// --- Configuration (loaded from storage, with defaults) ---
/* global getSiteAdapter */
const siteAdapter = getSiteAdapter();

let config = {
  defaultDelayMs: 5000,
  imageThrottleCount: 5,
  imageThrottleDelayMs: 120000,
  enableSleepIndicator: true,
  enableFloatingProgress: true,
  controlPanelPosition: null, // Will store {x, y} position
};

// --- State Variables ---
let currentChain = null;
let isChainRunning = false;
let isPaused = false;
let currentCommandIndex = 0;
let totalCommandsInSequence = 0;
let imageCommandCounter = 0;
let isCommandExecuting = false; // Track if a command is currently being executed
let isWaitingForResponse = false; // Track if we're waiting for ChatGPT response
let isImageThrottleActive = false; // Track if image throttle is currently active
let imageThrottleStartTime = 0; // When the image throttle started
let imageThrottleEndTime = 0; // When the image throttle will end

// --- State Persistence Variables ---
let currentChatId = null; // Current chat ID extracted from URL
let chatStates = {}; // Store state per chat ID
let lastSubmittedPrompt = null; // Store the last prompt for retry functionality

// --- DOM Elements for UI ---
let sleepIndicatorElement = null;
let sleepIndicatorMessageElement = null;
let sleepIndicatorCountdownElement = null;
let sleepCountdownInterval = null;
let sleepEndTime = 0; // Used for pausable sleep countdown

let controlPanelElement = null;
let progressStatusElement = null;
let pendingCommandsListElement = null;
let pauseResumeButton = null;
let stopButton = null;
let navContainer = null;
// Document Picture-in-Picture window and monitor
let pipWindow = null;
let pipMonitorInterval = null;

// --- Default settings (used if storage is not available or first run) ---
const C_DEFAULT_SETTINGS = {
  separator: "~",
  defaultDelayMs: 5000,
  imageThrottleCount: 5,
  imageThrottleDelayMs: 120000,
  enableSleepIndicator: true,
  enableFloatingProgress: true,
  controlPanelPosition: null,
};

// --- Load Configuration from Storage ---
function loadConfig() {
  chrome.storage.sync.get("extensionSettings", (data) => {
    if (chrome.runtime.lastError) {
      console.error("Failed to load configuration:", chrome.runtime.lastError);
      config = { ...C_DEFAULT_SETTINGS };
      return;
    }

    if (data.extensionSettings) {
      config = { ...C_DEFAULT_SETTINGS, ...data.extensionSettings };
      console.log("Configuration loaded from storage:", config);
    } else {
      config = { ...C_DEFAULT_SETTINGS };
      console.log("Using default configuration:", config);
      // Optionally save defaults to storage if they don't exist
      chrome.storage.sync.set({ extensionSettings: config }, (result) => {
        if (chrome.runtime.lastError) {
          console.error(
            "Failed to save default settings:",
            chrome.runtime.lastError
          );
        }
      });
    }
    // Update UI elements based on loaded config (e.g., create/destroy if toggled)
    if (isChainRunning) {
      // If a chain is running, update its visual elements
      if (config.enableFloatingProgress) createControlPanel();
      else destroyControlPanel();
      if (config.enableSleepIndicator) createSleepIndicator();
      else destroySleepIndicator();
    }
  });
}

// --- UI Creation and Management ---

function createSleepIndicator() {
  if (!config.enableSleepIndicator) return;
  if (document.getElementById("ext-sleep-indicator")) return;

  sleepIndicatorElement = document.createElement("div");
  sleepIndicatorElement.id = "ext-sleep-indicator";
  // ... (styling as before, ensure z-index is high)
  sleepIndicatorElement.style.cssText = `
        position: fixed; top: 40%; left: 50%; transform: translate(-50%, -50%);
        background-color: #1976d2; color: white; padding: 20px 25px;
        border-radius: 12px; z-index: 20001; text-align: center;
        font-family: 'Roboto', Arial, sans-serif; display: none; box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;
  sleepIndicatorMessageElement = document.createElement("p");
  sleepIndicatorMessageElement.style.margin = "0 0 10px 0";
  sleepIndicatorMessageElement.style.fontSize = "18px";

  sleepIndicatorCountdownElement = document.createElement("p");
  sleepIndicatorCountdownElement.style.margin = "0";
  sleepIndicatorCountdownElement.style.fontSize = "16px";

  sleepIndicatorElement.appendChild(sleepIndicatorMessageElement);
  sleepIndicatorElement.appendChild(sleepIndicatorCountdownElement);
  document.body.appendChild(sleepIndicatorElement);
}

function destroySleepIndicator() {
  if (sleepIndicatorElement) {
    sleepIndicatorElement.remove();
    sleepIndicatorElement = null;
    if (sleepCountdownInterval) clearInterval(sleepCountdownInterval);
    sleepCountdownInterval = null;
  }
}

function showSleepIndicator(message, durationMs) {
  if (!config.enableSleepIndicator || !sleepIndicatorElement) {
    if (config.enableSleepIndicator && !sleepIndicatorElement)
      createSleepIndicator(); // Try to create if missing
    if (!sleepIndicatorElement) return; // Still missing, so exit
  }

  let displayDuration = durationMs;
  if (isPaused && sleepEndTime > Date.now()) {
    displayDuration = sleepEndTime - Date.now();
    sleepIndicatorMessageElement.textContent = `💤 Paused during: ${message
      .replace("💤", "")
      .trim()}`;
  } else if (!isPaused) {
    sleepEndTime = Date.now() + durationMs;
    sleepIndicatorMessageElement.textContent = `💤 ${message}`;
  } else {
    // Paused, but not during an active sleep (e.g. paused while waiting for API)
    sleepIndicatorMessageElement.textContent = `💤 Sequence Paused`;
    sleepIndicatorCountdownElement.textContent = `(Resume to continue)`;
    sleepIndicatorElement.style.display = "block";
    return;
  }

  if (sleepCountdownInterval) clearInterval(sleepCountdownInterval);

  function updateCountdown() {
    let remaining;
    if (isPaused) {
      remaining = Math.max(0, sleepEndTime - Date.now());
      sleepIndicatorCountdownElement.textContent = `(Paused at ${String(
        Math.floor(remaining / 60000)
      ).padStart(2, "0")}:${String(
        Math.floor((remaining % 60000) / 1000)
      ).padStart(2, "0")})`;
      return; // Don't countdown further if paused
    }

    remaining = Math.max(0, sleepEndTime - Date.now());
    const seconds = Math.floor((remaining / 1000) % 60);
    const minutes = Math.floor((remaining / (1000 * 60)) % 60);
    sleepIndicatorCountdownElement.textContent = `(Next command in ${String(
      minutes
    ).padStart(2, "0")}:${String(seconds).padStart(2, "0")})`;

    if (remaining === 0) {
      clearInterval(sleepCountdownInterval);
      // hideSleepIndicator() will be called by the main loop usually
    }
  }
  updateCountdown();
  sleepCountdownInterval = setInterval(updateCountdown, 1000);
  sleepIndicatorElement.style.display = "block";
}

function hideSleepIndicator() {
  if (sleepCountdownInterval) clearInterval(sleepCountdownInterval);
  sleepCountdownInterval = null;
  if (sleepIndicatorElement) {
    sleepIndicatorElement.style.display = "none";
  }
}

function createControlPanel() {
  if (!config.enableFloatingProgress) return;
  if (document.getElementById("ext-control-panel")) return;

  // Calculate initial position - higher on smaller screens to avoid text area
  const screenHeight = window.innerHeight;
  const screenWidth = window.innerWidth;
  let initialTop, initialLeft;

  if (config.controlPanelPosition) {
    // Use saved position
    initialTop = config.controlPanelPosition.y;
    initialLeft = config.controlPanelPosition.x;
  } else {
    // Default position - higher on smaller screens
    if (screenHeight < 700) {
      initialTop = 20; // Higher on small screens
    } else {
      initialTop = screenHeight - 200; // Lower on larger screens
    }
    initialLeft = screenWidth - 300;
  }

  controlPanelElement = document.createElement("div");
  controlPanelElement.id = "ext-control-panel";
  controlPanelElement.style.cssText = `
        position: fixed; top: ${initialTop}px; left: ${initialLeft}px;
        background-color: rgba(255, 255, 255, 0.95); color: #333; padding: 15px;
        border-radius: 10px; z-index: 20000; font-family: 'Roboto', Arial, sans-serif;
        font-size: 14px; display: none; width: 280px; box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        cursor: move; user-select: none;
    `;

  // Make the panel draggable
  let isDragging = false;
  let startX, startY, startLeft, startTop;

  controlPanelElement.addEventListener("mousedown", (e) => {
    // Only start dragging if clicking on the panel itself, not buttons
    if (
      e.target.tagName === "BUTTON" ||
      e.target.tagName === "UL" ||
      e.target.tagName === "LI"
    ) {
      return;
    }

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startLeft = parseInt(controlPanelElement.style.left);
    startTop = parseInt(controlPanelElement.style.top);

    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    const newLeft = startLeft + e.clientX - startX;
    const newTop = startTop + e.clientY - startY;

    // Keep panel within viewport bounds
    const maxLeft = window.innerWidth - controlPanelElement.offsetWidth;
    const maxTop = window.innerHeight - controlPanelElement.offsetHeight;

    const constrainedLeft = Math.max(0, Math.min(newLeft, maxLeft));
    const constrainedTop = Math.max(0, Math.min(newTop, maxTop));

    controlPanelElement.style.left = constrainedLeft + "px";
    controlPanelElement.style.top = constrainedTop + "px";
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      // Save position to config
      const newPosition = {
        x: parseInt(controlPanelElement.style.left),
        y: parseInt(controlPanelElement.style.top),
      };
      config.controlPanelPosition = newPosition;
      // Save to storage
      chrome.storage.sync.set(
        {
          extensionSettings: { ...config },
        },
        (result) => {
          if (chrome.runtime.lastError) {
            console.error(
              "Failed to save control panel position:",
              chrome.runtime.lastError
            );
          }
        }
      );

      isDragging = false;
    }
  });
  progressStatusElement = document.createElement("div");
  progressStatusElement.id = "ext-progress-status";
  progressStatusElement.style.marginBottom = "8px";
  progressStatusElement.style.fontWeight = "bold";

  // Add progress bar
  const progressBarContainer = document.createElement("div");
  progressBarContainer.style.cssText = `
    background-color: #e0e0e0;
    border-radius: 10px;
    height: 6px;
    margin-bottom: 10px;
    overflow: hidden;
  `;

  const progressBar = document.createElement("div");
  progressBar.id = "ext-progress-bar";
  progressBar.style.cssText = `
    height: 100%;
    width: 0%;
    background-color: #1976d2;
    transition: width 0.3s ease;
    border-radius: 10px;
  `;

  progressBarContainer.appendChild(progressBar);
  pendingCommandsListElement = document.createElement("ul");
  pendingCommandsListElement.id = "ext-pending-commands";
  pendingCommandsListElement.style.cssText = `
        list-style: none; padding: 0; margin: 0 0 10px 0; max-height: 150px; 
        overflow-y: auto; font-size: 12px; background-color: rgba(0,0,0,0.2); 
        border-radius: 5px; padding: 5px;
    `;
  const buttonContainer = document.createElement("div");
  buttonContainer.style.display = "flex";
  buttonContainer.style.gap = "10px";
  buttonContainer.style.marginBottom = "10px";

  const pipButton = document.createElement("button");
  pipButton.id = "ext-pip-button";
  pipButton.textContent = "⧉";
  pipButton.title = "Toggle Picture-in-Picture";
  pipButton.style.cssText =
    "padding: 6px 8px; background-color: #1976d2; color: white; border:none; border-radius:5px; cursor:pointer; flex-grow: 0; box-shadow: 0 1px 2px rgba(0,0,0,0.2);";
  pipButton.onclick = () => togglePiP();

  pauseResumeButton = document.createElement("button");
  pauseResumeButton.id = "ext-pause-resume-button";
  pauseResumeButton.textContent = "Pause";
  pauseResumeButton.style.cssText = `padding: 8px 10px; background-color: #ffc107; color: black; border:none; border-radius:5px; cursor:pointer; flex-grow: 1; box-shadow: 0 1px 2px rgba(0,0,0,0.2);`;
  pauseResumeButton.onclick = () => {
    if (isPaused) resumeSequence();
    else pauseSequence();
  };

  stopButton = document.createElement("button");
  stopButton.id = "ext-stop-button";
  stopButton.textContent = "Stop";
  stopButton.style.cssText = `padding: 8px 10px; background-color: #d32f2f; color: white; border:none; border-radius:5px; cursor:pointer; flex-grow: 1; box-shadow: 0 1px 2px rgba(0,0,0,0.2);`;
  stopButton.onclick = stopSequence; // Navigation buttons for when paused
  navContainer = document.createElement("div");
  navContainer.id = "ext-nav-container";
  navContainer.style.cssText = `display: none; gap: 5px; margin-bottom: 10px;`;

  const backButton = document.createElement("button");
  backButton.id = "ext-back-button";
  backButton.textContent = "← Back";
  backButton.style.cssText = `padding: 6px 8px; background-color: #9e9e9e; color: white; border:none; border-radius:5px; cursor:pointer; flex-grow: 1; font-size: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.2);`;
  backButton.onclick = () => {
    if (isPaused && currentCommandIndex > 0) {
      currentCommandIndex--;
      updateControlPanel();
      saveChatState(); // Save state when navigating
    }
  };

  const forwardButton = document.createElement("button");
  forwardButton.id = "ext-forward-button";
  forwardButton.textContent = "Forward →";
  forwardButton.style.cssText = `padding: 6px 8px; background-color: #9e9e9e; color: white; border:none; border-radius:5px; cursor:pointer; flex-grow: 1; font-size: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.2);`;
  forwardButton.onclick = () => {
    if (isPaused && currentCommandIndex < totalCommandsInSequence - 1) {
      currentCommandIndex++;
      updateControlPanel();
      saveChatState(); // Save state when navigating
    }
  };
  navContainer.appendChild(backButton);
  navContainer.appendChild(forwardButton);
  buttonContainer.appendChild(pauseResumeButton);
  buttonContainer.appendChild(stopButton);
  buttonContainer.appendChild(pipButton);

  // Quick wait insertion controls (shown when paused or running)
  const quickWaitContainer = document.createElement("div");
  quickWaitContainer.id = "ext-quick-wait-container";
  quickWaitContainer.style.cssText = `margin-bottom: 8px; display: none;`;

  const quickWaitLabel = document.createElement("div");
  quickWaitLabel.textContent = "Insert Wait:";
  quickWaitLabel.style.cssText = `font-size: 11px; color: #555; margin-bottom: 4px; font-weight: bold;`;

  const quickWaitButtons = document.createElement("div");
  quickWaitButtons.style.cssText = `display: flex; gap: 4px;`;

  const waitDurations = [
    { label: "30s", ms: 30000 },
    { label: "1m", ms: 60000 },
    { label: "2m", ms: 120000 },
    { label: "5m", ms: 300000 },
  ];

  waitDurations.forEach((duration) => {
    const waitBtn = document.createElement("button");
    waitBtn.textContent = duration.label;
    waitBtn.style.cssText = `padding: 4px 8px; background-color: #1976d2; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px; flex-grow: 1; box-shadow: 0 1px 2px rgba(0,0,0,0.2);`;
    waitBtn.onclick = () => insertQuickWait(duration.ms);
    quickWaitButtons.appendChild(waitBtn);
  });

  quickWaitContainer.appendChild(quickWaitLabel);
  quickWaitContainer.appendChild(quickWaitButtons);

  // Image throttle skip controls (shown when image throttle is active)
  const imageThrottleContainer = document.createElement("div");
  imageThrottleContainer.id = "ext-image-throttle-container";
  imageThrottleContainer.style.cssText = `margin-bottom: 8px; display: none; background: #fff3cd; padding: 6px; border-radius: 4px; border: 1px solid #ffeaa7;`;

  const imageThrottleStatus = document.createElement("div");
  imageThrottleStatus.id = "ext-image-throttle-status";
  imageThrottleStatus.style.cssText = `font-size: 11px; color: #856404; margin-bottom: 4px; font-weight: bold;`;

  const skipImageThrottleBtn = document.createElement("button");
  skipImageThrottleBtn.id = "ext-skip-image-throttle";
  skipImageThrottleBtn.textContent = "Skip Image Wait";
  skipImageThrottleBtn.style.cssText = `padding: 4px 8px; background-color: #1976d2; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px; width: 100%; box-shadow: 0 1px 2px rgba(0,0,0,0.2);`;
  skipImageThrottleBtn.onclick = skipImageThrottle;

  imageThrottleContainer.appendChild(imageThrottleStatus);
  imageThrottleContainer.appendChild(skipImageThrottleBtn);

  controlPanelElement.appendChild(progressStatusElement);
  controlPanelElement.appendChild(progressBarContainer);
  controlPanelElement.appendChild(navContainer);
  controlPanelElement.appendChild(quickWaitContainer);
  controlPanelElement.appendChild(imageThrottleContainer);
  controlPanelElement.appendChild(pendingCommandsListElement);
  controlPanelElement.appendChild(buttonContainer);
  document.body.appendChild(controlPanelElement);
  ensureControlPanelInView();
}

function ensureControlPanelInView() {
  if (!controlPanelElement) return;
  const margin = 20;
  const rect = controlPanelElement.getBoundingClientRect();
  let newLeft = rect.left;
  let newTop = rect.top;

  if (rect.right > window.innerWidth - margin) {
    newLeft = window.innerWidth - controlPanelElement.offsetWidth - margin;
  }
  if (rect.bottom > window.innerHeight - margin) {
    newTop = window.innerHeight - controlPanelElement.offsetHeight - margin;
  }
  if (rect.left < margin) newLeft = margin;
  if (rect.top < margin) newTop = margin;

  if (newLeft !== rect.left || newTop !== rect.top) {
    controlPanelElement.style.left = `${newLeft}px`;
    controlPanelElement.style.top = `${newTop}px`;
    config.controlPanelPosition = { x: newLeft, y: newTop };
    chrome.storage.sync.set({ extensionSettings: { ...config } });
  }
}

window.addEventListener("resize", ensureControlPanelInView);

function destroyControlPanel() {
  if (controlPanelElement) {
    controlPanelElement.remove();
    controlPanelElement = null;
    progressStatusElement = null;
    pendingCommandsListElement = null;
    pauseResumeButton = null;
    stopButton = null;
    navContainer = null;
  }
}

// Insert a quick wait at the current position
async function insertQuickWait(durationMs) {
  if (!isChainRunning) return;

  console.log(`Inserting ${durationMs}ms wait at current position`);

  // If we're currently executing a command or waiting for response, show a message
  if (isCommandExecuting || isWaitingForResponse) {
    console.log(
      "Command in progress, quick wait will be inserted after current command completes"
    );
    showSleepIndicator(
      `Quick wait (${durationMs / 1000}s) queued after current command`,
      2000
    );

    // Store the pending wait to be applied after current command
    setTimeout(async () => {
      if (isChainRunning && !isCommandExecuting && !isWaitingForResponse) {
        const waitMsg = `Quick wait (${durationMs / 1000}s)`;
        const wasAlreadyPaused = isPaused;

        if (!isPaused) {
          await pauseSequence();
        }

        await sleep(durationMs, waitMsg);

        if (!wasAlreadyPaused && isPaused) {
          await resumeSequence();
        }
      }
    }, 500); // Check again in 500ms
    return;
  }

  // Apply the wait immediately
  const waitMsg = `Quick wait (${durationMs / 1000}s)`;
  const wasAlreadyPaused = isPaused;

  if (!isPaused) {
    await pauseSequence();
  }

  await sleep(durationMs, waitMsg);

  if (!wasAlreadyPaused && isPaused) {
    // Auto-resume if we paused it ourselves
    await resumeSequence();
  }
}

// Skip the current image throttle
function skipImageThrottle() {
  if (isImageThrottleActive) {
    console.log("Skipping image throttle");
    isImageThrottleActive = false;
    imageThrottleEndTime = 0;
    hideSleepIndicator();
    updateControlPanel();

    // If we're not paused, continue processing
    if (!isPaused && !isCommandExecuting && !isWaitingForResponse) {
      processNextCommand();
    }
  }
}

function updateControlPanel() {
  if (!config.enableFloatingProgress || !controlPanelElement) {
    if (config.enableFloatingProgress && !controlPanelElement)
      createControlPanel();
    if (!controlPanelElement) return;
  }
  let statusText = `Step ${
    currentCommandIndex + 1
  } of ${totalCommandsInSequence}`;
  let statusColor = "#007bff";

  if (isPaused) {
    statusText += " • ⏸️ PAUSED";
    statusColor = "#dc3545";
  } else if (isWaitingForResponse) {
    statusText += " • ⏳ Waiting for ChatGPT...";
    statusColor = "#6f42c1";
  } else if (isCommandExecuting) {
    statusText += " • 📤 Submitting command...";
    statusColor = "#fd7e14";
  } else if (isChainRunning) {
    statusText += " • ▶️ Running";
    statusColor = "#28a745";
  }

  progressStatusElement.innerHTML = `<span style="color: ${statusColor}; font-weight: bold;">${statusText}</span>`;

  // Add completion percentage
  const percentage =
    totalCommandsInSequence > 0
      ? Math.round((currentCommandIndex / totalCommandsInSequence) * 100)
      : 0;
  const progressBar = document.getElementById("ext-progress-bar");
  if (progressBar) {
    progressBar.style.width = `${percentage}%`;
    progressBar.style.backgroundColor = statusColor;
  }

  // Show/hide navigation buttons based on pause state
  const backButton = document.getElementById("ext-back-button");
  const forwardButton = document.getElementById("ext-forward-button");

  if (navContainer) {
    navContainer.style.display = isPaused ? "flex" : "none";

    if (isPaused && backButton && forwardButton) {
      // Update button states
      backButton.disabled = currentCommandIndex <= 0;
      forwardButton.disabled =
        currentCommandIndex >= totalCommandsInSequence - 1;
      backButton.style.opacity = backButton.disabled ? "0.5" : "1";
      forwardButton.style.opacity = forwardButton.disabled ? "0.5" : "1";
    }
  }
  pendingCommandsListElement.innerHTML = "";
  if (currentChain) {
    // Show completed commands (max 2 most recent)
    const completedStart = Math.max(0, currentCommandIndex - 2);
    const completed = currentChain.slice(completedStart, currentCommandIndex);
    completed.forEach((cmd, idx) => {
      const li = document.createElement("li");
      const { command: cleanCmd, isPauseCommand } = parseCommand(cmd);
      const actualIndex = completedStart + idx + 1;
      const displayText =
        isPauseCommand && cleanCmd.trim() === ""
          ? `${actualIndex}. [PAUSE COMMAND]`
          : `${actualIndex}. ${cleanCmd.substring(0, 40)}${
              cleanCmd.length > 40 ? "..." : ""
            }`;
      li.innerHTML = `<span style="color: #28a745;">✅</span> <span style="text-decoration: line-through; color: #6c757d;">${displayText}</span>`;
      li.style.fontSize = "12px";
      li.style.marginBottom = "4px";
      pendingCommandsListElement.appendChild(li);
    }); // Show current executing command
    if (currentCommandIndex < totalCommandsInSequence) {
      const currentCmd = currentChain[currentCommandIndex];
      const li = document.createElement("li");
      const { command: cleanCmd, isPauseCommand } = parseCommand(currentCmd);

      let statusIcon = "▶️";
      let statusText = "CURRENT";
      let statusColor = "#007bff";

      if (isPauseCommand) {
        statusIcon = "⏸️";
        statusText = "PAUSE COMMAND";
        statusColor = "#ffc107";
      } else if (isCommandExecuting) {
        statusIcon = "📤";
        statusText = "SUBMITTING";
        statusColor = "#fd7e14";
      } else if (isWaitingForResponse) {
        statusIcon = "⏳";
        statusText = "WAITING FOR RESPONSE";
        statusColor = "#6f42c1";
      } else if (isPaused) {
        statusIcon = "⏸️";
        statusText = "PAUSED";
        statusColor = "#dc3545";
      }

      const displayText =
        isPauseCommand && cleanCmd.trim() === ""
          ? `${currentCommandIndex + 1}. [PAUSE COMMAND]`
          : `${currentCommandIndex + 1}. ${cleanCmd.substring(0, 50)}${
              cleanCmd.length > 50 ? "..." : ""
            }`;

      li.innerHTML = `
        <div style="background: ${statusColor}15; border-left: 4px solid ${statusColor}; padding: 8px; margin: 4px 0; border-radius: 4px;">
          <div style="color: ${statusColor}; font-weight: bold; font-size: 11px; margin-bottom: 2px;">
            ${statusIcon} ${statusText}
          </div>
          <div style="font-weight: bold; color: #333;">
            ${displayText}
          </div>
        </div>
      `;
      pendingCommandsListElement.appendChild(li);
    }

    // Show upcoming commands (next 4)
    const upcoming = currentChain.slice(
      currentCommandIndex + 1,
      currentCommandIndex + 5
    );
    upcoming.forEach((cmd, idx) => {
      const li = document.createElement("li");
      const { command: cleanCmd, isPauseCommand } = parseCommand(cmd);
      const actualIndex = currentCommandIndex + idx + 2;

      const displayText =
        isPauseCommand && cleanCmd.trim() === ""
          ? `${actualIndex}. [PAUSE COMMAND]`
          : `${actualIndex}. ${cleanCmd.substring(0, 45)}${
              cleanCmd.length > 45 ? "..." : ""
            }`;

      if (idx === 0) {
        // Next command - highlight it
        li.innerHTML = `
          <div style="background: #f8f9fa; border-left: 4px solid #17a2b8; padding: 6px; margin: 4px 0; border-radius: 4px;">
            <div style="color: #17a2b8; font-weight: bold; font-size: 11px; margin-bottom: 2px;">
              ⏭️ NEXT
            </div>
            <div style="font-weight: 600; color: #333;">
              ${displayText}
            </div>
          </div>
        `;
      } else {
        // Future commands
        const shorterDisplayText =
          isPauseCommand && cleanCmd.trim() === ""
            ? `${actualIndex}. [PAUSE COMMAND]`
            : `${actualIndex}. ${cleanCmd.substring(0, 35)}${
                cleanCmd.length > 35 ? "..." : ""
              }`;
        li.innerHTML = `<span style="color: #6c757d;">⏸</span> <span style="color: #6c757d;">${shorterDisplayText}</span>`;
        li.style.fontSize = "12px";
        li.style.marginBottom = "2px";
      }

      pendingCommandsListElement.appendChild(li);
    });

    // Show if there are more commands beyond what's displayed
    const remainingCount = totalCommandsInSequence - (currentCommandIndex + 5);
    if (remainingCount > 0) {
      const li = document.createElement("li");
      li.innerHTML = `<span style="color: #6c757d; font-style: italic;">... and ${remainingCount} more command${
        remainingCount !== 1 ? "s" : ""
      }</span>`;
      li.style.fontSize = "11px";
      li.style.marginTop = "8px";
      pendingCommandsListElement.appendChild(li);
    }

    // Handle edge cases
    if (currentCommandIndex >= totalCommandsInSequence && isChainRunning) {
      const li = document.createElement("li");
      li.innerHTML = `
        <div style="background: #28a74515; border-left: 4px solid #28a745; padding: 8px; margin: 4px 0; border-radius: 4px;">
          <div style="color: #28a745; font-weight: bold; font-size: 11px;">
            🏁 FINISHING
          </div>
          <div style="color: #333;">Completing final command...</div>
        </div>
      `;
      pendingCommandsListElement.appendChild(li);
    } else if (!isChainRunning && totalCommandsInSequence === 0) {
      const li = document.createElement("li");
      li.innerHTML = `<span style="color: #6c757d; font-style: italic;">No commands in queue</span>`;
      li.style.fontSize = "12px";
      pendingCommandsListElement.appendChild(li);
    }
  }

  pauseResumeButton.textContent = isPaused ? "Resume" : "Pause";
  // Show/hide quick wait controls
  const quickWaitContainer = document.getElementById(
    "ext-quick-wait-container"
  );
  if (quickWaitContainer) {
    // Show quick wait controls when chain is running (paused or active)
    quickWaitContainer.style.display = isChainRunning ? "block" : "none";
  }
  // Show/hide image throttle skip controls
  const imageThrottleContainer = document.getElementById(
    "ext-image-throttle-container"
  );
  const imageThrottleStatus = document.getElementById(
    "ext-image-throttle-status"
  );
  if (imageThrottleContainer && imageThrottleStatus) {
    if (isImageThrottleActive) {
      const remainingTime = Math.max(0, imageThrottleEndTime - Date.now());
      const remainingSeconds = Math.ceil(remainingTime / 1000);

      if (remainingTime > 0) {
        imageThrottleStatus.textContent = `🖼️ Image throttle: ${remainingSeconds}s remaining`;
        imageThrottleContainer.style.display = "block";

        // Schedule next update if still active
        setTimeout(() => {
          if (isImageThrottleActive) {
            updateControlPanel();
          }
        }, 1000);
      } else {
        // Time expired, clear throttle state
        isImageThrottleActive = false;
        imageThrottleEndTime = 0;
        imageThrottleContainer.style.display = "none";
      }
    } else {
      imageThrottleContainer.style.display = "none";
    }
  }

  controlPanelElement.style.display = isChainRunning ? "block" : "none";
}

// --- Core Logic ---

async function sleep(durationMs, sleepMessage) {
  if (durationMs <= 0) return;
  console.log(`Sleeping for ${durationMs}ms: ${sleepMessage}`);
  showSleepIndicator(sleepMessage, durationMs);

  // This promise structure allows the sleep to be "interrupted" by isPaused
  // because processNextCommand will not proceed if isPaused is true.
  // The actual waiting happens via setTimeout.
  return new Promise((resolve) => {
    let waitTimeout = setTimeout(() => {
      // If paused, the main loop will handle it. This timeout just finishes.
      if (!isPaused) {
        // Only resolve if not paused.
        hideSleepIndicator();
        resolve();
      }
      // If paused, the resolution will effectively be delayed until resumed and sleep completes.
    }, durationMs);

    // If paused during sleep, the sleepIndicator handles the visual pause.
    // The main processNextCommand loop will re-evaluate when resumed.
  });
}

function isResponseComplete() {
  // Check if the "Regenerate" button or a similar element indicating completion is visible,
  // and that the send button is enabled.
  const speechButton = document.querySelector(
    siteAdapter.speechButtonSelector
  );
  // const sendButton = document.querySelector('button[aria-label="Send prompt"][data-testid="send-button"]');
  return speechButton != null; // && (sendButton && !sendButton.disabled);
}

async function submitPrompt(prompt) {
  const textarea = document.querySelector(siteAdapter.textareaSelector);
  if (!textarea) {
    console.error(`Textarea ${siteAdapter.textareaSelector} not found. Stopping sequence.`);
    await stopSequence();
    throw new Error("Textarea not found");
  }

  textarea.value = prompt;
  textarea.textContent = prompt;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.dispatchEvent(new Event("change", { bubbles: true })); // Good practice

  // Store the last submitted prompt for retry functionality
  lastSubmittedPrompt = prompt;

  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 1500; // Wait up to 5 minutes (1500 * 200ms)
    const tryClick = setInterval(async () => {
      if (isPaused) {
        // Don't attempt to click if paused
        console.log("Submit attempt paused.");
        return;
      }

      const button = document.querySelector(siteAdapter.sendButtonSelector);

      // Detect if ChatGPT is still generating a prior response
      const chatgptBusy = !isResponseComplete();

      if (button && !button.disabled) {
        clearInterval(tryClick);
        button.click();
        console.log("Prompt submitted:", prompt.substring(0, 50) + "...");
        resolve();
      } else if (chatgptBusy) {
        // Another response is in progress; wait until ChatGPT is ready
        if (attempts % 10 === 0) {
          console.log(
            "Waiting for ChatGPT to finish current response before submitting..."
          );
        }
        return; // Don't increment attempts while waiting
      } else if (attempts >= maxAttempts) {
        // Check for retry button before giving up
        const retryButton = document.querySelector(siteAdapter.retryButtonSelector);
        if (retryButton) {
          console.log(
            "Send button timeout, but retry button found. Clicking retry..."
          );
          clearInterval(tryClick);
          retryButton.click();

          // Wait a bit and try to submit again
          setTimeout(() => {
            const newButton = document.querySelector(siteAdapter.sendButtonSelector);
            if (newButton && !newButton.disabled) {
              newButton.click();
              console.log(
                "Prompt resubmitted after retry:",
                prompt.substring(0, 50) + "..."
              );
              resolve();
            } else {
              console.error("Failed to submit prompt even after retry.");
              stopSequence();
              reject(new Error("Send button timeout after retry"));
            }
          }, 1000);
        } else {
          clearInterval(tryClick);
          console.error(
            "Failed to submit prompt: Send button not available/enabled after max attempts and no retry button found. Stopping sequence."
          );
          await stopSequence();
          reject(new Error("Send button timeout or not found"));
        }
      } else if (!button && attempts > 5) {
        // If button disappears after initial checks, look for retry button
        const retryButton = document.querySelector(
          siteAdapter.retryButtonSelector
        );
        if (retryButton) {
          console.log(
            "Send button disappeared, but retry button found. Clicking retry..."
          );
          clearInterval(tryClick);
          retryButton.click();

          // Wait a bit and try to submit again
          setTimeout(() => {
            const newButton = document.querySelector(
              siteAdapter.sendButtonSelector
            );
            if (newButton && !newButton.disabled) {
              newButton.click();
              console.log(
                "Prompt resubmitted after retry:",
                prompt.substring(0, 50) + "..."
              );
              resolve();
            } else {
              console.error("Failed to submit prompt even after retry.");
              stopSequence();
              reject(new Error("Send button disappeared and retry failed"));
            }
          }, 1000);
        } else {
          clearInterval(tryClick);
          console.error(
            "Failed to submit prompt: Send button disappeared and no retry button found. Stopping sequence."
          );
          await stopSequence();
          reject(new Error("Send button disappeared"));
        }
      }
      attempts++;
    }, 200);
  });
}


async function processNextCommand() {
  if (isPaused) {
    console.log("Sequence is paused. Waiting for resume...");
    updateControlPanel(); // Reflect paused state
    if (
      sleepIndicatorElement &&
      sleepIndicatorElement.style.display === "block"
    ) {
      // If a sleep was active, ensure its countdown reflects pause
      showSleepIndicator(
        sleepIndicatorMessageElement.textContent.replace("💤", "").trim(),
        sleepEndTime - Date.now()
      );
    }
    return;
  }

  // If we're already executing a command or waiting for response, don't start another
  if (isCommandExecuting || isWaitingForResponse) {
    console.log("Command already in progress, skipping duplicate execution");
    return;
  }

  if (!isChainRunning || currentCommandIndex >= totalCommandsInSequence) {
    console.log("Command chain finished or stopped.");
    await stopSequence(); // Ensure clean stop
    return;
  }

  updateControlPanel();
  const rawPrompt = currentChain[currentCommandIndex];
  const { command, explicitDelayMs, isPauseCommand } = parseCommand(rawPrompt);

  // Handle pause command
  if (isPauseCommand) {
    console.log(`Pause command encountered at step ${currentCommandIndex + 1}`);

    // If there's a command text with the pause, execute it first
    if (command.trim().length > 0) {
      console.log(
        `Executing command before pause: "${command.substring(0, 50)}..."`
      );

      isCommandExecuting = true;

      try {
        await submitPrompt(command);
        isCommandExecuting = false;
        isWaitingForResponse = true;

        // Wait for ChatGPT response
        await new Promise((resolve) => {
          const checkInterval = setInterval(async () => {
            if (isPaused) {
              console.log("Paused while waiting for ChatGPT response.");
              updateControlPanel();
              return;
            }
            if (isResponseComplete()) {
              clearInterval(checkInterval);
              isWaitingForResponse = false;
              console.log(
                `ChatGPT response complete for: "${command.substring(
                  0,
                  50
                )}..."`
              );
              resolve();
            }
          }, 100);
        });
      } catch (error) {
        console.error(
          "Error submitting prompt before pause, sequence stopped:",
          error
        );
        isCommandExecuting = false;
        isWaitingForResponse = false;
        return;
      }
    }
    // Move to next command index after executing the command (if any)
    currentCommandIndex++;

    // Now pause the sequence
    isPaused = true;
    console.log("Sequence automatically paused due to $pause$ command.");
    saveChatState(); // Save state after pause command
    updateControlPanel();

    return; // Stop execution here until manually resumed
  }

  console.log(
    `Executing command ${
      currentCommandIndex + 1
    }/${totalCommandsInSequence}: "${command.substring(0, 50)}..."`
  );

  isCommandExecuting = true; // Mark command as executing

  try {
    await submitPrompt(command);
    isCommandExecuting = false; // Command submitted successfully
    isWaitingForResponse = true; // Now waiting for response
  } catch (error) {
    console.error("Error submitting prompt, sequence stopped:", error);
    isCommandExecuting = false;
    isWaitingForResponse = false;
    // stopSequence() is called within submitPrompt on failure
    return;
  }

  // Wait for ChatGPT to complete its response
  await new Promise((resolve) => {
    const checkInterval = setInterval(async () => {
      if (isPaused) {
        console.log("Paused while waiting for ChatGPT response.");
        // Don't clear interval; it will resume checking when unpaused.
        // Update UI to show it's waiting but paused.
        updateControlPanel();
        return;
      }
      if (isResponseComplete()) {
        clearInterval(checkInterval);
        isWaitingForResponse = false; // Response received
        console.log(
          `ChatGPT response complete for: "${command.substring(0, 50)}..."`
        ); // Increment command index *after* successful execution and before delays for *this* command
        currentCommandIndex++;
        saveChatState(); // Save state after command completion
        updateControlPanel(); // Reflect that one more command is done
        // 1. Image Generation Throttling
        if (command.toLowerCase().includes("create image")) {
          imageCommandCounter++;
          console.log(`Image command count: ${imageCommandCounter}`);
          if (
            imageCommandCounter > 0 &&
            imageCommandCounter % config.imageThrottleCount === 0
          ) {
            // Set image throttle state
            isImageThrottleActive = true;
            imageThrottleStartTime = Date.now();
            imageThrottleEndTime =
              imageThrottleStartTime + config.imageThrottleDelayMs;

            const throttleMsg = `Image generation throttle (${
              config.imageThrottleDelayMs / 1000
            }s pause)`;

            updateControlPanel(); // Show image throttle controls

            await sleep(config.imageThrottleDelayMs, throttleMsg);

            // Clear image throttle state after sleep completes
            isImageThrottleActive = false;
            imageThrottleEndTime = 0;
            updateControlPanel(); // Hide image throttle controls

            if (isPaused) {
              resolve();
              return;
            } // Check pause after sleep
          }
        }

        // 2. Handle Inter-Command Delay (Explicit or Default)
        // This delay applies *after* the current command (and its potential throttle)
        // and *before* the next one, IF there is a next one.
        if (currentCommandIndex < totalCommandsInSequence) {
          let delayToApplyMs =
            explicitDelayMs > 0 ? explicitDelayMs : config.defaultDelayMs;
          if (delayToApplyMs > 0) {
            const delayMsg = `Delaying for ${delayToApplyMs / 1000}s`;
            await sleep(
              delayToApplyMs,
              delayMsg + (explicitDelayMs > 0 ? " (explicit)" : " (default)")
            );
            if (isPaused) {
              resolve();
              return;
            } // Check pause after sleep
          }
        } else {
          console.log("Last command in sequence processed.");
        }
        resolve();
      }
    }, 100);
  });

  if (isPaused) {
    // Final check before looping
    console.log("Sequence paused before processing next command.");
    updateControlPanel();
    return;
  }
  processNextCommand(); // Recursively call for the next command
}

// --- Control Functions ---
async function pauseSequence() {
  if (isChainRunning && !isPaused) {
    isPaused = true;
    console.log("Sequence paused.");
    saveChatState(); // Save state when paused
    if (sleepCountdownInterval) {
      // If a sleep was active, ensure its visual countdown pauses
      // The showSleepIndicator logic will handle the text update
      showSleepIndicator(
        sleepIndicatorMessageElement.textContent.replace("💤", "").trim(),
        sleepEndTime - Date.now()
      );
    }
    updateControlPanel();
  }
}

async function resumeSequence() {
  if (isChainRunning && isPaused) {
    isPaused = false;
    console.log("Sequence resumed.");
    saveChatState(); // Save state when resumed
    updateControlPanel();

    // Check if there's an active image throttle that needs to be honored
    if (isImageThrottleActive) {
      const remainingTime = Math.max(0, imageThrottleEndTime - Date.now());
      if (remainingTime > 0) {
        console.log(
          `Resuming with ${remainingTime}ms remaining on image throttle`
        );
        const throttleMsg = `Image throttle resuming (${Math.ceil(
          remainingTime / 1000
        )}s remaining)`;
        await sleep(remainingTime, throttleMsg);

        // Clear throttle state after completion
        isImageThrottleActive = false;
        imageThrottleEndTime = 0;
        updateControlPanel();

        // Check if paused again during the throttle wait
        if (isPaused) {
          return;
        }
      } else {
        // Throttle time has already passed, clear the state
        isImageThrottleActive = false;
        imageThrottleEndTime = 0;
        updateControlPanel();
      }
    }

    // If a sleep was active, its visual countdown will resume via its own interval logic.
    // Only kick off the processing loop if we're not already waiting for a response
    if (!isWaitingForResponse && !isCommandExecuting && !isPaused) {
      processNextCommand();
    }
  }
}

async function stopSequence() {
  console.log("Stopping sequence...");
  isChainRunning = false;
  isPaused = false;
  isCommandExecuting = false; // Reset execution state
  isWaitingForResponse = false; // Reset waiting state
  isImageThrottleActive = false; // Clear image throttle state
  imageThrottleEndTime = 0;
  // Preserve chain state for potential resume
  if (currentChatId) {
    const state = {
      chain: currentChain,
      isRunning: false,
      isPaused: false,
      currentIndex: currentCommandIndex,
      totalCommands: totalCommandsInSequence,
      imageCounter: imageCommandCounter,
      timestamp: Date.now(),
    };
    chatStates[currentChatId] = state;
    localStorage.setItem("chatgpt-chain-states", JSON.stringify(chatStates));
    console.log(`Saved stop state for chat ${currentChatId}:`, state);
  }

  currentChain = null;

  // currentCommandIndex = 0; // Keep currentCommandIndex to show final progress if needed, or reset
  // totalCommandsInSequence = 0;
  imageCommandCounter = 0;

  hideSleepIndicator();
  if (controlPanelElement) controlPanelElement.style.display = "none"; // Hide immediately
  // Or update it to show "Stopped"
  if (config.enableFloatingProgress && controlPanelElement) {
    progressStatusElement.textContent = `Sequence Stopped at ${currentCommandIndex} / ${totalCommandsInSequence}`;
    pendingCommandsListElement.innerHTML = "<li>Sequence stopped.</li>";
    pauseResumeButton.textContent = "Pause"; // Reset button
    pauseResumeButton.disabled = true;
    stopButton.disabled = true;
    // Keep panel visible for a moment or hide after timeout? For now, let it stay with "Stopped"
  }

  console.log("Sequence has been stopped.");
}

// --- State Persistence Functions ---

// Extract chat ID from current URL
function getCurrentChatId() {
  const url = window.location.href;
  const chatMatch = url.match(/\/c\/([a-f0-9-]+)/);
  return chatMatch ? chatMatch[1] : null;
}

// Save current state to localStorage for this chat
function saveChatState() {
  if (!currentChatId) return;

  const prev = chatStates[currentChatId] || {};
  const state = {
    ...prev,
    chain: currentChain,
    isRunning: isChainRunning,
    isPaused: isPaused,
    currentIndex: currentCommandIndex,
    totalCommands: totalCommandsInSequence,
    imageCounter: imageCommandCounter,
    timestamp: Date.now(),
  };

  chatStates[currentChatId] = state;
  localStorage.setItem("chatgpt-chain-states", JSON.stringify(chatStates));
  console.log(`Saved state for chat ${currentChatId}:`, state);
}

// Load state from localStorage for current chat
function loadChatState() {
  const stored = localStorage.getItem("chatgpt-chain-states");
  if (stored) {
    chatStates = JSON.parse(stored);
  }

  if (!currentChatId || !chatStates[currentChatId]) return null;

  const state = chatStates[currentChatId];
  console.log(`Loading state for chat ${currentChatId}:`, state);
  return state;
}

// Get all submitted user prompts from the current chat
function getSubmittedPrompts() {
  const userMessages = document.querySelectorAll(
    siteAdapter.userMessageSelector
  );
  return Array.from(userMessages).map((msg) => msg.textContent.trim());
}

// Find the current position in chain based on submitted prompts
function findChainPosition(chain, submittedPrompts) {
  if (!chain || !submittedPrompts || submittedPrompts.length === 0) {
    return 0;
  }

  // Start from the last submitted prompt and work backwards
  for (let i = submittedPrompts.length - 1; i >= 0; i--) {
    const submittedPrompt = submittedPrompts[i];

    // Check each command in the chain to see if it matches
    for (let j = 0; j < chain.length; j++) {
      const { command } = parseCommand(chain[j]);

      // Check if the submitted prompt matches this command (allowing for minor differences)
      if (
        command.trim() &&
        submittedPrompt.includes(command.trim().substring(0, 50))
      ) {
        console.log(
          `Found matching command at position ${j}: "${command.substring(
            0,
            50
          )}..."`
        );
        return j + 1; // Return the next position to execute
      }
    }
  }

  return 0; // Start from beginning if no matches found
}

// Restore state for current chat if available
function restoreStateIfAvailable() {
  currentChatId = getCurrentChatId();
  if (!currentChatId) return;

  const state = loadChatState();
  if (!state || !state.isRunning) return;

  // Check if the state is recent (within last 24 hours)
  const hoursSinceLastUpdate =
    (Date.now() - state.timestamp) / (1000 * 60 * 60);
  if (hoursSinceLastUpdate > 24) {
    console.log("State is too old, not restoring");
    return;
  }

  // Get submitted prompts to verify current position
  const submittedPrompts = getSubmittedPrompts();
  const actualPosition = findChainPosition(state.chain, submittedPrompts);

  // Only restore if we haven't completed the chain
  if (actualPosition < state.chain.length) {
    currentChain = state.chain;
    isChainRunning = state.isRunning;
    isPaused = state.isPaused;
    currentCommandIndex = actualPosition;
    totalCommandsInSequence = state.chain.length;
    imageCommandCounter = state.imageCounter;

    console.log(
      `Restored state: position ${actualPosition}/${totalCommandsInSequence}, paused: ${isPaused}`
    );

    // Show control panel if chain is active
    if (config.enableFloatingProgress) {
      createControlPanel();
      updateControlPanel();
    }

    // Resume if not paused
    if (!isPaused) {
      processNextCommand();
    }
  } else {
    console.log("Chain appears to be completed, not restoring");
  }
}

// --- Message Listener ---
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "ping") {
    sendResponse({ status: "ready" });
    return true;
  } else if (request.action === "usePrompt") {
    if (isChainRunning) {
      console.warn("A command chain is already running.");
      sendResponse({
        status: "busy",
        message: "Chain already in progress. Stop it or wait.",
      });
      return true;
    }

    // Ensure UI elements are ready based on current config
    if (config.enableFloatingProgress) createControlPanel();
    else destroyControlPanel();
    if (config.enableSleepIndicator) createSleepIndicator();
    else destroySleepIndicator();

    let separator =
      request.separator || config.separator || C_DEFAULT_SETTINGS.separator; // Use config separator
    if (separator.toLowerCase() === "\\n" || separator === "\n") {
      currentChain = request.prompt
        .split(/\n+/)
        .map((p) => p.trim())
        .filter((p) => p);
    } else {
      currentChain = request.prompt
        .split(separator)
        .map((p) => p.trim())
        .filter((p) => p);
    }
    if (currentChain && currentChain.length > 0) {
      isChainRunning = true;
      isPaused = false;

      // Handle start position
      const startPosition = request.startPosition || 0;
      currentCommandIndex = Math.max(
        0,
        Math.min(startPosition, currentChain.length - 1)
      );

      totalCommandsInSequence = currentChain.length;
      imageCommandCounter = 0;

      // Update chat ID and save initial state
      currentChatId = getCurrentChatId();
      if (currentChatId) {
        saveChatState();
      }

      if (pauseResumeButton) pauseResumeButton.disabled = false;
      if (stopButton) stopButton.disabled = false;

      const startInfo =
        currentCommandIndex > 0
          ? ` (starting from step ${currentCommandIndex + 1})`
          : "";
      console.log(
        `Starting new chain with ${totalCommandsInSequence} commands${startInfo}.`
      );
      updateControlPanel(); // Show and update panel

      processNextCommand(); // Start the chain

      const remainingCommands = totalCommandsInSequence - currentCommandIndex;
      sendResponse({
        status: "started",
        message: `${remainingCommands} commands remaining`,
      });
    } else {
      sendResponse({
        status: "error",
        message: "Prompt chain is empty or invalid.",
      });
    }
    return true;
  } else if (request.action === "togglePip") {
    togglePiP().then((status) => sendResponse({ status }));
    return true;
  } else if (request.action === "getState") {
    currentChatId = getCurrentChatId();
    const state = loadChatState();
    sendResponse({ state });
    return true;
  } else if (request.action === "showProgress") {
    if (config.enableFloatingProgress) {
      createControlPanel();
      updateControlPanel();
      if (controlPanelElement) controlPanelElement.style.display = "block";
      sendResponse({ status: "shown" });
    } else {
      sendResponse({ status: "disabled" });
    }
    return true;
  } else if (request.action === "updateConfig") {
    console.log("Received config update from popup:", request.newConfig);
    config = { ...config, ...request.newConfig };
    // Apply visual changes immediately if toggled
    if (config.enableFloatingProgress) createControlPanel();
    else destroyControlPanel();
    if (config.enableSleepIndicator) createSleepIndicator();
    else destroySleepIndicator();
    if (isChainRunning) updateControlPanel(); // Refresh panel if running

    sendResponse({ status: "config updated in content script" });
    return true;
  }
});

// --- Initial Setup ---
loadConfig(); // Load config when script initially loads
// Initial creation of UI elements will happen if enabled in config,
// or when a chain starts, or when config is updated.

// --- State Restoration ---
// Wait for user messages to load before attempting state restore
function attemptRestoreState(retries = 10) {
  const userMsgs = document.querySelectorAll(siteAdapter.userMessageSelector);
  if (userMsgs.length > 0 || retries <= 0) {
    restoreStateIfAvailable();
  } else {
    setTimeout(() => attemptRestoreState(retries - 1), 1000);
  }
}

// Start initial state restoration attempt
attemptRestoreState();


// Monitor URL changes to update chat ID and save state
let lastUrl = window.location.href;
setInterval(() => {
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    console.log("URL changed, updating chat ID");
    const newChatId = getCurrentChatId();

    // If chat ID changed and we have an active chain, save state to old ID and update to new ID
    if (currentChatId !== newChatId) {
      if (currentChatId && isChainRunning) {
        saveChatState(); // Save state to old chat ID
      }
      currentChatId = newChatId;
      if (currentChatId && isChainRunning) {
        saveChatState(); // Save state to new chat ID
      }
    }

    lastUrl = currentUrl;
  }
}, 1000);

console.log("ChatGPT Chain Extension content script v2 loaded.");

// Retry the last submitted prompt (useful for error recovery)
async function retryLastPrompt() {
  if (!lastSubmittedPrompt) {
    console.log("No prompt to retry");
    return;
  }

  console.log(
    "Retrying last prompt:",
    lastSubmittedPrompt.substring(0, 50) + "..."
  );

  // Look for retry button first
  const retryButton = document.querySelector(
    siteAdapter.retryButtonSelector
  );
  if (retryButton) {
    retryButton.click();
    console.log("Clicked retry button");

    // Wait a moment for the page to reset
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Submit the last prompt again
  try {
    await submitPrompt(lastSubmittedPrompt);
  } catch (error) {
    console.error("Failed to retry last prompt:", error);
    throw error;
  }
}

// --- Picture-in-Picture Support ---
function savePipWindowState() {
  if (!pipWindow || pipWindow.closed || !currentChatId) return;
  const state = chatStates[currentChatId] || {};
  state.pipWidth = pipWindow.outerWidth;
  state.pipHeight = pipWindow.outerHeight;
  state.pipLeft = pipWindow.screenX;
  state.pipTop = pipWindow.screenY;
  chatStates[currentChatId] = state;
  localStorage.setItem("chatgpt-chain-states", JSON.stringify(chatStates));
}

async function togglePiP() {
  if (!("documentPictureInPicture" in window)) {
    console.warn("Document Picture-in-Picture not supported");
    return "PIP not supported";
  }

  if (pipWindow && !pipWindow.closed) {
    savePipWindowState();
    pipWindow.close();
    clearInterval(pipMonitorInterval);
    pipMonitorInterval = null;
    pipWindow = null;
    return "PIP closed";
  }

  currentChatId = getCurrentChatId();
  const saved = chatStates[currentChatId] || {};
  try {
    pipWindow = await documentPictureInPicture.requestWindow({
      width: saved.pipWidth || 600,
      height: saved.pipHeight || 400,
    });
  } catch (e) {
    console.error("Failed to open PIP window", e);
    return "Failed to open PIP";
  }

  pipWindow.document.documentElement.style.cssText =
    "width:100%;height:100%;margin:0;padding:0;overflow:hidden";
  pipWindow.document.body.style.cssText =
    "margin:0;padding:0;width:100%;height:100%;overflow:hidden";
  const iframe = pipWindow.document.createElement("iframe");
  iframe.src = window.location.href;
  iframe.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;border:none;";
  pipWindow.document.body.appendChild(iframe);

  if (saved.pipLeft !== undefined && saved.pipTop !== undefined) {
    try {
      pipWindow.moveTo(saved.pipLeft, saved.pipTop);
    } catch (e) {
      // moveTo may fail in some browsers
    }
  }

  pipWindow.addEventListener("resize", savePipWindowState);
  pipWindow.addEventListener("pagehide", () => {
    savePipWindowState();
    pipWindow = null;
    if (pipMonitorInterval) clearInterval(pipMonitorInterval);
    pipMonitorInterval = null;
  });
  pipMonitorInterval = setInterval(savePipWindowState, 1000);
  savePipWindowState();
  return "PIP opened";
}
