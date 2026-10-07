use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Rect {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreemapNode {
    pub id: String,
    pub label: String,
    pub value: u64,
    pub rect: Rect,
}

pub struct SquarifiedTreemap;

impl SquarifiedTreemap {
    /// Solves squarified treemap layout using Bruls-Huizing-van Wijk algorithm
    pub fn layout(items: &[(String, String, u64)], bounds: Rect) -> Vec<TreemapNode> {
        if items.is_empty() || bounds.w <= 0.0 || bounds.h <= 0.0 {
            return Vec::new();
        }

        let total_val: u64 = items.iter().map(|(_, _, v)| *v).sum();
        if total_val == 0 {
            return Vec::new();
        }

        // Normalize values to bounding rectangle area
        let area = bounds.w * bounds.h;
        let mut normalized: Vec<(String, String, u64, f32)> = items
            .iter()
            .map(|(id, label, val)| {
                let norm_area = (*val as f32 / total_val as f32) * area;
                (id.clone(), label.clone(), *val, norm_area)
            })
            .collect();

        // Sort descending by normalized area
        normalized.sort_by(|a, b| b.3.partial_cmp(&a.3).unwrap_or(std::cmp::Ordering::Equal));

        let mut results = Vec::new();
        let mut current_bounds = bounds;

        let mut row: Vec<(String, String, u64, f32)> = Vec::new();

        for item in normalized {
            if row.is_empty() {
                row.push(item);
            } else {
                let mut test_row = row.clone();
                test_row.push(item.clone());

                if Self::worst_aspect_ratio(&test_row, Self::shortest_side(&current_bounds))
                    <= Self::worst_aspect_ratio(&row, Self::shortest_side(&current_bounds))
                {
                    row.push(item);
                } else {
                    current_bounds = Self::layout_row(&row, current_bounds, &mut results);
                    row.clear();
                    row.push(item);
                }
            }
        }

        if !row.is_empty() {
            Self::layout_row(&row, current_bounds, &mut results);
        }

        results
    }

    fn shortest_side(rect: &Rect) -> f32 {
        rect.w.min(rect.h)
    }

    fn worst_aspect_ratio(row: &[(String, String, u64, f32)], side_length: f32) -> f32 {
        if side_length <= 0.0 {
            return f32::MAX;
        }

        let sum_area: f32 = row.iter().map(|item| item.3).sum();
        if sum_area <= 0.0 {
            return f32::MAX;
        }

        let mut max_aspect: f32 = 0.0;
        for item in row {
            let area = item.3;
            if area > 0.0 {
                let len = area / (sum_area / side_length);
                let w = sum_area / side_length;
                let aspect = (len / w).max(w / len);
                if aspect > max_aspect {
                    max_aspect = aspect;
                }
            }
        }
        max_aspect
    }

    fn layout_row(
        row: &[(String, String, u64, f32)],
        bounds: Rect,
        results: &mut Vec<TreemapNode>,
    ) -> Rect {
        let sum_area: f32 = row.iter().map(|item| item.3).sum();
        if sum_area <= 0.0 {
            return bounds;
        }

        let is_horizontal = bounds.w >= bounds.h;
        let side_length = if is_horizontal { bounds.h } else { bounds.w };
        let strip_thickness = sum_area / side_length;

        let mut current_offset = 0.0;

        for (id, label, val, area) in row {
            let item_length = area / strip_thickness;
            let rect = if is_horizontal {
                Rect {
                    x: bounds.x,
                    y: bounds.y + current_offset,
                    w: strip_thickness,
                    h: item_length,
                }
            } else {
                Rect {
                    x: bounds.x + current_offset,
                    y: bounds.y,
                    w: item_length,
                    h: strip_thickness,
                }
            };

            current_offset += item_length;
            results.push(TreemapNode {
                id: id.clone(),
                label: label.clone(),
                value: *val,
                rect,
            });
        }

        if is_horizontal {
            Rect {
                x: bounds.x + strip_thickness,
                y: bounds.y,
                w: bounds.w - strip_thickness,
                h: bounds.h,
            }
        } else {
            Rect {
                x: bounds.x,
                y: bounds.y + strip_thickness,
                w: bounds.w,
                h: bounds.h - strip_thickness,
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_squarified_treemap_layout() {
        let items = vec![
            ("1".to_string(), "Brave".to_string(), 6000),
            ("2".to_string(), "Antigravity".to_string(), 3000),
            ("3".to_string(), "Docker".to_string(), 1000),
        ];

        let bounds = Rect {
            x: 0.0,
            y: 0.0,
            w: 1000.0,
            h: 500.0,
        };

        let nodes = SquarifiedTreemap::layout(&items, bounds);
        assert_eq!(nodes.len(), 3);

        // Check total area matches bounds
        let total_tile_area: f32 = nodes.iter().map(|n| n.rect.w * n.rect.h).sum();
        let expected_area = bounds.w * bounds.h;
        assert!((total_tile_area - expected_area).abs() < 1.0);
    }
}

