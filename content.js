let currentChain = null;
let isProcessing = false;

// Function to check if ChatGPT is ready for next input
function isResponseComplete() {
    // Check if the "Regenerate response" button is visible
    // const regenerateButton = document.querySelector('button:has-text("Regenerate")');
    // Check if the main input is enabled

    return document.querySelector('button[data-testid="composer-speech-button"]')!=null;
}

// Function to submit a prompt
function submitPrompt(prompt) {
    const textarea = document.querySelector('#prompt-textarea');
    if (textarea) {
        // Set the content
        textarea.textContent = prompt;

        // Create and dispatch input event
        const inputEvent = new Event('input', { bubbles: true });
        textarea.dispatchEvent(inputEvent);

        // Find and click the submit button
        const checkButtonExistence = setInterval(() => {
            const button = document.querySelector('button[aria-label="Send prompt"][data-testid="send-button"]');
            if (button) {
                clearInterval(checkButtonExistence);  // Stop checking once the button is found
                button.click();  // Click the button
            }
        }, 100);  // Check every 100ms


    }
}

// Function to process the next prompt in chain
async function processNextPrompt() {
    if (!currentChain || currentChain.length === 0 || isProcessing) {
        currentChain = null;
        isProcessing = false;
        return;
    }

    isProcessing = true;
    const nextPrompt = currentChain[0];
    currentChain = currentChain.slice(1);

    submitPrompt(nextPrompt);

    // Start checking for completion
    await waitForCompletion();
}

// Function to wait for ChatGPT to complete its response
async function waitForCompletion() {
    const checkInterval = setInterval(() => {
        if (isResponseComplete()) {
            clearInterval(checkInterval);
            isProcessing = false;

            // Wait a short moment before processing next prompt
            setTimeout(() => {
                processNextPrompt();
            }, 1000);
        }
    }, 1000);
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === 'usePrompt') {
        let separator = request.separator || '---';

        // Special handling for newline separator
        if (separator.toLowerCase() === '\\n' || separator === '\n') {
            currentChain = request.prompt.split(/\n+/).map(p => p.trim()).filter(p => p);
        } else {
            currentChain = request.prompt.split(separator).map(p => p.trim()).filter(p => p);
        }

        // Start the chain
        if (currentChain.length > 0 && !isProcessing) {
            processNextPrompt();
        }
    }
});