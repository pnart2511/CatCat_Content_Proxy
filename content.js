// Content script cho MaxImg Proxy
// Chịu trách nhiệm thay đổi src của img và video elements

(function() {
  'use strict';
  
  const PROXY_BASE = 'https://imax.ibyteproxy.workers.dev/?url=';
  let isProxyEnabled = false;
  let originalSources = new WeakMap(); // Lưu trữ src gốc
  
  // Kiểm tra xem URL có phải là proxy không
  function isProxyUrl(url) {
    return url && url.startsWith(PROXY_BASE);
  }
  
  // Tạo proxy URL từ original URL
  function createProxyUrl(originalUrl) {
    if (!originalUrl || isProxyUrl(originalUrl)) return originalUrl;
    
    // Chỉ proxy http/https URLs
    if (!originalUrl.startsWith('http://') && !originalUrl.startsWith('https://')) {
      return originalUrl;
    }
    
    return PROXY_BASE + encodeURIComponent(originalUrl);
  }
  
  // Khôi phục original URL từ proxy URL
  function restoreOriginalUrl(proxyUrl) {
    if (!isProxyUrl(proxyUrl)) return proxyUrl;
    
    try {
      const encodedUrl = proxyUrl.substring(PROXY_BASE.length);
      return decodeURIComponent(encodedUrl);
    } catch (e) {
      console.warn('Failed to decode proxy URL:', proxyUrl);
      return proxyUrl;
    }
  }
  
  // Xử lý img elements
  function processImage(img) {
    if (!img.src) return;
    
    if (isProxyEnabled) {
      // Lưu src gốc nếu chưa có
      if (!originalSources.has(img)) {
        const originalSrc = isProxyUrl(img.src) ? restoreOriginalUrl(img.src) : img.src;
        originalSources.set(img, originalSrc);
      }
      
      // Chuyển sang proxy URL
      const originalSrc = originalSources.get(img);
      const proxyUrl = createProxyUrl(originalSrc);
      if (img.src !== proxyUrl) {
        img.src = proxyUrl;
      }
    } else {
      // Khôi phục src gốc
      if (originalSources.has(img)) {
        const originalSrc = originalSources.get(img);
        if (img.src !== originalSrc) {
          img.src = originalSrc;
        }
      } else if (isProxyUrl(img.src)) {
        // Nếu không có trong WeakMap nhưng là proxy URL, decode nó
        img.src = restoreOriginalUrl(img.src);
      }
    }
  }
  
  // Xử lý video elements  
  function processVideo(video) {
    if (!video.src && !video.currentSrc) return;
    
    const currentSrc = video.currentSrc || video.src;
    if (!currentSrc) return;
    
    let shouldReload = false;
    
    if (isProxyEnabled) {
      // Lưu src gốc nếu chưa có
      if (!originalSources.has(video)) {
        const originalSrc = isProxyUrl(currentSrc) ? restoreOriginalUrl(currentSrc) : currentSrc;
        originalSources.set(video, originalSrc);
      }
      
      // Chuyển sang proxy URL
      const originalSrc = originalSources.get(video);
      const proxyUrl = createProxyUrl(originalSrc);
      if (video.src !== proxyUrl) {
        // Lưu thời gian hiện tại để khôi phục sau khi reload
        const currentTime = video.currentTime;
        const wasPlaying = !video.paused;
        
        video.src = proxyUrl;
        shouldReload = true;
        
        // Khôi phục trạng thái sau khi load
        video.addEventListener('loadedmetadata', function onLoaded() {
          video.removeEventListener('loadedmetadata', onLoaded);
          if (currentTime > 0) {
            video.currentTime = currentTime;
          }
          if (wasPlaying) {
            video.play().catch(() => {});
          }
        });
      }
    } else {
      // Khôi phục src gốc
      if (originalSources.has(video)) {
        const originalSrc = originalSources.get(video);
        if (video.src !== originalSrc) {
          const currentTime = video.currentTime;
          const wasPlaying = !video.paused;
          
          video.src = originalSrc;
          shouldReload = true;
          
          video.addEventListener('loadedmetadata', function onLoaded() {
            video.removeEventListener('loadedmetadata', onLoaded);
            if (currentTime > 0) {
              video.currentTime = currentTime;
            }
            if (wasPlaying) {
              video.play().catch(() => {});
            }
          });
        }
      } else if (isProxyUrl(currentSrc)) {
        const currentTime = video.currentTime;
        const wasPlaying = !video.paused;
        
        video.src = restoreOriginalUrl(currentSrc);
        shouldReload = true;
        
        video.addEventListener('loadedmetadata', function onLoaded() {
          video.removeEventListener('loadedmetadata', onLoaded);
          if (currentTime > 0) {
            video.currentTime = currentTime;
          }
          if (wasPlaying) {
            video.play().catch(() => {});
          }
        });
      }
    }
    
    // Reload video để áp dụng src mới
    if (shouldReload) {
      video.load();
    }
  }
  
  // Xử lý tất cả images và videos hiện có
  function processAllMediaElements() {
    // Xử lý tất cả img
    document.querySelectorAll('img').forEach(processImage);
    
    // Xử lý tất cả video
    document.querySelectorAll('video').forEach(processVideo);
  }
  
  // Observer để theo dõi elements mới được thêm vào DOM
  const observer = new MutationObserver((mutations) => {
    if (!isProxyEnabled) return; // Chỉ xử lý khi proxy được bật
    
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Kiểm tra chính node đó
          if (node.tagName === 'IMG') {
            processImage(node);
          } else if (node.tagName === 'VIDEO') {
            processVideo(node);
          }
          
          // Kiểm tra các children
          if (node.querySelectorAll) {
            node.querySelectorAll('img').forEach(processImage);
            node.querySelectorAll('video').forEach(processVideo);
          }
        }
      });
    });
  });
  
  // Bắt đầu observe DOM changes
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Lấy trạng thái proxy khi content script load
  chrome.storage.local.get(['proxyEnabled'], (result) => {
    isProxyEnabled = result.proxyEnabled || false;
    console.log('MaxImg Proxy content script loaded - Proxy enabled:', isProxyEnabled);
    
    // Xử lý tất cả media elements hiện có
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', processAllMediaElements);
    } else {
      processAllMediaElements();
    }
  });
  
  // Lắng nghe thay đổi storage
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.proxyEnabled) {
      isProxyEnabled = changes.proxyEnabled.newValue;
      console.log('Proxy state changed:', isProxyEnabled);
      processAllMediaElements();
    }
  });
  
  // Xử lý khi có images/videos mới load bằng JavaScript
  document.addEventListener('load', (e) => {
    if (e.target.tagName === 'IMG') {
      processImage(e.target);
    } else if (e.target.tagName === 'VIDEO') {
      processVideo(e.target);
    }
  }, true);
  
})();