// Google Tag Manager Data Layer
window.dataLayer = window.dataLayer || [];
window.dataLayer.push({
  'gtm.start': new Date().getTime(),
  event: 'gtm.js'
});

// Highlight tombol informasi aktif
document.addEventListener('DOMContentLoaded', function () {
  const currentUrl = window.location.href;
  const navLinks = document.querySelectorAll('.tombol_informasi a');
  navLinks.forEach(link => {
    if (link.href === currentUrl) {
      link.parentElement.classList.add('tombol_informasi_aktif');
    }
  });

  const currentUrl2 = window.location.href;
  const navLinks2 = document.querySelectorAll('.kategori');
  navLinks2.forEach(link => {
    if (link.href === currentUrl2) {
      link.parentElement.classList.add('tombol_kategori_aktif');
    }
  });

  // Logout button handler (mengganti onclick inline)
  const logoutLink = document.querySelector('.logout');
  if (logoutLink) {
    logoutLink.addEventListener('click', function (e) {
      e.preventDefault();
      const logoutForm = document.getElementById('logout-form');
      if (logoutForm) logoutForm.submit();
    });
  }

  // Scroll toggle untuk tombol WhatsApp
  const whatsappButton = document.querySelector('.whatsapp-float');
  if (whatsappButton) {
    window.addEventListener('scroll', function () {
      if (window.scrollY > -10) {
        whatsappButton.style.display = 'block';
      } else {
        whatsappButton.style.display = 'none';
      }
    });
  }

  // Efek loading setelah First Contentful Paint
  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntriesByType('paint');
      const firstContentfulPaint = entries.find(entry => entry.name === 'first-contentful-paint');

      if (firstContentfulPaint) {
        setTimeout(() => {
          const loadingOverlay = document.getElementById('loading-overlay');
          if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
          }
        }, 400); // 0.4 detik
      }
    });
    observer.observe({ type: 'paint', buffered: true });
  }
});
