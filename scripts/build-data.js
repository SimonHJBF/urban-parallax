#!/usr/bin/env node
/**
 * Urban Parallax — Build Script
 * Reads Google Drive content folder → outputs public/data/comparisons.json
 * + copies images to public/images/comparisons/
 *
 * Usage:
 *   node scripts/build-data.js [path/to/content/folder]
 *
 * Defaults to ../content relative to this script (works when repo is inside
 * the same parent folder as the Drive content).
 */

const fs = require('fs');
const path = require('path');

// ─── Paths ────────────────────────────────────────────────────────────────────

const contentDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, '../../content');

const outputJson = path.resolve(__dirname, '../public/data/comparisons.json');
const outputImages = path.resolve(__dirname, '../public/images/comparisons');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    // Simple CSV parse (handles quoted fields)
    const values = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === ',' && !inQuote) { values.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    values.push(cur.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] ?? ''; });
    return obj;
  });
}

function resolveImagePaths(side, slug) {
  const base = `/images/comparisons/${slug}`;
  return {
    ...side,
    image: side.image ? `${base}/${side.image}` : null,
    extraImages: (side.extraImages || []).map(img => `${base}/${img}`),
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log(`\nUrban Parallax build`);
console.log(`Content: ${contentDir}`);
console.log(`Output:  ${outputJson}\n`);

// 1. Read index.csv
const indexPath = path.join(contentDir, 'index.csv');
if (!fs.existsSync(indexPath)) {
  console.error(`ERROR: index.csv not found at ${indexPath}`);
  process.exit(1);
}

const rows = parseCSV(readFile(indexPath));
console.log(`Found ${rows.length} rows in index.csv`);

// 2. Filter published
const published = rows.filter(r => r.status === 'published');
console.log(`${published.length} published comparisons`);

// 3. Sort: rows with order first (ascending), then by date (descending)
published.sort((a, b) => {
  const aOrder = a.order ? parseInt(a.order) : null;
  const bOrder = b.order ? parseInt(b.order) : null;
  if (aOrder !== null && bOrder !== null) return aOrder - bOrder;
  if (aOrder !== null) return -1;
  if (bOrder !== null) return 1;
  return b.date.localeCompare(a.date);
});

// 4. Build comparison objects
const comparisons = [];
let errors = 0;

for (const row of published) {
  const slug = `${row.id}-${row.slug}`;
  const compDir = path.join(contentDir, slug);

  if (!fs.existsSync(compDir)) {
    console.warn(`  SKIP ${slug} — folder not found`);
    errors++;
    continue;
  }

  // Read meta.json
  const metaRaw = readFile(path.join(compDir, 'meta.json'));
  if (!metaRaw) {
    console.warn(`  SKIP ${slug} — meta.json missing`);
    errors++;
    continue;
  }

  let meta;
  try {
    meta = JSON.parse(metaRaw);
  } catch (e) {
    console.warn(`  SKIP ${slug} — meta.json invalid JSON: ${e.message}`);
    errors++;
    continue;
  }

  // Read markdown bodies
  const leftBody = readFile(path.join(compDir, 'left.md')) || '';
  const rightBody = readFile(path.join(compDir, 'right.md')) || '';

  // Copy images
  const imagesDir = path.join(compDir, 'images');
  const destImages = path.join(outputImages, slug);
  if (fs.existsSync(imagesDir)) {
    copyDir(imagesDir, destImages);
    console.log(`  ✓ ${slug} — images copied`);
  } else {
    console.log(`  ✓ ${slug} — no images folder`);
  }

  // Build output object
  const comparison = {
    id: row.id,
    title: row.title,
    slug: row.slug,
    date: row.date,
    order: row.order ? parseInt(row.order) : null,
    introduction: meta.introduction || '',
    metadata: meta.metadata || {},
    tags: meta.tags || [],
    quickFacts: meta.quickFacts || [],
    left: {
      ...resolveImagePaths(meta.left || {}, slug),
      body: leftBody,
    },
    right: {
      ...resolveImagePaths(meta.right || {}, slug),
      body: rightBody,
    },
  };

  comparisons.push(comparison);
}

// 5. Write output
fs.mkdirSync(path.dirname(outputJson), { recursive: true });
fs.writeFileSync(outputJson, JSON.stringify(comparisons, null, 2), 'utf8');

console.log(`\nWrote ${comparisons.length} comparisons to ${outputJson}`);
if (errors) console.warn(`${errors} comparison(s) skipped due to errors`);
console.log('Done.\n');
