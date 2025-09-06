// Popup script cho MaxImg Proxy extension
// Xử lý giao diện và logic bật/tắt proxy

document.addEventListener('DOMContentLoaded', function() {
  const toggleBtn = document.getElementById('toggleBtn');
  const statusElement = document.getElementById('status');
  const statusText = document.getElementById('status-text');
  const btnText = document.getElementById('btn-text');
  
  let isLoading = false;
  
  // Cập nhật giao diện dựa trên trạng thái
  function updateUI(enabled) {
    if (enabled) {
      statusElement.className = 'status enabled';
      statusText.textContent = '✅ Proxy Đang Bật';
      
      toggleBtn.className = 'toggle-btn enabled';
      btnText.textContent = '🔴 Tắt Proxy';
    } else {
      statusElement.className = 'status disabled';
      statusText.textContent = '⚫ Proxy Đang Tắt';
      
      toggleBtn.className = 'toggle-btn';
      btnText.textContent = '🟢 Bật Proxy';
    }
    
    // Animation cho status change
    statusElement.classList.add('status-changing');
    setTimeout(() => {
      statusElement.classList.remove('status-changing');
    }, 300);
  }
  
  // Hiển thị trạng thái loading
  function setLoading(loading) {
    isLoading = loading;
    const container = document.querySelector('.container');
    
    if (loading) {
      container.classList.add('loading');
      btnText.innerHTML = '<span class="spinner"></span>Đang xử lý...';
      toggleBtn.disabled = true;
    } else {
      container.classList.remove('loading');
      toggleBtn.disabled = false;
    }
  }
  
  // Lấy trạng thái hiện tại từ background script
  function getCurrentState() {
    chrome.runtime.sendMessage(
      { action: 'getProxyState' },
      function(response) {
        if (chrome.runtime.lastError) {
          console.error('Error getting proxy state:', chrome.runtime.lastError);
          statusText.textContent = '❌ Lỗi kết nối';
          btnText.textContent = 'Thử lại';
          return;
        }
        
        updateUI(response.enabled);
      }
    );
  }
  
  // Xử lý khi click nút toggle
  toggleBtn.addEventListener('click', function() {
    if (isLoading) return;
    
    setLoading(true);
    
    // Gửi message đến background script để toggle proxy
    chrome.runtime.sendMessage(
      { action: 'toggleProxy' },
      function(response) {
        setLoading(false);
        
        if (chrome.runtime.lastError) {
          console.error('Error toggling proxy:', chrome.runtime.lastError);
          statusText.textContent = '❌ Lỗi khi thay đổi';
          btnText.textContent = 'Thử lại';
          return;
        }
        
        if (response.success) {
          updateUI(response.enabled);
          
          // Hiển thị thông báo ngắn
          const originalText = statusText.textContent;
          statusText.textContent = response.enabled ? 
            '✨ Đã bật proxy!' : '✨ Đã tắt proxy!';
          
          setTimeout(() => {
            updateUI(response.enabled);
          }, 1500);
          
          // Tự động đóng popup sau khi thành công (optional)
          setTimeout(() => {
            window.close();
          }, 2000);
        } else {
          statusText.textContent = '❌ Có lỗi xảy ra';
          btnText.textContent = 'Thử lại';
        }
      }
    );
  });
  
  // Lắng nghe thay đổi storage để cập nhật UI real-time
  chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (namespace === 'local' && changes.proxyEnabled) {
      updateUI(changes.proxyEnabled.newValue);
    }
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    // Space hoặc Enter để toggle
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      toggleBtn.click();
    }
    
    // Escape để đóng popup
    if (e.code === 'Escape') {
      window.close();
    }
  });
  
  // Thêm hover effects bằng JavaScript
  toggleBtn.addEventListener('mouseenter', function() {
    if (!isLoading) {
      this.style.transform = 'translateY(-2px)';
    }
  });
  
  toggleBtn.addEventListener('mouseleave', function() {
    this.style.transform = 'translateY(0)';
  });
  
  // Focus trên button để có thể dùng keyboard
  toggleBtn.focus();
  
  // Tải trạng thái ban đầu
  getCurrentState();
  
  // Thêm tooltip cho các elements
  statusElement.title = 'Trạng thái hiện tại của proxy';
  toggleBtn.title = 'Click để bật/tắt proxy (Space/Enter)';
  
  console.log('MaxImg Proxy popup loaded');
});