/**
 * Urban Parallax — Admin Panel
 */

// ── Supabase ───────────────────────────────────────────────────────────────────
const SUPABASE_URL      = 'https://qqoxqkpilcebvrscgvmn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxb3hxa3BpbGNlYnZyc2Nndm1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NDUzNTYsImV4cCI6MjA5MDIyMTM1Nn0.intBH-jneA_gsNWEviMemYWPZMfvL9pZ0TpvXTO19mw';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const WORKER_ORIGIN = 'https://urbanparallax-worker.flatin94.workers.dev';
function resolveImageUrl(p) {
  if (!p || p.includes('placeholder')) return p;
  if (p.startsWith('http')) return p;
  return WORKER_ORIGIN + '/' + p;
}

// ── State ─────────────────────────────────────────────────────────────────────
let adminData   = [];   // full comparisons array
let editingIdx  = null; // null = new, number = index being edited
let currentUser = '';
let pendingImages = []; // { path, data: ArrayBuffer, type, objectUrl }

// Extra media per side: array of { type, path, data, objectUrl, name, saved }
const extraMediaSlots = { left: [], right: [] };

// ── Image conversion ───────────────────────────────────────────────────────────
// Converts any image (incl. HEIC from iPhone) to JPEG and optionally resizes it.
// maxPx: longest side cap in pixels. quality: JPEG quality 0–1.
async function convertToJpeg(file, maxPx = 2400, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width >= height) { height = Math.round(height * maxPx / width); width = maxPx; }
        else                 { width = Math.round(width  * maxPx / height); height = maxPx; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
        'image/jpeg', quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}

// Derive display name from email
function nameFromEmail(email) {
  if (!email) return 'Unknown';
  if (email.includes('flatin')) return 'Simon';
  if (email.includes('miriam')) return 'Miriam';
  return email.split('@')[0];
}

async function checkAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    location.replace('/login.html');
    return;
  }
  showAdmin(nameFromEmail(session.user.email));
}

function showAdmin(userName) {
  currentUser = userName;
  document.getElementById('admin-ui').hidden = false;
  window.scrollTo(0, 0);
  document.querySelector('.admin-title').textContent = `Admin — ${userName}`;
  initSidebar(userName);
  initAdmin(userName);
}

function initSidebar(userName) {
  // Populate user info
  const initial = userName ? userName[0].toUpperCase() : '?';
  document.getElementById('sidebar-avatar').textContent = initial;
  document.getElementById('sidebar-uname').textContent  = userName;

  // Sidebar nav
  document.querySelectorAll('.sidebar-ni[data-sidebar-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.sidebarView;
      document.querySelectorAll('.sidebar-ni').forEach(b => b.classList.remove('sidebar-ni--active'));
      btn.classList.add('sidebar-ni--active');
      if (view === 'new') {
        startEdit(null);
        switchTab('edit');
      } else {
        switchTab('browse');
      }
    });
  });

  // Sync sidebar active state whenever switchTab is called
  const origSwitchTab = switchTab;
  window._switchTabOrig = origSwitchTab;
  switchTab = function(name) {
    origSwitchTab(name);
    document.querySelectorAll('.sidebar-ni[data-sidebar-view]').forEach(btn => {
      btn.classList.toggle('sidebar-ni--active',
        (name === 'browse' && btn.dataset.sidebarView === 'browse') ||
        (name === 'edit'   && btn.dataset.sidebarView === 'new')
      );
    });
  };

  // Sidebar logout
  document.getElementById('sidebar-logout').addEventListener('click', async () => {
    await sb.auth.signOut();
    location.replace('/login.html');
  });
}

document.getElementById('admin-logout').addEventListener('click', async () => {
  await sb.auth.signOut();
  location.replace('/login.html');
});

// ── Tabs ──────────────────────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`tab-${name}`).classList.add('active');
}

document.querySelectorAll('.admin-tab').forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

// ── Init ──────────────────────────────────────────────────────────────────────
async function initAdmin(userName) {
  initEditor(userName);
  initWizard(userName);
  initPublish();

  // Load from Supabase (auto-migrate from R2 JSON if first run)
  await migrateFromR2IfNeeded();
  try {
    const { data: rows, error } = await sb.from('comparisons').select('*').order('date', { ascending: false });
    if (!error && rows) adminData = rows.map(dbRowToEntry);
  } catch { /* offline — start with empty array */ }

  renderBrowse();

  const startNew = () => { startEdit(null); switchTab('edit'); };
  document.getElementById('btn-new').addEventListener('click', startNew);
  document.getElementById('browse-fab').addEventListener('click', startNew);

  // Browse-tab Save & Go Live button
  document.getElementById('btn-browse-save').addEventListener('click', async () => {
    const btn = document.getElementById('btn-browse-save');
    btn.disabled = true;
    await quickPublish('Saved changes');
    btn.disabled = false;
    markClean();
  });
}

let _browseHasChanges = false;

function markDirty() {
  _browseHasChanges = true;
  const bar = document.getElementById('browse-save-bar');
  if (bar) bar.classList.remove('browse-save-bar--hidden');
}

function markClean() {
  _browseHasChanges = false;
  const bar = document.getElementById('browse-save-bar');
  if (bar) bar.classList.add('browse-save-bar--hidden');
}

// ── Quick publish (used by browse-save bar — no pending images) ────────────────
async function quickPublish(actionLabel) {
  const statusEl = document.getElementById('browse-status');
  const setStatus = (msg, type) => {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = 'export-status' + (type ? ' status--' + type : '');
  };

  setStatus(`Saving (${actionLabel})…`);
  try {
    if (pendingImages.length) await r2Deploy(setStatus);
    await saveLocalBackup();
    markClean();
    setStatus(`✓ ${actionLabel} — live now.`, 'success');
    setTimeout(() => { if (!_browseHasChanges) setStatus(''); }, 6000);
  } catch (err) {
    console.error('quickPublish error:', err);
    setStatus('✗ ' + (err.message || String(err)), 'error');
  }
}

// ── Browse tab ────────────────────────────────────────────────────────────────
function isAwaiting(c) {
  const hasLeft  = !!(c.left?.image  || c.left?.city);
  const hasRight = !!(c.right?.image || c.right?.city);
  return (hasLeft || hasRight) && !(hasLeft && hasRight);
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function renderBrowse() {
  const list = document.getElementById('browse-list');

  if (!adminData.length) {
    list.innerHTML = '<p class="admin-hint">No comparisons yet.</p>';
    return;
  }

  const awaitingCount = adminData.filter(isAwaiting).length;
  list.innerHTML = awaitingCount > 0
    ? `<div class="browse-awaiting-banner">${awaitingCount} comparison${awaitingCount > 1 ? 's' : ''} awaiting their pair</div>`
    : '';

  // Keep sidebar badge in sync
  const badge = document.getElementById('sidebar-awaiting-badge');
  if (badge) {
    badge.hidden = awaitingCount === 0;
    badge.textContent = awaitingCount;
  }

  adminData.forEach((c, idx) => {
    const card = document.createElement('div');
    card.className = 'browse-card';

    const awaiting    = isAwaiting(c);
    const isDraft     = c.status === 'draft';
    const statusClass = awaiting ? 'browse-status--awaiting' : (isDraft ? 'browse-status--draft' : 'browse-status--published');
    const statusLabel = awaiting ? '◑ Awaiting' : (isDraft ? 'Draft' : '● Live');
    const divClass    = awaiting ? 'browse-thumb-div--awaiting' : '';

    card.innerHTML = `
      <div class="browse-thumb">
        <div class="browse-thumb-half" style="${c.left?.image  ? `background-image:url(${esc(c.left.image)})`  : ''}"></div>
        <div class="browse-thumb-div ${divClass}"></div>
        <div class="browse-thumb-half" style="${c.right?.image ? `background-image:url(${esc(c.right.image)})` : ''}"></div>
      </div>
      <div class="browse-card-body">
        <div class="browse-card-title">${esc(c.title || '(untitled)')}</div>
        <div class="browse-card-meta">
          <span class="browse-status ${statusClass}">${statusLabel}</span>
          <span class="browse-card-date">${fmtDate(c.date)}</span>
        </div>
      </div>
      <button class="browse-card-delete" aria-label="Delete" title="Delete">×</button>`;

    card.addEventListener('click', e => {
      if (e.target.classList.contains('browse-card-delete')) return;
      startEdit(idx);
      switchTab('edit');
    });

    card.querySelector('.browse-card-delete').addEventListener('click', async e => {
      e.stopPropagation();
      if (confirm(`Delete "${c.title || 'this comparison'}"? This cannot be undone.`)) {
        try {
          await deleteFromSupabase(c.id);
        } catch (err) {
          alert('Delete failed: ' + err.message);
          return;
        }
        adminData.splice(idx, 1);
        renderBrowse();
        await saveLocalBackup();
        const statusEl = document.getElementById('browse-status');
        if (statusEl) {
          statusEl.textContent = '✓ Deleted.';
          statusEl.className = 'export-status status--success';
          setTimeout(() => { statusEl.textContent = ''; statusEl.className = 'export-status'; }, 4000);
        }
      }
    });

    list.appendChild(card);
  });
}


// ── Wizard ─────────────────────────────────────────────────────────────────────
let wizardStep = 1;
let activeSide = 'left'; // which side the current contributor is working on

function syncCityTabsToActiveSide() {
  document.querySelectorAll('.city-tab').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.city === `editor-city-${activeSide}`);
  });
  document.getElementById('editor-city-left').classList.toggle('is-active',  activeSide === 'left');
  document.getElementById('editor-city-right').classList.toggle('is-active', activeSide === 'right');
}

function syncPlaceTabsToActiveSide() {
  document.querySelectorAll('.wiz-side-tab').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.side === activeSide);
  });
  document.getElementById('wiz-place-left').hidden  = activeSide !== 'left';
  document.getElementById('wiz-place-right').hidden = activeSide !== 'right';
}

function setActiveSide(side) {
  activeSide = side;
  document.getElementById('wiz-caption-left').hidden  = side !== 'left';
  document.getElementById('wiz-caption-right').hidden = side !== 'right';
  if (wizardStep === 2) syncCityTabsToActiveSide();
  if (wizardStep === 3) syncPlaceTabsToActiveSide();
}

function setWizardStep(n) {
  wizardStep = n;
  for (let i = 1; i <= 4; i++) {
    document.getElementById(`wiz-pane-${i}`).classList.toggle('active', i === n);
  }
  document.querySelectorAll('.wiz-ind-step').forEach(el => {
    const s = Number(el.dataset.step);
    el.classList.toggle('wiz-ind-done',   s < n);
    el.classList.toggle('wiz-ind-active', s === n);
  });
  document.querySelectorAll('.wiz-ind-line').forEach((el, i) => {
    el.classList.toggle('wiz-ind-line--done', i < n - 1);
  });
  const isLast = n === 4;
  document.getElementById('wiz-next').style.display = isLast ? 'none' : '';
  document.getElementById('wiz-post').textContent   = isLast ? 'Publish ↗' : 'Post ↗';
  updateWizThumbStrips();
  if (n === 2) syncCityTabsToActiveSide();
  if (n === 3) syncPlaceTabsToActiveSide();
}

function initWizard(userName) {
  document.getElementById('wiz-back').addEventListener('click', () => {
    if (wizardStep === 1) switchTab('browse');
    else setWizardStep(wizardStep - 1);
  });

  document.getElementById('wiz-next').addEventListener('click', () => {
    if (wizardStep < 4) setWizardStep(wizardStep + 1);
  });

  document.getElementById('wiz-post').addEventListener('click', async () => {
    saveComparison(true);
    const btn      = document.getElementById('wiz-post');
    const statusEl = document.getElementById('save-status');
    const origText = btn.textContent;
    btn.disabled   = true;
    btn.textContent = wizardStep === 4 ? 'Publishing…' : 'Posting…';
    try {
      await _doPublish(
        (msg, type) => {
          statusEl.textContent = msg;
          statusEl.className   = 'export-status' + (type ? ' status--' + type : '');
        },
        btn
      );
      if (wizardStep < 4) setWizardStep(wizardStep + 1);
    } catch (err) {
      statusEl.className   = 'export-status status--error';
      statusEl.textContent = err.message;
    } finally {
      btn.disabled    = false;
      btn.textContent = origText;
    }
  });

  // Step-3 side tabs (Place)
  document.querySelectorAll('.wiz-side-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const side = btn.dataset.side;
      document.querySelectorAll('.wiz-side-tab').forEach(b => b.classList.toggle('is-active', b === btn));
      document.getElementById('wiz-place-left').hidden  = side !== 'left';
      document.getElementById('wiz-place-right').hidden = side !== 'right';
    });
  });

  // Step-1 photo areas — click to trigger file input, sets activeSide
  ['left', 'right'].forEach(side => {
    document.getElementById(`wiz-${side}-photo`).addEventListener('click', () => {
      setActiveSide(side);
      document.getElementById(`upload-${side}-img`).click();
    });
  });

  // Step-1 heading fields mirror f-left-title / f-right-title
  ['left', 'right'].forEach(side => {
    document.getElementById(`wiz-s1-${side}-heading`).addEventListener('input', e => {
      document.getElementById(`f-${side}-title`).value = e.target.value;
    });
  });
}

// ── Editor tab ────────────────────────────────────────────────────────────────
function initEditor(userName) {
  // Auto-generate slug from title
  document.getElementById('f-title').addEventListener('input', e => {
    const slugField = document.getElementById('f-slug');
    if (!slugField.dataset.manual) slugField.value = slugify(e.target.value);
  });
  document.getElementById('f-slug').addEventListener('input', function() {
    this.dataset.manual = '1';
  });

  // Live image previews
  document.getElementById('f-left-img').addEventListener('input', e => {
    updateImagePreview('left', e.target.value.trim());
  });
  document.getElementById('f-right-img').addEventListener('input', e => {
    updateImagePreview('right', e.target.value.trim());
  });

  // Image file upload — staged locally, uploaded to R2 on publish
  ['left', 'right'].forEach(side => {
    document.getElementById(`upload-${side}-img`).addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      const slug = document.getElementById('f-slug').value.trim() || 'untitled';

      let uploadBlob = file, mimeType = file.type, ext = file.name.split('.').pop().toLowerCase() || 'jpg';
      if (file.type.startsWith('image/') && file.type !== 'image/gif') {
        try { uploadBlob = await convertToJpeg(file); ext = 'jpg'; mimeType = 'image/jpeg'; } catch { /* keep original */ }
      }

      const r2Key     = `images/comparisons/${slug}/${side}.${ext}`;
      const imgUrl    = `https://urbanparallax-worker.flatin94.workers.dev/${r2Key}`;
      const data      = await uploadBlob.arrayBuffer();
      const objectUrl = URL.createObjectURL(uploadBlob);
      // Remove any previous pending upload for this slot (may have had a different extension)
      pendingImages = pendingImages.filter(p => !/^images\/comparisons\/[^/]+\//.test(p.path) || !p.path.includes(`/${side}.`));
      pendingImages.push({ path: r2Key, data, type: mimeType, objectUrl });
      document.getElementById(`f-${side}-img`).value = imgUrl;
      updateImagePreview(side, objectUrl);
      setActiveSide(side); // track which side was actually uploaded
      e.target.value = '';
    });
  });

  // Live body previews
  document.getElementById('f-left-body').addEventListener('input', e => {
    updateBodyPreview('left', e.target.value);
  });
  document.getElementById('f-right-body').addEventListener('input', e => {
    updateBodyPreview('right', e.target.value);
  });

  // Quick facts
  document.getElementById('qf-add').addEventListener('click', () => addQFRow());

  // Step-2 city tabs (body text left/right)
  document.querySelectorAll('.city-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.city;
      document.querySelectorAll('.city-tab').forEach(b => b.classList.toggle('is-active', b === btn));
      document.getElementById('editor-city-left').classList.toggle('is-active',  target === 'editor-city-left');
      document.getElementById('editor-city-right').classList.toggle('is-active', target === 'editor-city-right');
    });
  });
}

function startEdit(idx) {
  editingIdx = idx;
  document.getElementById('save-status').textContent = '';

  if (idx === null) {
    // New entry — default to this user's usual side
    const defaultSide = currentUser === 'Simon' ? 'right' : 'left';
    setActiveSide(defaultSide);
    setWizardStep(1);
    clearForm();
    document.getElementById('f-date').value     = new Date().toISOString().slice(0, 10);
    document.getElementById('f-status').value   = 'published';
    if (currentUser === 'Simon')  document.getElementById('f-right-contrib').value = 'Simon';
    if (currentUser === 'Miriam') document.getElementById('f-left-contrib').value  = 'Miriam';
    document.getElementById('f-slug').dataset.manual = '';
    // Seed quick facts rows
    for (let i = 0; i < 4; i++) addQFRow();
  } else {
    // Existing entry — detect active side from which side has an image
    const entry = adminData[idx];
    const hasLeft  = !!(entry.left?.image  && !entry.left.image.includes('placeholder'));
    const hasRight = !!(entry.right?.image && !entry.right.image.includes('placeholder'));
    const detectedSide = (!hasLeft && hasRight) ? 'right' : 'left';
    setActiveSide(detectedSide);
    setWizardStep(1);
    populateForm(adminData[idx]);
  }
}

function clearForm() {
  [
    'title','date','status','slug','intro',
    'left-city','left-nbhd','left-contrib','left-title','left-subtitle','left-desc','left-img','left-body',
    'right-city','right-nbhd','right-contrib','right-title','right-subtitle','right-desc','right-img','right-body',
    'topic','scale','system','season','coord-left','coord-right','tags',
  ].forEach(id => {
    const el = document.getElementById('f-' + id);
    if (el) el.value = '';
  });
  document.getElementById('qf-rows').innerHTML = '';
  const s1l = document.getElementById('wiz-s1-left-heading');
  const s1r = document.getElementById('wiz-s1-right-heading');
  if (s1l) s1l.value = '';
  if (s1r) s1r.value = '';
  updateImagePreview('left',  '');
  updateImagePreview('right', '');
  updateBodyPreview('left',   '');
  updateBodyPreview('right',  '');
  initExtraMedia('left',  []);
  initExtraMedia('right', []);
}

function populateForm(c) {
  const set = (id, val) => {
    const el = document.getElementById('f-' + id);
    if (el) el.value = val || '';
  };

  set('title',         c.title);
  set('date',          c.date);
  set('status',        c.status || 'published');
  set('slug',          c.slug);
  set('intro',         c.introduction);

  const m = c.metadata || {};
  set('topic',         m.topic);
  set('scale',         m.scale);
  set('system',        m.system);
  set('season',        m.season);
  set('coord-left',    m.coordinates?.left);
  set('coord-right',   m.coordinates?.right);
  set('tags',          (c.tags || []).join(', '));

  set('left-city',     c.left?.city);
  set('left-nbhd',     c.left?.neighbourhood);
  set('left-title',    c.left?.title);
  set('left-subtitle', c.left?.subtitle);
  set('left-desc',     c.left?.description);
  set('left-contrib',  c.left?.contributor);
  set('left-img',      c.left?.image);
  set('left-body',     c.left?.body);

  set('right-city',     c.right?.city);
  set('right-nbhd',     c.right?.neighbourhood);
  set('right-title',    c.right?.title);
  set('right-subtitle', c.right?.subtitle);
  set('right-desc',     c.right?.description);
  set('right-contrib',  c.right?.contributor);
  set('right-img',      c.right?.image);
  set('right-body',     c.right?.body);

  // Load extra media — support both new extraMedia and legacy extraImages
  const toMedia = arr => (arr || []).map(p => typeof p === 'string' ? { type: 'image', path: p } : p);
  initExtraMedia('left',  toMedia(c.left?.extraMedia  || c.left?.extraImages));
  initExtraMedia('right', toMedia(c.right?.extraMedia || c.right?.extraImages));

  document.getElementById('qf-rows').innerHTML = '';
  (c.quickFacts || []).forEach(r => addQFRow(r.left, r.right));

  updateImagePreview('left',  c.left?.image  || '');
  updateImagePreview('right', c.right?.image || '');
  updateBodyPreview('left',   c.left?.body   || '');
  updateBodyPreview('right',  c.right?.body  || '');

  // Sync step-1 heading shadow fields
  const s1l = document.getElementById('wiz-s1-left-heading');
  const s1r = document.getElementById('wiz-s1-right-heading');
  if (s1l) s1l.value = c.left?.title  || '';
  if (s1r) s1r.value = c.right?.title || '';

  document.getElementById('f-slug').dataset.manual = '1';
}

function updateImagePreview(side, src) {
  // Wizard step-1 photo area
  const img  = document.getElementById(`wiz-${side}-preview`);
  const ph   = document.getElementById(`wiz-${side}-placeholder`);
  if (img && ph) {
    if (src) {
      img.src = src;
      img.style.display = '';
      ph.style.display  = 'none';
    } else {
      img.style.display = 'none';
      ph.style.display  = '';
    }
  }
  // Thumbnail strips (steps 2 & 3)
  updateWizThumbStrips();
}

function updateWizThumbStrips() {
  const l = document.getElementById('f-left-img')?.value  || '';
  const r = document.getElementById('f-right-img')?.value || '';
  document.querySelectorAll('.wiz-thumb-l').forEach(el => {
    el.style.backgroundImage = l ? `url(${esc(l)})` : '';
  });
  document.querySelectorAll('.wiz-thumb-r').forEach(el => {
    el.style.backgroundImage = r ? `url(${esc(r)})` : '';
  });
}

function updateBodyPreview(side, md) {
  const el = document.getElementById(`preview-${side}-body`);
  if (!el) return;
  if (!md || !md.trim()) { el.innerHTML = '<span class="preview-empty">No text yet</span>'; return; }
  el.innerHTML = typeof marked !== 'undefined' ? marked.parse(md) : md.replace(/\n/g, '<br>');
}

// ── Extra media (images / GIFs / videos below body text) ──────────────────────

function initExtraMedia(side, mediaArray) {
  // Revoke any previous blob URLs to avoid memory leaks
  for (const slot of extraMediaSlots[side]) {
    if (slot.objectUrl && slot.objectUrl.startsWith('blob:')) URL.revokeObjectURL(slot.objectUrl);
  }
  extraMediaSlots[side] = mediaArray.map(item => ({
    type:     item.type || 'image',
    path:     item.path,
    data:     null,        // already saved — no pending data needed
    objectUrl: item.path,  // use live path for preview
    name:     item.path.split('/').pop(),
    saved:    true,
  }));
  renderExtraMediaSlots(side);
}

function renderExtraMediaSlots(side) {
  const container = document.getElementById(`${side}-extra-media`);
  if (!container) return;
  container.innerHTML = '';

  extraMediaSlots[side].forEach((slot, idx) => {
    container.appendChild(buildFilledSlot(side, idx, slot));
  });

  // Always show one empty "+ Add media" button unless we've hit the limit
  if (extraMediaSlots[side].length < 10) {
    container.appendChild(buildEmptySlot(side));
  }
}

function buildFilledSlot(side, idx, slot) {
  const div = document.createElement('div');
  div.className = 'em-slot em-slot--filled';

  const thumb = slot.type === 'video'
    ? `<div class="em-thumb em-thumb--video">▶</div>`
    : `<img class="em-thumb" src="${esc(slot.objectUrl || slot.path)}" alt=""
         onerror="this.style.background='#333'">`;

  div.innerHTML = `
    ${thumb}
    <div class="em-info">
      <span class="em-type-badge em-type--${slot.type}">${slot.type}</span>
      <span class="em-name">${esc(slot.name)}</span>
    </div>
    <button class="em-remove" type="button" title="Remove">×</button>`;

  div.querySelector('.em-remove').addEventListener('click', () => removeExtraMedia(side, idx));
  return div;
}

function buildEmptySlot(side) {
  const div = document.createElement('div');
  div.className = 'em-slot em-slot--empty';

  const label = document.createElement('label');
  label.className = 'em-add-btn';
  label.innerHTML = '<span>+ Add<br>media</span>';

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,video/mp4,video/webm,video/quicktime,.gif';
  input.className = 'em-file-input';
  input.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (file) await handleExtraMediaFile(side, file);
    e.target.value = '';
  });

  label.appendChild(input);
  div.appendChild(label);
  return div;
}

async function handleExtraMediaFile(side, file) {
  const slug = document.getElementById('f-slug').value.trim() || 'untitled';
  const idx  = extraMediaSlots[side].length + 1; // 1-based for filename
  let ext    = file.name.split('.').pop().toLowerCase();

  // Determine type from MIME
  let type, uploadBlob = file, mimeType = file.type;
  if (file.type.startsWith('video/'))                  { type = 'video'; }
  else if (file.type === 'image/gif' || ext === 'gif') { type = 'gif'; }
  else {
    type = 'image';
    try { uploadBlob = await convertToJpeg(file); ext = 'jpg'; mimeType = 'image/jpeg'; } catch { /* keep original */ }
  }

  const path      = `images/comparisons/${slug}/${side}-extra-${idx}.${ext}`;
  const data      = await uploadBlob.arrayBuffer();
  const objectUrl = URL.createObjectURL(uploadBlob);

  // Add to slot list
  extraMediaSlots[side].push({ type, path, data, objectUrl, name: file.name, saved: false });

  // Register as a pending upload so publish picks it up
  pendingImages = pendingImages.filter(p => p.path !== path);
  pendingImages.push({ path, data, type: mimeType, objectUrl });

  renderExtraMediaSlots(side);
}

function removeExtraMedia(side, idx) {
  const slot = extraMediaSlots[side][idx];
  // Remove from pending uploads if it hasn't been published yet
  if (!slot.saved) pendingImages = pendingImages.filter(p => p.path !== slot.path);
  if (slot.objectUrl && slot.objectUrl.startsWith('blob:')) URL.revokeObjectURL(slot.objectUrl);
  extraMediaSlots[side].splice(idx, 1);
  renderExtraMediaSlots(side);
}

function getExtraMedia(side) {
  return extraMediaSlots[side].map(s => ({ type: s.type, path: s.path }));
}

function saveComparison(silent = false) {
  const val = id => {
    const el = document.getElementById('f-' + id);
    return el ? el.value.trim() : '';
  };

  const leftBody  = document.getElementById('f-left-body').value;
  const rightBody = document.getElementById('f-right-body').value;

  const entry = {
    id:           editingIdx !== null ? adminData[editingIdx].id : String(adminData.length + 1).padStart(3, '0'),
    title:        val('title'),
    slug:         val('slug') || slugify(val('title')),
    date:         val('date'),
    status:       val('status'),
    order:        editingIdx !== null ? (adminData[editingIdx].order ?? null) : null,
    introduction: val('intro'),
    tags:         val('tags').split(',').map(t => t.trim()).filter(Boolean),
    quickFacts:   getQuickFacts(),
    left: {
      city:          val('left-city'),
      neighbourhood: val('left-nbhd'),
      title:         val('left-title'),
      subtitle:      val('left-subtitle'),
      description:   val('left-desc'),
      contributor:   val('left-contrib'),
      image:      val('left-img') || 'images/site/placeholder.svg',
      extraMedia: getExtraMedia('left'),
      body:       leftBody,
    },
    right: {
      city:          val('right-city'),
      neighbourhood: val('right-nbhd'),
      title:         val('right-title'),
      subtitle:      val('right-subtitle'),
      description:   val('right-desc'),
      contributor:   val('right-contrib'),
      image:      val('right-img') || 'images/site/placeholder.svg',
      extraMedia: getExtraMedia('right'),
      body:       rightBody,
    },
  };

  // Metadata
  const metadata = {};
  ['topic','scale','system','season'].forEach(f => { if (val(f)) metadata[f] = val(f); });
  const cl = val('coord-left'), cr = val('coord-right');
  if (cl || cr) metadata.coordinates = { left: cl, right: cr };
  if (Object.keys(metadata).length) entry.metadata = metadata;

  if (editingIdx !== null) {
    adminData[editingIdx] = entry;
  } else {
    adminData.unshift(entry); // new entries appear at top
    editingIdx = 0;           // now pointing at the new entry
  }

  if (!silent) {
    const statusEl = document.getElementById('save-status');
    statusEl.className   = 'export-status status--success';
    statusEl.textContent = '✓ Draft saved.';
    setTimeout(() => { statusEl.textContent = ''; statusEl.className = 'export-status'; }, 4000);
  }

  renderBrowse();
}

// ── Quick Facts ───────────────────────────────────────────────────────────────
function addQFRow(leftVal = '', rightVal = '') {
  const container = document.getElementById('qf-rows');
  const row       = document.createElement('div');
  row.className   = 'qf-row';
  row.innerHTML   = `
    <input type="text" class="qf-left-field" placeholder="Left city fact" value="${escAttr(leftVal)}">
    <span class="qf-row-sep qf-tab-sep">—</span>
    <input type="text" class="qf-right-field" placeholder="Right city fact" value="${escAttr(rightVal)}">
    <button class="qf-remove" title="Remove row">✕</button>`;
  row.querySelector('.qf-remove').addEventListener('click', () => row.remove());
  container.appendChild(row);
}

function getQuickFacts() {
  return Array.from(document.querySelectorAll('#qf-rows .qf-row'))
    .map(row => {
      const inputs = row.querySelectorAll('input');
      return { left: inputs[0].value.trim(), right: inputs[1].value.trim() };
    })
    .filter(r => r.left || r.right);
}

// ── Publish tab ───────────────────────────────────────────────────────────────
// ── Publish — R2 via Cloudflare Worker ────────────────────────────────────────

// ── Local-folder backup (File System Access API) ──────────────────────────────
// The chosen folder handle is persisted in IndexedDB across sessions.

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('up-admin', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('kv');
    req.onsuccess  = e => resolve(e.target.result);
    req.onerror    = e => reject(e.target.error);
  });
}
async function idbGet(key) {
  const db = await idbOpen();
  return new Promise((resolve) => {
    const tx = db.transaction('kv', 'readonly');
    const req = tx.objectStore('kv').get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror   = () => resolve(null);
  });
}
async function idbSet(key, value) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('kv', 'readwrite');
    const req = tx.objectStore('kv').put(value, key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

let backupDirHandle = null; // FileSystemDirectoryHandle or null

async function loadBackupHandle() {
  backupDirHandle = await idbGet('backupDir');
  await refreshBackupUI();
}

async function pickBackupFolder() {
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite', id: 'up-backup' });
    backupDirHandle = handle;
    await idbSet('backupDir', handle);
    await refreshBackupUI();
  } catch (e) {
    if (e.name !== 'AbortError') console.error('Folder picker error:', e);
  }
}

async function refreshBackupUI() {
  const el = document.getElementById('backup-folder-label');
  if (!el) return;
  if (!backupDirHandle) {
    el.textContent = 'No folder chosen';
    el.className = 'backup-folder-label backup-folder-label--none';
    return;
  }
  // Verify permission is still granted (handle may be stale)
  try {
    const perm = await backupDirHandle.queryPermission({ mode: 'readwrite' });
    el.textContent = perm === 'granted'
      ? backupDirHandle.name + '/'
      : backupDirHandle.name + '/ (click to re-allow)';
    el.className = 'backup-folder-label' + (perm === 'granted' ? '' : ' backup-folder-label--warn');
  } catch (_) {
    el.textContent = 'Folder unavailable — choose again';
    el.className = 'backup-folder-label backup-folder-label--warn';
  }
}

async function saveLocalBackup() {
  if (!backupDirHandle) return;
  try {
    // May need to re-request permission after a browser restart
    const perm = await backupDirHandle.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') return;
    const file     = await backupDirHandle.getFileHandle('comparisons.json', { create: true });
    const writable = await file.createWritable();
    await writable.write(JSON.stringify(adminData, null, 2));
    await writable.close();
  } catch (e) {
    console.warn('Local backup failed (non-fatal):', e);
  }
}


// ── initPublish ───────────────────────────────────────────────────────────────

function initPublish() {
  loadBackupHandle(); // restore saved folder silently

  document.getElementById('btn-pick-folder').addEventListener('click', pickBackupFolder);
  document.getElementById('btn-publish').addEventListener('click', publishAll);
  document.getElementById('btn-download-json').addEventListener('click', () => {
    downloadBlob(new Blob([JSON.stringify(adminData, null, 2)], { type: 'application/json' }),
                 'comparisons.json');
  });
}

// ── Main publish ──────────────────────────────────────────────────────────────

// Shared publish logic — accepts a status-setter and the trigger button
async function _doPublish(setStatus, btnEl) {
  btnEl.disabled = true;
  try {
    await r2Deploy(setStatus);
    // Persist current entry to Supabase
    if (editingIdx !== null && adminData[editingIdx]) {
      setStatus('Saving to database…');
      await saveToSupabase(adminData[editingIdx]);
    }
    await saveLocalBackup();
    pendingImages = [];
    setStatus('✓ Published! Site is live.', 'success');
    await refreshBackupUI();
  } catch (err) {
    setStatus('✗ ' + err.message, 'error');
  } finally {
    btnEl.disabled = false;
  }
}

// Publish tab button
async function publishAll() {
  await _doPublish(setPublishStatus, document.getElementById('btn-publish'));
}

// Editor bottom Publish button — auto-saves first, then deploys
async function publishFromEditor() {
  saveComparison(/* silent= */ true);
  const setStatus = (msg, type) => {
    const el = document.getElementById('save-status');
    el.textContent = msg;
    el.className = 'export-status' + (type ? ' status--' + type : '');
  };
  await _doPublish(setStatus, document.getElementById('btn-publish-editor'));
}

async function r2Deploy(setStatus = setPublishStatus) {
  if (!pendingImages.length) return;

  const { data: { session } } = await sb.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not authenticated');

  for (let i = 0; i < pendingImages.length; i++) {
    const img = pendingImages[i];
    setStatus(`Uploading image ${i + 1}/${pendingImages.length}…`);
    const resp = await fetch('https://urbanparallax-worker.flatin94.workers.dev/r2-upload/' + img.path, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': img.type },
      body: img.data,
    });
    if (!resp.ok) throw new Error(`Failed to upload ${img.path}`);
  }
}

function setPublishStatus(msg, type) {
  const el = document.getElementById('publish-status');
  el.textContent = msg;
  el.className = 'export-status' + (type ? ' status--' + type : '');
}

// ── Supabase DB helpers ────────────────────────────────────────────────────────

function dbRowToEntry(row) {
  const left  = row.left_city  || {};
  const right = row.right_city || {};
  if (left.image)  left.image  = resolveImageUrl(left.image);
  if (right.image) right.image = resolveImageUrl(right.image);
  return {
    id:           row.id,
    title:        row.title,
    slug:         row.slug,
    date:         row.date,
    status:       row.status,
    order:        row.order,
    introduction: row.introduction,
    tags:         row.tags || [],
    quickFacts:   row.quick_facts || [],
    left, right,
    metadata:     row.metadata   || {},
  };
}

function entryToDbRow(entry) {
  return {
    id:           entry.id,
    title:        entry.title        || null,
    slug:         entry.slug         || null,
    date:         entry.date         || null,
    status:       entry.status       || 'published',
    order:        entry.order        ?? null,
    introduction: entry.introduction || null,
    tags:         entry.tags         || [],
    quick_facts:  entry.quickFacts   || [],
    left_city:    entry.left         || {},
    right_city:   entry.right        || {},
    metadata:     entry.metadata     || {},
  };
}

async function saveToSupabase(entry) {
  const { error } = await sb.from('comparisons').upsert(entryToDbRow(entry), { onConflict: 'id' });
  if (error) throw new Error('Supabase save failed: ' + error.message);
}

async function deleteFromSupabase(id) {
  const { error } = await sb.from('comparisons').delete().eq('id', id);
  if (error) throw new Error('Supabase delete failed: ' + error.message);
}

async function migrateFromR2IfNeeded() {
  try {
    const { count } = await sb.from('comparisons').select('id', { count: 'exact', head: true });
    if (count > 0) return; // already has data
    const res = await fetch('data/comparisons.json?t=' + Date.now());
    if (!res.ok) return;
    const entries = await res.json();
    for (const entry of entries) {
      await sb.from('comparisons').upsert(entryToDbRow(entry), { onConflict: 'id' });
    }
    console.log(`Urban Parallax: migrated ${entries.length} entries from R2 → Supabase`);
  } catch (e) {
    console.warn('Urban Parallax: R2 migration skipped:', e);
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function slugify(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escAttr(str) {
  if (str == null) return '';
  return String(str).replace(/"/g, '&quot;');
}

// ── Boot ──────────────────────────────────────────────────────────────────────
checkAuth();
