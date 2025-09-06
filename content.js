// Content script cho MaxImg Proxy
// Chỉ xử lý ảnh (img elements), không xử lý video

(function() {
  'use strict';
  
  const PROXY_BASE = 'https://imax.ibyteproxy.workers.dev/?url=';
  let isProxyEnabled = false;
  let originalSources = new WeakMap(); // Lưu trữ src gốc của images
  
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
  
  // Kiểm tra xem có phải ảnh không (optional check)
  function isImageUrl(url) {
    if (!url) return false;
    
    // Kiểm tra extension
    const imageExtensions = /\.(jpe?g|png|gif|webp|bmp|svg|avif|ico|tiff|tif)(\?.*)?$/i;
    return imageExtensions.test(url);
  }
  
  // Xử lý img elements
  function processImage(img) {
    if (!img.src) return;
    
    // Optional: chỉ proxy những URL có vẻ là ảnh
    // Uncomment dòng dưới nếu muốn filter chặt hơn
    // if (!isImageUrl(img.src) && !isProxyUrl(img.src)) return;
    
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
  
  // Xử lý tất cả images hiện có
  function processAllImages() {
    // Xử lý tất cả img elements
    document.querySelectorAll('img').forEach(processImage);
    
    // Xử lý img trong picture elements
    document.querySelectorAll('picture img').forEach(processImage);
    
    // Xử lý background-image trong CSS (optional - advanced)
    if (isProxyEnabled) {
      processBackgroundImages();
    }
  }
  
  // Xử lý background-image CSS (optional feature)
  function processBackgroundImages() {
    const elementsWithBg = document.querySelectorAll('[style*="background-image"]');
    
    elementsWithBg.forEach(element => {
      const style = element.style.backgroundImage;
      if (style && style.includes('url(')) {
        const urlMatch = style.match(/url\(['"]?(.*?)['"]?\)/);
        if (urlMatch && urlMatch[1] && !isProxyUrl(urlMatch[1])) {
          const originalUrl = urlMatch[1];
          const proxyUrl = createProxyUrl(originalUrl);
          element.style.backgroundImage = style.replace(originalUrl, proxyUrl);
        }
      }
    });
  }
  
  // Observer để theo dõi img elements mới được thêm vào DOM
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Kiểm tra chính node đó
          if (node.tagName === 'IMG') {
            processImage(node);
          }
          
          // Kiểm tra các img children
          if (node.querySelectorAll) {
            node.querySelectorAll('img').forEach(processImage);
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
    
    // Xử lý tất cả images hiện có
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', processAllImages);
    } else {
      processAllImages();
    }
  });
  
  // Lắng nghe thay đổi storage
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.proxyEnabled) {
      isProxyEnabled = changes.proxyEnabled.newValue;
      console.log('Proxy state changed:', isProxyEnabled);
      processAllImages();
    }
  });
  
  // Xử lý khi có images mới load bằng JavaScript
  document.addEventListener('load', (e) => {
    if (e.target.tagName === 'IMG') {
      processImage(e.target);
    }
  }, true);
  
  // Xử lý khi có lỗi loading image (fallback to original)
  document.addEventListener('error', (e) => {
    if (e.target.tagName === 'IMG' && isProxyUrl(e.target.src)) {
      console.warn('Image proxy failed, fallback to original:', e.target.src);
      const originalSrc = restoreOriginalUrl(e.target.src);
      if (originalSrc !== e.target.src) {
        e.target.src = originalSrc;
      }
    }
  }, true);
  
})();
