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
// Publishes by committing directly to GitHub, which triggers Netlify auto-deploy.
// This is reliable because Netlify always deploys from the repo — no conflicts.

const GITHUB_REPO = 'SimonHJBF/urban-parallax';

function initPublish() {
  const savedToken = localStorage.getItem('up-github-token') || '';
  if (savedToken) document.getElementById('github-token').value = savedToken;

  document.getElementById('btn-publish').addEventListener('click', publishToGitHub);

  document.getElementById('btn-download-json').addEventListener('click', () => {
    const json = JSON.stringify(adminData, null, 2);
    downloadBlob(new Blob([json], { type: 'application/json' }), 'comparisons.json');
  });
}

// Returns the current SHA of a file in the repo (needed to update it), or null if new.
async function githubGetSHA(token, path) {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub: could not read ${path} (HTTP ${res.status})`);
  const data = await res.json();
  return data.sha;
}

// Creates or updates a file in the repo with base64-encoded content.
async function githubPutFile(token, path, contentBase64, message, sha) {
  const body = { message, content: contentBase64 };
  if (sha) body.sha = sha;
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.message || `GitHub: write failed for ${path} (HTTP ${res.status})`);
  }
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer instanceof ArrayBuffer ? buffer : buffer.buffer || buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function publishToGitHub() {
  const token = document.getElementById('github-token').value.trim();
  if (!token) {
    setPublishStatus('Enter your GitHub token first.', 'error');
    return;
  }
  localStorage.setItem('up-github-token', token);

  const btn = document.getElementById('btn-publish');
  btn.disabled = true;

  try {
    const total = 1 + pendingImages.length;
    let done = 0;

    // ── Push comparisons.json ──────────────────────────────────────────────────
    setPublishStatus(`Pushing file ${done + 1}/${total}: comparisons.json…`);
    const jsonStr     = JSON.stringify(adminData, null, 2);
    const jsonBytes   = new TextEncoder().encode(jsonStr);
    const jsonBase64  = arrayBufferToBase64(jsonBytes);
    const jsonPath    = 'public/data/comparisons.json';
    const jsonSHA     = await githubGetSHA(token, jsonPath);
    await githubPutFile(token, jsonPath, jsonBase64, 'Update comparisons via admin panel', jsonSHA);
    done++;

    // ── Push any newly uploaded images ─────────────────────────────────────────
    for (const img of pendingImages) {
      setPublishStatus(`Pushing file ${done + 1}/${total}: ${img.path}…`);
      const imgBase64 = arrayBufferToBase64(img.data);
      const imgPath   = 'public/' + img.path;
      const imgSHA    = await githubGetSHA(token, imgPath);
      await githubPutFile(token, imgPath, imgBase64, `Upload ${img.path} via admin panel`, imgSHA);
      done++;
    }

    pendingImages = [];
    setPublishStatus('✓ Pushed to GitHub — Netlify will update in ~30 seconds.', 'success');
  } catch (err) {
    setPublishStatus('✗ ' + err.message, 'error');
  } finally {
    btn.disabled = false;
  }
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
