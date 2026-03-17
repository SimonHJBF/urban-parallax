/**
 * Urban Parallax — Wheel / Drum Layout
 *
 * One comparison is always centred and fully expanded.
 * Every other entry compresses exponentially by distance, down to a 1px line.
 * Click any entry to jump to it. Click the active entry to open the full detail.
 */

// ── State ──────────────────────────────────────────────────────────────────────
let comparisons  = [];
let currentIndex = 0;

// ── Wheel constants ────────────────────────────────────────────────────────────
const FULL_H     = 200;  // height of the active (centred) entry in px
const MIN_H      = 1;    // floor — every entry is at least 1px (the border line)
const DECAY      = 0.38; // exponential decay per distance step
const TRANSITION = 400;  // animation duration in ms

// ── Boot ───────────────────────────────────────────────────────────────────────
async function init() {
  try {
    const res = await fetch('data/comparisons.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    comparisons = await res.json();
  } catch (err) {
    document.getElementById('wheelStack').innerHTML =
      `<p style="padding:80px 0;text-align:center;font-family:monospace;font-size:12px;color:var(--color-muted);">
        Could not load comparisons.json<br>
        <code style="font-size:11px">node scripts/build-data.js</code>
      </p>`;
    console.error('Urban Parallax: failed to load data', err);
    return;
  }

  renderWheel();
  initWheel();
  bindDetailClose();
}

// ── Render ─────────────────────────────────────────────────────────────────────
function renderWheel() {
  const stack = document.getElementById('wheelStack');
  stack.innerHTML = '';

  comparisons.forEach((c, idx) => {
    const entry        = document.createElement('div');
    entry.className    = 'wheel-entry';
    entry.dataset.idx  = idx;
    entry.innerHTML    = buildEntryHTML(c);
    stack.appendChild(entry);
  });
}

function buildEntryHTML(c) {
  const leftImg   = esc(c.left?.image  || 'images/site/placeholder.svg');
  const rightImg  = esc(c.right?.image || 'images/site/placeholder.svg');

  const leftCity  = c.left?.neighbourhood
    ? `${c.left.city} · ${c.left.neighbourhood}`
    : (c.left?.city || '');
  const rightCity = c.right?.neighbourhood
    ? `${c.right.city} · ${c.right.neighbourhood}`
    : (c.right?.city || '');

  return `
    <div class="wheel-entry-inner">
      <div class="pair-row">
        <div class="pair-side">
          <div class="pair-image">
            <img src="${leftImg}" alt="${esc(leftCity)}" loading="lazy">
          </div>
          <div class="pair-text">
            <div class="pair-city">${esc(leftCity)}</div>
            <div class="pair-title">${esc(c.left?.title || '')}</div>
            <div class="pair-desc">${esc(c.left?.description || '')}</div>
          </div>
        </div>
        <div class="pair-side">
          <div class="pair-image">
            <img src="${rightImg}" alt="${esc(rightCity)}" loading="lazy">
          </div>
          <div class="pair-text">
            <div class="pair-city">${esc(rightCity)}</div>
            <div class="pair-title">${esc(c.right?.title || '')}</div>
            <div class="pair-desc">${esc(c.right?.description || '')}</div>
          </div>
        </div>
      </div>
    </div>`;
}

// ── Wheel engine ───────────────────────────────────────────────────────────────
function entryHeight(distance) {
  if (distance === 0) return FULL_H;
  return Math.max(FULL_H * Math.pow(DECAY, distance), MIN_H);
}

function entryOpacity(distance) {
  if (distance === 0) return 1;
  return Math.max(Math.pow(0.62, distance), 0.18);
}

function getStackTop(activeIndex) {
  // Sum heights of all entries above the active one (including their 1px borders)
  let sumAbove = 0;
  for (let i = 0; i < activeIndex; i++) {
    sumAbove += entryHeight(Math.abs(i - activeIndex)) + 1; // +1 for border-bottom
  }
  const viewportH = document.getElementById('wheelViewport').offsetHeight;
  const activeMid = sumAbove + entryHeight(0) / 2;
  return (viewportH / 2) - activeMid;
}

function applyWheel(activeIndex, animate) {
  const entries = document.querySelectorAll('.wheel-entry');
  const stack   = document.getElementById('wheelStack');
  const top     = getStackTop(activeIndex);
  const dur     = animate ? TRANSITION : 0;

  stack.style.transition = dur
    ? `top ${dur}ms cubic-bezier(0.4,0,0.2,1)`
    : 'none';
  stack.style.top = top + 'px';

  entries.forEach((el, i) => {
    const dist = Math.abs(i - activeIndex);
    el.style.transition = dur
      ? `height ${dur}ms cubic-bezier(0.4,0,0.2,1), opacity ${dur}ms ease`
      : 'none';
    el.style.height  = entryHeight(dist) + 'px';
    el.style.opacity = entryOpacity(dist);
    el.classList.toggle('is-active', i === activeIndex);
  });

  currentIndex = activeIndex;
}

function goTo(index) {
  const entries = document.querySelectorAll('.wheel-entry');
  const clamped = Math.max(0, Math.min(entries.length - 1, index));

  if (clamped === currentIndex) {
    // Clicking the already-active entry opens the full detail
    openDetail(clamped);
    return;
  }

  applyWheel(clamped, true);
}

// ── Input bindings ─────────────────────────────────────────────────────────────
let wheelAcc = 0;

function initWheelInput() {
  const vp = document.getElementById('wheelViewport');

  // Mouse wheel
  vp.addEventListener('wheel', e => {
    e.preventDefault();
    wheelAcc += e.deltaY;
    if (Math.abs(wheelAcc) > 40) {
      goTo(currentIndex + (wheelAcc > 0 ? 1 : -1));
      wheelAcc = 0;
    }
  }, { passive: false });

  // Touch swipe
  let touchStartY = 0;
  vp.addEventListener('touchstart', e => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  vp.addEventListener('touchend', e => {
    const dy = touchStartY - e.changedTouches[0].clientY;
    if (Math.abs(dy) > 30) goTo(currentIndex + (dy > 0 ? 1 : -1));
  }, { passive: true });

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); goTo(currentIndex + 1); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); goTo(currentIndex - 1); }
    if (e.key === 'Escape')    { closeDetail(); }
  });
}

function attachEntryClicks() {
  document.querySelectorAll('.wheel-entry').forEach((el, i) => {
    el.addEventListener('click', () => goTo(i));
  });
}

function initWheel() {
  attachEntryClicks();
  initWheelInput();
  applyWheel(0, false);
}

// ── Detail overlay ─────────────────────────────────────────────────────────────
function openDetail(idx) {
  const c = comparisons[idx];
  if (!c) return;

  const overlay = document.getElementById('wheelDetail');
  const inner   = document.getElementById('wheelDetailInner');

  inner.innerHTML = buildExpandHTML(c);
  overlay.hidden  = false;

  // Two rAF frames to ensure hidden→display transition fires
  requestAnimationFrame(() => requestAnimationFrame(() => {
    overlay.classList.add('open');
  }));

  // Bind the close button rendered inside the expand HTML
  const closeBtn = inner.querySelector('.up-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', closeDetail);
}

function closeDetail() {
  const overlay = document.getElementById('wheelDetail');
  overlay.classList.remove('open');
  setTimeout(() => { overlay.hidden = true; }, 380);
}

function bindDetailClose() {
  document.getElementById('wheelDetailClose').addEventListener('click', closeDetail);
}

// ── Expand HTML ────────────────────────────────────────────────────────────────
function buildExpandHTML(c) {
  const leftBodyHTML  = c.left?.body  ? marked.parse(c.left.body)  : '';
  const rightBodyHTML = c.right?.body ? marked.parse(c.right.body) : '';

  // Metadata pills
  const meta = c.metadata || {};
  const pillFields = ['topic', 'scale', 'system', 'season', 'population_density', 'year_built', 'architect'];
  let pills = pillFields
    .filter(k => meta[k])
    .map(k => `<span class="up-pill"><span class="up-pill-key">${esc(formatKey(k))}</span>${esc(meta[k])}</span>`)
    .join('');
  if (meta.coordinates) {
    pills += `<span class="up-pill"><span class="up-pill-key">coords</span>${esc(meta.coordinates.left)} / ${esc(meta.coordinates.right)}</span>`;
  }

  // Quick facts
  let qfHTML = '';
  if (c.quickFacts && c.quickFacts.length) {
    const rows = c.quickFacts.map(r =>
      `<div class="up-qf-row">
        <span class="up-qf-left">${esc(r.left)}</span>
        <span class="up-qf-sep">—</span>
        <span class="up-qf-right">${esc(r.right)}</span>
      </div>`
    ).join('');
    qfHTML = `
      <div class="up-quickfacts">
        <div class="up-qf-header">
          <span>${esc(c.left.city)}</span>
          <span></span>
          <span>${esc(c.right.city)}</span>
        </div>
        ${rows}
      </div>`;
  }

  // Extra images
  const leftExtras  = (c.left?.extraImages  || []).map(src => `<img src="${esc(src)}" alt="" loading="lazy" class="up-extra-img">`).join('');
  const rightExtras = (c.right?.extraImages || []).map(src => `<img src="${esc(src)}" alt="" loading="lazy" class="up-extra-img">`).join('');

  // Tags
  const tagsHTML = c.tags && c.tags.length
    ? `<div class="up-tags">${c.tags.map(t => `<span class="up-tag">#${esc(t)}</span>`).join('')}</div>`
    : '';

  return `
    <div class="up-expand-inner">
      ${c.introduction ? `<p class="up-introduction">${esc(c.introduction)}</p>` : ''}
      ${pills ? `<div class="up-meta-pills">${pills}</div>` : ''}
      ${qfHTML}

      <div class="up-expand-grid">
        <div class="up-expand-body">
          ${c.left?.subtitle  ? `<div class="up-expand-subtitle">${esc(c.left.subtitle)}</div>` : ''}
          <div class="up-body-text">${leftBodyHTML}</div>
          ${leftExtras ? `<div class="up-extra-images">${leftExtras}</div>` : ''}
          <p class="up-credit">${esc(c.left?.contributor || '')}${c.date ? ' · ' + c.date : ''}</p>
        </div>

        <div class="up-divider-v"></div>

        <div class="up-expand-body">
          ${c.right?.subtitle ? `<div class="up-expand-subtitle">${esc(c.right.subtitle)}</div>` : ''}
          <div class="up-body-text">${rightBodyHTML}</div>
          ${rightExtras ? `<div class="up-extra-images">${rightExtras}</div>` : ''}
          <p class="up-credit">${esc(c.right?.contributor || '')}${c.date ? ' · ' + c.date : ''}</p>
        </div>
      </div>

      ${tagsHTML}
      <button class="up-close-btn" aria-label="Close">close ↑</button>
    </div>`;
}

// ── Utilities ──────────────────────────────────────────────────────────────────
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatKey(key) {
  return key.replace(/_/g, ' ');
}

// ── Start ──────────────────────────────────────────────────────────────────────
init();
