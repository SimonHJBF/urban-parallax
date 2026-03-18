/**
 * Urban Parallax — Wheel / Drum Layout
 *
 * One comparison is always centred and fully expanded.
 * Every other entry compresses exponentially by distance, down to a 1px line.
 * Click an inactive entry to jump to it.
 * Click the active entry to expand the full detail inline, below the images.
 */

// ── State ──────────────────────────────────────────────────────────────────────
let comparisons    = [];
let currentIndex   = 0;
let isDetailOpen   = false;

// ── Wheel constants ────────────────────────────────────────────────────────────
const FULL_H     = 200;  // active entry height
const MIN_H      = 1;    // floor — always visible as a hairline + border
const DECAY      = 0.38;
const TRANSITION = 320;  // ms — slightly faster for crisper feel

// ── Boot ───────────────────────────────────────────────────────────────────────
async function init() {
  try {
    const res = await fetch('data/comparisons.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    comparisons = await res.json();
  } catch (err) {
    document.getElementById('wheelStack').innerHTML =
      `<p style="padding:80px 0;text-align:center;font-family:monospace;font-size:12px;color:var(--color-muted);">
        Could not load comparisons.json
      </p>`;
    console.error('Urban Parallax: failed to load data', err);
    return;
  }

  renderWheel();
  // Apply saved alignment to freshly-rendered images
  setImgPos(localStorage.getItem('up-img-pos') || 'top', false);
  initWheel();
}

// ── Render ─────────────────────────────────────────────────────────────────────
function renderWheel() {
  const stack = document.getElementById('wheelStack');
  stack.innerHTML = '';

  comparisons.forEach((c, idx) => {
    const entry       = document.createElement('div');
    entry.className   = 'wheel-entry';
    entry.dataset.idx = idx;
    entry.innerHTML   = buildEntryHTML(c);
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
  let sumAbove = 0;
  for (let i = 0; i < activeIndex; i++) {
    sumAbove += entryHeight(Math.abs(i - activeIndex)) + 1;
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

    // Width zoom: active = 115%, distance-1 = 107%, rest = 100%
    const pairRow = el.querySelector('.pair-row');
    if (pairRow) {
      const easing = `cubic-bezier(0.4,0,0.2,1)`;
      if (window.innerWidth <= 600) {
        // Mobile: zoom via padding (narrower padding = wider feel)
        const pad = dist === 0 ? 4 : dist === 1 ? 8 : 12;
        pairRow.style.transition = dur
          ? `padding-left ${dur}ms ${easing}, padding-right ${dur}ms ${easing}`
          : 'none';
        pairRow.style.paddingLeft  = pad + 'px';
        pairRow.style.paddingRight = pad + 'px';
      } else {
        // Desktop: zoom via max-width
        const BASE_W   = 760;
        const pairMaxW = dist === 0 ? BASE_W * 1.15 : dist === 1 ? BASE_W * 1.07 : BASE_W;
        pairRow.style.transition = dur
          ? `max-width ${dur}ms ${easing}`
          : 'none';
        pairRow.style.maxWidth = pairMaxW + 'px';
      }
    }
  });

  currentIndex = activeIndex;
}

// fromClick = true means the call came from a user click, not navigation.
// Only a click on the already-active entry opens the detail.
function goTo(index, fromClick) {
  if (isDetailOpen) return;

  const total   = document.querySelectorAll('.wheel-entry').length;
  const clamped = Math.max(0, Math.min(total - 1, index));

  if (clamped === currentIndex) {
    if (fromClick) openDetail(clamped);
    return;
  }

  applyWheel(clamped, true);
}

// ── Input bindings ─────────────────────────────────────────────────────────────
let wheelAcc      = 0;
let wheelCooldown = false;

function initWheelInput() {
  const vp = document.getElementById('wheelViewport');

  // Mouse wheel — skip when detail is open so native scroll works
  vp.addEventListener('wheel', e => {
    if (isDetailOpen) return;
    e.preventDefault();
    if (wheelCooldown) return;
    wheelAcc += e.deltaY;
    if (Math.abs(wheelAcc) > 40) {
      goTo(currentIndex + (wheelAcc > 0 ? 1 : -1));
      wheelAcc = 0;
      wheelCooldown = true;
      setTimeout(() => { wheelCooldown = false; }, TRANSITION + 60);
    }
  }, { passive: false });

  // Touch swipe
  let touchStartY = 0;
  vp.addEventListener('touchstart', e => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  vp.addEventListener('touchend', e => {
    if (isDetailOpen) return;
    const dy = touchStartY - e.changedTouches[0].clientY;
    if (Math.abs(dy) > 30) goTo(currentIndex + (dy > 0 ? 1 : -1));
  }, { passive: true });

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' && !isDetailOpen) { e.preventDefault(); goTo(currentIndex + 1); }
    if (e.key === 'ArrowUp'   && !isDetailOpen) { e.preventDefault(); goTo(currentIndex - 1); }
    if (e.key === 'Escape') closeDetail();
  });
}

function attachEntryClicks() {
  document.querySelectorAll('.wheel-entry').forEach((el, i) => {
    el.addEventListener('click', () => {
      // If detail is open, clicking the expanded entry (anywhere except the
      // detail body itself, which stops propagation) closes it.
      if (isDetailOpen) {
        if (i === currentIndex) closeDetail();
        return;
      }
      goTo(i, true);
    });
  });
}

function initWheel() {
  attachEntryClicks();
  initWheelInput();
  applyWheel(0, false);
}

// ── Detail — opens inline below the pair images ────────────────────────────────
function openDetail(idx) {
  if (isDetailOpen) return;
  const c     = comparisons[idx];
  const entry = document.querySelector(`.wheel-entry[data-idx="${idx}"]`);
  if (!c || !entry) return;

  // Inject expand HTML inside the entry, below pair-row
  const inner    = entry.querySelector('.wheel-entry-inner');
  const detailEl = document.createElement('div');
  detailEl.className = 'wheel-entry-detail';
  detailEl.innerHTML = buildExpandHTML(c);
  // Clicks inside the detail body must not bubble up to the entry
  // (which would immediately close the detail).
  detailEl.addEventListener('click', e => e.stopPropagation());
  inner.appendChild(detailEl);

  // Let the entry grow to its natural content height
  entry.style.transition = `height ${TRANSITION}ms cubic-bezier(0.4,0,0.2,1)`;
  entry.style.overflow   = 'visible';
  entry.style.height     = 'auto';
  entry.classList.add('is-expanded');

  // Make the viewport scrollable so the user can read the full detail
  const vp      = document.getElementById('wheelViewport');
  const stackEl = document.getElementById('wheelStack');
  vp.classList.add('is-expanded');

  // Scroll the viewport so the top of the active entry aligns with the viewport top
  const stackTop  = parseFloat(stackEl.style.top) || 0;
  let   sumAbove  = 0;
  for (let i = 0; i < idx; i++) sumAbove += entryHeight(Math.abs(i - idx)) + 1;
  const entryTopInViewport = stackTop + sumAbove;
  requestAnimationFrame(() => {
    vp.scrollTop = Math.max(0, entryTopInViewport);
  });

  isDetailOpen = true;

  // Bind close button inside the injected HTML
  detailEl.querySelector('.up-close-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    closeDetail();
  });
}

function closeDetail() {
  if (!isDetailOpen) return;

  const entry = document.querySelector('.wheel-entry.is-expanded');
  if (entry) {
    entry.querySelector('.wheel-entry-detail')?.remove();
    entry.style.transition = 'none';
    entry.style.overflow   = 'hidden';
    entry.style.height     = FULL_H + 'px';
    entry.classList.remove('is-expanded');
  }

  const vp = document.getElementById('wheelViewport');
  vp.classList.remove('is-expanded');
  vp.scrollTop = 0;

  isDetailOpen = false;
}

// ── Expand HTML ────────────────────────────────────────────────────────────────
function buildExpandHTML(c) {
  const leftBodyHTML  = c.left?.body  ? marked.parse(c.left.body)  : '';
  const rightBodyHTML = c.right?.body ? marked.parse(c.right.body) : '';

  const meta = c.metadata || {};
  const pillFields = ['topic', 'scale', 'system', 'season', 'population_density', 'year_built', 'architect'];
  let pills = pillFields
    .filter(k => meta[k])
    .map(k => `<span class="up-pill"><span class="up-pill-key">${esc(formatKey(k))}</span>${esc(meta[k])}</span>`)
    .join('');
  if (meta.coordinates) {
    pills += `<span class="up-pill"><span class="up-pill-key">coords</span>${esc(meta.coordinates.left)} / ${esc(meta.coordinates.right)}</span>`;
  }

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
          <span>${esc(c.left?.city || '')}</span>
          <span></span>
          <span>${esc(c.right?.city || '')}</span>
        </div>
        ${rows}
      </div>`;
  }

  // Support both new extraMedia (typed) and legacy extraImages (string array)
  const toMedia = arr => (arr || []).map(p => typeof p === 'string' ? { type: 'image', path: p } : p);
  const renderMedia = items => toMedia(items).map(item =>
    item.type === 'video'
      ? `<video src="${esc(item.path)}" class="up-extra-item up-extra-video" controls preload="metadata" playsinline></video>`
      : `<img  src="${esc(item.path)}" class="up-extra-item up-extra-img" alt="" loading="lazy">`
  ).join('');

  const leftExtras  = renderMedia(c.left?.extraMedia  || c.left?.extraImages);
  const rightExtras = renderMedia(c.right?.extraMedia || c.right?.extraImages);

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
          ${leftExtras ? `<div class="up-extra-media">${leftExtras}</div>` : ''}
          <p class="up-credit">${esc(c.left?.contributor || '')}${c.date ? ' · ' + c.date : ''}</p>
        </div>

        <div class="up-divider-v"></div>

        <div class="up-expand-body">
          ${c.right?.subtitle ? `<div class="up-expand-subtitle">${esc(c.right.subtitle)}</div>` : ''}
          <div class="up-body-text">${rightBodyHTML}</div>
          ${rightExtras ? `<div class="up-extra-media">${rightExtras}</div>` : ''}
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

// ── Image alignment toggle (T / C / B) ─────────────────────────────────────────
const IMG_POS_MAP = { top: 'center top', center: 'center center', bottom: 'center bottom' };

function setImgPos(pos, save) {
  const objectPosition = IMG_POS_MAP[pos] || 'center center';

  // 1. Body dataset — drives CSS selector rules for future renders
  document.body.dataset.imgPos = pos;

  // 2. Directly update all currently-rendered pair images
  document.querySelectorAll('.pair-image img').forEach(img => {
    img.style.objectPosition = objectPosition;
  });

  // 3. Update button active state
  document.querySelectorAll('.align-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.pos === pos);
  });

  if (save) localStorage.setItem('up-img-pos', pos);
}

function initAlignToggle() {
  const saved = localStorage.getItem('up-img-pos') || 'top';
  setImgPos(saved, false);
  document.querySelectorAll('.align-opt').forEach(btn => {
    btn.addEventListener('click', () => setImgPos(btn.dataset.pos, true));
  });
}

// ── Start ──────────────────────────────────────────────────────────────────────
initAlignToggle();
init();
