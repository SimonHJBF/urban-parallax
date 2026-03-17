/**
 * Urban Parallax — Admin Panel
 * Client-side only. Generates downloadable folder (meta.json + left.md + right.md).
 * Password gate using SHA-256. No server needed.
 *
 * To change the password:
 *   1. Run: echo -n "yourpassword" | sha256sum
 *   2. Update PASSWORD_HASH below
 *
 * Default password: urbanparallax
 */

// SHA-256 hash of "urbanparallax"
const PASSWORD_HASH = 'b6c1c7ea7d5a5bfe9c8b1a2fe1f6c1e8c5a3b2d9e8f7c6b5a4d3c2b1a0e9f8d7';

// ── Auth ──────────────────────────────────────────────────────────────────────
async function hashPassword(pw) {
  const buf    = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function checkAuth() {
  if (sessionStorage.getItem('up-admin') === '1') return showAdmin();

  document.getElementById('auth-form').addEventListener('submit', async e => {
    e.preventDefault();
    const pw   = document.getElementById('auth-input').value;
    const hash = await hashPassword(pw);
    if (hash === PASSWORD_HASH) {
      sessionStorage.setItem('up-admin', '1');
      showAdmin();
    } else {
      document.getElementById('auth-error').hidden = false;
    }
  });
}

function showAdmin() {
  document.getElementById('auth-gate').hidden = true;
  document.getElementById('admin-ui').hidden  = false;
  initAdmin();
}

document.getElementById('admin-logout').addEventListener('click', () => {
  sessionStorage.removeItem('up-admin');
  location.reload();
});

// ── Tabs ──────────────────────────────────────────────────────────────────────
document.querySelectorAll('.admin-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
  });
});

// ── Admin init ────────────────────────────────────────────────────────────────
function initAdmin() {
  initQuickFacts();
  initExport();
  initReorder();
  initLoadMeta();

  // Auto-generate slug from title
  document.getElementById('f-title').addEventListener('input', e => {
    const slugField = document.getElementById('f-slug');
    if (!slugField.dataset.manual) {
      slugField.value = slugify(e.target.value);
    }
  });
  document.getElementById('f-slug').addEventListener('input', function() {
    this.dataset.manual = '1';
  });

  // Set today's date
  document.getElementById('f-date').value = new Date().toISOString().slice(0, 10);
}

function slugify(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// ── Quick Facts Editor ────────────────────────────────────────────────────────
function initQuickFacts() {
  document.getElementById('qf-add').addEventListener('click', addQFRow);
  // Seed with 5 empty rows
  for (let i = 0; i < 5; i++) addQFRow();
}

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

// ── Build meta.json from form ─────────────────────────────────────────────────
function buildMeta() {
  const val = id => document.getElementById(id).value.trim();

  const meta = {
    introduction: val('f-intro'),
    metadata: {},
    tags: val('f-tags').split(',').map(t => t.trim()).filter(Boolean),
    quickFacts: getQuickFacts(),
    left: {
      city:         val('f-left-city'),
      neighbourhood: val('f-left-nbhd'),
      title:        val('f-left-title'),
      subtitle:     val('f-left-subtitle'),
      description:  val('f-left-desc'),
      contributor:  val('f-left-contrib'),
      image:        val('f-left-img') || 'left-main.jpg',
      extraImages:  val('f-left-extras').split(',').map(s => s.trim()).filter(Boolean),
    },
    right: {
      city:         val('f-right-city'),
      neighbourhood: val('f-right-nbhd'),
      title:        val('f-right-title'),
      subtitle:     val('f-right-subtitle'),
      description:  val('f-right-desc'),
      contributor:  val('f-right-contrib'),
      image:        val('f-right-img') || 'right-main.jpg',
      extraImages:  val('f-right-extras').split(',').map(s => s.trim()).filter(Boolean),
    },
  };

  // Metadata fields
  const fields = ['topic', 'scale', 'system', 'season'];
  fields.forEach(f => { if (val(`f-${f}`)) meta.metadata[f] = val(`f-${f}`); });
  const coordL = val('f-coord-left'), coordR = val('f-coord-right');
  if (coordL || coordR) meta.metadata.coordinates = { left: coordL, right: coordR };

  // Clean up empty objects
  if (!Object.keys(meta.metadata).length) delete meta.metadata;

  return meta;
}

// ── Export ────────────────────────────────────────────────────────────────────
function initExport() {
  document.getElementById('btn-export').addEventListener('click', exportFolder);
  document.getElementById('btn-preview').addEventListener('click', previewComparison);
}

async function exportFolder() {
  const id    = document.getElementById('f-id').value.trim().padStart(3, '0');
  const slug  = document.getElementById('f-slug').value.trim();
  const date  = document.getElementById('f-date').value;
  const status = document.getElementById('f-status').value;
  const order = document.getElementById('f-order').value.trim();
  const title = document.getElementById('f-title').value.trim();

  if (!id || !slug || !title) {
    setStatus('Please fill in ID, title and slug before exporting.', true);
    return;
  }

  const meta      = buildMeta();
  const leftBody  = document.getElementById('f-left-body').value;
  const rightBody = document.getElementById('f-right-body').value;
  const folderName = `${id}-${slug}`;

  const zip = new JSZip();
  const folder = zip.folder(folderName);

  folder.file('meta.json', JSON.stringify(meta, null, 2));
  folder.file('left.md',   leftBody);
  folder.file('right.md',  rightBody);
  folder.folder('images');  // empty placeholder

  // Generate CSV row
  const csvRow = `${id},"${title}",${slug},${date},${status},${order}`;

  // Instructions file
  folder.file('_INSTRUCTIONS.txt',
    `Urban Parallax — Comparison folder: ${folderName}\n` +
    `Generated: ${new Date().toISOString()}\n\n` +
    `FILES:\n` +
    `  meta.json  — structured metadata, quick-facts, city info\n` +
    `  left.md    — deep-dive body text for left city\n` +
    `  right.md   — deep-dive body text for right city\n` +
    `  images/    — drop your images here (left-main.jpg, right-main.jpg, etc.)\n\n` +
    `NEXT STEPS:\n` +
    `  1. Copy this folder into the Google Drive content/ directory\n` +
    `  2. Add this row to content/index.csv:\n     ${csvRow}\n` +
    `  3. Run: node scripts/build-data.js\n` +
    `  4. Push to deploy\n`
  );

  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, `${folderName}.zip`);
  setStatus(`Exported ${folderName}.zip — drop the folder into Google Drive content/ and update index.csv.`);
}

function previewComparison() {
  const meta = buildMeta();
  const leftBody  = document.getElementById('f-left-body').value;
  const rightBody = document.getElementById('f-right-body').value;

  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(`<!DOCTYPE html><html><head>
    <title>Preview — ${meta.left.city || 'Left'} vs ${meta.right.city || 'Right'}</title>
    <style>
      body { font-family: sans-serif; padding: 32px; max-width: 800px; margin: 0 auto; background: #F5F3EE; }
      h1   { font-size: 24px; margin-bottom: 8px; }
      .intro { font-style: italic; color: #555; margin-bottom: 24px; }
      .grid { display: grid; grid-template-columns: 1fr 1px 1fr; gap: 0; border-top: 1px solid #ccc; padding-top: 24px; }
      .cell { padding: 0 24px; }
      .cell:first-child { padding-left: 0; }
      .cell:last-child  { padding-right: 0; }
      .divider { background: #ccc; }
      h2 { font-size: 18px; margin-bottom: 8px; }
      p  { font-size: 14px; line-height: 1.6; }
      .qf { margin: 24px 0; border-collapse: collapse; width: 100%; }
      .qf td { padding: 6px 12px; border-bottom: 1px solid #ccc; font-size: 14px; }
      .qf td:first-child { text-align: right; }
      .qf td:last-child  { text-align: left; }
      .qf td:nth-child(2) { text-align: center; color: #ccc; width: 24px; }
    </style>
  </head><body>
    <p style="font-family:monospace;font-size:11px;color:#888;margin-bottom:16px">PREVIEW — Urban Parallax Admin</p>
    <h1>${esc(meta.left.city || 'Left')} vs ${esc(meta.right.city || 'Right')}</h1>
    <p class="intro">${esc(meta.introduction || '')}</p>
    ${meta.quickFacts && meta.quickFacts.length ? `
      <table class="qf">
        <tr><td><strong>${esc(meta.left.city)}</strong></td><td></td><td><strong>${esc(meta.right.city)}</strong></td></tr>
        ${meta.quickFacts.map(r => `<tr><td>${esc(r.left)}</td><td>—</td><td>${esc(r.right)}</td></tr>`).join('')}
      </table>` : ''}
    <div class="grid">
      <div class="cell">
        <h2>${esc(meta.left.title)}</h2>
        <p style="color:#888;font-size:12px;margin-bottom:12px">${esc(meta.left.subtitle)}</p>
        <div>${leftBody.replace(/\n/g, '<br>')}</div>
      </div>
      <div class="divider"></div>
      <div class="cell">
        <h2>${esc(meta.right.title)}</h2>
        <p style="color:#888;font-size:12px;margin-bottom:12px">${esc(meta.right.subtitle)}</p>
        <div>${rightBody.replace(/\n/g, '<br>')}</div>
      </div>
    </div>
  </body></html>`);
}

// ── Reorder tab ───────────────────────────────────────────────────────────────
let reorderData = [];
let dragSrc     = null;

function initReorder() {
  document.getElementById('btn-load-json').addEventListener('click', () => {
    document.getElementById('input-json').click();
  });

  document.getElementById('input-json').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        reorderData = JSON.parse(ev.target.result);
        renderReorderList();
        document.getElementById('btn-export-csv').disabled = false;
      } catch {
        alert('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
  });

  document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
}

function renderReorderList() {
  const list = document.getElementById('reorder-list');
  list.innerHTML = '';

  reorderData.forEach((c, idx) => {
    const item       = document.createElement('div');
    item.className   = 'reorder-item';
    item.draggable   = true;
    item.dataset.idx = idx;
    item.innerHTML   = `
      <span class="reorder-handle">⠿</span>
      <span class="reorder-order">${idx + 1}</span>
      <span class="reorder-title">${esc(c.title)}</span>
      <span class="reorder-date">${c.date || ''}</span>`;

    item.addEventListener('dragstart', e => {
      dragSrc = item;
      e.dataTransfer.effectAllowed = 'move';
      item.classList.add('dragging');
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      updateOrderNumbers();
    });

    item.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragSrc && dragSrc !== item) {
        const rect   = item.getBoundingClientRect();
        const after  = e.clientY - rect.top > rect.height / 2;
        list.insertBefore(dragSrc, after ? item.nextSibling : item);
      }
    });

    list.appendChild(item);
  });
}

function updateOrderNumbers() {
  document.querySelectorAll('#reorder-list .reorder-item').forEach((item, i) => {
    item.querySelector('.reorder-order').textContent = i + 1;
  });
}

function exportCSV() {
  const items   = document.querySelectorAll('#reorder-list .reorder-item');
  const orderedIDs = Array.from(items).map(el => {
    const idx = parseInt(el.dataset.idx);
    return reorderData[idx];
  });

  const header = 'id,title,slug,date,status,order';
  const rows   = orderedIDs.map((c, i) =>
    `${c.id},"${c.title}",${c.slug},${c.date},published,${i + 1}`
  );

  const csv = [header, ...rows].join('\n');
  downloadBlob(new Blob([csv], { type: 'text/csv' }), 'index.csv');
  setStatus('Exported index.csv — replace the file in Google Drive content/ and redeploy.');
}

// ── Load & Edit ───────────────────────────────────────────────────────────────
function initLoadMeta() {
  document.getElementById('input-meta').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const meta = JSON.parse(ev.target.result);
        populateForm(meta);
        // Switch to Add tab
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
        document.querySelector('[data-tab="add"]').classList.add('active');
        document.getElementById('tab-add').classList.add('active');
        document.getElementById('load-status').textContent = `Loaded: ${file.name}`;
      } catch {
        document.getElementById('load-status').textContent = 'Error: invalid JSON.';
      }
    };
    reader.readAsText(file);
  });
}

function populateForm(meta) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };

  set('f-intro',         meta.introduction);
  set('f-topic',         meta.metadata?.topic);
  set('f-scale',         meta.metadata?.scale);
  set('f-system',        meta.metadata?.system);
  set('f-season',        meta.metadata?.season);
  set('f-coord-left',    meta.metadata?.coordinates?.left);
  set('f-coord-right',   meta.metadata?.coordinates?.right);
  set('f-tags',          (meta.tags || []).join(', '));

  set('f-left-city',     meta.left?.city);
  set('f-left-nbhd',     meta.left?.neighbourhood);
  set('f-left-title',    meta.left?.title);
  set('f-left-subtitle', meta.left?.subtitle);
  set('f-left-desc',     meta.left?.description);
  set('f-left-contrib',  meta.left?.contributor);
  set('f-left-img',      meta.left?.image);
  set('f-left-extras',   (meta.left?.extraImages || []).join(', '));

  set('f-right-city',    meta.right?.city);
  set('f-right-nbhd',    meta.right?.neighbourhood);
  set('f-right-title',   meta.right?.title);
  set('f-right-subtitle',meta.right?.subtitle);
  set('f-right-desc',    meta.right?.description);
  set('f-right-contrib', meta.right?.contributor);
  set('f-right-img',     meta.right?.image);
  set('f-right-extras',  (meta.right?.extraImages || []).join(', '));

  // Quick facts
  document.getElementById('qf-rows').innerHTML = '';
  (meta.quickFacts || []).forEach(r => addQFRow(r.left, r.right));
}

// ── Utilities ─────────────────────────────────────────────────────────────────
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

function setStatus(msg, isError = false) {
  const el    = document.getElementById('export-status');
  el.textContent = msg;
  el.style.color = isError ? '#C4553A' : '#4A6670';
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
