import { useState, useEffect, useRef } from 'react';

const LEVEL_COLORS_DARK = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];
const LEVEL_COLORS_LIGHT = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];

function getLevelColors() {
  return document.body.classList.contains('light-mode') ? LEVEL_COLORS_LIGHT : LEVEL_COLORS_DARK;
}

function GitHubHeatmap({ username = 'Akash-rengaraj' }) {
  const [contributions, setContributions] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [error, setError] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    fetch(`https://github-contributions-api.jogruber.de/v4/${username}?y=last`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => setContributions(data.contributions || []))
      .catch(() => setError(true));
  }, [username]);

  useEffect(() => {
    if (contributions && scrollRef.current) {
      // Scroll to the far right after rendering the heatmap
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [contributions]);

  if (error) return (
    <div className="heatmap-error output-error">
      github heatmap: api unavailable or rate limited.
    </div>
  );

  if (!contributions) return (
    <div className="heatmap-skeleton">
      {[...Array(52)].map((_, i) => (
        <div key={i} className="heatmap-col">
          {[...Array(7)].map((_, j) => (
            <div key={j} className="heatmap-cell skeleton-cell" />
          ))}
        </div>
      ))}
    </div>
  );

  // Group by week
  const weeks = [];
  let week = [];
  contributions.forEach((day, i) => {
    week.push(day);
    if (week.length === 7 || i === contributions.length - 1) {
      weeks.push(week);
      week = [];
    }
  });

  const totalContribs = contributions.reduce((s, d) => s + d.count, 0);
  const colors = getLevelColors();

  const DAYS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

  return (
    <div className="heatmap-wrapper">
      <div className="heatmap-header">
        <span className="heatmap-total">{totalContribs} contributions in the last year</span>
        <div className="heatmap-legend">
          <span>Less</span>
          {colors.map((c, i) => (
            <div key={i} className="heatmap-legend-cell" style={{ background: c }} />
          ))}
          <span>More</span>
        </div>
      </div>
      <div className="heatmap-scroll" ref={scrollRef}>
        <div className="heatmap-grid-wrapper">
          <div className="heatmap-day-labels">
            {DAYS.map((d, i) => <div key={i} className="heatmap-day-label">{d}</div>)}
          </div>
          <div className="heatmap-grid">
            {weeks.map((week, wi) => (
              <div key={wi} className="heatmap-col">
                {week.map((day, di) => (
                  <div
                    key={di}
                    className="heatmap-cell"
                    style={{ background: colors[day.level] || colors[0] }}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltip({ text: `${day.count} contributions on ${day.date}`, x: rect.left, y: rect.top });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    aria-label={`${day.count} contributions on ${day.date}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      {tooltip && (
        <div
          className="heatmap-tooltip"
          style={{ left: tooltip.x, top: tooltip.y - 34, position: 'fixed' }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}

export default GitHubHeatmap;
