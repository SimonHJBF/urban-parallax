# Urban Parallax

A visual research blog comparing urban spaces across cities. Two columns. Two cities. One lens.

Built by Simon (São Paulo) + Miriam (Rotterdam).

## Architecture

- **Content**: Google Drive folder-per-comparison CMS (see `../content/`)
- **Build**: `scripts/build-data.js` reads the Drive content and outputs `public/data/comparisons.json`
- **Frontend**: Vanilla HTML/CSS/JS — no framework, no bundler
- **Hosting**: Netlify (deploy from `public/`)

## Local development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the build script, pointing at the Google Drive content folder:
   ```bash
   node scripts/build-data.js "/path/to/Urban Parallax/content"
   ```
   This reads `index.csv` + all comparison folders, copies images, and writes `public/data/comparisons.json`.

3. Serve locally:
   ```bash
   npx serve public
   ```
   Or open `public/index.html` directly in a browser.

## Deploying

1. Run the build script (step 2 above)
2. Commit and push — Netlify auto-deploys from the `public/` folder.

Or deploy manually:
```bash
npx netlify deploy --prod --dir=public
```

## Adding a comparison

See `../README.txt` for the full content guide.

Short version:
1. Copy `../templates/` into `../content/00N-your-slug/`
2. Fill in `meta.json`, `left.md`, `right.md`, drop images into `images/`
3. Add a row to `../content/index.csv` with `status = published`
4. Re-run `npm run build`
5. Push to deploy

## Admin panel

Visit `/admin.html` (password-protected). The admin panel is client-side only — it generates downloadable files you then drop into the Drive content folder.
