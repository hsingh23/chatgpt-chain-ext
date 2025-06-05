chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'show-progress',
    title: 'Show Chain Progress',
    contexts: ['all']
  });
  chrome.contextMenus.create({
    id: 'toggle-pip',
    title: 'Toggle Picture-in-Picture',
    contexts: ['all']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) return;
  if (info.menuItemId === 'show-progress') {
    // Call open() synchronously after setOptions to preserve the user gesture
    chrome.sidePanel.setOptions({ tabId: tab.id, path: 'sidepanel.html' }, () => {
      try {
        chrome.sidePanel.open({ tabId: tab.id });
      } catch (err) {
        console.error('Failed to open side panel:', err);
      }
    });
    try {
      chrome.tabs.sendMessage(tab.id, { action: 'showProgress' });
    } catch (_) {
      // Ignore missing receivers
    }
  } else if (info.menuItemId === 'toggle-pip') {
    try {
      chrome.tabs.sendMessage(tab.id, { action: 'togglePip' });
    } catch (_) {
      // Ignore missing receivers
    }
  }
});
