/**
 * Urban Parallax — Clarity Overlay Engine
 *
 * The overlay is position:fixed, covering the full viewport.
 * backdrop-filter blurs everything the cursor is NOT near.
 * A mask-image with a ~260px clear band follows clientY (viewport-relative).
 *
 * Key differences from old approach:
 *  - Overlay is appended to <body>, NOT the feed container.
 *  - Mouse is tracked on document (whole page), not just the feed.
 *  - Overlay shows when cursor is anywhere on page; hides on viewport exit.
 *  - Scroll listener keeps band correctly anchored to cursor viewport position.
 *  - NO per-element filter/blur is applied anywhere.
 *  - Expand mode: .has-expanded class on feed; CSS handles dimming.
 */
const BlurEngine = (() => {
  let overlayEl    = null;
  let expandedRow  = null;
  let mouseClientY = window.innerHeight / 2; // default to viewport centre
  let rafId        = null;

  // ── Update the band position ───────────────────────────────────────────────
  function updateBand() {
    rafId = null;
    if (!overlayEl) return;
    // overlay is position:fixed with inset:0, so rect.top is always 0
    // → relY = mouseClientY - 0 = mouseClientY
    const rect = overlayEl.getBoundingClientRect();
    const relY  = mouseClientY - rect.top;
    overlayEl.style.setProperty('--mouse-y', relY + 'px');
  }

  function scheduleUpdate() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(updateBand);
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    // Skip on touch-only devices — no mouse cursor means the overlay
    // would permanently obscure content with no way to dismiss it
    if (window.matchMedia('(hover: none)').matches) return;

    // Create overlay, append to body (not feed) so it covers the whole page
    overlayEl = document.createElement('div');
    overlayEl.className = 'clarity-overlay';
    document.body.appendChild(overlayEl);

    // Track cursor across the entire document
    document.addEventListener('mousemove', (e) => {
      if (expandedRow !== null) return;
      mouseClientY = e.clientY;
      scheduleUpdate();
      overlayEl.classList.add('visible');
    });

    // Scroll: content moves but cursor doesn't — recalculate relY
    window.addEventListener('scroll', () => {
      scheduleUpdate();
    }, { passive: true });

    // Cursor leaves the browser window → hide overlay
    document.addEventListener('mouseleave', () => {
      overlayEl.classList.remove('visible');
    });
  }

  // ── Expand mode ────────────────────────────────────────────────────────────
  function setExpanded(row) {
    expandedRow = row;
    const feed = document.getElementById('feed');
    if (feed) feed.classList.add('has-expanded');
    if (overlayEl) overlayEl.classList.remove('visible');
  }

  function clearExpanded() {
    expandedRow = null;
    const feed = document.getElementById('feed');
    if (feed) feed.classList.remove('has-expanded');
    // Overlay will re-appear on next mousemove
  }

  // ── No-ops (kept for API compatibility with app.js) ────────────────────────
  function setElements() {}

  return { init, setElements, setExpanded, clearExpanded, scheduleUpdate };
})();
