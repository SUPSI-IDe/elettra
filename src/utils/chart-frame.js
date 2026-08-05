/**
 * Shared sizing contract for every d3 chart in the app.
 *
 * Charts are drawn into an SVG with `width:100%; height:auto`, so the rendered
 * size is `containerWidth × (viewBoxHeight / viewBoxWidth)`. When each chart
 * hard-codes its own viewBox the browser scales it by an arbitrary factor, so
 * two charts side by side end up different heights *and* their 10px labels
 * render at different physical sizes.
 *
 * The fix is to draw at 1:1 — viewBox width = the container's measured pixel
 * width — and to give every chart the same viewBox height. Then one viewBox
 * unit is one CSS pixel everywhere: all charts are exactly CHART_PLOT_HEIGHT
 * tall and a font-size of 11 is 11px in every chart on every page.
 *
 * Measurement needs a fallback because charts are also rendered inside hidden
 * tab panels (`display:none` ⇒ width 0). Those draw at CHART_FALLBACK_WIDTH and
 * are redrawn by the shared ResizeObserver as soon as the panel becomes
 * visible, which is the same mechanism that keeps them correct on resize.
 */

/** Plot-area height, in CSS pixels, shared by every standard chart. */
export const CHART_PLOT_HEIGHT = 260;

/** viewBox width used when the container has no layout width yet. */
export const CHART_FALLBACK_WIDTH = 620;

/** Narrowest canvas we draw into, so axis margins never collapse the plot. */
const CHART_MIN_WIDTH = 280;

/* Type scale — three roles, in CSS pixels (1:1 with viewBox units). */
export const CHART_FONT_TICK = "10px";       // axis ticks and axis titles
export const CHART_FONT_LABEL = "11px";      // data values, category labels
export const CHART_FONT_EMPHASIS = "12px";   // totals and headline callouts
export const CHART_FONT_TOOLTIP = "var(--font-size-xs)";

const redraws = new WeakMap();
let resizeObserver = null;

const getObserver = () => {
  if (resizeObserver || typeof ResizeObserver === "undefined") return resizeObserver;
  resizeObserver = new ResizeObserver((entries) => {
    entries.forEach((entry) => {
      const state = redraws.get(entry.target);
      if (!state) return;
      const width = Math.round(entry.contentRect.width);
      // Redrawing only replaces the SVG inside a container whose width comes
      // from the page grid, so this cannot feed itself a new width. The guard
      // is here to skip the no-op notifications, not to break a loop.
      if (width <= 0 || width === state.width) return;
      state.width = width;
      state.redraw();
    });
  });
  return resizeObserver;
};

/**
 * Measure `el` for a 1:1 viewBox and register `redraw` to run again whenever the
 * container's width changes — including the 0 → visible transition of a hidden
 * tab. `redraw` must repaint `el` from scratch (the chart render function
 * itself, re-invoked with the same data).
 */
export const chartCanvasWidth = (el, redraw) => {
  if (!el) return CHART_FALLBACK_WIDTH;

  const measured = Math.round(el.getBoundingClientRect?.().width ?? 0);
  const width = measured > 0 ? Math.max(measured, CHART_MIN_WIDTH) : CHART_FALLBACK_WIDTH;

  if (typeof redraw === "function") {
    const existing = redraws.get(el);
    if (existing) {
      existing.redraw = redraw;
      existing.width = measured;
    } else {
      redraws.set(el, { redraw, width: measured });
      getObserver()?.observe(el);
    }
  }

  return width;
};

/**
 * Row geometry for horizontal bar charts, derived from a fixed canvas height so
 * the chart is the same height whatever the row count. Without this, a
 * three-pollutant chart and a two-scenario chart end up different heights.
 *
 * `maxBand` keeps a two-row chart from turning into two enormous slabs; when
 * the rows do not fill the canvas the block is centred in it, so the returned
 * `offsetTop` replaces `margin.top` as the first row's y origin.
 */
export const horizontalBandGeometry = (
  rowCount,
  { top, bottom },
  { gapRatio = 0.45, maxBand = Infinity, height = CHART_PLOT_HEIGHT } = {}
) => {
  const rows = Math.max(1, rowCount);
  const available = Math.max(0, height - top - bottom);
  // rows * band + (rows - 1) * band * gapRatio = available
  const band = Math.min(available / (rows + (rows - 1) * gapRatio), maxBand);
  const gap = band * gapRatio;
  const used = rows * band + (rows - 1) * gap;
  return { band, gap, available, offsetTop: top + Math.max(0, (available - used) / 2) };
};
