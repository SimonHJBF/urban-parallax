/**
 * Urban Parallax — Colour Mode System
 * 12 modes: 6 families × 2 variants (earth / vivid)
 * localStorage key: 'up-theme'   Default: 'dark-earth'
 */

const COLOUR_MODES = {
  'dark-vivid':   { nav:'#0A0A0A', page:'#111111', surface:'#1C1C1C', text:'#FFFFFF',   muted:'#AAAAAA', accent:'#FF3B3B', pageBgRgb:'17,17,17',    isDark:true  },
  'dark-earth':   { nav:'#1A1410', page:'#221C17', surface:'#2A221C', text:'#E8D9C5',   muted:'#9A8A78', accent:'#C4622D', pageBgRgb:'34,28,23',    isDark:true  },
  'light-vivid':  { nav:'#FFFFFF', page:'#F0F0EE', surface:'#FFFFFF', text:'#0A0A0A',   muted:'#666666', accent:'#E0200A', pageBgRgb:'240,240,238', isDark:false },
  'light-earth':  { nav:'#F0E8DC', page:'#F5EFE6', surface:'#EDE5D8', text:'#2A1F15',   muted:'#7A6555', accent:'#93511D', pageBgRgb:'245,239,230', isDark:false },
  'red-vivid':    { nav:'#1A0505', page:'#200808', surface:'#2D0A0A', text:'#FFFFFF',   muted:'#CC8888', accent:'#FF4040', pageBgRgb:'32,8,8',      isDark:true  },
  'red-earth':    { nav:'#2E1410', page:'#3D1E18', surface:'#4A2018', text:'#F0D5CB',   muted:'#B08878', accent:'#E06040', pageBgRgb:'61,30,24',    isDark:true  },
  'orange-vivid': { nav:'#150A00', page:'#1C0F00', surface:'#241400', text:'#FFFFFF',   muted:'#CC9966', accent:'#FF8000', pageBgRgb:'28,15,0',     isDark:true  },
  'orange-earth': { nav:'#221600', page:'#2E1E06', surface:'#3A2408', text:'#F5DEB0',   muted:'#AA9070', accent:'#D4821A', pageBgRgb:'46,30,6',     isDark:true  },
  'green-vivid':  { nav:'#041408', page:'#061A0C', surface:'#0A2412', text:'#FFFFFF',   muted:'#66BB88', accent:'#00D44A', pageBgRgb:'6,26,12',     isDark:true  },
  'green-earth':  { nav:'#0F2018', page:'#152B20', surface:'#1A3325', text:'#C5E0D0',   muted:'#7AAA90', accent:'#4DAA70', pageBgRgb:'21,43,32',    isDark:true  },
  'blue-vivid':   { nav:'#040A18', page:'#061020', surface:'#0A1628', text:'#FFFFFF',   muted:'#7AABDD', accent:'#2060FF', pageBgRgb:'6,16,32',     isDark:true  },
  'blue-earth':   { nav:'#0E1E30', page:'#132438', surface:'#172D42', text:'#C5D5E8',   muted:'#7A9AB5', accent:'#5A90C8', pageBgRgb:'19,36,56',    isDark:true  },
};

// Per-family last-used variant (defaults to 'earth', updated as user clicks)
const familyVariant = {
  dark: 'earth', light: 'earth', red: 'earth', orange: 'earth', green: 'earth', blue: 'earth',
};

// Migrate from old key if present
let currentMode = localStorage.getItem('up-theme')
  || localStorage.getItem('up-colour-mode')
  || 'dark-earth';

// ── Apply a mode key (e.g. 'red-vivid') ──────────────────────────────────────
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

  // data-theme on <html> drives [data-theme*="light"] CSS selectors for pills
  root.dataset.theme = mode;

  localStorage.setItem('up-theme', mode);
  currentMode = mode;
}

// ── Parse 'family-variant' string (handles 'orange-earth', 'blue-vivid', etc.)
function parseMode(mode) {
  const i = mode.lastIndexOf('-');
  return { family: mode.slice(0, i), variant: mode.slice(i + 1) };
}

// ── Activate a family+variant, update pill UI ─────────────────────────────────
function activatePill(family, variant) {
  familyVariant[family] = variant;
  applyMode(family + '-' + variant);

  document.querySelectorAll('.colour-pill').forEach(pill => {
    const isActive = pill.dataset.family === family;
    pill.classList.toggle('active', isActive);

    const ve = pill.querySelector('.pill-ve');
    if (ve) ve.classList.toggle('hidden', !isActive);

    if (isActive) {
      pill.querySelectorAll('.ve-opt').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.v === variant);
      });
    }
  });
}

// ── Pill button click ─────────────────────────────────────────────────────────
function handlePillClick(pillEl) {
  const family  = pillEl.dataset.family;
  const variant = familyVariant[family] || 'earth';
  activatePill(family, variant);
}

// ── Earth/Vivid sub-toggle click ──────────────────────────────────────────────
function handleVariantClick(event, optEl) {
  event.stopPropagation();
  const variant = optEl.dataset.v;
  const family  = optEl.closest('.colour-pill').dataset.family;
  activatePill(family, variant);
}

// ── Apply before first paint to eliminate flash ───────────────────────────────
applyMode(currentMode);

// ── Restore pill UI after DOM is ready ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const { family, variant } = parseMode(currentMode);
  familyVariant[family] = variant;
  activatePill(family, variant);
});
