import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import TerminalBot from '../components/TerminalBot';
import TerminalInput from '../components/TerminalInput';
import { projectsData } from '../data/projects';
import { skillsData } from '../data/skills';
import { profile } from '../data/profile';

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const PROJECT_COUNT = projectsData.length;
const CERT_COUNT = skillsData.reduce((total, s) => total + s.certifications.length, 0);

const ASCII_NAME = `
 █████╗ ██╗  ██╗ █████╗ ███████╗██╗  ██╗    ██████╗
██╔══██╗██║ ██╔╝██╔══██╗██╔════╝██║  ██║    ██╔══██╗
███████║█████╔╝ ███████║███████╗███████║    ██████╔╝
██╔══██║██╔═██╗ ██╔══██║╚════██║██╔══██║    ██╔══██╗
██║  ██║██║  ██╗██║  ██║███████║██║  ██║    ██║  ██║
╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝    ╚═╝  ╚═╝`;

const ROLES = [
  'AI agents & RAG pipelines',
  'full-stack web apps',
  'IoT & embedded systems',
  'secure, defensive tooling',
];
const ROLE_WIDTH = Math.max(...ROLES.map(r => r.length));

const PROFILE_COMMAND = 'cat ~/profile.json';

/* Each output line is a list of [text, token-kind] pairs for syntax colouring */
const PROFILE_OUTPUT = [
  [['{', 'punct']],
  [['  "name"', 'key'], [': ', 'punct'], ['"Akash Rengaraj"', 'str'], [',', 'punct']],
  [['  "role"', 'key'], [': ', 'punct'], ['"AI & DS student · full-stack dev"', 'str'], [',', 'punct']],
  [['  "focus"', 'key'], [': ', 'punct'], ['[', 'punct'], ['"AI agents"', 'str'], [', ', 'punct'], ['"IoT"', 'str'], [', ', 'punct'], ['"security"', 'str'], ['],', 'punct']],
  [['  "shipped"', 'key'], [': ', 'punct'], [String(PROJECT_COUNT), 'num'], [',', 'punct']],
  [['  "highlight"', 'key'], [': ', 'punct'], ['"HackIndia \'25 · Top 10"', 'str'], [',', 'punct']],
  [['  "status"', 'key'], [': ', 'punct'], ['"open to internships"', 'ok']],
  [['}', 'punct']],
];

/** Live IST clock + availability, rendered at a fixed width so ticking never shifts layout. */
function StatusLine() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const time = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });

  return (
    <div className="hero-status hero-rise" style={{ '--d': 0 }}>
      <Link to="/contact" className="status-live">
        <span className="status-dot" aria-hidden="true" />
        open to internships
      </Link>
      <span className="status-sep" aria-hidden="true">/</span>
      <span>coimbatore, IN · remote</span>
      <span className="status-sep" aria-hidden="true">/</span>
      <span className="status-clock">{time} IST</span>
    </div>
  );
}

/** Types and deletes role phrases inside a slot sized to the longest phrase. */
function RoleCycler() {
  const [reduced] = useState(prefersReducedMotion);
  const [idx, setIdx] = useState(0);
  const [len, setLen] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (reduced) {
      const t = setInterval(() => setIdx(i => (i + 1) % ROLES.length), 2800);
      return () => clearInterval(t);
    }
    const word = ROLES[idx];
    let delay;
    let next;
    if (!deleting && len < word.length) {
      delay = 45 + Math.random() * 45;
      next = () => setLen(l => l + 1);
    } else if (!deleting) {
      delay = 1900;
      next = () => setDeleting(true);
    } else if (len > 0) {
      delay = 22;
      next = () => setLen(l => l - 1);
    } else {
      delay = 260;
      next = () => {
        setDeleting(false);
        setIdx(i => (i + 1) % ROLES.length);
      };
    }
    const t = setTimeout(next, delay);
    return () => clearTimeout(t);
  }, [idx, len, deleting, reduced]);

  const word = ROLES[idx];

  return (
    <p className="hero-role hero-rise" style={{ '--d': 2 }}>
      <span className="visually-hidden">{`Building ${ROLES.join(', ')}`}</span>
      <span className="role-prompt" aria-hidden="true">&gt;</span>
      <span aria-hidden="true"> building </span>
      <span className="role-slot" style={{ width: `${ROLE_WIDTH + 1}ch` }} aria-hidden="true">
        <span className="role-word">{reduced ? word : word.slice(0, len)}</span>
        <span className="tw-caret" />
      </span>
    </p>
  );
}

/** Eases a number from 0 to `target` once, after `delay` ms. */
function useCountUp(target, delay) {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));

  useEffect(() => {
    if (prefersReducedMotion()) return;
    let raf;
    const duration = 1200;
    const startTimer = setTimeout(() => {
      const start = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - start) / duration);
        setValue(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(startTimer);
      cancelAnimationFrame(raf);
    };
  }, [target, delay]);

  return value;
}

/** One metric; its width is reserved for the final value so counting never reflows. */
function HeroStat({ value, decimals = 0, prefix = '', label, delay }) {
  const current = useCountUp(value, delay);
  const finalText = `${prefix}${value.toFixed(decimals)}`;

  return (
    <div className="hero-stat">
      <span className="stat-value" style={{ minWidth: `${finalText.length}ch` }} aria-label={finalText}>
        {prefix}{current.toFixed(decimals)}
      </span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

/**
 * A mini terminal that "runs" `cat ~/profile.json`: the command is typed,
 * then the output prints line by line. Every line is laid out from the first
 * frame (hidden until printed), so the card never changes size.
 */
function ProfileCard() {
  const [reduced] = useState(prefersReducedMotion);
  const [cmdLen, setCmdLen] = useState(reduced ? PROFILE_COMMAND.length : 0);
  const [linesShown, setLinesShown] = useState(reduced ? PROFILE_OUTPUT.length : 0);
  const typing = cmdLen < PROFILE_COMMAND.length;
  const done = !typing && linesShown >= PROFILE_OUTPUT.length;

  useEffect(() => {
    if (done) return;
    let t;
    if (typing) {
      t = setTimeout(() => setCmdLen(n => n + 1), cmdLen === 0 ? 600 : 35 + Math.random() * 30);
    } else {
      t = setTimeout(() => setLinesShown(n => n + 1), linesShown === 0 ? 220 : 50);
    }
    return () => clearTimeout(t);
  }, [cmdLen, linesShown, typing, done]);

  return (
    <div className="profile-card hero-rise" style={{ '--d': 3 }} aria-label="Profile summary">
      <div className="profile-card-bar" aria-hidden="true">
        <span className="pc-dot" />
        <span className="pc-dot" />
        <span className="pc-dot" />
        <span className="pc-title">akash@portfolio — zsh</span>
      </div>
      <pre className="profile-code">
        <span className="pc-line">
          <span className="tok-prompt">$ </span>
          <span className="tok-cmd">{PROFILE_COMMAND.slice(0, cmdLen)}</span>
          {typing && <span className="tw-caret" />}
          <span className="tw-rest">{PROFILE_COMMAND.slice(cmdLen)}</span>
        </span>
        {PROFILE_OUTPUT.map((tokens, i) => (
          <span key={i} className={`pc-line ${i < linesShown ? '' : 'pc-hidden'}`}>
            {tokens.map(([text, kind], j) => (
              <span key={j} className={`tok-${kind}`}>{text}</span>
            ))}
          </span>
        ))}
        <span className={`pc-line ${done ? '' : 'pc-hidden'}`}>
          <span className="tok-prompt">$ </span>
          <span className="tw-caret tw-caret-idle" />
        </span>
      </pre>
    </div>
  );
}

function MagneticBtn({ to, className, children }) {
  const ref = useRef(null);
  const handleMove = useCallback((e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dx = (e.clientX - (rect.left + rect.width / 2)) * 0.35;
    const dy = (e.clientY - (rect.top + rect.height / 2)) * 0.35;
    el.style.transform = `translate(${dx}px, ${dy}px)`;
  }, []);
  const handleLeave = useCallback(() => {
    if (ref.current) ref.current.style.transform = 'translate(0,0)';
  }, []);

  return (
    <Link ref={ref} to={to} className={className} onMouseMove={handleMove} onMouseLeave={handleLeave}>
      {children}
    </Link>
  );
}

/** Starts downloading the game chunk (three.js) as soon as someone shows interest. */
const prefetchDrive = () => {
  import('./DrivePage').catch(() => {});
};

function HeroCTAs() {
  return (
    <div className="hero-ctas hero-rise" style={{ '--d': 5 }}>
      <MagneticBtn to="/contact" className="cta-btn cta-primary">
        <span className="cta-bracket">[</span>
        <span className="cta-arrow">→</span> hire me
        <span className="cta-bracket">]</span>
      </MagneticBtn>
      <Link to="/projects" className="cta-btn cta-secondary">
        <span className="cta-bracket">[</span>
        <span className="cta-arrow">→</span> view my work
        <span className="cta-bracket">]</span>
      </Link>
      <Link
        to="/drive"
        className="cta-btn cta-drive"
        onMouseEnter={prefetchDrive}
        onFocus={prefetchDrive}
        onTouchStart={prefetchDrive}
        aria-label="Take a drive: play Zen Drive, a relaxing 3D driving game"
      >
        <span className="cta-bracket">[</span>
        <span className="cta-arrow">▶</span> take a drive
        <span className="cta-bracket">]</span>
      </Link>
      <a href="/Akash_Rengaraj_Resume.pdf" download className="cta-btn cta-ghost">
        <span className="cta-bracket">[</span>
        <span className="cta-arrow">↓</span> resume.pdf
        <span className="cta-bracket">]</span>
      </a>
    </div>
  );
}

/* ─── sudo easter egg ─────────────────────────────── */
function SudoEasterEgg() {
  const [active, setSudo] = useState(false);
  const typed = useRef('');

  useEffect(() => {
    let timer;
    const onKey = (e) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      typed.current = (typed.current + e.key).slice(-4);
      if (typed.current === 'sudo') {
        setSudo(true);
        timer = setTimeout(() => setSudo(false), 1800);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(timer); };
  }, []);

  if (!active) return null;
  return <div className="sudo-flash" aria-hidden="true">sudo mode activated</div>;
}

function HomePage() {
  return (
    <>
      <Helmet>
        <title>Akash Rengaraj | Terminal Portfolio</title>
        <meta name="description" content="Akash Rengaraj — AI & Data Science student and full-stack developer. Available for internship immediately." />
        <meta property="og:title" content="Akash Rengaraj — AI & Full-Stack Developer" />
        <meta property="og:description" content={`Built ${PROJECT_COUNT} products solo. HackIndia 2025 Top 10 Finalist. Available for internship.`} />
        <meta property="og:image" content="https://www.akashr.dev/screenshots/home-dark.png" />
        <meta name="twitter:title" content="Akash Rengaraj — AI & Full-Stack Developer" />
        <meta name="twitter:description" content={`Built ${PROJECT_COUNT} products solo. HackIndia 2025 Top 10 Finalist. Available for internship.`} />
        <meta name="twitter:image" content="https://www.akashr.dev/screenshots/home-dark.png" />
      </Helmet>
      <div className="page active" id="home">
        <div className="hero">
          <div className="hero-grid">
            <div className="hero-main">
              <StatusLine />
              <h1 className="hero-name hero-rise" style={{ '--d': 1 }}>
                <span className="visually-hidden">Akash Rengaraj</span>
                <pre className="ascii-art hero-ascii" aria-hidden="true">{ASCII_NAME}</pre>
                <span className="hero-name-compact" aria-hidden="true">Akash Rengaraj</span>
              </h1>
              <RoleCycler />
              <div className="hero-stats hero-rise" style={{ '--d': 4 }}>
                <HeroStat value={PROJECT_COUNT} label="projects shipped" delay={700} />
                <HeroStat value={10} prefix="Top " label="hackindia 2025" delay={800} />
                <HeroStat value={profile.cgpa} decimals={2} label="cgpa · ai&ds" delay={900} />
                <HeroStat value={CERT_COUNT} label="certifications" delay={1000} />
              </div>
              <HeroCTAs />
              <p className="hero-tip hero-rise" style={{ '--d': 6 }}>
                tip: type <kbd>help</kbd> or <kbd>hire</kbd> in the terminal below ↓
              </p>
            </div>
            <ProfileCard />
          </div>
        </div>
        <TerminalInput />
        <TerminalBot />
        <SudoEasterEgg />
      </div>
    </>
  );
}

export default HomePage;
