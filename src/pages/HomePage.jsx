import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import TerminalBot from '../components/TerminalBot';
import TerminalInput from '../components/TerminalInput';

function Typewriter() {
  return (
    <div className="tagline" role="presentation">
      <div className="typewriter-container">
        <div className="line-wrapper">
          <span className="typewriter first-line">&gt; AI &amp; Data Science student | Full-Stack + IoT + Security developer</span>
        </div>
        <div className="line-wrapper">
          <span className="typewriter second-line">&gt; Built 4+ products solo. HackIndia 2025 Top 10 Finalist. Available for internship.</span>
        </div>
      </div>
    </div>
  );
}

function AvailabilityAlert() {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('alertDismissed') === 'true');
  const [typed, setTyped] = useState('');

  const fullText = '> SYSTEM: Akash is available for internships. Type \'hire\' or ';

  useEffect(() => {
    if (dismissed) return;
    let i = 0;
    const timer = setInterval(() => {
      if (i <= fullText.length) {
        setTyped(fullText.slice(0, i));
        i++;
      } else {
        clearInterval(timer);
      }
    }, 28);
    return () => clearInterval(timer);
  }, [dismissed]);

  const dismiss = () => {
    sessionStorage.setItem('alertDismissed', 'true');
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div className="availability-alert">
      <span className="alert-text">
        {typed}
        <Link to="/contact" className="alert-link">click here</Link>
        {typed.length >= fullText.length ? ' to contact.' : ''}
      </span>
      <button className="alert-dismiss" onClick={dismiss} aria-label="Dismiss">×</button>
    </div>
  );
}

function MagneticBtn({ to, className, children }) {
  const ref = useRef(null);
  const handleMove = useCallback((e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) * 0.35;
    const dy = (e.clientY - cy) * 0.35;
    el.style.transform = `translate(${dx}px, ${dy}px)`;
  }, []);
  const handleLeave = useCallback(() => {
    if (ref.current) ref.current.style.transform = 'translate(0,0)';
  }, []);

  return (
    <Link
      ref={ref}
      to={to}
      className={className}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      {children}
    </Link>
  );
}

function HeroCTAs() {
  return (
    <div className="hero-ctas">
      <Link to="/projects" className="cta-btn cta-secondary">
        <span className="cta-bracket">[</span>
        <span className="cta-arrow">→</span> view my work
        <span className="cta-bracket">]</span>
      </Link>
      <MagneticBtn to="/contact" className="cta-btn cta-primary">
        <span className="cta-bracket">[</span>
        <span className="cta-arrow">→</span> hire me
        <span className="cta-bracket">]</span>
      </MagneticBtn>
    </div>
  );
}

function AvailabilityBadge() {
  return (
    <Link to="/contact" className="availability-badge">
      <span className="avail-dot" />
      Available — Coimbatore + Remote
    </Link>
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
  const asciiArt = `
 █████╗ ██╗  ██╗ █████╗ ███████╗██╗  ██╗    ██████╗
██╔══██╗██║ ██╔╝██╔══██╗██╔════╝██║  ██║    ██╔══██╗
███████║█████╔╝ ███████║███████╗███████║    ██████╔╝
██╔══██║██╔═██╗ ██╔══██║╚════██║██╔══██║    ██╔══██╗
██║  ██║██║  ██╗██║  ██║███████║██║  ██║    ██║  ██║
╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝    ╚═╝  ╚═╝`;

  return (
    <>
      <Helmet>
        <title>Akash Rengaraj | Terminal Portfolio</title>
        <meta name="description" content="Akash Rengaraj — AI & Data Science student and full-stack developer. Available for internship immediately." />
        <meta property="og:title" content="Akash Rengaraj — AI & Full-Stack Developer" />
        <meta property="og:description" content="Built 4+ products solo. HackIndia 2025 Top 10 Finalist. Available for internship." />
        <meta property="og:image" content="https://www.akashr.dev/screenshots/home-dark.png" />
        <meta name="twitter:title" content="Akash Rengaraj — AI & Full-Stack Developer" />
        <meta name="twitter:description" content="Built 4+ products solo. HackIndia 2025 Top 10 Finalist. Available for internship." />
        <meta name="twitter:image" content="https://www.akashr.dev/screenshots/home-dark.png" />
      </Helmet>
      <div className="page active" id="home">
        <div className="home-content">
          <pre className="ascii-art">{asciiArt}</pre>
          <Typewriter />
          <HeroCTAs />
          <AvailabilityAlert />
        </div>
        <AvailabilityBadge />
        <TerminalInput />
        <TerminalBot />
        <SudoEasterEgg />
      </div>
    </>
  );
}

export default HomePage;
