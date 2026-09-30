// 注册 DevTools 面板，指向独立的 panel 页面（devtools-panel.html）
chrome.devtools.panels.create('SnapRequest', '', 'devtools-panel.html');
