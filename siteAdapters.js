(function(){
  const defaultAdapter = {
    textareaSelector: '#prompt-textarea',
    sendButtonSelector: 'button[aria-label="Send prompt"][data-testid="send-button"]',
    retryButtonSelector: 'button[data-testid="regenerate-thread-error-button"]',
    speechButtonSelector: 'button[data-testid="composer-speech-button"]',
    userMessageSelector: '[data-message-author-role="user"]'
  };

  const adapters = {
    'chatgpt.com': {}, // uses default selectors
    'gemini.google.com': {
      // Update these selectors when integrating Gemini
      textareaSelector: 'textarea',
      sendButtonSelector: 'button[type="submit"]',
      userMessageSelector: '.user-message'
    },
    'claude.ai': {
      // Update these selectors when integrating Claude
      textareaSelector: 'textarea',
      sendButtonSelector: 'button[type="submit"]',
      userMessageSelector: '.user-message'
    }
  };

  function getSiteAdapter() {
    const host = location.hostname;
    for (const domain in adapters) {
      if (host === domain || host.endsWith('.' + domain)) {
        return { ...defaultAdapter, ...adapters[domain] };
      }
    }
    return defaultAdapter;
  }

  window.getSiteAdapter = getSiteAdapter;

  if (typeof module !== 'undefined') {
    module.exports = { getSiteAdapter };
  }
})();
