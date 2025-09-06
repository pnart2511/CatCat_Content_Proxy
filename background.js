// Background service worker cho MaxImg Proxy extension
// Chịu trách nhiệm quản lý trạng thái và xử lý messages từ popup/content

// Khởi tạo trạng thái mặc định khi extension được cài đặt
chrome.runtime.onInstalled.addListener(() => {
  // Mặc định tắt proxy khi cài đặt
  chrome.storage.local.set({ proxyEnabled: false });
  console.log('MaxImg Proxy installed - Default state: disabled');
});

// Lắng nghe messages từ popup để bật/tắt proxy
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggleProxy') {
    // Lấy trạng thái hiện tại
    chrome.storage.local.get(['proxyEnabled'], (result) => {
      const newState = !result.proxyEnabled;
      
      // Lưu trạng thái mới
      chrome.storage.local.set({ proxyEnabled: newState }, () => {
        console.log(`Proxy ${newState ? 'enabled' : 'disabled'}`);
        
        // Gửi response về popup
        sendResponse({ success: true, enabled: newState });
        
        // Reload tab hiện tại để áp dụng thay đổi
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.reload(tabs[0].id);
          }
        });
      });
    });
    
    // Báo cho Chrome biết response sẽ được gửi async
    return true;
  }
  
  // Lấy trạng thái hiện tại cho popup
  if (message.action === 'getProxyState') {
    chrome.storage.local.get(['proxyEnabled'], (result) => {
      sendResponse({ enabled: result.proxyEnabled || false });
    });
    return true;
  }
});

// Cập nhật icon và title dựa trên trạng thái
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.proxyEnabled) {
    const isEnabled = changes.proxyEnabled.newValue;
    
    // Cập nhật title của extension
    chrome.action.setTitle({
      title: `MaxImg Proxy - ${isEnabled ? 'Enabled' : 'Disabled'}`
    });
    
    // Cập nhật badge để hiển thị trạng thái
    chrome.action.setBadgeText({
      text: isEnabled ? 'ON' : 'OFF'
    });
    
    // Đặt màu badge
    chrome.action.setBadgeBackgroundColor({
      color: isEnabled ? '#10b981' : '#6b7280'
    });
    
    console.log(`Extension status updated: ${isEnabled ? 'Enabled' : 'Disabled'}`);
  }
});

// Khởi tạo badge khi extension start
chrome.runtime.onStartup.addListener(() => {
  // Lấy trạng thái hiện tại và cập nhật badge
  chrome.storage.local.get(['proxyEnabled'], (result) => {
    const isEnabled = result.proxyEnabled || false;
    chrome.action.setBadgeText({ text: isEnabled ? 'ON' : 'OFF' });
    chrome.action.setBadgeBackgroundColor({ 
      color: isEnabled ? '#10b981' : '#6b7280' 
    });
  });
});