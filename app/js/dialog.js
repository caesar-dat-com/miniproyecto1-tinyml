/* Keep keyboard navigation inside whichever sheet is open. */
(function () {
  'use strict';
  document.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const sheet = document.querySelector('[role="dialog"]:not([hidden])');
    if (!sheet) return;
    const focusable = [...sheet.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')].filter(el => el.getClientRects().length);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && (document.activeElement === first || !sheet.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
    if (!e.shiftKey && (document.activeElement === last || !sheet.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
  });
})();
