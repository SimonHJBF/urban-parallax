/**
 * Urban Parallax — Lens Engine
 *
 * The signature interaction: a spatial "clear band" floating on the viewport.
 * Content inside the band is sharp; content outside fades continuously to blur
 * based on pixel distance from the band edges.
 *
 * This is NOT a per-row effect — the band cuts across row boundaries.
 *
 * Two input modes:
 *  1. Scroll (default): lens fixed at viewport centre; content scrolls through it.
 *  2. Mouse: lens Y follows cursor; returns to centre after MOUSE_TIMEOUT ms idle.
 *
 * Expand mode: when a row is expanded, that row is fully clear; everything
 * else is dimmed to blur(3px) / opacity 0.4. Mouse tracking is paused.
 */
const BlurEngine = (() => {
  // ── Constants ──────────────────────────────────────────────────────────────
  const LENS_HEIGHT  = 180;   // px — fully clear zone
  const FADE_ZONE    = 140;   // px — gradient from clear to max blur
  const BLUR_MAX     = 6;     // px — maximum blur
  const OPACITY_MIN  = 0.55;  // minimum opacity at max blur
  const MOUSE_TIMEOUT = 2000; // ms — idle before lens returns to centre

  // ── State ──────────────────────────────────────────────────────────────────
  let lensY       = null;   // null = use viewport centre
  let mouseActive = false;
  let mouseTimer  = null;
  let expandedRow = null;   // DOM element currently expanded (or null)
  let elements    = [];     // array of DOM elements to apply lens to
  let rafPending  = false;
  let enabled     = true;   // false on mobile we could still keep on, lens just stays centred

  // ── Core ───────────────────────────────────────────────────────────────────
  function applyLens() {
    rafPending = false;

    const vpH    = window.innerHeight;
    const centreY = (lensY !== null) ? lensY : vpH / 2;
    const lensTop = centreY - LENS_HEIGHT / 2;
    const lensBot = centreY + LENS_HEIGHT / 2;

    elements.forEach(el => {
      // ── Expand mode ──
      if (expandedRow !== null) {
        if (el === expandedRow) {
          el.style.filter     = 'none';
          el.style.opacity    = '1';
          el.style.transition = 'filter 0.4s ease, opacity 0.4s ease';
        } else {
          el.style.filter     = 'blur(3px)';
          el.style.opacity    = '0.4';
          el.style.transition = 'filter 0.4s ease, opacity 0.4s ease';
        }
        return;
      }

      // ── Normal lens mode ──
      const rect  = el.getBoundingClientRect();
      const elMid = rect.top + rect.height / 2;

      let dist = 0;
      if      (elMid < lensTop) dist = lensTop - elMid;
      else if (elMid > lensBot) dist = elMid   - lensBot;

      const ratio   = Math.min(dist / FADE_ZONE, 1);
      const blur    = ratio * BLUR_MAX;
      const opacity = 1 - ratio * (1 - OPACITY_MIN);

      el.style.filter     = blur > 0.1 ? `blur(${blur.toFixed(1)}px)` : 'none';
      el.style.opacity    = opacity.toFixed(2);
      el.style.transition = mouseActive
        ? 'filter 0.15s ease, opacity 0.15s ease'
        : 'filter 0.3s ease, opacity 0.3s ease';
    });
  }

  function scheduleUpdate() {
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(applyLens);
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  function setElements(els) {
    elements = Array.from(els);
  }

  function setExpanded(row) {
    expandedRow = row;
    scheduleUpdate();
  }

  function clearExpanded() {
    expandedRow = null;
    scheduleUpdate();
  }

  function init() {
    // Scroll: lens stays at centre; content moves through it
    window.addEventListener('scroll', () => {
      if (!mouseActive) lensY = null;
      scheduleUpdate();
    }, { passive: true });

    // Mouse: lens follows cursor Y
    window.addEventListener('mousemove', e => {
      if (expandedRow !== null) return; // pause during expand
      lensY       = e.clientY;
      mouseActive = true;
      clearTimeout(mouseTimer);
      mouseTimer = setTimeout(() => {
        mouseActive = false;
        lensY       = null;
        scheduleUpdate();
      }, MOUSE_TIMEOUT);
      scheduleUpdate();
    });

    // Mouse leaves viewport: snap back to centre
    window.addEventListener('mouseleave', () => {
      mouseActive = false;
      lensY       = null;
      scheduleUpdate();
    });

    // Resize: recalculate
    window.addEventListener('resize', scheduleUpdate, { passive: true });

    // Initial render
    scheduleUpdate();
  }

  return { init, setElements, setExpanded, clearExpanded, scheduleUpdate };
})();
