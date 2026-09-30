export const AUTO_CAPTURE_KEY = 'autoCapture';

export async function isAutoCaptureEnabled(): Promise<boolean> {
  const result = await chrome.storage.local.get(AUTO_CAPTURE_KEY);
  return result[AUTO_CAPTURE_KEY] !== false;
}

export async function setAutoCaptureEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({ [AUTO_CAPTURE_KEY]: enabled });
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id != null) {
      chrome.tabs
        .sendMessage(tab.id, { type: 'AUTO_CAPTURE_CHANGED', enabled })
        .catch(() => {});
    }
  }
}
