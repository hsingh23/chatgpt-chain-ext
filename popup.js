document.addEventListener("DOMContentLoaded", function () {
  const defaultSettings = {
    separator: "~",
    defaultDelayMs: 5000,
    imageThrottleCount: 5,
    imageThrottleDelayMs: 120000,
    enableSleepIndicator: true,
    enableFloatingProgress: true,
  };

  const separatorInput = document.getElementById("separator");
  const newPromptInput = document.getElementById("new-prompt");
  const savePromptButton = document.getElementById("save-prompt");
  const promptsListDiv = document.getElementById("prompts-list");
  const statusMessageDiv = document.getElementById("status-message");

  // Settings elements
  const defaultDelayMsInput = document.getElementById("defaultDelayMs");
  const imageThrottleCountInput = document.getElementById("imageThrottleCount");
  const imageThrottleDelayMsInput = document.getElementById(
    "imageThrottleDelayMs"
  );
  const enableSleepIndicatorCheckbox = document.getElementById(
    "enableSleepIndicator"
  );
  const enableFloatingProgressCheckbox = document.getElementById(
    "enableFloatingProgress"
  );
  const saveSettingsButton = document.getElementById("save-settings");
  const openPipButton = document.getElementById("open-pip-view");

  function showStatus(message, isError = false) {
    statusMessageDiv.textContent = message;
    statusMessageDiv.className = isError ? "status-error" : "status-success";
    statusMessageDiv.style.display = "block";
    setTimeout(() => {
      statusMessageDiv.style.display = "none";
    }, 3000);
  }

  // Parse command to extract special syntax (pause, wait/sleep commands)
  function parseCommand(promptText) {
    // Check for pause command first
    const pauseRegex = /\$pause\$/i;
    if (pauseRegex.test(promptText)) {
      const command = promptText.replace(pauseRegex, "").trim();
      return { command, isPauseCommand: true, delayMs: 0, isDelayCommand: false };
    }

    // Check for new wait syntax: $wait 30s$ or $wait 2m$
    const waitTagRegex = /\$wait\s*(\d+)([sm])\$/i;
    let delayMs = 0;
    let command = promptText;
    const waitMatch = promptText.match(waitTagRegex);

    if (waitMatch) {
      const duration = parseInt(waitMatch[1]);
      const unit = waitMatch[2].toLowerCase();
      if (unit === "s") {
        delayMs = duration * 1000;
      } else if (unit === "m") {
        delayMs = duration * 60 * 1000;
      }
      command = promptText.replace(waitTagRegex, "").trim();
      return { command, isPauseCommand: false, delayMs, isDelayCommand: true };
    } else {
      // Legacy support for old sleep syntax: $sleep30s$
      const sleepTagRegex = /\$sleep\s*(\d+)([sm])\$/i;
      const sleepMatch = promptText.match(sleepTagRegex);

      if (sleepMatch) {
        const duration = parseInt(sleepMatch[1]);
        const unit = sleepMatch[2].toLowerCase();
        if (unit === "s") {
          delayMs = duration * 1000;
        } else if (unit === "m") {
          delayMs = duration * 60 * 1000;
        }
        command = promptText.replace(sleepTagRegex, "").trim();
        return { command, isPauseCommand: false, delayMs, isDelayCommand: true };
      }
    }

    return { command, isPauseCommand: false, delayMs: 0, isDelayCommand: false };
  }

  // Run migration first, then load data
  migratePromptsToLocal();

  // Load saved prompts and settings (using different storage APIs)
  // Settings from sync (small, should sync across devices)
  chrome.storage.sync.get(["extensionSettings"], function (syncResult) {
    const settings = {
      ...defaultSettings,
      ...(syncResult.extensionSettings || {}),
    };

    // Populate settings fields (convert from ms to user-friendly units)
    separatorInput.value = settings.separator;
    defaultDelayMsInput.value = (settings.defaultDelayMs / 1000).toFixed(1); // Convert ms to seconds with 1 decimal
    imageThrottleCountInput.value = settings.imageThrottleCount;
    imageThrottleDelayMsInput.value = (
      settings.imageThrottleDelayMs / 60000
    ).toFixed(1); // Convert ms to minutes with 1 decimal
    enableSleepIndicatorCheckbox.checked = settings.enableSleepIndicator;
    enableFloatingProgressCheckbox.checked = settings.enableFloatingProgress;

    // Prompts from local storage (can be large, device-specific is OK)
    chrome.storage.local.get(["prompts"], function (localResult) {
      const prompts = localResult.prompts || [];
      displayPrompts(prompts);
    });
  });

  // Save settings
  saveSettingsButton.addEventListener("click", function () {
    const newSettings = {
      separator: separatorInput.value || defaultSettings.separator, // Also save separator with general settings
      defaultDelayMs: Math.round(
        (parseFloat(defaultDelayMsInput.value) || 5) * 1000
      ), // Convert seconds to ms, round to avoid floating point issues
      imageThrottleCount:
        parseInt(imageThrottleCountInput.value) ||
        defaultSettings.imageThrottleCount,
      imageThrottleDelayMs: Math.round(
        (parseFloat(imageThrottleDelayMsInput.value) || 2) * 60000
      ), // Convert minutes to ms, round to avoid floating point issues
      enableSleepIndicator: enableSleepIndicatorCheckbox.checked,
      enableFloatingProgress: enableFloatingProgressCheckbox.checked,
    };
    chrome.storage.sync.set({ extensionSettings: newSettings }, function () {
      if (chrome.runtime.lastError) {
        console.error("Failed to save settings:", chrome.runtime.lastError);
        showStatus(
          "Failed to save settings: " + chrome.runtime.lastError.message,
          true
        );
        return;
      }

      showStatus("Settings saved successfully!");
      // Notify content script about config changes
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0] && tabs[0].id) {
          chrome.tabs.sendMessage(
            tabs[0].id,
            {
              action: "updateConfig",
              newConfig: newSettings,
            },
            (response) => {
              if (chrome.runtime.lastError) {
                console.warn(
                  "Could not send config update to content script:",
                  chrome.runtime.lastError.message
                );
              } else if (response && response.status) {
                console.log(
                  "Config update response from content script:",
                  response.status
                );
              }
            }
          );
        }
      });
    });
  });
  // Save separator immediately when it changes (legacy, but good for responsiveness if user expects it)
  separatorInput.addEventListener("change", function () {
    chrome.storage.sync.get(["extensionSettings"], function (result) {
      if (chrome.runtime.lastError) {
        console.error(
          "Failed to load settings for separator update:",
          chrome.runtime.lastError
        );
        return;
      }

      const currentSettings = {
        ...defaultSettings,
        ...(result.extensionSettings || {}),
      };
      currentSettings.separator = separatorInput.value;
      chrome.storage.sync.set(
        { extensionSettings: currentSettings },
        function () {
          if (chrome.runtime.lastError) {
            console.error(
              "Failed to save separator:",
              chrome.runtime.lastError
            );
          }
        }
      );
    });
  });
  // Save new prompt (using local storage for large data)
  savePromptButton.addEventListener("click", function () {
    const promptText = newPromptInput.value.trim();
    if (promptText) {
      chrome.storage.local.get(["prompts"], function (result) {
        if (chrome.runtime.lastError) {
          console.error("Failed to load prompts:", chrome.runtime.lastError);
          showStatus(
            "Failed to load existing prompts: " +
              chrome.runtime.lastError.message,
            true
          );
          return;
        }

        const prompts = result.prompts || [];
        prompts.push(promptText);
        chrome.storage.local.set({ prompts }, function () {
          if (chrome.runtime.lastError) {
            console.error("Failed to save prompt:", chrome.runtime.lastError);
            showStatus(
              "Failed to save prompt chain: " +
                chrome.runtime.lastError.message,
              true
            );
            return;
          }

          displayPrompts(prompts);
          newPromptInput.value = "";
          showStatus("Prompt chain saved!");
        });
      });
    } else {
      showStatus("Prompt text cannot be empty.", true);
    }
  });

  function displayPrompts(prompts) {
    promptsListDiv.innerHTML = "";
    if (prompts.length === 0) {
      promptsListDiv.textContent = "No prompt chains saved yet.";
      return;
    }

    prompts.forEach((prompt, index) => {
      const div = document.createElement("div");
      div.className = "prompt-item";

      const currentSeparator =
        separatorInput.value || defaultSettings.separator;
      let commands = [];

      // Split the prompt into individual commands for better visualization
      if (currentSeparator !== "\\n" && currentSeparator !== "\n") {
        commands = prompt
          .split(currentSeparator)
          .map((cmd) => cmd.trim())
          .filter((cmd) => cmd);
      } else {
        commands = prompt
          .split(/\n+/)
          .map((cmd) => cmd.trim())
          .filter((cmd) => cmd);
      }      // Create a nicely formatted preview with numbered commands
      const commandsHtml = commands
        .map((cmd, idx) => {
          const parsedCmd = parseCommand(cmd);
          let shortCmd = cmd.length > 60 ? cmd.substring(0, 60) + "..." : cmd;
          let statusIcon = "";
          let statusText = "";
          let borderColor = "#007bff";
          
          if (parsedCmd.isPauseCommand) {
            statusIcon = "⏸️ ";
            statusText = "PAUSE";
            borderColor = "#ffc107";
            if (parsedCmd.command.trim() === "") {
              shortCmd = "[PAUSE COMMAND]";
            } else {
              shortCmd = parsedCmd.command.length > 50 ? parsedCmd.command.substring(0, 50) + "..." : parsedCmd.command;
              shortCmd += " + PAUSE";
            }
          } else if (parsedCmd.isDelayCommand) {
            const delayText = parsedCmd.delayMs >= 60000 ? 
              `${Math.round(parsedCmd.delayMs / 60000)}m` : 
              `${Math.round(parsedCmd.delayMs / 1000)}s`;
            statusIcon = "⏱️ ";
            statusText = `WAIT ${delayText}`;
            borderColor = "#6f42c1";
            if (parsedCmd.command.trim() === "") {
              shortCmd = `[WAIT ${delayText}]`;
            } else {
              shortCmd = parsedCmd.command.length > 45 ? parsedCmd.command.substring(0, 45) + "..." : parsedCmd.command;
              shortCmd += ` + WAIT ${delayText}`;
            }
          }
          
          return `<div style="margin-bottom: 12px; padding: 10px; background: rgba(0,0,0,0.05); border-radius: 6px; border-left: 4px solid ${borderColor}; line-height: 1;">
                    ${statusIcon ? `<div style="color: ${borderColor}; font-size: 11px; font-weight: bold; margin-bottom: 4px;">${statusText}</div>` : ""}
                    <span style="color: #333;">${shortCmd
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;")}</span>
                </div>`;
        })
        .join("");

      div.innerHTML = `
                <div class="preview-mode">
                    <div style="margin-bottom: 10px; font-weight: bold; color: #555;">
                        Chain with ${commands.length} command${
        commands.length !== 1 ? "s" : ""
      }:
                    </div>
                    <div class="prompt-preview" style="max-height: 200px; overflow-y: auto;">
                        ${commandsHtml}
                    </div>                    <div class="button-group">
                        <div class="start-position-selector">
                            <label for="start-position-${index}">Start from:</label>                            <select class="start-position-select" id="start-position-${index}">
                                ${commands.map((cmd, cmdIdx) => {
                                    const parsedCmd = parseCommand(cmd);
                                    let shortCmd = cmd.length > 35 ? cmd.substring(0, 35) + "..." : cmd;
                                    let prefix = "";
                                    
                                    if (parsedCmd.isPauseCommand) {
                                        prefix = "⏸️ ";
                                        if (parsedCmd.command.trim() === "") {
                                            shortCmd = "[PAUSE]";
                                        } else {
                                            shortCmd = parsedCmd.command.length > 25 ? parsedCmd.command.substring(0, 25) + "..." : parsedCmd.command;
                                        }
                                    } else if (parsedCmd.isDelayCommand) {
                                        const delayText = parsedCmd.delayMs >= 60000 ? 
                                            `${Math.round(parsedCmd.delayMs / 60000)}m` : 
                                            `${Math.round(parsedCmd.delayMs / 1000)}s`;
                                        prefix = `⏱️ `;
                                        if (parsedCmd.command.trim() === "") {
                                            shortCmd = `[WAIT ${delayText}]`;
                                        } else {
                                            shortCmd = parsedCmd.command.length > 20 ? parsedCmd.command.substring(0, 20) + "..." : parsedCmd.command;
                                        }
                                    }
                                    
                                    return `<option value="${cmdIdx}">Step ${cmdIdx + 1}: ${prefix}${shortCmd.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</option>`;
                                }).join('')}
                            </select>
                        </div>
                        <div style="display: flex; gap: 5px;">
                            <button class="use-prompt" data-prompt="${prompt.replace(
                              /"/g,
                              "&quot;"
                            )}" data-index="${index}">Play Chain</button>
                            <button class="edit-prompt secondary" data-index="${index}">Edit</button>
                            <button class="delete-prompt danger" data-index="${index}">Delete</button>
                        </div>
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
    });    // Add event listeners for action buttons
    document.querySelectorAll(".use-prompt").forEach((button) => {
      button.addEventListener("click", function () {
        const prompt = this.getAttribute("data-prompt");
        const chainIndex = this.getAttribute("data-index");
        const startPositionSelect = document.getElementById(`start-position-${chainIndex}`);
        const startPosition = startPositionSelect ? parseInt(startPositionSelect.value) : 0;
        
        const currentSeparator =
          separatorInput.value || defaultSettings.separator;        chrome.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            if (tabs[0] && tabs[0].id) {              // Check if we're on a ChatGPT page
              if (!tabs[0].url || !tabs[0].url.includes('chatgpt.com')) {
                showStatus(
                  "Please navigate to ChatGPT (https://chatgpt.com) to use this extension.",
                  true
                );
                return;
              }

              // Ensure content script is loaded before sending message
              ensureContentScript(tabs[0].id, (isLoaded) => {
                if (!isLoaded) {
                  showStatus(
                    "Failed to load extension on this page. Please refresh and try again.",
                    true
                  );
                  return;
                }

                chrome.tabs.sendMessage(
                  tabs[0].id,
                  {
                    action: "usePrompt",
                    prompt,
                    separator: currentSeparator,
                    startPosition: startPosition,
                  },
                  (response) => {
                    if (chrome.runtime.lastError) {
                      console.error(
                        "Error sending message to content script:",
                        chrome.runtime.lastError.message
                      );
                      
                      // Provide more helpful error messages
                      let errorMessage = "Failed to start chain. ";
                      if (chrome.runtime.lastError.message.includes("Receiving end does not exist")) {
                        errorMessage += "Please refresh the ChatGPT page and try again.";
                      } else {
                        errorMessage += chrome.runtime.lastError.message;
                      }
                      
                      showStatus(errorMessage, true);
                    } else if (response) {
                      if (response.status === "started") {
                        const startInfo = startPosition > 0 ? ` (starting from step ${startPosition + 1})` : '';
                        showStatus(`Chain started: ${response.message}${startInfo}`);
                        window.close(); // Close popup after successfully starting
                      } else {
                        showStatus(
                          `Could not start chain: ${response.message}`,
                          true
                        );
                      }
                    } else {
                      showStatus(
                        "No response from ChatGPT page. Please refresh the page and try again.",
                        true
                      );
                    }
                  }
                );
              });
            } else {
              showStatus("Could not find active tab to send prompt.", true);
            }
          }
        );
      });
    });
    document.querySelectorAll(".delete-prompt").forEach((button) => {
      button.addEventListener("click", function () {
        const index = parseInt(this.getAttribute("data-index"));
        chrome.storage.local.get(["prompts"], function (result) {
          if (chrome.runtime.lastError) {
            console.error(
              "Failed to load prompts for deletion:",
              chrome.runtime.lastError
            );
            showStatus(
              "Failed to delete prompt: " + chrome.runtime.lastError.message,
              true
            );
            return;
          }

          const prompts = result.prompts || [];
          prompts.splice(index, 1);
          chrome.storage.local.set({ prompts }, function () {
            if (chrome.runtime.lastError) {
              console.error(
                "Failed to save after deletion:",
                chrome.runtime.lastError
              );
              showStatus(
                "Failed to delete prompt: " + chrome.runtime.lastError.message,
                true
              );
              return;
            }

            displayPrompts(prompts);
            showStatus("Prompt chain deleted.");
          });
        });
      });
    });

    document.querySelectorAll(".edit-prompt").forEach((button) => {
      button.addEventListener("click", function () {
        const promptItem = this.closest(".prompt-item");
        promptItem.querySelector(".preview-mode").style.display = "none";
        promptItem.querySelector(".edit-mode").style.display = "block";
      });
    });

    document.querySelectorAll(".save-edit").forEach((button) => {
      button.addEventListener("click", function () {
        const index = parseInt(this.getAttribute("data-index"));
        const promptItem = this.closest(".prompt-item");
        const newText = promptItem.querySelector(".edit-textarea").value.trim();
        if (newText) {
          chrome.storage.local.get(["prompts"], function (result) {
            if (chrome.runtime.lastError) {
              console.error(
                "Failed to load prompts for editing:",
                chrome.runtime.lastError
              );
              showStatus(
                "Failed to update prompt: " + chrome.runtime.lastError.message,
                true
              );
              return;
            }

            const prompts = result.prompts || [];
            prompts[index] = newText;
            chrome.storage.local.set({ prompts }, function () {
              if (chrome.runtime.lastError) {
                console.error(
                  "Failed to save edited prompt:",
                  chrome.runtime.lastError
                );
                showStatus(
                  "Failed to update prompt: " +
                    chrome.runtime.lastError.message,
                  true
                );
                return;
              }

              displayPrompts(prompts);
              showStatus("Prompt chain updated.");
            });
          });
        } else {
          showStatus("Prompt text cannot be empty.", true);
        }
      });
    });

    document.querySelectorAll(".cancel-edit").forEach((button) => {
      button.addEventListener("click", function () {
        const promptItem = this.closest(".prompt-item");
        promptItem.querySelector(".preview-mode").style.display = "block";
        promptItem.querySelector(".edit-mode").style.display = "none";
        // Optionally re-render or reset textarea to original value if needed
      });
    });

  }

  // Migration function to move prompts from sync to local storage
  function migratePromptsToLocal() {
    chrome.storage.sync.get(["prompts"], function (syncResult) {
      if (chrome.runtime.lastError) {
        console.error(
          "Migration: Failed to check sync storage:",
          chrome.runtime.lastError
        );
        return;
      }

      if (syncResult.prompts && syncResult.prompts.length > 0) {
        console.log(
          "Found prompts in sync storage, migrating to local storage..."
        );

        chrome.storage.local.get(["prompts"], function (localResult) {
          if (chrome.runtime.lastError) {
            console.error(
              "Migration: Failed to check local storage:",
              chrome.runtime.lastError
            );
            return;
          }

          const localPrompts = localResult.prompts || [];
          const syncPrompts = syncResult.prompts;

          // Merge prompts (avoid duplicates)
          const allPrompts = [...localPrompts];
          syncPrompts.forEach((syncPrompt) => {
            if (!allPrompts.includes(syncPrompt)) {
              allPrompts.push(syncPrompt);
            }
          });

          // Save to local storage
          chrome.storage.local.set({ prompts: allPrompts }, function () {
            if (chrome.runtime.lastError) {
              console.error(
                "Migration: Failed to save to local storage:",
                chrome.runtime.lastError
              );
              return;
            }

            console.log(
              `Migration complete: ${syncPrompts.length} prompts moved to local storage`
            );

            // Remove from sync storage to free up quota
            chrome.storage.sync.remove(["prompts"], function () {
              if (chrome.runtime.lastError) {
                console.error(
                  "Migration: Failed to remove from sync storage:",
                  chrome.runtime.lastError
                );
              } else {
                console.log("Migration: Removed prompts from sync storage");
              }
            });
          });
        });
      }
    });
  }

  // Add storage info to the UI
  function addStorageInfo() {
    const storageInfo = document.createElement("div");
    storageInfo.style.cssText = `
            font-size: 11px; 
            color: #666; 
            margin-top: 10px; 
            padding: 8px; 
            background: #f8f9fa; 
            border-radius: 4px;
            border-left: 3px solid #007bff;
        `;
    storageInfo.innerHTML = `
            <strong>📍 Storage Info:</strong> Settings sync across devices, prompt chains are stored locally for unlimited size.
        `;
    document.body.appendChild(storageInfo);
  }

  // Add storage info to the popup
  addStorageInfo();

  if (openPipButton) {
    openPipButton.addEventListener("click", function () {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0] && tabs[0].id) {
          if (!tabs[0].url || !tabs[0].url.includes('chatgpt.com')) {
            showStatus(
              "Please navigate to ChatGPT (https://chatgpt.com) to use this extension.",
              true
            );
            return;
          }
          ensureContentScript(tabs[0].id, (loaded) => {
            if (!loaded) {
              showStatus(
                "Failed to load extension on this page. Please refresh and try again.",
                true
              );
              return;
            }
            chrome.tabs.sendMessage(
              tabs[0].id,
              { action: "togglePip" },
              (response) => {
                if (chrome.runtime.lastError) {
                  showStatus(
                    "Failed to toggle PIP: " + chrome.runtime.lastError.message,
                    true
                  );
                } else if (response && response.status) {
                  showStatus(response.status);
                  window.close();
                }
              }
            );
          });
        }
      });
    });
  }

  // Function to ensure content script is loaded
  function ensureContentScript(tabId, callback) {
    // Try to ping the content script first
    chrome.tabs.sendMessage(tabId, { action: "ping" }, (response) => {
      if (chrome.runtime.lastError || !response) {
        // Content script not loaded, try to inject it
        chrome.scripting.executeScript(
          {
            target: { tabId: tabId },
            files: ['content.js']
          },
          () => {
            if (chrome.runtime.lastError) {
              console.error("Failed to inject content script:", chrome.runtime.lastError);
              callback(false);
            } else {
              console.log("Content script injected successfully");
              callback(true);
            }
          }
        );
      } else {
        // Content script is already loaded
        callback(true);
      }
    });
  }
});
