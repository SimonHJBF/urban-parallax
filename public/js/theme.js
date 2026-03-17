/**
 * Urban Parallax — Theme System
 * 6 base themes × 2 moods (earthy / vivid) = 12 combinations
 * Persists to localStorage. Drives all colors via CSS custom properties.
 */

const THEMES = {
  light: {
    earthy: {
      bg:          '#F4F4F2',
      bgSurface:   '#EDEDE8',
      lens:        'rgba(255,255,255,0.45)',
      lensBorder:  'rgba(0,0,0,0.05)',
      text:        '#1A1A1A',
      textMuted:   '#7A7A76',
      textHint:    '#A5A5A0',
      accent:      '#C4553A',
      divider:     '#D5D5D0',
      imgBg:       '#DDD8D0',
      imgBgAlt:    '#D5D0C8',
      border:      '#D0CEC8',
    },
    vivid: {
      bg:          '#EFEFED',
      bgSurface:   '#E6E6E2',
      lens:        'rgba(255,255,255,0.55)',
      lensBorder:  'rgba(0,0,0,0.07)',
      text:        '#0A0A0A',
      textMuted:   '#555555',
      textHint:    '#888888',
      accent:      '#E8432A',
      divider:     '#C5C5C0',
      imgBg:       '#D0CAC0',
      imgBgAlt:    '#C8C2B8',
      border:      '#BBBBB5',
    },
  },
  dark: {
    earthy: {
      bg:          '#1A1A18',
      bgSurface:   '#222220',
      lens:        'rgba(255,255,255,0.04)',
      lensBorder:  'rgba(255,255,255,0.07)',
      text:        '#E0DED8',
      textMuted:   '#888580',
      textHint:    '#5A5850',
      accent:      '#D08060',
      divider:     '#333330',
      imgBg:       '#2A2826',
      imgBgAlt:    '#262422',
      border:      '#3A3A36',
    },
    vivid: {
      bg:          '#0E0E12',
      bgSurface:   '#18181E',
      lens:        'rgba(255,255,255,0.06)',
      lensBorder:  'rgba(255,255,255,0.10)',
      text:        '#F5F3F0',
      textMuted:   '#A0A0B0',
      textHint:    '#606070',
      accent:      '#FF6040',
      divider:     '#2A2A35',
      imgBg:       '#1C1C24',
      imgBgAlt:    '#18181E',
      border:      '#35353E',
    },
  },
  red: {
    earthy: {
      bg:          '#F2E8E5',
      bgSurface:   '#ECDEDA',
      lens:        'rgba(255,255,255,0.45)',
      lensBorder:  'rgba(160,80,60,0.10)',
      text:        '#3A1A14',
      textMuted:   '#8A5A4A',
      textHint:    '#B08878',
      accent:      '#A84030',
      divider:     '#D8C0B8',
      imgBg:       '#E0CCC5',
      imgBgAlt:    '#D8C4BB',
      border:      '#D0B8B0',
    },
    vivid: {
      bg:          '#FFE8E0',
      bgSurface:   '#FFDDD0',
      lens:        'rgba(255,255,255,0.50)',
      lensBorder:  'rgba(255,60,40,0.12)',
      text:        '#2A0A05',
      textMuted:   '#AA4030',
      textHint:    '#CC8070',
      accent:      '#E82010',
      divider:     '#FFBAA8',
      imgBg:       '#FFD0C0',
      imgBgAlt:    '#FFC4B0',
      border:      '#FFB0A0',
    },
  },
  orange: {
    earthy: {
      bg:          '#F2ECE0',
      bgSurface:   '#ECE4D6',
      lens:        'rgba(255,255,255,0.45)',
      lensBorder:  'rgba(160,120,40,0.10)',
      text:        '#3A2A10',
      textMuted:   '#8A7040',
      textHint:    '#B09868',
      accent:      '#A07020',
      divider:     '#D8CCB0',
      imgBg:       '#E0D4C0',
      imgBgAlt:    '#D8CCB5',
      border:      '#D0C4A8',
    },
    vivid: {
      bg:          '#FFF2D5',
      bgSurface:   '#FFE8C0',
      lens:        'rgba(255,255,255,0.50)',
      lensBorder:  'rgba(255,160,0,0.12)',
      text:        '#2A1800',
      textMuted:   '#AA7010',
      textHint:    '#CCA030',
      accent:      '#E88A00',
      divider:     '#FFD890',
      imgBg:       '#FFE4A8',
      imgBgAlt:    '#FFDC95',
      border:      '#FFD080',
    },
  },
  green: {
    earthy: {
      bg:          '#E8EEE4',
      bgSurface:   '#E0E6DA',
      lens:        'rgba(255,255,255,0.45)',
      lensBorder:  'rgba(80,130,60,0.10)',
      text:        '#1A2A14',
      textMuted:   '#507040',
      textHint:    '#7A9A68',
      accent:      '#4A7A30',
      divider:     '#C0D0B8',
      imgBg:       '#CEDCC5',
      imgBgAlt:    '#C5D4BB',
      border:      '#B8C8B0',
    },
    vivid: {
      bg:          '#E0FFE0',
      bgSurface:   '#D0F8D0',
      lens:        'rgba(255,255,255,0.50)',
      lensBorder:  'rgba(40,200,40,0.12)',
      text:        '#0A2000',
      textMuted:   '#308020',
      textHint:    '#60B048',
      accent:      '#20AA10',
      divider:     '#90EE90',
      imgBg:       '#B0FFB0',
      imgBgAlt:    '#A0F8A0',
      border:      '#80E880',
    },
  },
  blue: {
    earthy: {
      bg:          '#E4EAF0',
      bgSurface:   '#DCE2EA',
      lens:        'rgba(255,255,255,0.45)',
      lensBorder:  'rgba(60,100,160,0.10)',
      text:        '#14202A',
      textMuted:   '#406080',
      textHint:    '#6888A8',
      accent:      '#306898',
      divider:     '#B8C8D8',
      imgBg:       '#C5D0DC',
      imgBgAlt:    '#BCC8D4',
      border:      '#B0C0D0',
    },
    vivid: {
      bg:          '#DDF0FF',
      bgSurface:   '#D0E8FF',
      lens:        'rgba(255,255,255,0.50)',
      lensBorder:  'rgba(40,120,255,0.12)',
      text:        '#001830',
      textMuted:   '#2060B0',
      textHint:    '#4090DD',
      accent:      '#0070EE',
      divider:     '#90C8FF',
      imgBg:       '#A8DAFF',
      imgBgAlt:    '#98D0FF',
      border:      '#80C0FF',
    },
  },
};

// camelCase → kebab-case
function toKebab(str) {
  return str.replace(/([A-Z])/g, m => '-' + m.toLowerCase());
}

let currentTheme = localStorage.getItem('up-theme') || 'light';
let currentMood  = localStorage.getItem('up-mood')  || 'earthy';

function applyTheme(theme, mood) {
  const t    = THEMES[theme][mood];
  const root = document.documentElement;

  Object.keys(t).forEach(key => {
    root.style.setProperty('--up-' + toKebab(key), t[key]);
  });

  document.body.dataset.theme = theme;
  document.body.dataset.mood  = mood;

  localStorage.setItem('up-theme', theme);
  localStorage.setItem('up-mood',  mood);

  currentTheme = theme;
  currentMood  = mood;

  // Update swatch active state
  document.querySelectorAll('.theme-swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.theme === theme);
  });

  // Update mood toggle label
  const toggle = document.getElementById('mood-toggle');
  if (toggle) toggle.textContent = mood;
}

function toggleMood() {
  applyTheme(currentTheme, currentMood === 'earthy' ? 'vivid' : 'earthy');
}

// Apply immediately (before paint) to avoid flash
applyTheme(currentTheme, currentMood);

// After DOM ready: sync UI state (swatches + mood label)
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(currentTheme, currentMood);
});
