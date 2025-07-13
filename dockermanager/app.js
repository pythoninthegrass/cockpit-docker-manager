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
