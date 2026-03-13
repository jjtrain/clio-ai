(function () {
  var script = document.currentScript;
  var baseUrl = script.src.replace(/\/widget\/booking\.js.*$/, '');
  var target = script.getAttribute('data-target');

  var iframe = document.createElement('iframe');
  iframe.src = baseUrl + '/book?embed=true';
  iframe.style.cssText = 'width:100%;min-height:700px;border:none;border-radius:8px;';
  iframe.setAttribute('title', 'Book a Consultation');
  iframe.setAttribute('loading', 'lazy');

  // Allow iframe to resize based on content
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'clio-booking-resize') {
      iframe.style.height = e.data.height + 'px';
    }
  });

  if (target) {
    var container = document.querySelector(target);
    if (container) {
      container.appendChild(iframe);
    } else {
      console.warn('[Clio Booking] Target element not found:', target);
    }
  } else {
    // Append where the script tag is
    script.parentNode.insertBefore(iframe, script.nextSibling);
  }
})();
