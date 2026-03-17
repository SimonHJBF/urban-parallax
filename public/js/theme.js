/**
 * Urban Parallax — Fixed theme: dark-vivid
 * Applied immediately (before first paint) to avoid flash.
 */
(function () {
  const r = document.documentElement;
  r.style.setProperty('--color-nav',     '#0D0D0D');
  r.style.setProperty('--color-page',    '#141414');
  r.style.setProperty('--color-surface', '#1E1E1E');
  r.style.setProperty('--color-text',    '#FFFFFF');
  r.style.setProperty('--color-muted',   '#BBBBBB');
  r.style.setProperty('--color-accent',  '#FF3B3B');
  r.style.setProperty('--page-bg-rgb',   '20,20,20');
  r.style.setProperty('--color-border',  'rgba(255,255,255,0.10)');
  r.style.setProperty('--nav-border',    'none');
  r.dataset.theme = 'dark-vivid';
  if (document.body) document.body.style.backgroundColor = '#141414';
})();
