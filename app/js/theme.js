/* Preference is optional: blocked storage must never prevent starting MixLab. */
(function () {
  'use strict';
  const root = document.documentElement;
  const system = matchMedia('(prefers-color-scheme: dark)');
  try {
    const saved = localStorage.getItem('mixlab.theme');
    if (saved === 'dark' || saved === 'light') root.dataset.theme = saved;
  } catch {}
  function sync() {
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : system.matches;
    document.querySelectorAll('[data-theme-toggle]').forEach(b => {
      b.setAttribute('aria-label', dark ? 'Usar tema claro' : 'Usar tema oscuro');
      b.title = dark ? 'Usar tema claro' : 'Usar tema oscuro';
    });
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#211f1c' : '#eee9dc');
  }
  document.addEventListener('DOMContentLoaded', sync);
  system.addEventListener('change', sync);
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-theme-toggle]')) return;
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : system.matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('mixlab.theme', root.dataset.theme); } catch {}
    sync();
  });
})();
