document.addEventListener("DOMContentLoaded", () => {
  const containerList = document.getElementById("container-list");
  const refreshButton = document.getElementById("refresh-button");
  const actionBanner = document.getElementById("action-banner");
  const loadingOverlay = document.getElementById("loading-overlay");

  if (!containerList || typeof cockpit === "undefined") return;

  function showBanner(message) {
    if (!actionBanner) return;
    actionBanner.textContent = message;
    actionBanner.style.display = "block";
    setTimeout(() => {
      actionBanner.style.display = "none";
    }, 5000);
  }

  function hideLoading() {
    if (loadingOverlay) {
      loadingOverlay.style.display = "none";
    }
  }

  function showError(message) {
    containerList.innerHTML = `<div class="error">${message}</div>`;
  }

  function runDockerCommand(container, action) {
    showBanner(`${action.charAt(0).toUpperCase() + action.slice(1)}ing ${container}...`);
    cockpit.spawn(["docker", action, container], { err: "message" })
      .then(() => loadContainers())
      .catch(() => showBanner(`? Failed to ${action} ${container}`));
  }

  window.runDockerCommand = runDockerCommand;

  function parsePorts(portText) {
    if (!portText) return "";
    const hostname = window.location.hostname;
    const seen = new Set();
    const matches = portText.match(/(?:[0-9.:\\[\\]]+)?:(\d+)->/g);
    if (!matches) return "";
    return matches.map(m => {
      const portMatch = m.match(/:(\d+)->/);
      if (!portMatch) return null;
      const hostPort = portMatch[1];
      if (seen.has(hostPort)) return null;
      seen.add(hostPort);
      return `<a href="http://${hostname}:${hostPort}" target="_blank">${hostPort}</a>`;
    }).filter(Boolean).join(" ");
  }

  function loadContainers(onDone) {
    containerList.innerHTML = `<div class="loading">Loading containers...</div>`;
    cockpit.spawn(["docker", "ps", "-a", "--format", "{{.Names}}\t{{.Status}}\t{{.Ports}}"], { err: "message" })
      .then(output => {
        const lines = output.trim().split("\n");
        if (!lines.length || !lines[0]) {
          containerList.innerHTML = `<div class="empty">No containers found.</div>`;
          onDone?.();
          return;
        }

        const cards = lines.map(line => {
          const [name, statusRaw = "", portsRaw = ""] = line.split("\t");
          const isRunning = statusRaw.toLowerCase().startsWith("up");
          const portsHTML = parsePorts(portsRaw);

          return `
            <div class="container-card ${isRunning ? "" : "stopped"}">
              <div class="container-info">
                <div class="container-name">${name}</div>
                <div class="container-status">${statusRaw}</div>
              </div>
              <div class="container-ports">${portsHTML}</div>
              <div class="container-actions">
                ${isRunning
                  ? `<button onclick="runDockerCommand('${name}', 'stop')">Stop</button>
                     <button onclick="runDockerCommand('${name}', 'restart')">Restart</button>`
                  : `<button onclick="runDockerCommand('${name}', 'start')">Start</button>`}
              </div>
            </div>
          `;
        });

        containerList.innerHTML = cards.join("");
      })
      .catch(() => {
        showError(`ERROR: Unable to access Docker!<br>
        Please ensure Docker is installed and that this user belongs to the <code>docker</code> group. <br>
        <br>
        ie; sudo usermod -aG docker $USER<br>
        Note: Remeber to log out and back in after`);
        })
      .finally(() => {
        onDone?.();
      });
  }

  function checkDockerAvailable() {
    return cockpit.spawn(["docker", "info"], { err: "message" });
  }

  function initApp() {
    checkDockerAvailable()
      .then(() => {
        loadContainers();
        setInterval(() => loadContainers(), 5 * 60 * 1000); // Refresh every 5 minutes 
      })
      .catch(() => {
        showError(`ERROR: Unable to access Docker!<br>
        Please ensure Docker is installed and that this user belongs to the <code>docker</code> group. <br>
        <br>
        ie; sudo usermod -aG docker $USER<br>
        Note: Remeber to log out and back in after`);
      })
      .finally(() => {
        hideLoading();
      });
  }

  refreshButton?.addEventListener("click", () => {
    refreshButton.disabled = true;
    refreshButton.textContent = "Refreshing...";
    refreshButton.style.opacity = 0.6;
    refreshButton.style.cursor = "not-allowed";

    loadContainers(() => {
      refreshButton.disabled = false;
      refreshButton.textContent = "Refresh";
      refreshButton.style.opacity = 1;
      refreshButton.style.cursor = "pointer";
    });
  });

  initApp();
});



(function(){
  const panel   = document.getElementById('terminal-panel');
  const btn     = document.getElementById('terminal-toggle-btn');
  const resizer = document.getElementById('terminal-resizer');
  const iframe  = document.getElementById('terminal-iframe');
  const docEl   = document.documentElement;   // for CSS var 

  /* helper: apply current panel height as page padding */
  function syncPadding(){
    const h = panel.classList.contains('open') ? panel.offsetHeight : 0;
    docEl.style.setProperty('--terminal-panel-height', h + 'px');
  }

  /* toggle open/close */
  let dragMoved = false; // Track drag vs click 

  btn.addEventListener('click', (e) => {
    if (dragMoved) {
      /* Ignore click if just dragged */
      dragMoved = false;
      return;
    }
    panel.classList.toggle('open');
    document.body.classList.toggle('with-terminal-padding',
                                    panel.classList.contains('open'));
    syncPadding();
  });

  /* drag‑resize */
  let dragging=false;
  resizer.addEventListener('mousedown', () => {
    dragging=true;
    document.body.style.userSelect='none';
    iframe.style.pointerEvents='none';
  });

  window.addEventListener('mousemove', e => {
    if(!dragging) return;
    const vh       = window.innerHeight;
    const newH     = vh - e.clientY;
    const clampedH = Math.max(vh*0.2, Math.min(vh*0.9, newH)); // 20-90 % 
    panel.style.height = clampedH + 'px';
    syncPadding();                                            // keep pad in sync 
  });

  window.addEventListener('mouseup', () => {
    if(dragging){
      dragging=false;
      document.body.style.userSelect='';
      iframe.style.pointerEvents='';
    }
  });

  /* Draggable Button (clamped & action-safe) */
  let btnDragging = false, offsetX = 0, offsetY = 0;

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  btn.addEventListener('mousedown', function(e) {
    if (e.button !== 0) return;
    btnDragging = true;
    dragMoved = false;
    btn.style.cursor = 'grabbing';
    btn.style.left = btn.getBoundingClientRect().left + "px";
    btn.style.top = btn.getBoundingClientRect().top + "px";
    btn.style.right = "";
    btn.style.bottom = "";
    btn.style.position = "fixed";
    offsetX = e.clientX - btn.getBoundingClientRect().left;
    offsetY = e.clientY - btn.getBoundingClientRect().top;
    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener('mousemove', function(e) {
    if (!btnDragging) return;
    dragMoved = true;
    /* Clamp to viewport */
    const btnW = btn.offsetWidth, btnH = btn.offsetHeight;
    const x = clamp(e.clientX - offsetX, 0, window.innerWidth - btnW);
    const y = clamp(e.clientY - offsetY, 0, window.innerHeight - btnH);
    btn.style.left = x + "px";
    btn.style.top = y + "px";
    btn.style.right = "";
    btn.style.bottom = "";
    btn.style.position = "fixed";
  });

  document.addEventListener('mouseup', function() {
    if (btnDragging) {
      btnDragging = false;
      btn.style.cursor = 'grab';
      /* If moved, flag so click is ignored */
      setTimeout(() => { dragMoved = false; }, 100);
    }
  });

  /* Touch support for mobile/tablet */
  btn.addEventListener('touchstart', function(e) {
    btnDragging = true;
    dragMoved = false;
    btn.style.cursor = 'grabbing';
    btn.style.left = btn.getBoundingClientRect().left + "px";
    btn.style.top = btn.getBoundingClientRect().top + "px";
    btn.style.right = "";
    btn.style.bottom = "";
    btn.style.position = "fixed";
    offsetX = e.touches[0].clientX - btn.getBoundingClientRect().left;
    offsetY = e.touches[0].clientY - btn.getBoundingClientRect().top;
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('touchmove', function(e) {
    if (!btnDragging) return;
    dragMoved = true;
    const btnW = btn.offsetWidth, btnH = btn.offsetHeight;
    const x = clamp(e.touches[0].clientX - offsetX, 0, window.innerWidth - btnW);
    const y = clamp(e.touches[0].clientY - offsetY, 0, window.innerHeight - btnH);
    btn.style.left = x + "px";
    btn.style.top = y + "px";
    btn.style.right = "";
    btn.style.bottom = "";
    btn.style.position = "fixed";
  }, { passive: false });

  document.addEventListener('touchend', function() {
    if (btnDragging) {
      btnDragging = false;
      btn.style.cursor = 'grab';
      setTimeout(() => { dragMoved = false; }, 100);
    }
  });
})();
