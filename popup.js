document.addEventListener('DOMContentLoaded', function () {
    // Load saved prompts
    chrome.storage.sync.get(['prompts', 'separator'], function (result) {
        const prompts = result.prompts || [];
        if (result.separator) {
            document.getElementById('separator').value = result.separator;
        }
        displayPrompts(prompts);
    });

    // Save separator when it changes
    document.getElementById('separator').addEventListener('change', function () {
        chrome.storage.sync.set({ separator: this.value });
    });

    // Save new prompt
    document.getElementById('save-prompt').addEventListener('click', function () {
        const promptText = document.getElementById('new-prompt').value;
        if (promptText) {
            chrome.storage.sync.get(['prompts'], function (result) {
                const prompts = result.prompts || [];
                prompts.push(promptText);
                chrome.storage.sync.set({ prompts }, function () {
                    displayPrompts(prompts);
                    document.getElementById('new-prompt').value = '';
                });
            });
        }
    });
    
    function displayPrompts(prompts) {
        const promptsList = document.getElementById('prompts-list');
        promptsList.innerHTML = '';

        prompts.forEach((prompt, index) => {
            const div = document.createElement('div');
            div.className = 'prompt-item';

            // Format the preview text based on separator
            const separator = document.getElementById('separator').value;
            const formattedPrompt = separator.toLowerCase() === '\\n' || separator === '\n'
                ? prompt  // Keep original formatting for newlines
                : prompt.split(separator).join('\n' + separator + '\n');  // Format other separators

            div.innerHTML = `
            <div class="preview-mode">
                <div class="prompt-preview">${formattedPrompt}</div>
                <div class="button-group">
                    <button class="use-prompt" data-prompt="${prompt.replace(/"/g, '&quot;')}">Use Prompt Chain</button>
                    <button class="edit-prompt" data-index="${index}">Edit</button>
                    <button class="delete-prompt" data-index="${index}">Delete</button>
                </div>
            </div>
            <div class="edit-mode" style="display: none;">
                <textarea class="edit-textarea">${prompt}</textarea>
                <div class="button-group">
                    <button class="save-edit" data-index="${index}">Save</button>
                    <button class="cancel-edit">Cancel</button>
                </div>
            </div>
        `;
            promptsList.appendChild(div);
        });

        // Add event listeners for use and delete buttons
        document.querySelectorAll('.use-prompt').forEach(button => {
            button.addEventListener('click', function () {
                const prompt = this.getAttribute('data-prompt');
                const separator = document.getElementById('separator').value;
                chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'usePrompt',
                        prompt,
                        separator
                    });
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
                    });
                });
            });
        });

        document.querySelectorAll('.edit-prompt').forEach(button => {
            button.addEventListener('click', function () {
                const index = this.getAttribute('data-index');
                const promptItem = this.closest('.prompt-item');
                promptItem.querySelector('.preview-mode').style.display = 'none';
                promptItem.querySelector('.edit-mode').style.display = 'block';
            });
        });

        document.querySelectorAll('.save-edit').forEach(button => {
            button.addEventListener('click', function () {
                const index = parseInt(this.getAttribute('data-index'));
                const promptItem = this.closest('.prompt-item');
                const newText = promptItem.querySelector('.edit-textarea').value;

                chrome.storage.sync.get(['prompts'], function (result) {
                    const prompts = result.prompts || [];
                    prompts[index] = newText;
                    chrome.storage.sync.set({ prompts }, function () {
                        displayPrompts(prompts);
                    });
                });
            });
        });

        document.querySelectorAll('.cancel-edit').forEach(button => {
            button.addEventListener('click', function () {
                const promptItem = this.closest('.prompt-item');
                promptItem.querySelector('.preview-mode').style.display = 'block';
                promptItem.querySelector('.edit-mode').style.display = 'none';
            });
        });
    }
});