import { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { skillsData, hackerrankBadgesData } from '../data/skills';
import { hackathonsData } from '../data/hackathons';
import { useApp } from '../context/AppContext';
import GitHubHeatmap from '../components/GitHubHeatmap';

function SkeletonBox() {
  return (
    <div className="milestone-box skeleton-box">
      <div className="skeleton-line skeleton-title" />
      <div className="skeleton-line skeleton-number" />
      <div className="skeleton-line skeleton-comment" />
    </div>
  );
}

/* ─── Lightweight canvas confetti ─────────────────── */
function fireConfetti(originEl) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
  document.body.appendChild(canvas);
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');

  const rect = originEl.getBoundingClientRect();
  const ox = rect.left + rect.width / 2;
  const oy = rect.top + rect.height / 2;

  const colors = ['#00ffff','#00ff00','#ffff00','#ff00ff','#ffffff','#ff9900'];
  const particles = Array.from({ length: 80 }, () => ({
    x: ox, y: oy,
    vx: (Math.random() - 0.5) * 14,
    vy: (Math.random() - 0.8) * 14,
    r: Math.random() * 5 + 2,
    color: colors[Math.floor(Math.random() * colors.length)],
    alpha: 1,
    rot: Math.random() * Math.PI * 2,
    rotV: (Math.random() - 0.5) * 0.3,
  }));

  let frame;
  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    particles.forEach(p => {
      if (p.alpha <= 0) return;
      alive = true;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // gravity
      p.vx *= 0.98;
      p.alpha -= 0.018;
      p.rot += p.rotV;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
      ctx.restore();
    });
    if (alive) {
      frame = requestAnimationFrame(draw);
    } else {
      canvas.remove();
    }
  };
  frame = requestAnimationFrame(draw);
  setTimeout(() => { cancelAnimationFrame(frame); canvas.remove(); }, 4000);
}

/* ─── LeetCode difficulty grid ───────────────────── */
function LeetCodeGrid({ stats }) {
  const CELLS = 50;
  const filled = Math.min(stats.solved, CELLS);
  const t = stats.solved || 1;
  const easyN = Math.round((stats.easy / t) * filled);
  const medN = Math.round((stats.medium / t) * filled);
  const hardN = filled - easyN - medN;

  const cells = Array.from({ length: CELLS }, (_, i) => {
    if (i < easyN) return 'easy';
    if (i < easyN + medN) return 'medium';
    if (i < easyN + medN + hardN) return 'hard';
    return 'empty';
  });

  return (
    <div className="lc-grid-wrapper">
      <div className="lc-grid">
        {cells.map((type, i) => <div key={i} className={`lc-cell lc-${type}`} />)}
      </div>
      <div className="lc-legend">
        <span><span className="lc-dot lc-easy-dot" />{stats.easy} Easy</span>
        <span><span className="lc-dot lc-medium-dot" />{stats.medium} Medium</span>
        <span><span className="lc-dot lc-hard-dot" />{stats.hard} Hard</span>
      </div>
    </div>
  );
}

/* ─── Milestones ─────────────────────────────────── */
const Milestones = () => {
  const { viewCount } = useApp();
  const [leetcodeStats, setLeetcodeStats] = useState(null);
  const [githubContributions, setGithubContributions] = useState(null);

  useEffect(() => {
    fetch('https://leetcode-cors-proxy.vercel.app/api/leetcode?username=Akash_Rengaraj')
      .then(res => res.json())
      .then(data => {
        const all = data.totalSolved.find(d => d.difficulty === 'All');
        const total = data.totalQuestions.find(d => d.difficulty === 'All');
        const easy = data.totalSolved.find(d => d.difficulty === 'Easy');
        const medium = data.totalSolved.find(d => d.difficulty === 'Medium');
        const hard = data.totalSolved.find(d => d.difficulty === 'Hard');
        setLeetcodeStats({
          solved: all?.count || 0,
          total: total?.count || 0,
          easy: easy?.count || 0,
          medium: medium?.count || 0,
          hard: hard?.count || 0,
        });
      }).catch(() => setLeetcodeStats({ solved: 0, total: 0, easy: 0, medium: 0, hard: 0 }));

    fetch('https://github-contributions-api.jogruber.de/v4/Akash-rengaraj')
      .then(res => res.json())
      .then(data => {
        const total = Object.values(data.total).reduce((sum, val) => sum + val, 0);
        setGithubContributions(total);
      }).catch(() => setGithubContributions(0));
  }, []);

  const leetcodePercent = leetcodeStats
    ? (leetcodeStats.total > 0 ? (leetcodeStats.solved / leetcodeStats.total) * 100 : 0)
    : 0;

  const totalCertifications = skillsData.reduce((t, s) => t + s.certifications.length, 0);

  return (
    <div className="milestones-grid">
      {leetcodeStats === null ? (
        <SkeletonBox />
      ) : (
        <div className="milestone-box leetcode-box">
          <div className="milestone-title"><i className="fa-solid fa-code"></i> LeetCode Solved</div>
          <div className="big-number"><span>{leetcodeStats.solved}</span> / <span>{leetcodeStats.total}</span></div>
          <div className="progress-bar"><div style={{ width: `${leetcodePercent}%` }}></div></div>
          <LeetCodeGrid stats={leetcodeStats} />
          <div className="milestone-comment">Solving one problem at a time 🧠</div>
        </div>
      )}

      {githubContributions === null ? (
        <SkeletonBox />
      ) : (
        <div className="milestone-box github-box">
          <div className="milestone-title"><i className="fa-brands fa-github"></i> GitHub Contributions</div>
          <div className="big-number">{githubContributions}</div>
          <div className="milestone-comment">Open-source grind 💻</div>
        </div>
      )}

      <div className="milestone-box hacker-box">
        <div className="milestone-title"><i className="fa-brands fa-hackerrank"></i> HackerRank Badges</div>
        <div className="badge-list">
          {hackerrankBadgesData.map(b => <span key={b} className="badge">{b}</span>)}
        </div>
        <div className="milestone-comment">Badge collector 🏅</div>
      </div>

      <div className="milestone-box views-box">
        <div className="milestone-title"><i className="fa-solid fa-eye"></i> Portfolio Views</div>
        <div className="big-number">{viewCount}</div>
        <div className="milestone-comment">Growing far and wide! ⏳</div>
      </div>

      <div className="milestone-box cgpa-box">
        <div className="milestone-title"><i className="fa-solid fa-graduation-cap"></i> Current CGPA</div>
        <div className="big-number">8.2</div>
        <div className="milestone-comment">Academic excellence 📚</div>
      </div>

      <div className="milestone-box certifications-box">
        <div className="milestone-title"><i className="fa-solid fa-certificate"></i> Certifications</div>
        <div className="big-number">{totalCertifications}</div>
        <div className="milestone-comment">Learning never stops! 🎓</div>
      </div>

      <div className="milestone-box heatmap-milestone-box">
        <div className="milestone-title"><i className="fa-brands fa-github"></i> Contribution Graph</div>
        <GitHubHeatmap />
      </div>
    </div>
  );
};

/* ─── Skills Radar Chart ─────────────────────────── */
const RADAR_DATA = [
  { label: 'Frontend', value: 90 },
  { label: 'Backend', value: 75 },
  { label: 'Mobile', value: 70 },
  { label: 'IoT', value: 65 },
  { label: 'AI / ML', value: 60 },
  { label: 'Security', value: 70 },
];

function SkillsRadar() {
  const cx = 150, cy = 155, r = 100;
  const n = RADAR_DATA.length;

  const pt = (i, val) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    return [cx + Math.cos(angle) * (val / 100) * r, cy + Math.sin(angle) * (val / 100) * r];
  };

  const gridPoly = (level) =>
    RADAR_DATA.map((_, i) => pt(i, level).join(',')).join(' ');

  const dataPoints = RADAR_DATA.map((d, i) => pt(i, d.value));
  const dataPolygon = dataPoints.map(p => p.join(',')).join(' ');

  return (
    <div className="radar-wrapper reveal">
      <div className="radar-title">// skill_proficiency.svg</div>
      <div className="radar-inner">
        <svg viewBox="0 0 300 310" className="radar-svg" aria-label="Skills radar chart">
          {[25, 50, 75, 100].map(lvl => (
            <polygon key={lvl} points={gridPoly(lvl)} className="radar-grid" />
          ))}
          {RADAR_DATA.map((_, i) => {
            const [x, y] = pt(i, 100);
            return <line key={i} x1={cx} y1={cy} x2={x} y2={y} className="radar-axis" />;
          })}
          <polygon points={dataPolygon} className="radar-data" />
          {dataPoints.map((p, i) => (
            <circle key={i} cx={p[0]} cy={p[1]} r="4" className="radar-dot" />
          ))}
          {RADAR_DATA.map((d, i) => {
            const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
            const lx = cx + Math.cos(angle) * (r + 24);
            const ly = cy + Math.sin(angle) * (r + 24);
            const anchor = Math.abs(Math.cos(angle)) < 0.15 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end';
            return (
              <text key={i} x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle" className="radar-label">
                {d.label}
              </text>
            );
          })}
          {[25, 50, 75].map(lvl => {
            const [x, y] = pt(0, lvl);
            return <text key={lvl} x={x + 4} y={y - 4} className="radar-grid-label">{lvl}%</text>;
          })}
        </svg>
        <div className="radar-legend">
          {RADAR_DATA.map(d => (
            <div key={d.label} className="radar-legend-row">
              <span className="radar-legend-label">{d.label}</span>
              <div className="radar-bar-track">
                <div className="radar-bar-fill" style={{ width: `${d.value}%` }} />
              </div>
              <span className="radar-legend-pct">{d.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Skills ─────────────────────────────────────── */
const Skills = () => (
  <>
  <SkillsRadar />
  <div className="skills-grid">
    {skillsData.map(skill => (
      <div key={skill.skill} className="skill-cert-card reveal">
        <div className="skill-cert-title">{skill.skill}</div>
        {skill.certifications.map(cert => (
          <div key={cert.name} className="certification-entry">
            <span>
              <img src={cert.logo} alt="" className="cert-logo" onError={e => e.target.style.display='none'} />
              {cert.name}
            </span>
            <a href={cert.link} target="_blank" rel="noopener noreferrer">
              <button>View</button>
            </a>
          </div>
        ))}
      </div>
    ))}
  </div>
  </>
);

/* ─── GitHub Activity Feed ───────────────────────── */
const EVENT_LABELS = {
  PushEvent: (e) => `Pushed ${e.payload?.commits?.length || 1} commit(s) to ${e.repo?.name?.split('/')[1] || e.repo?.name}`,
  CreateEvent: (e) => `Created ${e.payload?.ref_type} ${e.payload?.ref ? `"${e.payload.ref}" in ` : ''}${e.repo?.name?.split('/')[1]}`,
  WatchEvent: (e) => `Starred ${e.repo?.name}`,
  ForkEvent: (e) => `Forked ${e.repo?.name?.split('/')[1]}`,
  IssuesEvent: (e) => `${e.payload?.action} issue in ${e.repo?.name?.split('/')[1]}`,
  PullRequestEvent: (e) => `${e.payload?.action} PR in ${e.repo?.name?.split('/')[1]}`,
  DeleteEvent: (e) => `Deleted ${e.payload?.ref_type} "${e.payload?.ref}" in ${e.repo?.name?.split('/')[1]}`,
};

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function GitHubActivity() {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('https://api.github.com/users/Akash-rengaraj/events?per_page=15')
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(data => {
        const filtered = data.filter(e => EVENT_LABELS[e.type]).slice(0, 10);
        setEvents(filtered);
      })
      .catch(() => setError(true));
  }, []);

  if (error) return (
    <div className="gh-activity-error">
      <span className="output-error">github api: rate limited or unavailable.</span>
    </div>
  );

  if (!events) return (
    <div className="gh-activity-list">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="gh-event-row skeleton-box" style={{ height: '2.5rem', marginBottom: '0.5rem' }}>
          <div className="skeleton-line" style={{ width: '70%' }} />
        </div>
      ))}
    </div>
  );

  return (
    <div className="gh-activity-list">
      {events.map((e, i) => (
        <a
          key={i}
          className="gh-event-row reveal"
          href={`https://github.com/${e.repo?.name}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="gh-event-icon">{e.type === 'PushEvent' ? '↑' : e.type === 'CreateEvent' ? '+' : e.type === 'WatchEvent' ? '★' : '•'}</span>
          <span className="gh-event-text">{EVENT_LABELS[e.type]?.(e)}</span>
          <span className="gh-event-time">{timeAgo(e.created_at)}</span>
        </a>
      ))}
    </div>
  );
}

/* ─── Hackathon Timeline ─────────────────────────── */
function HackathonTimeline() {
  return (
    <div className="hack-timeline">
      {hackathonsData.map((h, i) => (
        <div key={i} className="hack-tl-item reveal">
          <div className="hack-tl-dot" />
          <div className="hack-tl-content">
            <div className="hack-tl-title">{h.title}</div>
            <div className="hack-tl-meta">
              <span>{h.type}</span>
              <span className="hack-tl-sep">·</span>
              <span>{h.venue}</span>
              <span className="hack-tl-sep">·</span>
              <span>{h.team}</span>
            </div>
            <div className="hack-tl-project">{h.project}</div>
            <div className="hack-tl-achievement">{h.achievement}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Hackathons ─────────────────────────────────── */
const Hackathons = () => {
  const [selectedImages, setSelectedImages] = useState({});

  const handleBadgeHover = useCallback((e) => {
    fireConfetti(e.currentTarget);
  }, []);

  return (
    <>
    <HackathonTimeline />
    <div className="events-grid">
      {hackathonsData.map((hackathon, index) => {
        const selectedImageIndex = selectedImages[index] ?? 0;
        return (
          <div key={index} className="event-card reveal">
            <div className="event-image-container">
              <img
                src={hackathon.photos[selectedImageIndex]}
                alt={`${hackathon.title} - Image ${selectedImageIndex + 1}`}
                className="event-image"
              />
              {hackathon.photos.length > 1 && (
                <div className="image-gallery">
                  {hackathon.photos.map((photo, photoIndex) => (
                    <img
                      key={photoIndex}
                      src={photo}
                      alt={`thumbnail ${photoIndex + 1}`}
                      className={`gallery-thumb ${selectedImageIndex === photoIndex ? 'active' : ''}`}
                      onClick={() => setSelectedImages(prev => ({ ...prev, [index]: photoIndex }))}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="event-content">
              <div className="event-title">{hackathon.title}</div>
              <div className="event-details">
                <div><strong>Type:</strong> {hackathon.type}</div>
                <div><strong>Venue:</strong> {hackathon.venue}</div>
                <div><strong>Team:</strong> {hackathon.team}</div>
                <div><strong>Project:</strong> {hackathon.project}</div>
              </div>
              <div
                className="event-achievement hackathon-badge"
                onMouseEnter={handleBadgeHover}
                title="Hover for celebration!"
              >
                {hackathon.achievement}
              </div>
              <div className="event-description">
                <strong>Features:</strong>
                <ul className="event-list">
                  {hackathon.description.map((feature, i) => (
                    <li key={i}>{feature}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        );
      })}
    </div>
    </>
  );
};

/* ─── Page ───────────────────────────────────────── */
function EventsPage() {
  const [activeTab, setActiveTab] = useState('milestones');

  return (
    <>
      <Helmet>
        <title>Achievements — Akash Rengaraj</title>
        <meta name="description" content="HackIndia 2025 Top 10 Finalist. LeetCode stats, GitHub contributions, certifications, and milestones." />
        <meta property="og:title" content="Achievements — Akash Rengaraj" />
      </Helmet>
      <div className="page active" id="events">
        <div className="about-tabs">
          <button className={`about-tab ${activeTab === 'milestones' ? 'active' : ''}`} onClick={() => setActiveTab('milestones')}>milestones</button>
          <button className={`about-tab ${activeTab === 'skills' ? 'active' : ''}`} onClick={() => setActiveTab('skills')}>skills & certs</button>
          <button className={`about-tab ${activeTab === 'hackathons' ? 'active' : ''}`} onClick={() => setActiveTab('hackathons')}>hackathons</button>
          <button className={`about-tab ${activeTab === 'activity' ? 'active' : ''}`} onClick={() => setActiveTab('activity')}>github activity</button>
        </div>
        <div className="about-content">
          {activeTab === 'milestones' && <Milestones />}
          {activeTab === 'skills' && <Skills />}
          {activeTab === 'hackathons' && <Hackathons />}
          {activeTab === 'activity' && <GitHubActivity />}
        </div>
      </div>
    </>
  );
}

export default EventsPage;
