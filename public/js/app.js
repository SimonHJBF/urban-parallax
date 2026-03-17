/**
 * Urban Parallax — Main App
 * Fetches comparisons.json, renders the feed, handles expand / collapse.
 */

// ── State ─────────────────────────────────────────────────────────────────────
let comparisons  = [];
let expandedIdx  = null;

// ── Boot ──────────────────────────────────────────────────────────────────────
async function init() {
  try {
    const res = await fetch('data/comparisons.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    comparisons = await res.json();
  } catch (err) {
    document.getElementById('feed').innerHTML =
      `<p style="padding:80px 0;text-align:center;font-family:monospace;font-size:12px;color:var(--color-muted);">
        Could not load comparisons.json — run the build script first.<br>
        <code style="font-size:11px">node scripts/build-data.js</code>
      </p>`;
    console.error('Urban Parallax: failed to load data', err);
    return;
  }

  renderFeed();
  BlurEngine.init();
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderFeed() {
  const feed = document.getElementById('feed');
  feed.innerHTML = '';

  if (!comparisons.length) {
    feed.innerHTML =
      `<p style="padding:80px 0;text-align:center;font-family:monospace;font-size:12px;color:var(--color-muted);">No published comparisons yet.</p>`;
    return;
  }

  // Group by YYYY-MM for date headers
  let lastMonth = null;

  comparisons.forEach((c, idx) => {
    const monthKey = c.date ? c.date.slice(0, 7) : null;

    if (monthKey && monthKey !== lastMonth) {
      feed.appendChild(createDateHeader(c.date));
      lastMonth = monthKey;
    }

    feed.appendChild(createRow(c, idx));
  });

  // Register all lensable elements
  refreshLensElements();
}

function createDateHeader(dateStr) {
  const el  = document.createElement('div');
  el.className = 'up-date-header';
  const d = new Date(dateStr + 'T12:00:00');
  el.textContent = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase();
  return el;
}

function refreshLensElements() {
  const feed = document.getElementById('feed');
  const els  = feed.querySelectorAll('.up-row, .up-date-header');
  BlurEngine.setElements(els);
  BlurEngine.scheduleUpdate();
}

// ── Row ───────────────────────────────────────────────────────────────────────
function createRow(c, idx) {
  const row = document.createElement('article');
  row.className   = 'up-row';
  row.dataset.idx = idx;

  // Preview grid
  const grid = document.createElement('div');
  grid.className = 'up-row-grid';
  grid.setAttribute('role', 'button');
  grid.setAttribute('tabindex', '0');
  grid.setAttribute('aria-expanded', 'false');
  grid.setAttribute('aria-label', `${c.title} — ${c.left.city} vs ${c.right.city}. Click to expand.`);

  grid.appendChild(createCell(c.left,  'left'));
  grid.appendChild(createDivider());
  grid.appendChild(createCell(c.right, 'right'));
  row.appendChild(grid);

  // Expand panel
  const expand = document.createElement('div');
  expand.className   = 'up-expand';
  expand.innerHTML   = buildExpandHTML(c);
  row.appendChild(expand);

  // Interactions
  grid.addEventListener('click', () => toggleRow(idx, row, grid, expand));
  grid.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleRow(idx, row, grid, expand);
    }
  });

  const closeBtn = expand.querySelector('.up-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', e => {
      e.stopPropagation();
      collapseRow(idx, row, grid, expand);
    });
  }

  return row;
}

function createCell(side, position) {
  const cell = document.createElement('div');
  cell.className = `up-cell up-cell--${position}`;

  // Image
  const imgWrap = document.createElement('div');
  imgWrap.className = 'up-image-wrap';
  const img = document.createElement('img');
  img.src     = side.image || `images/site/placeholder.svg`;
  img.alt     = `${side.city}${side.neighbourhood ? ', ' + side.neighbourhood : ''} — ${side.title || ''}`;
  img.loading = 'lazy';
  imgWrap.appendChild(img);
  cell.appendChild(imgWrap);

  // Text
  const text = document.createElement('div');
  text.className = 'up-cell-text';

  const label = document.createElement('span');
  label.className   = 'up-city-label';
  label.textContent = side.neighbourhood
    ? `${side.city} · ${side.neighbourhood}`
    : side.city;

  const title = document.createElement('h2');
  title.className   = 'up-cell-title';
  title.textContent = side.title || '';

  const desc = document.createElement('p');
  desc.className   = 'up-cell-desc';
  desc.textContent = side.description || '';

  text.append(label, title, desc);
  cell.appendChild(text);
  return cell;
}

function createDivider() {
  const d = document.createElement('div');
  d.className = 'up-divider-v';
  return d;
}

// ── Expand HTML ───────────────────────────────────────────────────────────────
function buildExpandHTML(c) {
  const leftBodyHTML  = c.left.body  ? marked.parse(c.left.body)  : '';
  const rightBodyHTML = c.right.body ? marked.parse(c.right.body) : '';

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
  const leftExtras  = (c.left.extraImages  || []).map(src => `<img src="${esc(src)}" alt="" loading="lazy" class="up-extra-img">`).join('');
  const rightExtras = (c.right.extraImages || []).map(src => `<img src="${esc(src)}" alt="" loading="lazy" class="up-extra-img">`).join('');

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
          ${c.left.subtitle  ? `<div class="up-expand-subtitle">${esc(c.left.subtitle)}</div>` : ''}
          <div class="up-body-text">${leftBodyHTML}</div>
          ${leftExtras ? `<div class="up-extra-images">${leftExtras}</div>` : ''}
          <p class="up-credit">${esc(c.left.contributor || '')}${c.date ? ' · ' + c.date : ''}</p>
        </div>

        <div class="up-divider-v"></div>

        <div class="up-expand-body">
          ${c.right.subtitle ? `<div class="up-expand-subtitle">${esc(c.right.subtitle)}</div>` : ''}
          <div class="up-body-text">${rightBodyHTML}</div>
          ${rightExtras ? `<div class="up-extra-images">${rightExtras}</div>` : ''}
          <p class="up-credit">${esc(c.right.contributor || '')}${c.date ? ' · ' + c.date : ''}</p>
        </div>
      </div>

      ${tagsHTML}
      <button class="up-close-btn" aria-label="Close">close ↑</button>
    </div>`;
}

// ── Toggle / Expand / Collapse ────────────────────────────────────────────────
function toggleRow(idx, row, grid, expand) {
  if (expandedIdx === idx) {
    collapseRow(idx, row, grid, expand);
  } else {
    // Collapse any currently open row
    if (expandedIdx !== null) {
      const prev = document.querySelector(`.up-row[data-idx="${expandedIdx}"]`);
      if (prev) {
        collapseRow(expandedIdx, prev,
          prev.querySelector('.up-row-grid'),
          prev.querySelector('.up-expand'),
          true /* silent */);
      }
    }
    expandRow(idx, row, grid, expand);
  }
}

function expandRow(idx, row, grid, expand) {
  expandedIdx = idx;
  row.classList.add('expanded');
  grid.setAttribute('aria-expanded', 'true');
  expand.classList.add('open');

  // Tell the lens engine this row is expanded
  BlurEngine.setExpanded(row);

  // Smooth scroll so the row sits near the top of the viewport
  setTimeout(() => {
    const rect      = row.getBoundingClientRect();
    const headerH   = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 72;
    const target    = window.pageYOffset + rect.top - headerH - 16;
    window.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }, 60);
}

function collapseRow(idx, row, grid, expand, silent = false) {
  expandedIdx = null;
  row.classList.remove('expanded');
  grid.setAttribute('aria-expanded', 'false');
  expand.classList.remove('open');

  if (!silent) BlurEngine.clearExpanded();
}

// ── Utilities ─────────────────────────────────────────────────────────────────
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

// ── Start ─────────────────────────────────────────────────────────────────────
init();
