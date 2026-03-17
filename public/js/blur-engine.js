/**
 * Urban Parallax — Clarity Overlay Engine
 *
 * Images carry a progressive CSS blur by row position (defined in main.css).
 * When the mouse moves over the feed, a single backdrop-filter overlay covers
 * everything. A mask-image with a soft transparent window at the cursor's
 * Y position creates a horizontal "clarity band" — the rest stays blurred.
 *
 * Expand mode: non-expanded rows are dimmed via the .has-expanded class
 * on the feed container (CSS handles the actual filter/opacity).
 */
const BlurEngine = (() => {
  let overlayEl   = null;
  let expandedRow = null;
  let rafId       = null;
  let pendingY    = 0;

  // ── Clarity overlay setup ──────────────────────────────────────────────────
  function init() {
    const feed = document.getElementById('feed');
    if (!feed) return;

    // Create the overlay
    overlayEl = document.createElement('div');
    overlayEl.className = 'clarity-overlay';
    feed.appendChild(overlayEl);

    // Mousemove: update --mouse-y, show overlay
    feed.addEventListener('mousemove', (e) => {
      if (expandedRow !== null) return;
      const rect = feed.getBoundingClientRect();
      pendingY = e.clientY - rect.top;

      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          feed.style.setProperty('--mouse-y', pendingY + 'px');
        });
      }
      overlayEl.classList.add('visible');
    });

    // Mouse leaves feed: hide overlay
    feed.addEventListener('mouseleave', () => {
      overlayEl.classList.remove('visible');
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
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
  }

  // ── No-ops (kept for API compatibility with app.js) ────────────────────────
  function setElements() {}
  function scheduleUpdate() {}

  return { init, setElements, setExpanded, clearExpanded, scheduleUpdate };
})();
