document.addEventListener('DOMContentLoaded', function () {
    const defaultSettings = {
        separator: '~',
        defaultDelayMs: 5000,
        imageThrottleCount: 5,
        imageThrottleDelayMs: 120000,
        enableSleepIndicator: true,
        enableFloatingProgress: true
    };

    const separatorInput = document.getElementById('separator');
    const newPromptInput = document.getElementById('new-prompt');
    const savePromptButton = document.getElementById('save-prompt');
    const promptsListDiv = document.getElementById('prompts-list');
    const statusMessageDiv = document.getElementById('status-message');

    // Settings elements
    const defaultDelayMsInput = document.getElementById('defaultDelayMs');
    const imageThrottleCountInput = document.getElementById('imageThrottleCount');
    const imageThrottleDelayMsInput = document.getElementById('imageThrottleDelayMs');
    const enableSleepIndicatorCheckbox = document.getElementById('enableSleepIndicator');
    const enableFloatingProgressCheckbox = document.getElementById('enableFloatingProgress');
    const saveSettingsButton = document.getElementById('save-settings');

    function showStatus(message, isError = false) {
        statusMessageDiv.textContent = message;
        statusMessageDiv.className = isError ? 'status-error' : 'status-success';
        statusMessageDiv.style.display = 'block';
        setTimeout(() => {
            statusMessageDiv.style.display = 'none';
        }, 3000);
    }

    // Load saved prompts and settings
    chrome.storage.sync.get(['prompts', 'extensionSettings'], function (result) {
        const prompts = result.prompts || [];
        const settings = { ...defaultSettings, ...(result.extensionSettings || {}) };        // Populate settings fields (convert from ms to user-friendly units)
        separatorInput.value = settings.separator;
        defaultDelayMsInput.value = settings.defaultDelayMs / 1000; // Convert ms to seconds
        imageThrottleCountInput.value = settings.imageThrottleCount;
        imageThrottleDelayMsInput.value = settings.imageThrottleDelayMs / 60000; // Convert ms to minutes
        enableSleepIndicatorCheckbox.checked = settings.enableSleepIndicator;
        enableFloatingProgressCheckbox.checked = settings.enableFloatingProgress;
        
        displayPrompts(prompts);
    });    // Save settings
    saveSettingsButton.addEventListener('click', function () {
        const newSettings = {
            separator: separatorInput.value || defaultSettings.separator, // Also save separator with general settings
            defaultDelayMs: (parseInt(defaultDelayMsInput.value) || 5) * 1000, // Convert seconds to ms
            imageThrottleCount: parseInt(imageThrottleCountInput.value) || defaultSettings.imageThrottleCount,
            imageThrottleDelayMs: (parseFloat(imageThrottleDelayMsInput.value) || 2) * 60000, // Convert minutes to ms
            enableSleepIndicator: enableSleepIndicatorCheckbox.checked,
            enableFloatingProgress: enableFloatingProgressCheckbox.checked
        };

        chrome.storage.sync.set({ extensionSettings: newSettings }, function () {
            showStatus('Settings saved successfully!');
            // Notify content script about config changes
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs[0] && tabs[0].id) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'updateConfig',
                        newConfig: newSettings
                    }, response => {
                        if (chrome.runtime.lastError) {
                            console.warn("Could not send config update to content script:", chrome.runtime.lastError.message);
                        } else if (response && response.status) {
                            console.log("Config update response from content script:", response.status);
                        }
                    });
                }
            });
        });
    });
    
    // Save separator immediately when it changes (legacy, but good for responsiveness if user expects it)
    separatorInput.addEventListener('change', function () {
        chrome.storage.sync.get(['extensionSettings'], function(result) {
            const currentSettings = { ...defaultSettings, ...(result.extensionSettings || {}) };
            currentSettings.separator = this.value;
            chrome.storage.sync.set({ extensionSettings: currentSettings });
        });
    });


    // Save new prompt
    savePromptButton.addEventListener('click', function () {
        const promptText = newPromptInput.value.trim();
        if (promptText) {
            chrome.storage.sync.get(['prompts'], function (result) {
                const prompts = result.prompts || [];
                prompts.push(promptText);
                chrome.storage.sync.set({ prompts }, function () {
                    displayPrompts(prompts);
                    newPromptInput.value = '';
                    showStatus('Prompt chain saved!');
                });
            });
        } else {
            showStatus('Prompt text cannot be empty.', true);
        }
    });
      function displayPrompts(prompts) {
        promptsListDiv.innerHTML = '';
        if (prompts.length === 0) {
            promptsListDiv.textContent = 'No prompt chains saved yet.';
            return;
        }

        prompts.forEach((prompt, index) => {
            const div = document.createElement('div');
            div.className = 'prompt-item';

            const currentSeparator = separatorInput.value || defaultSettings.separator;
            let commands = [];
            
            // Split the prompt into individual commands for better visualization
            if (currentSeparator !== '\\n' && currentSeparator !== '\n') {
                commands = prompt.split(currentSeparator).map(cmd => cmd.trim()).filter(cmd => cmd);
            } else {
                commands = prompt.split(/\n+/).map(cmd => cmd.trim()).filter(cmd => cmd);
            }
            
            // Create a nicely formatted preview with numbered commands
            const commandsHtml = commands.map((cmd, idx) => {
                const shortCmd = cmd.length > 60 ? cmd.substring(0, 60) + '...' : cmd;
                return `<div style="margin-bottom: 8px; padding: 6px; background: rgba(0,0,0,0.05); border-radius: 4px; border-left: 3px solid #007bff;">
                    <strong>Command ${idx + 1}:</strong> ${shortCmd.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
                </div>`;
            }).join('');
            
            div.innerHTML = `
                <div class="preview-mode">
                    <div style="margin-bottom: 10px; font-weight: bold; color: #555;">
                        Chain with ${commands.length} command${commands.length !== 1 ? 's' : ''}:
                    </div>
                    <div class="prompt-preview" style="max-height: 200px; overflow-y: auto;">
                        ${commandsHtml}
                    </div>
                    <div class="button-group">
                        <button class="use-prompt" data-prompt="${prompt.replace(/"/g, '&quot;')}">Use Chain</button>
                        <button class="edit-prompt secondary" data-index="${index}">Edit</button>
                        <button class="delete-prompt danger" data-index="${index}">Delete</button>
                    </div>
                </div>
                <div class="edit-mode" style="display: none;">
                    <textarea class="edit-textarea">${prompt}</textarea>
                    <div class="button-group">
                        <button class="save-edit" data-index="${index}">Save</button>
                        <button class="cancel-edit secondary">Cancel</button>
                    </div>
                </div>
            `;
            promptsListDiv.appendChild(div);
        });

        // Add event listeners for action buttons
        document.querySelectorAll('.use-prompt').forEach(button => {
            button.addEventListener('click', function () {
                const prompt = this.getAttribute('data-prompt');
                const currentSeparator = separatorInput.value || defaultSettings.separator;
                chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                    if (tabs[0] && tabs[0].id) {
                        chrome.tabs.sendMessage(tabs[0].id, {
                            action: 'usePrompt',
                            prompt,
                            separator: currentSeparator
                        }, response => {
                             if (chrome.runtime.lastError) {
                                console.error("Error sending message to content script:", chrome.runtime.lastError.message);
                                showStatus(`Error starting chain: ${chrome.runtime.lastError.message}`, true);
                            } else if (response) {
                                if (response.status === "started") {
                                    showStatus(`Chain started: ${response.message}`);
                                    window.close(); // Close popup after successfully starting
                                } else {
                                    showStatus(`Could not start chain: ${response.message}`, true);
                                }
                            }
                        });
                    } else {
                        showStatus('Could not find active tab to send prompt.', true);
                    }
                });
            });
        });

        document.querySelectorAll('.delete-prompt').forEach(button => {
            button.addEventListener('click', function () {
                const index = parseInt(this.getAttribute('data-index'));
                chrome.storage.sync.get(['prompts'], function (result) {
                    const prompts = result.prompts || [];
                    prompts.splice(index, 1);
                    chrome.storage.sync.set({ prompts }, function () {
                        displayPrompts(prompts);
                        showStatus('Prompt chain deleted.');
                    });
                });
            });
        });

        document.querySelectorAll('.edit-prompt').forEach(button => {
            button.addEventListener('click', function () {
                const promptItem = this.closest('.prompt-item');
                promptItem.querySelector('.preview-mode').style.display = 'none';
                promptItem.querySelector('.edit-mode').style.display = 'block';
            });
        });

        document.querySelectorAll('.save-edit').forEach(button => {
            button.addEventListener('click', function () {
                const index = parseInt(this.getAttribute('data-index'));
                const promptItem = this.closest('.prompt-item');
                const newText = promptItem.querySelector('.edit-textarea').value.trim();

                if (newText) {
                    chrome.storage.sync.get(['prompts'], function (result) {
                        const prompts = result.prompts || [];
                        prompts[index] = newText;
                        chrome.storage.sync.set({ prompts }, function () {
                            displayPrompts(prompts);
                            showStatus('Prompt chain updated.');
                        });
                    });
                } else {
                     showStatus('Prompt text cannot be empty.', true);
                }
            });
        });

        document.querySelectorAll('.cancel-edit').forEach(button => {
            button.addEventListener('click', function () {
                const promptItem = this.closest('.prompt-item');
                promptItem.querySelector('.preview-mode').style.display = 'block';
                promptItem.querySelector('.edit-mode').style.display = 'none';
                // Optionally re-render or reset textarea to original value if needed
            });
        });
    }
});
