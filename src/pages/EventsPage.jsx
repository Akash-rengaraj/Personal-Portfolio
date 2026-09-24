import { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';
import { skillsData, hackerrankBadgesData } from '../data/skills';
import { hackathonsData } from '../data/hackathons';
import { CGPA_TEXT } from '../data/profile';
import { useApp } from '../context/AppContext';
import GitHubHeatmap from '../components/GitHubHeatmap';

const CGPA = CGPA_TEXT;
const CERT_COUNT = skillsData.reduce((t, s) => t + s.certifications.length, 0);

/* ─── Lightweight canvas confetti (easter egg: hover the finalist badge) ── */
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

  const colors = ['#3dffb8', '#40d9ff', '#ffe45c', '#ff6fd8', '#ffffff', '#ffb347'];
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
      p.vy += 0.35;
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
    if (alive) frame = requestAnimationFrame(draw);
    else canvas.remove();
  };
  frame = requestAnimationFrame(draw);
  setTimeout(() => { cancelAnimationFrame(frame); canvas.remove(); }, 4000);
}

/* ─── Data hooks ─────────────────────────────────── */

/** LeetCode solved counts by difficulty; null while loading, zeros on failure. */
function useLeetCode() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('https://leetcode-cors-proxy.vercel.app/api/leetcode?username=Akash_Rengaraj');
        if (!res.ok) throw new Error(`leetcode ${res.status}`);
        const data = await res.json();
        const solved = (d) => data.totalSolved.find(x => x.difficulty === d)?.count || 0;
        const next = {
          solved: solved('All'),
          total: data.totalQuestions.find(x => x.difficulty === 'All')?.count || 0,
          easy: solved('Easy'),
          medium: solved('Medium'),
          hard: solved('Hard'),
          ok: true,
        };
        if (!cancelled) setStats(next);
      } catch {
        if (!cancelled) setStats({ solved: 0, total: 0, easy: 0, medium: 0, hard: 0, ok: false });
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  return stats;
}

/** All-time GitHub contribution total; null while loading, -1 on failure. */
function useGitHubTotal() {
  const [total, setTotal] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('https://github-contributions-api.jogruber.de/v4/Akash-rengaraj');
        if (!res.ok) throw new Error(`github ${res.status}`);
        const data = await res.json();
        const sum = Object.values(data.total).reduce((s, v) => s + v, 0);
        if (!cancelled) setTotal(sum);
      } catch {
        if (!cancelled) setTotal(-1);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  return total;
}

/* ─── Widgets ────────────────────────────────────── */

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
        <span><span className="lc-dot lc-easy-dot" />{stats.easy} easy</span>
        <span><span className="lc-dot lc-medium-dot" />{stats.medium} medium</span>
        <span><span className="lc-dot lc-hard-dot" />{stats.hard} hard</span>
      </div>
    </div>
  );
}

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
  const gridPoly = (level) => RADAR_DATA.map((_, i) => pt(i, level).join(',')).join(' ');
  const dataPoints = RADAR_DATA.map((d, i) => pt(i, d.value));

  return (
    <div className="radar-inner">
      <svg viewBox="-45 0 390 310" className="radar-svg" role="img" aria-label="Self-assessed skill radar chart">
        {[25, 50, 75, 100].map(lvl => <polygon key={lvl} points={gridPoly(lvl)} className="radar-grid" />)}
        {RADAR_DATA.map((_, i) => {
          const [x, y] = pt(i, 100);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} className="radar-axis" />;
        })}
        <polygon points={dataPoints.map(p => p.join(',')).join(' ')} className="radar-data" />
        {dataPoints.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="4" className="radar-dot" />)}
        {RADAR_DATA.map((d, i) => {
          const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
          const lx = cx + Math.cos(angle) * (r + 24);
          const ly = cy + Math.sin(angle) * (r + 24);
          const anchor = Math.abs(Math.cos(angle)) < 0.15 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end';
          return <text key={i} x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle" className="radar-label">{d.label}</text>;
        })}
      </svg>
      <div className="radar-legend">
        {RADAR_DATA.map(d => (
          <div key={d.label} className="radar-legend-row">
            <span className="radar-legend-label">{d.label}</span>
            <div className="radar-bar-track"><div className="radar-bar-fill" style={{ width: `${d.value}%` }} /></div>
            <span className="radar-legend-pct">{d.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const EVENT_LABELS = {
  PushEvent: (e) => `pushed ${e.payload?.commits?.length || 1} commit(s) to ${e.repo?.name?.split('/')[1] || e.repo?.name}`,
  CreateEvent: (e) => `created ${e.payload?.ref_type} ${e.payload?.ref ? `"${e.payload.ref}" in ` : ''}${e.repo?.name?.split('/')[1]}`,
  WatchEvent: (e) => `starred ${e.repo?.name}`,
  ForkEvent: (e) => `forked ${e.repo?.name?.split('/')[1]}`,
  IssuesEvent: (e) => `${e.payload?.action} an issue in ${e.repo?.name?.split('/')[1]}`,
  PullRequestEvent: (e) => `${e.payload?.action} a PR in ${e.repo?.name?.split('/')[1]}`,
  DeleteEvent: (e) => `deleted ${e.payload?.ref_type} "${e.payload?.ref}" in ${e.repo?.name?.split('/')[1]}`,
};

const EVENT_ICONS = { PushEvent: '↑', CreateEvent: '+', WatchEvent: '★', ForkEvent: '⑂' };

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
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('https://api.github.com/users/Akash-rengaraj/events?per_page=30');
        if (!res.ok) throw new Error(`github events ${res.status}`);
        const data = await res.json();
        if (!cancelled) setEvents(data.filter(e => EVENT_LABELS[e.type]).slice(0, 8));
      } catch {
        if (!cancelled) setError(true);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  if (error) return <div className="ac-empty output-error">github api: rate limited or unavailable — try again in a bit.</div>;

  if (!events) {
    return (
      <div className="gh-activity-list">
        {Array.from({ length: 5 }, (_, i) => <div key={i} className="ac-skeleton" style={{ height: '2.1rem' }} />)}
      </div>
    );
  }

  if (events.length === 0) return <div className="ac-empty">no public activity in the last 90 days.</div>;

  return (
    <div className="gh-activity-list">
      {events.map((e) => (
        <a key={e.id} className="gh-event-row" href={`https://github.com/${e.repo?.name}`} target="_blank" rel="noopener noreferrer">
          <span className="gh-event-icon">{EVENT_ICONS[e.type] || '•'}</span>
          <span className="gh-event-text">{EVENT_LABELS[e.type](e)}</span>
          <span className="gh-event-time">{timeAgo(e.created_at)}</span>
        </a>
      ))}
    </div>
  );
}

const GITHUB_USER = 'Akash-rengaraj';

/** Public GitHub profile + most recently pushed repos; null while loading, false on failure. */
function useGitHubProfile() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [userRes, repoRes] = await Promise.all([
          fetch(`https://api.github.com/users/${GITHUB_USER}`),
          fetch(`https://api.github.com/users/${GITHUB_USER}/repos?sort=pushed&per_page=6`),
        ]);
        if (!userRes.ok || !repoRes.ok) throw new Error('github profile unavailable');
        const [user, repos] = await Promise.all([userRes.json(), repoRes.json()]);
        if (!cancelled) setData({ user, repos: repos.filter(r => !r.fork).slice(0, 5) });
      } catch {
        if (!cancelled) setData(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  return data;
}

function GitHubProfileCard({ profile }) {
  if (profile === null) return <div className="ac-card"><div className="ac-skeleton" style={{ height: '12rem' }} /></div>;

  if (profile === false) {
    return (
      <div className="ac-card ac-gh-profile">
        <div className="ac-empty">github api is rate limited right now.</div>
        <a className="ac-gh-button" href={`https://github.com/${GITHUB_USER}`} target="_blank" rel="noopener noreferrer">
          <i className="fa-brands fa-github" aria-hidden="true" /> open github profile
        </a>
      </div>
    );
  }

  const { user, repos } = profile;
  return (
    <div className="ac-card ac-gh-profile">
      <div className="ac-gh-id">
        <img src={user.avatar_url} alt="" className="ac-gh-avatar" loading="lazy" />
        <div>
          <div className="ac-gh-name">{user.name || user.login}</div>
          <div className="ac-gh-login">@{user.login}</div>
        </div>
      </div>
      {user.bio && <p className="ac-gh-bio">{user.bio}</p>}
      <div className="ac-gh-stats">
        <div><strong>{user.public_repos}</strong><span>repos</span></div>
        <div><strong>{user.followers}</strong><span>followers</span></div>
        <div><strong>{user.following}</strong><span>following</span></div>
      </div>
      <div className="ac-gh-repos-title">recently pushed</div>
      <ul className="ac-gh-repos">
        {repos.map(repo => (
          <li key={repo.id}>
            <a href={repo.html_url} target="_blank" rel="noopener noreferrer" className="ac-gh-repo">
              <span className="ac-gh-repo-name">{repo.name}</span>
              {repo.language && <span className="ac-gh-lang">{repo.language}</span>}
              <span className="ac-gh-when">{timeAgo(repo.pushed_at)}</span>
            </a>
          </li>
        ))}
      </ul>
      <a className="ac-gh-button" href={user.html_url} target="_blank" rel="noopener noreferrer">
        <i className="fa-brands fa-github" aria-hidden="true" /> view full profile
      </a>
    </div>
  );
}

/** Featured hackathon: photo gallery + story, with the confetti easter egg on the badge. */
function HackathonShowcase({ hackathon }) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const handleBadgeHover = useCallback((e) => fireConfetti(e.currentTarget), []);

  return (
    <article className="ac-feature">
      <div className="ac-gallery">
        <img
          src={hackathon.photos[photoIdx]}
          alt={`${hackathon.title} — photo ${photoIdx + 1} of ${hackathon.photos.length}`}
          className="ac-gallery-main"
        />
        {hackathon.photos.length > 1 && (
          <div className="ac-thumbs">
            {hackathon.photos.map((photo, i) => (
              <button
                key={photo}
                type="button"
                className={`ac-thumb ${i === photoIdx ? 'is-active' : ''}`}
                onClick={() => setPhotoIdx(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-pressed={i === photoIdx}
              >
                <img src={photo} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="ac-feature-body">
        <div className="ac-feature-kicker">{hackathon.type} · {hackathon.team}</div>
        <h3 className="ac-feature-title">{hackathon.title}</h3>
        <button type="button" className="ac-trophy" onMouseEnter={handleBadgeHover} onFocus={handleBadgeHover}>
          {hackathon.achievement}
        </button>
        <dl className="ac-feature-facts">
          <div><dt>project</dt><dd>{hackathon.project}</dd></div>
          <div><dt>venue</dt><dd>{hackathon.venue}</dd></div>
          <div><dt>role</dt><dd>Team lead</dd></div>
        </dl>
        <ul className="ac-feature-list">
          {hackathon.description.map(item => <li key={item}>{item}</li>)}
        </ul>
      </div>
    </article>
  );
}

function StatCard({ icon, label, children, className = '', foot }) {
  return (
    <div className={`ac-card ${className}`}>
      <div className="ac-card-label"><i className={icon} aria-hidden="true" /> {label}</div>
      {children}
      {foot && <div className="ac-card-foot">{foot}</div>}
    </div>
  );
}

function SectionTitle({ command, note }) {
  return (
    <h2 className="ac-title">
      <span className="ac-prompt">akash@achievements:~$</span> {command}
      {note && <span className="ac-title-note">{note}</span>}
    </h2>
  );
}

/* ─── Tabs ───────────────────────────────────────── */
const TABS = [
  { id: 'milestones', label: 'milestones', icon: 'fa-solid fa-chart-simple', cmd: './stats --live', note: 'updates on every visit' },
  { id: 'skills', label: 'skills & certs', icon: 'fa-solid fa-certificate', cmd: 'ls ./certs && ./skills --radar', note: `${CERT_COUNT} certificates` },
  { id: 'hackathons', label: 'hackathons', icon: 'fa-solid fa-trophy', cmd: 'cat hackathons.log', note: `${hackathonsData.length} event${hackathonsData.length === 1 ? '' : 's'}` },
  { id: 'activity', label: 'github activity', icon: 'fa-brands fa-github', cmd: 'git log --remote', note: 'latest public events' },
];

function MilestonesTab({ leetcode, githubTotal, viewCount }) {
  const lcPercent = leetcode?.total ? (leetcode.solved / leetcode.total) * 100 : 0;

  return (
    <div className="ac-bento">
      <StatCard icon="fa-solid fa-code" label="LeetCode" className="ac-leetcode" foot="solving one problem at a time">
        {leetcode === null ? (
          <div className="ac-skeleton" style={{ height: '9rem' }} />
        ) : leetcode.ok ? (
          <>
            <div className="ac-big">{leetcode.solved}<span className="ac-big-sub"> / {leetcode.total} solved</span></div>
            <div className="ac-meter" role="progressbar" aria-label="LeetCode problems solved" aria-valuenow={Math.round(lcPercent)} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${Math.max(lcPercent, 1.5)}%` }} />
            </div>
            <LeetCodeGrid stats={leetcode} />
          </>
        ) : (
          <div className="ac-empty">leetcode api unavailable right now.</div>
        )}
      </StatCard>

      <StatCard
        icon="fa-brands fa-github"
        label="GitHub contributions"
        className="ac-github"
        foot={githubTotal === -1 ? 'github api busy — refresh in a minute' : 'all-time on GitHub'}
      >
        {githubTotal === null ? <div className="ac-skeleton" style={{ height: '2.6rem' }} /> : (
          <div className="ac-big">{githubTotal < 0 ? '—' : githubTotal}</div>
        )}
      </StatCard>

      <StatCard icon="fa-solid fa-graduation-cap" label="CGPA" className="ac-cgpa" foot="B.Tech AI&DS · current">
        <div className="ac-big">{CGPA}</div>
      </StatCard>

      <StatCard icon="fa-brands fa-hackerrank" label="HackerRank badges" className="ac-hackerrank">
        <div className="ac-badges">
          {hackerrankBadgesData.map(b => <span key={b} className="ac-badge">{b}</span>)}
        </div>
      </StatCard>

      <StatCard icon="fa-solid fa-certificate" label="Certifications" className="ac-certs" foot="Google · Meta · IBM · NPTEL">
        <div className="ac-big">{CERT_COUNT}</div>
      </StatCard>

      <StatCard icon="fa-brands fa-github" label="Contribution graph · last 12 months" className="ac-heatmap">
        <GitHubHeatmap />
      </StatCard>

      <StatCard icon="fa-solid fa-eye" label="Portfolio views" className="ac-views" foot="live from Firebase">
        <div className="ac-big ac-live">{viewCount}</div>
      </StatCard>
    </div>
  );
}

function SkillsTab() {
  return (
    <div className="ac-skills">
      <div className="ac-card ac-radar">
        <div className="ac-card-label"><i className="fa-solid fa-bullseye" aria-hidden="true" /> skill_proficiency.svg · self-assessed</div>
        <SkillsRadar />
      </div>
      <div className="ac-cert-grid">
        {skillsData.map(({ skill, certifications }) => (
          <div key={skill} className="ac-card ac-cert-group">
            <div className="ac-cert-head">
              <span className="ac-cert-dir">{skill.toLowerCase().replace(/ /g, '_')}/</span>
              <span className="ac-cert-count">{certifications.length}</span>
            </div>
            {certifications.map(cert => (
              <a key={cert.name} className="ac-cert" href={cert.link} target="_blank" rel="noopener noreferrer">
                <img src={cert.logo} alt="" className="ac-cert-logo" loading="lazy" onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
                <span className="ac-cert-name">{cert.name}</span>
                <span className="ac-cert-view">view ↗</span>
              </a>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────── */
function EventsPage() {
  const { viewCount } = useApp();
  // fetched once at page level so switching tabs doesn't refetch
  const leetcode = useLeetCode();
  const githubTotal = useGitHubTotal();
  const githubProfile = useGitHubProfile();

  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const activeTab = TABS.find(t => t.id === requested) ?? TABS[0];

  const selectTab = (id) => setSearchParams(id === TABS[0].id ? {} : { tab: id }, { replace: true });

  const handleTabKeys = (e) => {
    const idx = TABS.findIndex(t => t.id === activeTab.id);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = TABS[(idx + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
      selectTab(next.id);
      document.getElementById(`ac-tab-${next.id}`)?.focus();
    }
  };

  return (
    <>
      <Helmet>
        <title>Achievements — Akash Rengaraj</title>
        <meta name="description" content="HackIndia 2025 Top 10 Finalist. LeetCode stats, GitHub contributions, certifications and milestones." />
        <meta property="og:title" content="Achievements — Akash Rengaraj" />
      </Helmet>

      <div className="page active ac-page" id="events">
        <div className="ac-scroll">
          <header className="ac-header">
            <div className="ac-header-text">
              <div className="ac-cmd"><span className="ac-prompt">akash@achievements:~$</span> ./proof_of_work</div>
              <h1 className="ac-h1">Proof of work</h1>
            </div>
            <div className="ac-tabs" role="tablist" aria-label="Achievement categories" onKeyDown={handleTabKeys}>
              {TABS.map(tab => {
                const selected = tab.id === activeTab.id;
                return (
                  <button
                    key={tab.id}
                    id={`ac-tab-${tab.id}`}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls="ac-panel"
                    tabIndex={selected ? 0 : -1}
                    className={`ac-tab ${selected ? 'is-active' : ''}`}
                    onClick={() => selectTab(tab.id)}
                  >
                    <i className={tab.icon} aria-hidden="true" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </header>

          <section
            key={activeTab.id}
            id="ac-panel"
            className="ac-panel"
            role="tabpanel"
            aria-labelledby={`ac-tab-${activeTab.id}`}
          >
            <SectionTitle command={activeTab.cmd} note={activeTab.note} />
            {activeTab.id === 'milestones' && (
              <MilestonesTab leetcode={leetcode} githubTotal={githubTotal} viewCount={viewCount} />
            )}
            {activeTab.id === 'skills' && <SkillsTab />}
            {activeTab.id === 'hackathons' && (
              <div className="ac-stack">
                {hackathonsData.map(h => <HackathonShowcase key={h.title} hackathon={h} />)}
              </div>
            )}
            {activeTab.id === 'activity' && (
              <div className="ac-gh-layout">
                <GitHubProfileCard profile={githubProfile} />
                <div className="ac-card ac-activity">
                  <div className="ac-card-label"><i className="fa-solid fa-wave-square" aria-hidden="true" /> recent public events</div>
                  <GitHubActivity />
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

export default EventsPage;
