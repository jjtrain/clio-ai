(function () {
  var script = document.currentScript;
  var baseUrl = script.src.replace(/\/widget\/chat\.js.*$/, '');

  // Create chat bubble button
  var bubble = document.createElement('div');
  bubble.id = 'clio-chat-bubble';
  bubble.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
  bubble.style.cssText = 'position:fixed;bottom:20px;right:20px;width:56px;height:56px;background:#3B82F6;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:99998;transition:transform 0.2s;';
  bubble.onmouseenter = function () { bubble.style.transform = 'scale(1.1)'; };
  bubble.onmouseleave = function () { bubble.style.transform = 'scale(1)'; };

  // Create iframe container
  var container = document.createElement('div');
  container.id = 'clio-chat-container';
  container.style.cssText = 'position:fixed;bottom:20px;right:20px;width:400px;height:560px;z-index:99999;display:none;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.12);';

  var iframe = document.createElement('iframe');
  iframe.src = baseUrl + '/widget/chat';
  iframe.style.cssText = 'width:100%;height:100%;border:none;border-radius:16px;';
  iframe.allow = 'microphone';
  container.appendChild(iframe);

  var isOpen = false;

  bubble.onclick = function () {
    isOpen = !isOpen;
    container.style.display = isOpen ? 'block' : 'none';
    bubble.style.display = isOpen ? 'none' : 'flex';
  };

  // Listen for close messages from iframe
  window.addEventListener('message', function (e) {
    if (e.data === 'clio-chat-close') {
      isOpen = false;
      container.style.display = 'none';
      bubble.style.display = 'flex';
    }
  });

  document.body.appendChild(bubble);
  document.body.appendChild(container);
})();
