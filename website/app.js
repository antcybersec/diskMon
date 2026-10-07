// diskMon Web Treemap Simulator & Interactive UI Logic

document.addEventListener('DOMContentLoaded', () => {
  // Sample System Telemetry Data
  const sampleWorkloads = [
    {
      id: 'daemons',
      name: 'macOS System Daemons',
      category: 'SystemDaemon',
      class: 'tile-system',
      physRamMb: 2780,
      cpuPct: 3.2,
      pssMb: 2400,
      pids: [
        { pid: 1, name: 'launchd', physMb: 42.0 },
        { pid: 184, name: 'WindowServer', physMb: 850.0 },
        { pid: 320, name: 'kernelmanagerd', physMb: 120.0 },
        { pid: 412, name: 'syspolicyd', physMb: 88.0 },
        { pid: 501, name: 'mds_stores', physMb: 420.0 },
        { pid: 610, name: 'coreaudiod', physMb: 64.0 },
      ]
    },
    {
      id: 'brave',
      name: 'Brave Browser',
      category: 'Browser',
      class: 'tile-browser',
      physRamMb: 2240,
      cpuPct: 8.5,
      pssMb: 1980,
      pids: [
        { pid: 7120, name: 'Brave Browser (Main)', physMb: 450.0 },
        { pid: 7124, name: 'Brave Helper (GPU)', physMb: 380.0 },
        { pid: 7129, name: 'Brave Helper (Renderer 1)', physMb: 310.0 },
        { pid: 7132, name: 'Brave Helper (Renderer 2)', physMb: 290.0 },
        { pid: 7140, name: 'Brave Helper (Renderer 3)', physMb: 240.0 },
        { pid: 7145, name: 'Brave Helper (Network)', physMb: 180.0 },
      ]
    },
    {
      id: 'antigravity',
      name: 'Antigravity IDE',
      category: 'Ide',
      class: 'tile-ide',
      physRamMb: 1480,
      cpuPct: 14.2,
      pssMb: 1350,
      pids: [
        { pid: 14201, name: 'Antigravity Main Process', physMb: 520.0 },
        { pid: 14215, name: 'gopls (Go Language Server)', physMb: 380.0 },
        { pid: 14220, name: 'tsserver (TypeScript Server)', physMb: 240.0 },
        { pid: 14228, name: 'mcp-server (Stitch MCP Helper)', physMb: 180.0 },
        { pid: 14234, name: 'extensionHost', physMb: 160.0 },
      ]
    },
    {
      id: 'docker',
      name: 'Docker Container Runtime',
      category: 'ContainerRuntime',
      class: 'tile-container',
      physRamMb: 1120,
      cpuPct: 4.1,
      pssMb: 1050,
      pids: [
        { pid: 22100, name: 'com.docker.backend', physMb: 680.0 },
        { pid: 22105, name: 'vpnkit', physMb: 240.0 },
        { pid: 22110, name: 'docker-index', physMb: 200.0 },
      ]
    },
    {
      id: 'ollama',
      name: 'Ollama Local LLM (Llama 3)',
      category: 'LocalLlm',
      class: 'tile-llm',
      physRamMb: 920,
      cpuPct: 22.8,
      pssMb: 900,
      pids: [
        { pid: 31050, name: 'ollama_llama3_runner', physMb: 850.0 },
        { pid: 31052, name: 'ollama_daemon', physMb: 70.0 },
      ]
    },
    {
      id: 'chrome',
      name: 'Google Chrome',
      category: 'Browser',
      class: 'tile-app',
      physRamMb: 340,
      cpuPct: 1.2,
      pssMb: 310,
      pids: [
        { pid: 8812, name: 'Google Chrome Helper', physMb: 340.0 },
      ]
    }
  ];

  let activeMetric = 'phys'; // 'phys', 'cpu', 'pss'
  let selectedWorkloadId = 'antigravity';
  const canvas = document.getElementById('treemapCanvas');

  // Squarified Treemap Algorithm Implementation in JS
  function solveTreemap(items, bounds) {
    if (!items.length || bounds.w <= 0 || bounds.h <= 0) return [];
    
    const totalVal = items.reduce((sum, item) => sum + item.value, 0);
    if (!totalVal) return [];

    const area = bounds.w * bounds.h;
    const sorted = items
      .map(item => ({ ...item, normArea: (item.value / totalVal) * area }))
      .sort((a, b) => b.normArea - a.normArea);

    const results = [];
    let currentBounds = { ...bounds };
    let row = [];

    for (const item of sorted) {
      if (!row.length) {
        row.push(item);
      } else {
        const testRow = [...row, item];
        const sideLen = Math.min(currentBounds.w, currentBounds.h);
        if (worstAspect(testRow, sideLen) <= worstAspect(row, sideLen)) {
          row.push(item);
        } else {
          currentBounds = layoutRow(row, currentBounds, results);
          row = [item];
        }
      }
    }
    if (row.length) {
      layoutRow(row, currentBounds, results);
    }
    return results;
  }

  function worstAspect(row, sideLen) {
    if (sideLen <= 0) return Infinity;
    const sumArea = row.reduce((sum, item) => sum + item.normArea, 0);
    if (sumArea <= 0) return Infinity;

    let maxAspect = 0;
    for (const item of row) {
      const len = item.normArea / (sumArea / sideLen);
      const w = sumArea / sideLen;
      const aspect = Math.max(len / w, w / len);
      if (aspect > maxAspect) maxAspect = aspect;
    }
    return maxAspect;
  }

  function layoutRow(row, bounds, results) {
    const sumArea = row.reduce((sum, item) => sum + item.normArea, 0);
    if (sumArea <= 0) return bounds;

    const isHorizontal = bounds.w >= bounds.h;
    const sideLen = isHorizontal ? bounds.h : bounds.w;
    const stripThickness = sumArea / sideLen;
    let offset = 0;

    for (const item of row) {
      const itemLen = item.normArea / stripThickness;
      const rect = isHorizontal
        ? { x: bounds.x, y: bounds.y + offset, w: stripThickness, h: itemLen }
        : { x: bounds.x + offset, y: bounds.y, w: itemLen, h: stripThickness };

      offset += itemLen;
      results.push({ ...item, rect });
    }

    return isHorizontal
      ? { x: bounds.x + stripThickness, y: bounds.y, w: bounds.w - stripThickness, h: bounds.h }
      : { x: bounds.x, y: bounds.y + stripThickness, w: bounds.w, h: bounds.h - stripThickness };
  }

  // Render Treemap Canvas
  function renderTreemap() {
    canvas.innerHTML = '';
    const rect = canvas.getBoundingClientRect();
    const bounds = { x: 0, y: 0, w: rect.width, h: rect.height };

    const items = sampleWorkloads.map(w => {
      let val = w.physRamMb;
      if (activeMetric === 'cpu') val = Math.round(w.cpuPct * 100);
      else if (activeMetric === 'pss') val = w.pssMb;
      return { id: w.id, label: w.name, value: val, raw: w };
    });

    const solvedNodes = solveTreemap(items, bounds);

    solvedNodes.forEach(node => {
      const tile = document.createElement('div');
      tile.className = `treemap-tile ${node.raw.class}`;
      tile.style.left = `${node.rect.x}px`;
      tile.style.top = `${node.rect.y}px`;
      tile.style.width = `${node.rect.w - 2}px`;
      tile.style.height = `${node.rect.h - 2}px`;

      let formattedVal = '';
      if (activeMetric === 'cpu') {
        formattedVal = `${node.raw.cpuPct}% CPU`;
      } else {
        const mb = node.raw.physRamMb;
        formattedVal = mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb} MB`;
      }

      tile.innerHTML = `
        <span class="tile-label">${node.label}</span>
        <span class="tile-val">${formattedVal}</span>
      `;

      tile.addEventListener('click', () => {
        selectedWorkloadId = node.id;
        updateSidebar(node.raw);
      });

      canvas.appendChild(tile);
    });

    // Auto-select initial workload
    const activeRaw = sampleWorkloads.find(w => w.id === selectedWorkloadId) || sampleWorkloads[0];
    updateSidebar(activeRaw);
  }

  // Update Detail Sidebar
  function updateSidebar(workload) {
    document.getElementById('selectedWorkloadTitle').textContent = workload.name;
    document.getElementById('selectedWorkloadCategory').textContent = workload.category;
    
    const ramGb = (workload.physRamMb / 1024).toFixed(2);
    document.getElementById('selectedPhysicalRam').textContent = `${ramGb} GB`;
    document.getElementById('selectedPidCount').textContent = workload.pids.length;

    const processList = document.getElementById('processList');
    processList.innerHTML = '';

    workload.pids.forEach(p => {
      const li = document.createElement('li');
      li.className = 'process-item';
      li.innerHTML = `
        <span>PID ${p.pid} — <strong>${p.name}</strong></span>
        <span>${p.physMb} MB</span>
      `;
      processList.appendChild(li);
    });
  }

  // Event Listeners for Metric Toggles
  const toggleBtns = document.querySelectorAll('.toggle-btn');
  toggleBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      toggleBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      activeMetric = e.target.dataset.metric;
      renderTreemap();
    });
  });

  // History Slider Handler
  const historySlider = document.getElementById('historySlider');
  const timeReadout = document.getElementById('timeReadout');
  historySlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    if (val === 60) {
      timeReadout.textContent = 'Live (Now)';
    } else {
      const minsAgo = 60 - val;
      timeReadout.textContent = `-${minsAgo}m ago`;
    }
  });

  // Initial Render & Window Resize Handling
  renderTreemap();
  window.addEventListener('resize', renderTreemap);
});
