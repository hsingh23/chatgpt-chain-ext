// --- Configuration (loaded from storage, with defaults) ---
let config = {
    defaultDelayMs: 5000,
    imageThrottleCount: 5,
    imageThrottleDelayMs: 120000,
    enableSleepIndicator: true,
    enableFloatingProgress: true // This now enables the control panel
};

// --- State Variables ---
let currentChain = null;
let isChainRunning = false;
let isPaused = false;
let currentCommandIndex = 0;
let totalCommandsInSequence = 0;
let imageCommandCounter = 0;

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

// --- Default settings (used if storage is not available or first run) ---
const C_DEFAULT_SETTINGS = {
    separator: '~',
    defaultDelayMs: 5000,
    imageThrottleCount: 5,
    imageThrottleDelayMs: 120000,
    enableSleepIndicator: true,
    enableFloatingProgress: true
};

// --- Load Configuration from Storage ---
function loadConfig() {
    chrome.storage.sync.get('extensionSettings', (data) => {
        if (data.extensionSettings) {
            config = { ...C_DEFAULT_SETTINGS, ...data.extensionSettings };
            console.log('Configuration loaded from storage:', config);
        } else {
            config = { ...C_DEFAULT_SETTINGS };
            console.log('Using default configuration:', config);
            // Optionally save defaults to storage if they don't exist
            chrome.storage.sync.set({ extensionSettings: config });
        }
        // Update UI elements based on loaded config (e.g., create/destroy if toggled)
        if (isChainRunning) { // If a chain is running, update its visual elements
             if (config.enableFloatingProgress) createControlPanel(); else destroyControlPanel();
             if (config.enableSleepIndicator) createSleepIndicator(); else destroySleepIndicator();
        }
    });
}


// --- UI Creation and Management ---

function createSleepIndicator() {
    if (!config.enableSleepIndicator) return;
    if (document.getElementById('ext-sleep-indicator')) return;

    sleepIndicatorElement = document.createElement('div');
    sleepIndicatorElement.id = 'ext-sleep-indicator';
    // ... (styling as before, ensure z-index is high)
    sleepIndicatorElement.style.cssText = `
        position: fixed; top: 40%; left: 50%; transform: translate(-50%, -50%);
        background-color: rgba(0,0,0,0.8); color: white; padding: 20px 25px;
        border-radius: 12px; z-index: 20001; text-align: center;
        font-family: Arial, sans-serif; display: none; box-shadow: 0 0 15px rgba(0,0,0,0.5);
    `;
    sleepIndicatorMessageElement = document.createElement('p');
    sleepIndicatorMessageElement.style.margin = '0 0 10px 0';
    sleepIndicatorMessageElement.style.fontSize = '18px';

    sleepIndicatorCountdownElement = document.createElement('p');
    sleepIndicatorCountdownElement.style.margin = '0';
    sleepIndicatorCountdownElement.style.fontSize = '16px';

    sleepIndicatorElement.appendChild(sleepIndicatorMessageElement);
    sleepIndicatorElement.appendChild(sleepIndicatorCountdownElement);
    document.body.appendChild(sleepIndicatorElement);
}

function destroySleepIndicator() {
    if (sleepIndicatorElement) {
        sleepIndicatorElement.remove();
        sleepIndicatorElement = null;
        if(sleepCountdownInterval) clearInterval(sleepCountdownInterval);
        sleepCountdownInterval = null;
    }
}

function showSleepIndicator(message, durationMs) {
    if (!config.enableSleepIndicator || !sleepIndicatorElement) {
        if (config.enableSleepIndicator && !sleepIndicatorElement) createSleepIndicator(); // Try to create if missing
        if (!sleepIndicatorElement) return; // Still missing, so exit
    }
    
    let displayDuration = durationMs;
    if (isPaused && sleepEndTime > Date.now()) {
        displayDuration = sleepEndTime - Date.now();
        sleepIndicatorMessageElement.textContent = `💤 Paused during: ${message.replace('💤','').trim()}`;
    } else if (!isPaused) {
        sleepEndTime = Date.now() + durationMs;
        sleepIndicatorMessageElement.textContent = `💤 ${message}`;
    } else { // Paused, but not during an active sleep (e.g. paused while waiting for API)
         sleepIndicatorMessageElement.textContent = `💤 Sequence Paused`;
         sleepIndicatorCountdownElement.textContent = `(Resume to continue)`;
         sleepIndicatorElement.style.display = 'block';
         return;
    }


    if (sleepCountdownInterval) clearInterval(sleepCountdownInterval);

    function updateCountdown() {
        let remaining;
        if (isPaused) {
            remaining = Math.max(0, sleepEndTime - Date.now());
            sleepIndicatorCountdownElement.textContent = `(Paused at ${String(Math.floor(remaining / 60000)).padStart(2, '0')}:${String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')})`;
            return; // Don't countdown further if paused
        }
        
        remaining = Math.max(0, sleepEndTime - Date.now());
        const seconds = Math.floor((remaining / 1000) % 60);
        const minutes = Math.floor((remaining / (1000 * 60)) % 60);
        sleepIndicatorCountdownElement.textContent = `(Next command in ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')})`;
        
        if (remaining === 0) {
            clearInterval(sleepCountdownInterval);
            // hideSleepIndicator() will be called by the main loop usually
        }
    }
    updateCountdown();
    sleepCountdownInterval = setInterval(updateCountdown, 1000);
    sleepIndicatorElement.style.display = 'block';
}

function hideSleepIndicator() {
    if (sleepCountdownInterval) clearInterval(sleepCountdownInterval);
    sleepCountdownInterval = null;
    if (sleepIndicatorElement) {
        sleepIndicatorElement.style.display = 'none';
    }
}

function createControlPanel() {
    if (!config.enableFloatingProgress) return;
    if (document.getElementById('ext-control-panel')) return;

    controlPanelElement = document.createElement('div');
    controlPanelElement.id = 'ext-control-panel';
    controlPanelElement.style.cssText = `
        position: fixed; bottom: 20px; right: 20px;
        background-color: rgba(20, 20, 80, 0.9); color: white; padding: 15px;
        border-radius: 10px; z-index: 20000; font-family: Arial, sans-serif;
        font-size: 14px; display: none; width: 280px; box-shadow: 0 0 15px rgba(0,0,0,0.4);
    `;

    progressStatusElement = document.createElement('div');
    progressStatusElement.id = 'ext-progress-status';
    progressStatusElement.style.marginBottom = '10px';
    progressStatusElement.style.fontWeight = 'bold';

    pendingCommandsListElement = document.createElement('ul');
    pendingCommandsListElement.id = 'ext-pending-commands';
    pendingCommandsListElement.style.cssText = `
        list-style: none; padding: 0; margin: 0 0 10px 0; max-height: 100px; 
        overflow-y: auto; font-size: 12px; background-color: rgba(0,0,0,0.2); 
        border-radius: 5px; padding: 5px;
    `;

    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '10px';

    pauseResumeButton = document.createElement('button');
    pauseResumeButton.id = 'ext-pause-resume-button';
    pauseResumeButton.textContent = 'Pause';
    pauseResumeButton.style.cssText = `padding: 8px 10px; background-color: #ffc107; color: black; border:none; border-radius:5px; cursor:pointer; flex-grow: 1;`;
    pauseResumeButton.onclick = () => {
        if (isPaused) resumeSequence();
        else pauseSequence();
    };

    stopButton = document.createElement('button');
    stopButton.id = 'ext-stop-button';
    stopButton.textContent = 'Stop';
    stopButton.style.cssText = `padding: 8px 10px; background-color: #dc3545; color: white; border:none; border-radius:5px; cursor:pointer; flex-grow: 1;`;
    stopButton.onclick = stopSequence;
    
    buttonContainer.appendChild(pauseResumeButton);
    buttonContainer.appendChild(stopButton);

    controlPanelElement.appendChild(progressStatusElement);
    controlPanelElement.appendChild(pendingCommandsListElement);
    controlPanelElement.appendChild(buttonContainer);
    document.body.appendChild(controlPanelElement);
}

function destroyControlPanel() {
    if (controlPanelElement) {
        controlPanelElement.remove();
        controlPanelElement = null;
    }
}

function updateControlPanel() {
    if (!config.enableFloatingProgress || !controlPanelElement) {
         if (config.enableFloatingProgress && !controlPanelElement) createControlPanel();
         if (!controlPanelElement) return;
    }

    progressStatusElement.textContent = `Progress: ${currentCommandIndex} / ${totalCommandsInSequence}`;
    if (isPaused) {
        progressStatusElement.textContent += " (Paused)";
    }

    pendingCommandsListElement.innerHTML = '';
    if (currentChain) {
        const upcoming = currentChain.slice(currentCommandIndex, currentCommandIndex + 5);
        if (upcoming.length === 0 && currentCommandIndex >= totalCommandsInSequence && isChainRunning) {
            const li = document.createElement('li');
            li.textContent = "Finishing last command...";
            pendingCommandsListElement.appendChild(li);
        } else if (upcoming.length === 0 && !isChainRunning) {
             const li = document.createElement('li');
            li.textContent = "No commands pending.";
            pendingCommandsListElement.appendChild(li);
        }
        upcoming.forEach((cmd, idx) => {
            const li = document.createElement('li');
            const { command: cleanCmd } = parseCommand(cmd); // Show clean command
            li.textContent = `${currentCommandIndex + idx + 1}. ${cleanCmd.substring(0, 30)}${cleanCmd.length > 30 ? '...' : ''}`;
            if (idx === 0) li.style.fontWeight = 'bold';
            pendingCommandsListElement.appendChild(li);
        });
    }

    pauseResumeButton.textContent = isPaused ? 'Resume' : 'Pause';
    controlPanelElement.style.display = isChainRunning ? 'block' : 'none';
}


// --- Core Logic ---

async function sleep(durationMs, sleepMessage) {
    if (durationMs <= 0) return;
    console.log(`Sleeping for ${durationMs}ms: ${sleepMessage}`);
    showSleepIndicator(sleepMessage, durationMs);

    // This promise structure allows the sleep to be "interrupted" by isPaused
    // because processNextCommand will not proceed if isPaused is true.
    // The actual waiting happens via setTimeout.
    return new Promise(resolve => {
        let waitTimeout = setTimeout(() => {
             // If paused, the main loop will handle it. This timeout just finishes.
            if (!isPaused) { // Only resolve if not paused.
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
    const speechButton = document.querySelector('button[data-testid="composer-speech-button"]');
    const sendButton = document.querySelector('button[data-testid="send-button"]');
    return speechButton != null && (sendButton && !sendButton.disabled);
}

async function submitPrompt(prompt) {
    const textarea = document.querySelector('#prompt-textarea');
    if (!textarea) {
        console.error("Textarea #prompt-textarea not found. Stopping sequence.");
        await stopSequence();
        throw new Error("Textarea not found");
    }

    textarea.value = prompt;
    textarea.textContent = prompt;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true })); // Good practice

    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 30; // Try for 6 seconds (30 * 200ms)
        const tryClick = setInterval(async () => {
            if (isPaused) { // Don't attempt to click if paused
                console.log("Submit attempt paused.");
                return;
            }
            const button = document.querySelector('button[data-testid="send-button"]');
            if (button && !button.disabled) {
                clearInterval(tryClick);
                button.click();
                console.log("Prompt submitted:", prompt.substring(0,50) + "...");
                resolve();
            } else if (attempts >= maxAttempts) {
                clearInterval(tryClick);
                console.error("Failed to submit prompt: Send button not available/enabled after max attempts. Stopping sequence.");
                await stopSequence();
                reject(new Error("Send button timeout or not found"));
            } else if (!button && attempts > 5) { // If button disappears after initial checks
                 clearInterval(tryClick);
                 console.error("Failed to submit prompt: Send button disappeared. Stopping sequence.");
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
        if (unit === 's') {
            explicitDelayMs = duration * 1000;
        } else if (unit === 'm') {
            explicitDelayMs = duration * 60 * 1000;
        }
        command = promptText.replace(sleepTagRegex, '').trim();
    }
    return { command, explicitDelayMs };
}

async function processNextCommand() {
    if (isPaused) {
        console.log("Sequence is paused. Waiting for resume...");
        updateControlPanel(); // Reflect paused state
        if (sleepIndicatorElement && sleepIndicatorElement.style.display === 'block') {
            // If a sleep was active, ensure its countdown reflects pause
            showSleepIndicator(sleepIndicatorMessageElement.textContent.replace('💤','').trim(), sleepEndTime - Date.now());
        }
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

    console.log(`Executing command ${currentCommandIndex + 1}/${totalCommandsInSequence}: "${command.substring(0,50)}..."`);
    
    try {
        await submitPrompt(command);
    } catch (error) {
        console.error("Error submitting prompt, sequence stopped:", error);
        // stopSequence() is called within submitPrompt on failurbe
        return;
    }
    
    // Wait for ChatGPT to complete its response
    await new Promise(resolve => {
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
                console.log(`ChatGPT response complete for: "${command.substring(0,50)}..."`);

                // Increment command index *after* successful execution and before delays for *this* command
                currentCommandIndex++; 
                updateControlPanel(); // Reflect that one more command is done

                // 1. Image Generation Throttling
                if (command.toLowerCase().includes("create image")) {
                    imageCommandCounter++;
                    console.log(`Image command count: ${imageCommandCounter}`);
                    if (imageCommandCounter > 0 && (imageCommandCounter % config.imageThrottleCount === 0)) {
                        const throttleMsg = `Image generation throttle (${config.imageThrottleDelayMs / 1000}s pause)`;
                        await sleep(config.imageThrottleDelayMs, throttleMsg);
                        if (isPaused) { resolve(); return; } // Check pause after sleep
                    }
                }

                // 2. Handle Inter-Command Delay (Explicit or Default)
                // This delay applies *after* the current command (and its potential throttle)
                // and *before* the next one, IF there is a next one.
                if (currentCommandIndex < totalCommandsInSequence) {
                    let delayToApplyMs = explicitDelayMs > 0 ? explicitDelayMs : config.defaultDelayMs;
                    if (delayToApplyMs > 0) {
                        const delayMsg = `Delaying for ${delayToApplyMs / 1000}s`;
                        await sleep(delayToApplyMs, delayMsg + (explicitDelayMs > 0 ? " (explicit)" : " (default)"));
                        if (isPaused) { resolve(); return; } // Check pause after sleep
                    }
                } else {
                    console.log("Last command in sequence processed.");
                }
                resolve();
            }
        }, 1000);
    });

    if (isPaused) { // Final check before looping
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
        if (sleepCountdownInterval) { // If a sleep was active, ensure its visual countdown pauses
            // The showSleepIndicator logic will handle the text update
            showSleepIndicator(sleepIndicatorMessageElement.textContent.replace('💤','').trim(), sleepEndTime - Date.now());
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
        // Kick off the processing loop again.
        processNextCommand();
    }
}

async function stopSequence() {
    console.log("Stopping sequence...");
    isChainRunning = false;
    isPaused = false;
    currentChain = null;
    // currentCommandIndex = 0; // Keep currentCommandIndex to show final progress if needed, or reset
    // totalCommandsInSequence = 0;
    imageCommandCounter = 0;
    
    hideSleepIndicator();
    if (controlPanelElement) controlPanelElement.style.display = 'none'; // Hide immediately
    // Or update it to show "Stopped"
    if (config.enableFloatingProgress && controlPanelElement) {
        progressStatusElement.textContent = `Sequence Stopped at ${currentCommandIndex} / ${totalCommandsInSequence}`;
        pendingCommandsListElement.innerHTML = '<li>Sequence stopped.</li>';
        pauseResumeButton.textContent = 'Pause'; // Reset button
        pauseResumeButton.disabled = true;
        stopButton.disabled = true;
        // Keep panel visible for a moment or hide after timeout? For now, let it stay with "Stopped"
    }


    console.log("Sequence has been stopped.");
}

// --- Message Listener ---
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === 'usePrompt') {
        if (isChainRunning) {
            console.warn("A command chain is already running.");
            sendResponse({ status: "busy", message: "Chain already in progress. Stop it or wait." });
            return true;
        }

        // Ensure UI elements are ready based on current config
        if (config.enableFloatingProgress) createControlPanel(); else destroyControlPanel();
        if (config.enableSleepIndicator) createSleepIndicator(); else destroySleepIndicator();


        let separator = request.separator || config.separator || C_DEFAULT_SETTINGS.separator; // Use config separator
        if (separator.toLowerCase() === '\\n' || separator === '\n') {
            currentChain = request.prompt.split(/\n+/).map(p => p.trim()).filter(p => p);
        } else {
            currentChain = request.prompt.split(separator).map(p => p.trim()).filter(p => p);
        }

        if (currentChain && currentChain.length > 0) {
            isChainRunning = true;
            isPaused = false;
            currentCommandIndex = 0;
            totalCommandsInSequence = currentChain.length;
            imageCommandCounter = 0;

            if (pauseResumeButton) pauseResumeButton.disabled = false;
            if (stopButton) stopButton.disabled = false;

            console.log(`Starting new chain with ${totalCommandsInSequence} commands.`);
            updateControlPanel(); // Show and update panel
            
            processNextCommand(); // Start the chain

            sendResponse({ status: "started", message: `${totalCommandsInSequence} commands.` });
        } else {
            sendResponse({ status: "error", message: "Prompt chain is empty or invalid." });
        }
        return true; 
    } else if (request.action === 'updateConfig') {
        console.log("Received config update from popup:", request.newConfig);
        config = { ...config, ...request.newConfig };
        // Apply visual changes immediately if toggled
        if (config.enableFloatingProgress) createControlPanel(); else destroyControlPanel();
        if (config.enableSleepIndicator) createSleepIndicator(); else destroySleepIndicator();
        if(isChainRunning) updateControlPanel(); // Refresh panel if running

        sendResponse({status: "config updated in content script"});
        return true;
    }
});

// --- Initial Setup ---
loadConfig(); // Load config when script initially loads
// Initial creation of UI elements will happen if enabled in config,
// or when a chain starts, or when config is updated.

console.log("ChatGPT Chain Extension content script v2 loaded.");
