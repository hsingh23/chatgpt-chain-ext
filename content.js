// --- Configuration (loaded from storage, with defaults) ---
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
        background-color: rgba(0,0,0,0.8); color: white; padding: 20px 25px;
        border-radius: 12px; z-index: 20001; text-align: center;
        font-family: Arial, sans-serif; display: none; box-shadow: 0 0 15px rgba(0,0,0,0.5);
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
        background-color: rgba(20, 20, 80, 0.85); color: white; padding: 15px;
        border-radius: 10px; z-index: 20000; font-family: Arial, sans-serif;
        font-size: 14px; display: none; width: 280px; box-shadow: 0 0 15px rgba(0,0,0,0.4);
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
    background-color: rgba(255,255,255,0.2); 
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
    background-color: #007bff; 
    transition: width 0.3s ease, background-color 0.3s ease;
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

  pauseResumeButton = document.createElement("button");
  pauseResumeButton.id = "ext-pause-resume-button";
  pauseResumeButton.textContent = "Pause";
  pauseResumeButton.style.cssText = `padding: 8px 10px; background-color: #ffc107; color: black; border:none; border-radius:5px; cursor:pointer; flex-grow: 1;`;
  pauseResumeButton.onclick = () => {
    if (isPaused) resumeSequence();
    else pauseSequence();
  };

  stopButton = document.createElement("button");
  stopButton.id = "ext-stop-button";
  stopButton.textContent = "Stop";
  stopButton.style.cssText = `padding: 8px 10px; background-color: #dc3545; color: white; border:none; border-radius:5px; cursor:pointer; flex-grow: 1;`;
  stopButton.onclick = stopSequence; // Navigation buttons for when paused
  navContainer = document.createElement("div");
  navContainer.id = "ext-nav-container";
  navContainer.style.cssText = `display: none; gap: 5px; margin-bottom: 10px;`;

  const backButton = document.createElement("button");
  backButton.id = "ext-back-button";
  backButton.textContent = "← Back";
  backButton.style.cssText = `padding: 6px 8px; background-color: #6c757d; color: white; border:none; border-radius:5px; cursor:pointer; flex-grow: 1; font-size: 12px;`;
  backButton.onclick = () => {
    if (isPaused && currentCommandIndex > 0) {
      currentCommandIndex--;
      updateControlPanel();
    }
  };

  const forwardButton = document.createElement("button");
  forwardButton.id = "ext-forward-button";
  forwardButton.textContent = "Forward →";
  forwardButton.style.cssText = `padding: 6px 8px; background-color: #6c757d; color: white; border:none; border-radius:5px; cursor:pointer; flex-grow: 1; font-size: 12px;`;
  forwardButton.onclick = () => {
    if (isPaused && currentCommandIndex < totalCommandsInSequence - 1) {
      currentCommandIndex++;
      updateControlPanel();
    }
  };

  navContainer.appendChild(backButton);
  navContainer.appendChild(forwardButton);
  buttonContainer.appendChild(pauseResumeButton);
  buttonContainer.appendChild(stopButton);
  controlPanelElement.appendChild(progressStatusElement);
  controlPanelElement.appendChild(progressBarContainer);
  controlPanelElement.appendChild(navContainer);
  controlPanelElement.appendChild(pendingCommandsListElement);
  controlPanelElement.appendChild(buttonContainer);
  document.body.appendChild(controlPanelElement);
}

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

function updateControlPanel() {
  if (!config.enableFloatingProgress || !controlPanelElement) {
    if (config.enableFloatingProgress && !controlPanelElement)
      createControlPanel();
    if (!controlPanelElement) return;
  }
  let statusText = `Step ${currentCommandIndex + 1} of ${totalCommandsInSequence}`;
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
  const percentage = totalCommandsInSequence > 0 ? Math.round((currentCommandIndex / totalCommandsInSequence) * 100) : 0;
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
      const { command: cleanCmd } = parseCommand(cmd);
      const actualIndex = completedStart + idx + 1;
      li.innerHTML = `<span style="color: #28a745;">✅</span> <span style="text-decoration: line-through; color: #6c757d;">${actualIndex}. ${cleanCmd.substring(0, 40)}${cleanCmd.length > 40 ? "..." : ""}</span>`;
      li.style.fontSize = "12px";
      li.style.marginBottom = "4px";
      pendingCommandsListElement.appendChild(li);
    });

    // Show current executing command
    if (currentCommandIndex < totalCommandsInSequence) {
      const currentCmd = currentChain[currentCommandIndex];
      const li = document.createElement("li");
      const { command: cleanCmd } = parseCommand(currentCmd);
      
      let statusIcon = "▶️";
      let statusText = "CURRENT";
      let statusColor = "#007bff";
      
      if (isCommandExecuting) {
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
      
      li.innerHTML = `
        <div style="background: ${statusColor}15; border-left: 4px solid ${statusColor}; padding: 8px; margin: 4px 0; border-radius: 4px;">
          <div style="color: ${statusColor}; font-weight: bold; font-size: 11px; margin-bottom: 2px;">
            ${statusIcon} ${statusText}
          </div>
          <div style="font-weight: bold; color: #333;">
            ${currentCommandIndex + 1}. ${cleanCmd.substring(0, 50)}${cleanCmd.length > 50 ? "..." : ""}
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
      const { command: cleanCmd } = parseCommand(cmd);
      const actualIndex = currentCommandIndex + idx + 2;
      
      if (idx === 0) {
        // Next command - highlight it
        li.innerHTML = `
          <div style="background: #f8f9fa; border-left: 4px solid #17a2b8; padding: 6px; margin: 4px 0; border-radius: 4px;">
            <div style="color: #17a2b8; font-weight: bold; font-size: 11px; margin-bottom: 2px;">
              ⏭️ NEXT
            </div>
            <div style="font-weight: 600; color: #333;">
              ${actualIndex}. ${cleanCmd.substring(0, 45)}${cleanCmd.length > 45 ? "..." : ""}
            </div>
          </div>
        `;
      } else {
        // Future commands
        li.innerHTML = `<span style="color: #6c757d;">⏸</span> <span style="color: #6c757d;">${actualIndex}. ${cleanCmd.substring(0, 35)}${cleanCmd.length > 35 ? "..." : ""}</span>`;
        li.style.fontSize = "12px";
        li.style.marginBottom = "2px";
      }
      
      pendingCommandsListElement.appendChild(li);
    });
    
    // Show if there are more commands beyond what's displayed
    const remainingCount = totalCommandsInSequence - (currentCommandIndex + 5);
    if (remainingCount > 0) {
      const li = document.createElement("li");
      li.innerHTML = `<span style="color: #6c757d; font-style: italic;">... and ${remainingCount} more command${remainingCount !== 1 ? 's' : ''}</span>`;
      li.style.fontSize = "11px";
      li.style.marginTop = "8px";
      pendingCommandsListElement.appendChild(li);
    }

    // Handle edge cases
    if (
      currentCommandIndex >= totalCommandsInSequence &&
      isChainRunning
    ) {
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
    'button[data-testid="composer-speech-button"]'
  );
  // const sendButton = document.querySelector('button[aria-label="Send prompt"][data-testid="send-button"]');
  return speechButton != null; // && (sendButton && !sendButton.disabled);
}

async function submitPrompt(prompt) {
  const textarea = document.querySelector("#prompt-textarea");
  if (!textarea) {
    console.error("Textarea #prompt-textarea not found. Stopping sequence.");
    await stopSequence();
    throw new Error("Textarea not found");
  }

  textarea.value = prompt;
  textarea.textContent = prompt;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.dispatchEvent(new Event("change", { bubbles: true })); // Good practice

  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 30; // Try for 6 seconds (30 * 200ms)
    const tryClick = setInterval(async () => {
      if (isPaused) {
        // Don't attempt to click if paused
        console.log("Submit attempt paused.");
        return;
      }
      const button = document.querySelector(
        'button[aria-label="Send prompt"][data-testid="send-button"]'
      );
      if (button && !button.disabled) {
        clearInterval(tryClick);
        button.click();
        console.log("Prompt submitted:", prompt.substring(0, 50) + "...");
        resolve();
      } else if (attempts >= maxAttempts) {
        clearInterval(tryClick);
        console.error(
          "Failed to submit prompt: Send button not available/enabled after max attempts. Stopping sequence."
        );
        await stopSequence();
        reject(new Error("Send button timeout or not found"));
      } else if (!button && attempts > 5) {
        // If button disappears after initial checks
        clearInterval(tryClick);
        console.error(
          "Failed to submit prompt: Send button disappeared. Stopping sequence."
        );
        await stopSequence();
        reject(new Error("Send button disappeared"));
      }
      attempts++;
    }, 200);
  });
}

function parseCommand(promptText) {
  const sleepTagRegex = /\$sleep(\d+)([sm])\$/i;
  let explicitDelayMs = 0;
  let command = promptText;
  const match = promptText.match(sleepTagRegex);

  if (match) {
    const duration = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    if (unit === "s") {
      explicitDelayMs = duration * 1000;
    } else if (unit === "m") {
      explicitDelayMs = duration * 60 * 1000;
    }
    command = promptText.replace(sleepTagRegex, "").trim();
  }
  return { command, explicitDelayMs };
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
  const { command, explicitDelayMs } = parseCommand(rawPrompt);

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
        );

        // Increment command index *after* successful execution and before delays for *this* command
        currentCommandIndex++;
        updateControlPanel(); // Reflect that one more command is done

        // 1. Image Generation Throttling
        if (command.toLowerCase().includes("create image")) {
          imageCommandCounter++;
          console.log(`Image command count: ${imageCommandCounter}`);
          if (
            imageCommandCounter > 0 &&
            imageCommandCounter % config.imageThrottleCount === 0
          ) {
            const throttleMsg = `Image generation throttle (${
              config.imageThrottleDelayMs / 1000
            }s pause)`;
            await sleep(config.imageThrottleDelayMs, throttleMsg);
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
    updateControlPanel();
    // If a sleep was active, its visual countdown will resume via its own interval logic.
    // Only kick off the processing loop if we're not already waiting for a response
    if (!isWaitingForResponse && !isCommandExecuting) {
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
      currentCommandIndex = Math.max(0, Math.min(startPosition, currentChain.length - 1));
      
      totalCommandsInSequence = currentChain.length;
      imageCommandCounter = 0;

      if (pauseResumeButton) pauseResumeButton.disabled = false;
      if (stopButton) stopButton.disabled = false;

      const startInfo = currentCommandIndex > 0 ? ` (starting from step ${currentCommandIndex + 1})` : '';
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

console.log("ChatGPT Chain Extension content script v2 loaded.");
