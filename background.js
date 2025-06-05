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
    chrome.sidePanel.setOptions({ tabId: tab.id, path: 'sidepanel.html' }).then(() => {
      chrome.sidePanel.open({ tabId: tab.id });
    });
    chrome.tabs.sendMessage(tab.id, { action: 'showProgress' });
  } else if (info.menuItemId === 'toggle-pip') {
    chrome.tabs.sendMessage(tab.id, { action: 'togglePip' });
  }
});
