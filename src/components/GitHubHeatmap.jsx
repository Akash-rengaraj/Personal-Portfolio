import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

const LEVEL_COLORS_DARK = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];
const LEVEL_COLORS_LIGHT = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];
const DAYS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
const CELL = 11;
const GAP = 2;
const STEP = CELL + GAP;
const SKELETON_WEEKS = 53;

function getLevelColors() {
  return document.body.classList.contains('light-mode') ? LEVEL_COLORS_LIGHT : LEVEL_COLORS_DARK;
}

/** Splits a flat list of days into columns of seven. */
function toWeeks(days) {
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

/**
 * One SVG for the whole year instead of ~365 DOM boxes: a single layout
 * object, cheap to paint, and the hover tooltip never re-renders the cells.
 */
function HeatmapSvg({ weeks, colors, label, onCellHover, skeleton = false }) {
  const width = weeks.length * STEP - GAP;
  const height = 7 * STEP - GAP;
  return (
    <svg
      className={`heatmap-svg ${skeleton ? 'is-skeleton' : ''}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      onMouseOver={onCellHover}
      onMouseLeave={onCellHover}
    >
      {weeks.map((week, wi) =>
        week.map((day, di) => (
          <rect
            key={`${wi}-${di}`}
            x={wi * STEP}
            y={di * STEP}
            width={CELL}
            height={CELL}
            rx={2}
            fill={skeleton ? 'currentColor' : colors[day.level] || colors[0]}
            data-tip={skeleton ? undefined : `${day.count} contributions on ${day.date}`}
          />
        ))
      )}
    </svg>
  );
}

function GitHubHeatmap({ username = 'Akash-rengaraj' }) {
  const [contributions, setContributions] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [error, setError] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`https://github-contributions-api.jogruber.de/v4/${username}?y=last`, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setContributions(data.contributions || []);
      } catch (err) {
        if (err.name !== 'AbortError') setError(true);
      }
    })();
    return () => controller.abort();
  }, [username]);

  useEffect(() => {
    // newest weeks are on the right — start scrolled there
    if (contributions && scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  }, [contributions]);

  const handleHover = useCallback((e) => {
    const tip = e.type === 'mouseover' ? e.target.getAttribute?.('data-tip') : null;
    if (!tip) {
      setTooltip(null);
      return;
    }
    const rect = e.target.getBoundingClientRect();
    setTooltip({ text: tip, x: rect.left, y: rect.top });
  }, []);

  const colors = getLevelColors();
  const total = contributions?.reduce((sum, day) => sum + day.count, 0) ?? 0;
  const skeletonWeeks = useMemo(() => toWeeks(Array.from({ length: SKELETON_WEEKS * 7 }, () => ({}))), []);
  const grid = useMemo(
    () => contributions && (
      <HeatmapSvg
        weeks={toWeeks(contributions)}
        colors={colors}
        label={`${total} GitHub contributions in the last year`}
        onCellHover={handleHover}
      />
    ),
    // `colors` is one of two constant palettes, so it only changes with the theme
    [contributions, colors, total, handleHover]
  );

  if (error) return (
    <div className="heatmap-error output-error">
      github heatmap: api unavailable or rate limited.
    </div>
  );

  if (!contributions) return (
    <div className="heatmap-skeleton">
      <HeatmapSvg weeks={skeletonWeeks} label="Loading contribution graph" skeleton />
    </div>
  );

  return (
    <div className="heatmap-wrapper">
      <div className="heatmap-header">
        <span className="heatmap-total">{total} contributions in the last year</span>
        <div className="heatmap-legend" aria-hidden="true">
          <span>Less</span>
          {colors.map(c => <div key={c} className="heatmap-legend-cell" style={{ background: c }} />)}
          <span>More</span>
        </div>
      </div>
      <div className="heatmap-scroll" ref={scrollRef}>
        <div className="heatmap-grid-wrapper">
          <div className="heatmap-day-labels" aria-hidden="true">
            {DAYS.map((d, i) => <div key={i} className="heatmap-day-label">{d}</div>)}
          </div>
          {grid}
        </div>
      </div>
      {tooltip && (
        <div className="heatmap-tooltip" style={{ left: tooltip.x, top: tooltip.y - 34, position: 'fixed' }}>
          {tooltip.text}
        </div>
      )}
    </div>
  );
}

export default GitHubHeatmap;
