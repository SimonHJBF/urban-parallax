/**
 * Urban Parallax — Colour Mode System
 * 12 modes: 6 families × 2 variants (earth / vivid)
 * localStorage key: 'up-theme'   Default: 'dark-earth'
 */

const COLOUR_MODES = {
  'dark-earth':   { nav:'#1A1410', page:'#221C17', surface:'#2C2218', text:'#EAD9C4', muted:'#9A8A78', accent:'#C4622D', pageBgRgb:'34,28,23',    isDark:true  },
  'dark-vivid':   { nav:'#0D0D0D', page:'#141414', surface:'#1E1E1E', text:'#FFFFFF',  muted:'#BBBBBB', accent:'#FF3B3B', pageBgRgb:'20,20,20',     isDark:true  },
  'light-earth':  { nav:'#EDE5D8', page:'#F5EFE6', surface:'#FFFFFF', text:'#2A1F15', muted:'#7A6555', accent:'#93511D', pageBgRgb:'245,239,230',  isDark:false },
  'light-vivid':  { nav:'#FFFFFF', page:'#F2F2F0', surface:'#FFFFFF', text:'#0A0A0A', muted:'#666666', accent:'#D91A00', pageBgRgb:'242,242,240',  isDark:false },
  'red-earth':    { nav:'#2E1410', page:'#3D1E18', surface:'#4A2018', text:'#F0D5CB', muted:'#B08878', accent:'#E06040', pageBgRgb:'61,30,24',     isDark:true  },
  'red-vivid':    { nav:'#3A0000', page:'#500000', surface:'#660000', text:'#FFFFFF',  muted:'#FF9999', accent:'#FF2222', pageBgRgb:'80,0,0',       isDark:true  },
  'orange-earth': { nav:'#221600', page:'#2E1E06', surface:'#3A2408', text:'#F5DEB0', muted:'#AA9070', accent:'#D4821A', pageBgRgb:'46,30,6',      isDark:true  },
  'orange-vivid': { nav:'#281400', page:'#3D1E00', surface:'#522800', text:'#FFFFFF',  muted:'#FFB870', accent:'#FF8C00', pageBgRgb:'61,30,0',      isDark:true  },
  'green-earth':  { nav:'#0F2018', page:'#162B20', surface:'#1C3328', text:'#C5E0D0', muted:'#7AAA90', accent:'#4DAA70', pageBgRgb:'22,43,32',     isDark:true  },
  'green-vivid':  { nav:'#002810', page:'#003818', surface:'#004D22', text:'#FFFFFF',  muted:'#88EEA8', accent:'#00DD55', pageBgRgb:'0,56,24',      isDark:true  },
  'blue-earth':   { nav:'#0E1E30', page:'#142438', surface:'#1A2E44', text:'#C5D5E8', muted:'#7A9AB5', accent:'#5A90C8', pageBgRgb:'20,36,56',     isDark:true  },
  'blue-vivid':   { nav:'#000E28', page:'#001238', surface:'#001A4D', text:'#FFFFFF',  muted:'#88AAFF', accent:'#2255FF', pageBgRgb:'0,18,56',      isDark:true  },
};

const familyVariant = {
  dark:'earth', light:'earth', red:'earth', orange:'earth', green:'earth', blue:'earth',
};

let currentMode = localStorage.getItem('up-theme')
  || localStorage.getItem('up-colour-mode')
  || 'dark-earth';

// ── Apply CSS variables ────────────────────────────────────────────────────────
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
  root.style.setProperty('--color-border',  m.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)');
  root.style.setProperty('--nav-border',    m.isDark ? 'none' : '1px solid rgba(0,0,0,0.10)');
  // Also set body background directly to prevent any flash
  document.body.style.backgroundColor = m.page;
  root.dataset.theme = mode;
  localStorage.setItem('up-theme', mode);
  currentMode = mode;
}

// ── Parse 'family-variant' ─────────────────────────────────────────────────────
function parseMode(mode) {
  const i = mode.lastIndexOf('-');
  return { family: mode.slice(0, i), variant: mode.slice(i + 1) };
}

// ── Activate family+variant, sync all UI ──────────────────────────────────────
function activatePill(family, variant) {
  familyVariant[family] = variant;
  applyMode(family + '-' + variant);

  // Active pill highlight
  document.querySelectorAll('.colour-pill').forEach(pill => {
    pill.classList.toggle('active', pill.dataset.family === family);
  });

  // Standalone Earth/Vivid toggle
  document.querySelectorAll('.ve-standalone .ve-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.v === variant);
  });
}

// ── Pill click — switches colour only, keeps current variant ──────────────────
function handlePillClick(pillEl) {
  const family  = pillEl.dataset.family;
  const variant = parseMode(currentMode).variant;
  activatePill(family, variant);
}

// Apply before first paint
applyMode(currentMode);

// Sync UI + bind Earth/Vivid buttons after DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const { family, variant } = parseMode(currentMode);
  familyVariant[family] = variant;
  activatePill(family, variant);

  // Bind standalone Earth/Vivid buttons
  document.querySelectorAll('.ve-standalone .ve-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      const { family: f } = parseMode(currentMode);
      activatePill(f, btn.dataset.v);
    });
  });
});
