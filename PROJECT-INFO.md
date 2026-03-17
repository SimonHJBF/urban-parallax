# Urban Parallax — Project Info & Credentials

**Last updated:** 2026-03-17

---

## Live site
https://urban-parallax.netlify.app

## Code repository
https://github.com/SimonHJBF/urban-parallax

---

## Service credentials

### Netlify
- **Account:** flatin94@gmail.com
- **Site ID:** `aa0631e3-22bd-49ed-96c2-01fef494b233`
- **Personal Access Token:** `nfc_L5vJXde3VJyFEbEv6V4viWWgqfMQYvBs79b5`
- Dashboard: https://app.netlify.com/sites/urban-parallax

### GitHub
- **Repo:** `SimonHJBF/urban-parallax`  (branch: `master`)
- **Fine-grained token** (Contents: read+write, this repo only):
  stored as `atob(...)` in `public/js/admin.js` line ~396
  Full token saved separately in `PROJECT-INFO.local.md` (not committed to git)

> Both tokens are **hardcoded** in `public/js/admin.js` — no manual entry needed.

---

## Admin panel
- URL: https://urban-parallax.netlify.app/admin
- Passwords:  Simon → `12345`  /  Miriam → `12345`
  (hashed with SHA-256 in `admin.js` `ACCOUNTS` array)

---

## Publish flow (how it works)
1. Log in to /admin
2. Edit or add a comparison entry, upload images
3. Click **🚀 Publish** → the button automatically:
   - Commits `comparisons.json` + any new images to GitHub
   - Deploys the full site to Netlify via Files API (live in ~10 seconds)
   - Saves `comparisons.json` to the chosen local backup folder

---

## Local backup folder
- Set once via **Publish → 📁 Choose folder…**
- The handle is stored in the browser's IndexedDB (`up-admin` DB, `kv` store, key `backupDir`)
- `comparisons.json` is written there automatically on every publish

---

## File structure
```
public/
  index.html          — main page (wheel/drum layout)
  about.html          — about page
  admin.html          — admin panel
  css/
    main.css          — site styles (dark-vivid theme locked)
    admin.css         — admin panel styles
    fonts.css         — font imports
  js/
    app.js            — wheel engine, entry open/close, zoom
    theme.js          — dark-vivid theme IIFE (no selector)
    admin.js          — admin panel logic + publish
    blur-engine.js    — blur effects
  data/
    comparisons.json  — 24 comparison entries (committed to git)
  images/
    comparisons/      — per-entry images (committed to git)
    placeholder/      — fallback placeholder images
    site/favicon.svg
```

---

## Key technical notes
- **Netlify Files API `required[]`** returns SHA1 hashes (not paths).
  Upload to `/deploys/{id}/files/{path}` using a sha1→path reverse map.
- **No build step** — Netlify deploys `public/` directly (`netlify.toml`).
- **Theme** is permanently dark-vivid; `theme.js` is a 17-line IIFE — no selector.
- **Wheel layout:** exponential height/opacity decay by distance from centre.
  Active entry 15% wider (874px), distance-1 7% wider (813px), rest 760px.
- **comparisons.json** format per entry:
  ```json
  {
    "title": "Morning Commute",
    "slug": "morning-commute",
    "left":  { "city": "Rotterdam", "image": "images/comparisons/001-.../left-main.svg",  "caption": "…", "body": "…" },
    "right": { "city": "São Paulo",  "image": "images/comparisons/001-.../right-main.svg", "caption": "…", "body": "…" }
  }
  ```
