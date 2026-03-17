/**
 * Urban Parallax — Colour Mode System
 * 12 modes: 6 colour families × 2 variants (vivid / earth)
 * localStorage key: 'up-colour-mode'   Default: 'dark-earth'
 */

const COLOUR_MODES = {
  'dark-vivid': {
    nav:      '#0A0A0A',
    page:     '#111111',
    surface:  '#1C1C1C',
    text:     '#FFFFFF',
    muted:    '#AAAAAA',
    accent:   '#FF3B3B',
    pageBgRgb: '17,17,17',
    isDark: true,
  },
  'dark-earth': {
    nav:      '#1A1410',
    page:     '#221C17',
    surface:  '#2A221C',
    text:     '#E8D9C5',
    muted:    '#9A8A78',
    accent:   '#C4622D',
    pageBgRgb: '34,28,23',
    isDark: true,
  },
  'light-vivid': {
    nav:      '#FFFFFF',
    page:     '#F0F0EE',
    surface:  '#FFFFFF',
    text:     '#0A0A0A',
    muted:    '#666666',
    accent:   '#E0200A',
    pageBgRgb: '240,240,238',
    isDark: false,
  },
  'light-earth': {
    nav:      '#F0E8DC',
    page:     '#F5EFE6',
    surface:  '#EDE5D8',
    text:     '#2A1F15',
    muted:    '#7A6555',
    accent:   '#93511D',
    pageBgRgb: '245,239,230',
    isDark: false,
  },
  'red-vivid': {
    nav:      '#1A0505',
    page:     '#200808',
    surface:  '#2D0A0A',
    text:     '#FFFFFF',
    muted:    '#CC8888',
    accent:   '#FF4040',
    pageBgRgb: '32,8,8',
    isDark: true,
  },
  'red-earth': {
    nav:      '#2E1410',
    page:     '#3D1E18',
    surface:  '#4A2018',
    text:     '#F0D5CB',
    muted:    '#B08878',
    accent:   '#E06040',
    pageBgRgb: '61,30,24',
    isDark: true,
  },
  'orange-vivid': {
    nav:      '#150A00',
    page:     '#1C0F00',
    surface:  '#241400',
    text:     '#FFFFFF',
    muted:    '#CC9966',
    accent:   '#FF8000',
    pageBgRgb: '28,15,0',
    isDark: true,
  },
  'orange-earth': {
    nav:      '#221600',
    page:     '#2E1E06',
    surface:  '#3A2408',
    text:     '#F5DEB0',
    muted:    '#AA9070',
    accent:   '#D4821A',
    pageBgRgb: '46,30,6',
    isDark: true,
  },
  'green-vivid': {
    nav:      '#041408',
    page:     '#061A0C',
    surface:  '#0A2412',
    text:     '#FFFFFF',
    muted:    '#66BB88',
    accent:   '#00D44A',
    pageBgRgb: '6,26,12',
    isDark: true,
  },
  'green-earth': {
    nav:      '#0F2018',
    page:     '#152B20',
    surface:  '#1A3325',
    text:     '#C5E0D0',
    muted:    '#7AAA90',
    accent:   '#4DAA70',
    pageBgRgb: '21,43,32',
    isDark: true,
  },
  'blue-vivid': {
    nav:      '#040A18',
    page:     '#061020',
    surface:  '#0A1628',
    text:     '#FFFFFF',
    muted:    '#7AABDD',
    accent:   '#2060FF',
    pageBgRgb: '6,16,32',
    isDark: true,
  },
  'blue-earth': {
    nav:      '#0E1E30',
    page:     '#132438',
    surface:  '#172D42',
    text:     '#C5D5E8',
    muted:    '#7A9AB5',
    accent:   '#5A90C8',
    pageBgRgb: '19,36,56',
    isDark: true,
  },
};

let currentMode = localStorage.getItem('up-colour-mode') || 'dark-earth';

function applyMode(mode) {
  const m = COLOUR_MODES[mode];
  if (!m) return;

  const root = document.documentElement;
  root.style.setProperty('--color-nav',     m.nav);
  root.style.setProperty('--color-page',    m.page);
  root.style.setProperty('--color-surface', m.surface);
  root.style.setProperty('--color-text',    m.text);
  root.style.setProperty('--color-muted',   m.muted);
  root.style.setProperty('--color-accent',  m.accent);
  root.style.setProperty('--page-bg-rgb',   m.pageBgRgb);

  // Derived border/divider (not in spec, computed here)
  root.style.setProperty('--color-border',
    m.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)');

  // Nav bottom border: light modes get a subtle line, dark modes none
  root.style.setProperty('--nav-border',
    m.isDark ? 'none' : '1px solid rgba(0,0,0,0.10)');

  localStorage.setItem('up-colour-mode', mode);
  currentMode = mode;

  // Sync active swatch ring
  document.querySelectorAll('.mode-swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.mode === mode);
  });
}

// Apply before first paint — eliminates flash on reload
applyMode(currentMode);

// Re-sync UI elements after DOM is ready (swatches exist now)
document.addEventListener('DOMContentLoaded', () => {
  applyMode(currentMode);
});
