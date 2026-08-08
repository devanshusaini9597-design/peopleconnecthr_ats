/**
 * DevLumiq ATS — embeddable careers chatbot
 *
 * Usage:
 *   <script
 *     src="https://YOUR_APP/careers-chatbot.js"
 *     data-company="your-company-slug"
 *     async
 *   ></script>
 *
 * Optional: data-origin="https://YOUR_APP" if the script is hosted elsewhere.
 */
(function () {
  'use strict';
  if (window.__devlumiqCareersChatbotLoaded) return;
  window.__devlumiqCareersChatbotLoaded = true;

  var script = document.currentScript;
  var company =
    (script && script.getAttribute('data-company')) ||
    (script && script.getAttribute('data-slug')) ||
    '';
  var origin =
    (script && script.getAttribute('data-origin')) ||
    (script && script.src ? new URL(script.src).origin : window.location.origin);

  var iframe = document.createElement('iframe');
  iframe.title = 'Careers assistant';
  iframe.src =
    origin.replace(/\/$/, '') +
    '/embed/careers-chatbot' +
    (company ? '?company=' + encodeURIComponent(company) : '');
  iframe.setAttribute(
    'style',
    [
      'position:fixed',
      'bottom:20px',
      'right:20px',
      'width:380px',
      'height:560px',
      'max-width:calc(100vw - 24px)',
      'max-height:calc(100vh - 40px)',
      'border:0',
      'border-radius:16px',
      'box-shadow:0 20px 50px rgba(0,0,0,.25)',
      'z-index:2147483000',
      'background:#fff',
      'color-scheme:light',
    ].join(';'),
  );
  iframe.allow = 'clipboard-write';

  function mount() {
    document.body.appendChild(iframe);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
