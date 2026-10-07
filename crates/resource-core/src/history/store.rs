use std::collections::{HashMap, VecDeque};
use std::time::SystemTime;
use serde::{Deserialize, Serialize};

use crate::model::{Pid, SystemSnapshot, WorkloadGroup};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkloadDelta {
    pub workload_id: String,
    pub workload_name: String,
    pub initial_bytes: u64,
    pub final_bytes: u64,
    pub byte_change: i64,
    pub pct_change: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceDelta {
    pub start_time: SystemTime,
    pub end_time: SystemTime,
    pub duration_secs: f64,
    pub memory_pressure_start: f32,
    pub memory_pressure_end: f32,
    pub workload_deltas: Vec<WorkloadDelta>,
    pub spawned_pids: Vec<Pid>,
    pub terminated_pids: Vec<Pid>,
}

pub struct HistoryStore {
    capacity: usize,
    snapshots: VecDeque<SystemSnapshot>,
}

impl HistoryStore {
    pub fn new(capacity: usize) -> Self {
        Self {
            capacity,
            snapshots: VecDeque::with_capacity(capacity),
        }
    }

    pub fn push(&mut self, snapshot: SystemSnapshot) {
        if self.snapshots.len() >= self.capacity {
            self.snapshots.pop_front();
        }
        self.snapshots.push_back(snapshot);
    }

    pub fn latest(&self) -> Option<&SystemSnapshot> {
        self.snapshots.back()
    }

    /// Snapshots from oldest to newest.
    pub fn snapshots(&self) -> impl DoubleEndedIterator<Item = &SystemSnapshot> + ExactSizeIterator {
        self.snapshots.iter()
    }

    pub fn len(&self) -> usize {
        self.snapshots.len()
    }

    pub fn is_empty(&self) -> bool {
        self.snapshots.is_empty()
    }

    /// Calculate resource consumption change between the oldest snapshot and latest snapshot (or custom index range)
    pub fn calculate_delta(&self) -> Option<ResourceDelta> {
        if self.snapshots.len() < 2 {
            return None;
        }

        let first = self.snapshots.front().unwrap();
        let last = self.snapshots.back().unwrap();

        let duration_secs = last
            .timestamp
            .duration_since(first.timestamp)
            .unwrap_or_default()
            .as_secs_f64();

        // Workload lookup maps
        let first_workloads: HashMap<&str, &WorkloadGroup> =
            first.workloads.iter().map(|w| (w.id.as_str(), w)).collect();
        let last_workloads: HashMap<&str, &WorkloadGroup> =
            last.workloads.iter().map(|w| (w.id.as_str(), w)).collect();

        let mut workload_deltas = Vec::new();

        for (id, last_w) in &last_workloads {
            let initial_bytes = first_workloads
                .get(id)
                .map(|w| w.aggregated_metrics.phys_footprint)
                .unwrap_or(0);

            let final_bytes = last_w.aggregated_metrics.phys_footprint;
            let byte_change = (final_bytes as i64) - (initial_bytes as i64);

            let pct_change = if initial_bytes > 0 {
                (byte_change as f32 / initial_bytes as f32) * 100.0
            } else if final_bytes > 0 {
                100.0
            } else {
                0.0
            };

            workload_deltas.push(WorkloadDelta {
                workload_id: (*id).to_string(),
                workload_name: last_w.name.clone(),
                initial_bytes,
                final_bytes,
                byte_change,
                pct_change,
            });
        }

        // Sort deltas by largest absolute byte change descending
        workload_deltas.sort_by(|a, b| b.byte_change.abs().cmp(&a.byte_change.abs()));

        // PIDs diff
        let first_pids: std::collections::HashSet<Pid> = first.processes.keys().copied().collect();
        let last_pids: std::collections::HashSet<Pid> = last.processes.keys().copied().collect();

        let spawned_pids = last_pids.difference(&first_pids).copied().collect();
        let terminated_pids = first_pids.difference(&last_pids).copied().collect();

        Some(ResourceDelta {
            start_time: first.timestamp,
            end_time: last.timestamp,
            duration_secs,
            memory_pressure_start: first.system_metrics.memory_pressure_pct,
            memory_pressure_end: last.system_metrics.memory_pressure_pct,
            workload_deltas,
            spawned_pids,
            terminated_pids,
        })
    }
}
