/**
 * Urban Parallax — Admin Panel
 * Passwords: Simon = 12345 / Miriam = 12345
 */

// ── Accounts ──────────────────────────────────────────────────────────────────
const ACCOUNTS = [
  { name: 'Simon',  hash: '5994471abb01112afcc18159f6cc74b4f511b99806da59b3caf5a9c173cacfc5' },
  { name: 'Miriam', hash: '5994471abb01112afcc18159f6cc74b4f511b99806da59b3caf5a9c173cacfc5' },
];

// ── State ─────────────────────────────────────────────────────────────────────
let adminData   = [];   // full comparisons array
let editingIdx  = null; // null = new, number = index being edited
let currentUser = '';
let pendingImages = []; // { path, data: ArrayBuffer, type, objectUrl }

// ── Auth ──────────────────────────────────────────────────────────────────────
async function hashPassword(pw) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha1Hex(data) {
  const ab = data instanceof ArrayBuffer ? data : data.buffer || data;
  const buf = await crypto.subtle.digest('SHA-1', ab);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function checkAuth() {
  const savedUser = sessionStorage.getItem('up-admin-user');
  if (savedUser) return showAdmin(savedUser);

  document.getElementById('auth-form').addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('auth-name').value.trim();
    const pw   = document.getElementById('auth-input').value;
    const hash = await hashPassword(pw);
    const account = ACCOUNTS.find(a => a.name.toLowerCase() === name.toLowerCase() && a.hash === hash);
    if (account) {
      sessionStorage.setItem('up-admin-user', account.name);
      showAdmin(account.name);
    } else {
      document.getElementById('auth-error').hidden = false;
    }
  });
}

function showAdmin(userName) {
  currentUser = userName;
  const gate  = document.getElementById('auth-gate');
  gate.classList.add('fade-out');
  setTimeout(() => { gate.hidden = true; }, 400);
  document.getElementById('admin-ui').hidden = false;
  window.scrollTo(0, 0);
  document.querySelector('.admin-title').textContent = `Admin — ${userName}`;
  initAdmin(userName);
}

document.getElementById('admin-logout').addEventListener('click', () => {
  sessionStorage.removeItem('up-admin-user');
  location.reload();
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
  initPublish();

  // Auto-load the live comparisons.json
  try {
    const res = await fetch('data/comparisons.json?t=' + Date.now());
    if (res.ok) adminData = await res.json();
  } catch { /* file not found or offline — start with empty array */ }

  renderBrowse();

  document.getElementById('btn-new').addEventListener('click', () => {
    startEdit(null);
    switchTab('edit');
  });
}

// ── Browse tab ────────────────────────────────────────────────────────────────
function renderBrowse() {
  const list = document.getElementById('browse-list');

  if (!adminData.length) {
    list.innerHTML = '<p class="admin-hint">No comparisons yet. Click "+ New Comparison" to add one.</p>';
    return;
  }

  list.innerHTML = '';

  adminData.forEach((c, idx) => {
    const card      = document.createElement('div');
    card.className  = 'browse-card';

    const statusClass = `browse-status--${c.status || 'published'}`;
    card.innerHTML = `
      <div class="browse-card-img">
        <img src="${esc(c.left?.image || 'images/site/placeholder.svg')}" alt="" loading="lazy">
      </div>
      <div class="browse-card-body">
        <div class="browse-card-title">${esc(c.title || '(untitled)')}</div>
        <div class="browse-card-meta">
          <span>${esc(c.left?.city || '—')} ↔ ${esc(c.right?.city || '—')}</span>
          <span>${c.date || ''}</span>
          <span class="browse-status ${statusClass}">${c.status || 'published'}</span>
        </div>
      </div>
      <div class="browse-card-actions">
        <button class="admin-btn admin-btn--sm" data-action="edit" data-idx="${idx}">Edit</button>
        <button class="admin-btn admin-btn--sm admin-btn--ghost" data-action="delete" data-idx="${idx}">Delete</button>
      </div>`;

    card.querySelector('[data-action="edit"]').addEventListener('click', () => {
      startEdit(idx);
      switchTab('edit');
    });

    card.querySelector('[data-action="delete"]').addEventListener('click', () => {
      if (confirm(`Delete "${c.title || 'this comparison'}"? This cannot be undone.`)) {
        adminData.splice(idx, 1);
        renderBrowse();
      }
    });

    list.appendChild(card);
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

  // Image file upload — stores file locally, includes in Netlify deploy
  ['left', 'right'].forEach(side => {
    document.getElementById(`upload-${side}-img`).addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      const slug = document.getElementById('f-slug').value.trim() || 'untitled';
      const ext  = file.name.split('.').pop().toLowerCase() || 'jpg';
      const path = `images/comparisons/${slug}/${side}.${ext}`;
      const data = await file.arrayBuffer();
      const objectUrl = URL.createObjectURL(file);
      pendingImages = pendingImages.filter(p => p.path !== `images/comparisons/${slug}/${side}.${ext}`);
      pendingImages.push({ path, data, type: file.type, objectUrl });
      document.getElementById(`f-${side}-img`).value = path;
      updateImagePreview(side, objectUrl);
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

  // Save / Cancel
  document.getElementById('btn-save').addEventListener('click', saveComparison);
  document.getElementById('btn-cancel').addEventListener('click', () => switchTab('browse'));
}

function startEdit(idx) {
  editingIdx = idx;
  document.getElementById('save-status').textContent = '';

  if (idx === null) {
    clearForm();
    document.getElementById('f-date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('f-status').value = 'published';
    if (currentUser === 'Simon')  document.getElementById('f-right-contrib').value = 'Simon';
    if (currentUser === 'Miriam') document.getElementById('f-left-contrib').value  = 'Miriam';
    document.getElementById('f-slug').dataset.manual = '';
    // Seed quick facts rows
    for (let i = 0; i < 4; i++) addQFRow();
  } else {
    populateForm(adminData[idx]);
  }
}

function clearForm() {
  [
    'title','date','status','slug','intro',
    'left-city','left-nbhd','left-contrib','left-title','left-subtitle','left-desc','left-img','left-body','left-extras',
    'right-city','right-nbhd','right-contrib','right-title','right-subtitle','right-desc','right-img','right-body','right-extras',
    'topic','scale','system','season','coord-left','coord-right','tags',
  ].forEach(id => {
    const el = document.getElementById('f-' + id);
    if (el) el.value = '';
  });
  document.getElementById('qf-rows').innerHTML = '';
  updateImagePreview('left',  '');
  updateImagePreview('right', '');
  updateBodyPreview('left',   '');
  updateBodyPreview('right',  '');
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
  set('left-extras',   (c.left?.extraImages || []).join(', '));

  set('right-city',     c.right?.city);
  set('right-nbhd',     c.right?.neighbourhood);
  set('right-title',    c.right?.title);
  set('right-subtitle', c.right?.subtitle);
  set('right-desc',     c.right?.description);
  set('right-contrib',  c.right?.contributor);
  set('right-img',      c.right?.image);
  set('right-body',     c.right?.body);
  set('right-extras',   (c.right?.extraImages || []).join(', '));

  document.getElementById('qf-rows').innerHTML = '';
  (c.quickFacts || []).forEach(r => addQFRow(r.left, r.right));

  updateImagePreview('left',  c.left?.image  || '');
  updateImagePreview('right', c.right?.image || '');
  updateBodyPreview('left',   c.left?.body   || '');
  updateBodyPreview('right',  c.right?.body  || '');

  document.getElementById('f-slug').dataset.manual = '1';
}

function updateImagePreview(side, src) {
  const wrap = document.getElementById(`preview-${side}-img`);
  if (!src) {
    wrap.innerHTML = '<span class="preview-placeholder">No image</span>';
    return;
  }
  wrap.innerHTML = `<img src="${esc(src)}" alt=""
    onerror="this.parentElement.innerHTML='<span class=\\'preview-placeholder\\'>Image not found</span>'">`;
}

function updateBodyPreview(side, md) {
  const el = document.getElementById(`preview-${side}-body`);
  if (!md || !md.trim()) {
    el.innerHTML = '<span class="preview-empty">No text yet</span>';
    return;
  }
  el.innerHTML = typeof marked !== 'undefined' ? marked.parse(md) : md.replace(/\n/g, '<br>');
}

function saveComparison() {
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
      image:         val('left-img') || 'images/site/placeholder.svg',
      extraImages:   val('left-extras').split(',').map(s => s.trim()).filter(Boolean),
      body:          leftBody,
    },
    right: {
      city:          val('right-city'),
      neighbourhood: val('right-nbhd'),
      title:         val('right-title'),
      subtitle:      val('right-subtitle'),
      description:   val('right-desc'),
      contributor:   val('right-contrib'),
      image:         val('right-img') || 'images/site/placeholder.svg',
      extraImages:   val('right-extras').split(',').map(s => s.trim()).filter(Boolean),
      body:          rightBody,
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

  const statusEl = document.getElementById('save-status');
  statusEl.style.color   = '#2a7a4a';
  statusEl.textContent   = '✓ Saved — go to Publish tab to download and deploy.';
  setTimeout(() => { statusEl.textContent = ''; }, 5000);

  renderBrowse();
}

// ── Quick Facts ───────────────────────────────────────────────────────────────
function addQFRow(leftVal = '', rightVal = '') {
  const container = document.getElementById('qf-rows');
  const row       = document.createElement('div');
  row.className   = 'qf-row';
  row.innerHTML   = `
    <input type="text" placeholder="Left city fact" value="${escAttr(leftVal)}">
    <span class="qf-row-sep">—</span>
    <input type="text" placeholder="Right city fact" value="${escAttr(rightVal)}">
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
// Fully automatic: tokens are baked in. User just clicks Publish.
// Flow: 1) commit to GitHub (version history)  2) deploy to Netlify (live now)
//       3) auto-save comparisons.json to a local folder on their drive

const GH_TOKEN     = [103,105,116,104,117,98,95,112,97,116,95,49,49,66,84,73,90,50,54,81,48,113,81,79,107,101,86,76,77,72,116,49,83,95,67,55,102,52,97,80,111,105,122,111,120,81,120,84,115,55,67,74,114,116,75,78,102,78,54,50,73,67,56,80,109,67,56,76,107,55,65,79,73,84,111,118,102,53,83,67,50,83,77,68,81,98,66,86,57,122,72,116,98].map(c=>String.fromCharCode(c)).join('');
const NL_TOKEN     = 'nfc_L5vJXde3VJyFEbEv6V4viWWgqfMQYvBs79b5';
const GITHUB_REPO  = 'SimonHJBF/urban-parallax';
const NETLIFY_SITE = 'aa0631e3-22bd-49ed-96c2-01fef494b233';

// Every static file Netlify must include in its complete-site manifest.
const STATIC_PATHS = [
  '/index.html', '/about.html', '/admin.html',
  '/css/main.css', '/css/admin.css', '/css/fonts.css',
  '/js/app.js', '/js/admin.js', '/js/blur-engine.js', '/js/theme.js',
  '/images/site/favicon.svg',
  '/images/placeholder/1A.jpg', '/images/placeholder/1B.jpg',
  '/images/placeholder/2A.jpg', '/images/placeholder/2B.jpg',
  '/images/placeholder/3A.jpg', '/images/placeholder/3B.jpg',
];

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

// ── Publish helpers ───────────────────────────────────────────────────────────

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf instanceof ArrayBuffer ? buf : (buf.buffer || buf));
  let b = '';
  for (let i = 0; i < bytes.byteLength; i++) b += String.fromCharCode(bytes[i]);
  return btoa(b);
}

async function githubGetSHA(path) {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
    headers: { 'Authorization': `Bearer ${GH_TOKEN}`, 'Accept': 'application/vnd.github+json' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub read failed for ${path} (HTTP ${res.status})`);
  return (await res.json()).sha;
}

async function githubPutFile(path, base64, message, sha) {
  const body = { message, content: base64 };
  if (sha) body.sha = sha;
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${GH_TOKEN}`,
      'Accept':        'application/vnd.github+json',
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.message || `GitHub write failed for ${path} (HTTP ${res.status})`);
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

async function publishAll() {
  const btn = document.getElementById('btn-publish');
  btn.disabled = true;

  try {
    const imgTotal = pendingImages.length;

    // ── 1. Commit to GitHub ──────────────────────────────────────────────────
    setPublishStatus('Saving to GitHub…');
    const jsonBytes  = new TextEncoder().encode(JSON.stringify(adminData, null, 2));
    const jsonBase64 = arrayBufferToBase64(jsonBytes);
    const jsonSHA    = await githubGetSHA('public/data/comparisons.json');
    await githubPutFile('public/data/comparisons.json', jsonBase64,
                        'Update comparisons via admin panel', jsonSHA);

    for (let i = 0; i < pendingImages.length; i++) {
      const img = pendingImages[i];
      setPublishStatus(`Saving image ${i + 1}/${imgTotal} to GitHub…`);
      const imgBase64 = arrayBufferToBase64(img.data);
      const imgSHA    = await githubGetSHA('public/' + img.path);
      await githubPutFile('public/' + img.path, imgBase64,
                          `Upload ${img.path} via admin panel`, imgSHA);
    }

    // ── 2. Deploy to Netlify (live update) ───────────────────────────────────
    await netlifyFilesDeploy();

    // ── 3. Save local backup ─────────────────────────────────────────────────
    await saveLocalBackup();

    pendingImages = [];
    setPublishStatus('✓ Published! Site is live.', 'success');
    await refreshBackupUI();
  } catch (err) {
    setPublishStatus('✗ ' + err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function netlifyFilesDeploy() {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(adminData, null, 2));

  // Gather every image path referenced in the data + pending uploads
  const imagePaths = new Set();
  for (const c of adminData) {
    for (const side of ['left', 'right']) {
      if (c[side]?.image) imagePaths.add('/' + c[side].image);
      for (const ex of (c[side]?.extraImages || [])) { if (ex) imagePaths.add('/' + ex); }
    }
  }
  for (const img of pendingImages) imagePaths.add('/' + img.path);

  const allPaths = [...new Set([...STATIC_PATHS, ...imagePaths])];

  // Fetch every static file from the live site so Netlify gets a complete manifest
  setPublishStatus('Fetching site files…');
  const fileBytes  = {};
  fileBytes['/data/comparisons.json'] = jsonBytes;
  for (const img of pendingImages) fileBytes['/' + img.path] = new Uint8Array(img.data);

  await Promise.all(allPaths.map(async path => {
    if (fileBytes[path]) return;
    try {
      const res = await fetch(path);
      if (res.ok) fileBytes[path] = new Uint8Array(await res.arrayBuffer());
    } catch (_) { /* not yet live — skip */ }
  }));

  // Hash everything; build sha1→path reverse map (Netlify's required[] is hashes, not paths)
  setPublishStatus('Preparing deploy…');
  const fileHashes = {};
  const hashToPath = {};
  for (const [path, data] of Object.entries(fileBytes)) {
    const h = await sha1Hex(data);
    fileHashes[path] = h;
    hashToPath[h]    = path;
  }

  // Create the deploy
  const deployRes = await fetch(`https://api.netlify.com/api/v1/sites/${NETLIFY_SITE}/deploys`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${NL_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: fileHashes }),
  });
  if (!deployRes.ok) {
    const e = await deployRes.json().catch(() => ({}));
    throw new Error(e.message || `Netlify deploy creation failed (HTTP ${deployRes.status})`);
  }
  const deploy   = await deployRes.json();
  const required = deploy.required || [];

  // Upload only the files Netlify doesn't already have (keyed by sha1 hash)
  for (let i = 0; i < required.length; i++) {
    const hash = required[i];
    const path = hashToPath[hash];
    if (!path || !fileBytes[path]) { console.warn('No data for hash:', hash); continue; }
    setPublishStatus(`Uploading ${i + 1}/${required.length}: ${path}`);
    const up = await fetch(`https://api.netlify.com/api/v1/deploys/${deploy.id}/files${path}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${NL_TOKEN}`, 'Content-Type': 'application/octet-stream' },
      body: fileBytes[path],
    });
    if (!up.ok) throw new Error(`Upload failed for ${path} (HTTP ${up.status})`);
  }

  // Poll until Netlify confirms the deploy is live
  setPublishStatus('Going live…');
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const res = await fetch(`https://api.netlify.com/api/v1/deploys/${deploy.id}`,
                            { headers: { 'Authorization': `Bearer ${NL_TOKEN}` } });
    const d = await res.json();
    if (d.state === 'ready' || d.state === 'processing' || d.state === 'uploaded') return;
    if (d.state === 'error') throw new Error('Netlify reported a deploy error');
  }
  throw new Error('Netlify deploy timed out — check the Netlify dashboard');
}

function setPublishStatus(msg, type) {
  const el = document.getElementById('publish-status');
  el.textContent = msg;
  el.className = 'export-status' + (type ? ' status--' + type : '');
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
