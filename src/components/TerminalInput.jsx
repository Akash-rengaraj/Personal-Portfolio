import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const JOKES = [
  "Why do programmers prefer dark mode? Because light attracts bugs.",
  "A SQL query walks into a bar, walks up to two tables and asks: 'Can I join you?'",
  "Why did the developer go broke? Because he used up all his cache.",
  "How many programmers does it take to change a light bulb? None — that's a hardware problem.",
  "I have a joke about recursion, but first I have a joke about recursion.",
  "What's a programmer's favourite hangout spot? The Foo Bar.",
  "Why do Java developers wear glasses? Because they don't C#.",
  "A programmer's wife tells him: 'Go to the store and get a gallon of milk, and if they have eggs, get a dozen.' He comes home with 12 gallons of milk.",
  "Why was the JavaScript developer sad? Because he didn't Node how to Express himself.",
  "There are only 10 types of people: those who understand binary and those who don't.",
  "Why do programmers always mix up Halloween and Christmas? Because Oct 31 = Dec 25.",
  "A byte walks into a bar looking pale. Bartender asks: 'What's wrong?' 'I've been feeling a bit off.'",
  "Code never lies, comments sometimes do.",
  "Life is short. Use Python.",
  "Git happens.",
  "It's not a bug, it's an undocumented feature.",
  "Real programmers count from 0.",
  "Why did the developer quit? They didn't get arrays.",
  "What do you call 8 hobbits? A hobbyte.",
  "// TODO: Write joke here.",
];

const QUOTES = [
  "\"Any fool can write code that a computer can understand. Good programmers write code that humans can understand.\" — Martin Fowler",
  "\"First, solve the problem. Then, write the code.\" — John Johnson",
  "\"Experience is the name everyone gives to their mistakes.\" — Oscar Wilde",
  "\"In order to be irreplaceable, one must always be different.\" — Coco Chanel",
  "\"Java is to JavaScript what car is to carpet.\" — Chris Heilmann",
  "\"Knowledge is power.\" — Francis Bacon",
  "\"Sometimes it pays to stay in bed on Monday, rather than spending the rest of the week debugging Monday's code.\" — Dan Salomon",
  "\"Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away.\" — Antoine de Saint Exupéry",
  "\"The best way to predict the future is to invent it.\" — Alan Kay",
  "\"Talk is cheap. Show me the code.\" — Linus Torvalds",
];

const AUTOCOMPLETE = ['help', 'whoami', 'ls', 'cat bio.txt', 'cat skills.txt', 'cat resume.pdf', 'resume-view', 'projects', 'about', 'achievements', 'contact', 'hire', 'clear', 'theme dark', 'theme light', 'sudo dance', 'sudo hack', 'coffee', 'joke', 'quote', 'date', 'weather', 'github', 'linkedin', 'email', 'secret', 'cat .easter-eggs'];

function TerminalInput() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [matrixActive, setMatrixActive] = useState(false);
  const inputRef = useRef(null);
  const outputRef = useRef(null);
  const history = useRef(JSON.parse(sessionStorage.getItem('termHistory') || '[]'));
  const navigate = useNavigate();
  const { triggerBotCommand } = useApp();

  useEffect(() => {
    const handleClick = (e) => {
      if (!e.target.closest('.bot-character') && !e.target.closest('.cta-btn')) {
        inputRef.current?.focus();
      }
    };
    document.getElementById('home')?.addEventListener('click', handleClick);
    return () => document.getElementById('home')?.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const addOutput = useCallback((lines, type = 'default') => {
    const entries = Array.isArray(lines) ? lines : [lines];
    setOutput(prev => [...prev, ...entries.map(text => ({ text, type, id: Math.random() }))]);
  }, []);

  const execute = useCallback(async (cmd) => {
    const raw = cmd.trim();
    if (!raw) return;

    history.current = [raw, ...history.current.slice(0, 49)];
    sessionStorage.setItem('termHistory', JSON.stringify(history.current));
    setHistIdx(-1);

    addOutput(`akash@portfolio:~$ ${raw}`, 'prompt');

    const c = raw.toLowerCase();

    if (c === 'help') {
      addOutput([
        'Available commands:',
        '  whoami          — who is Akash?',
        '  ls              — list available pages',
        '  cat bio.txt     — print bio',
        '  cat skills.txt  — print skills',
        '  cat resume.pdf  — open resume PDF',
        '  resume-view     — open interactive resume page',
        '  cat .easter-eggs — reveal hidden interactions',
        '  projects        — navigate to projects',
        '  about           — navigate to about',
        '  achievements    — navigate to achievements',
        '  contact / hire  — navigate to contact page',
        '  theme dark/light — toggle theme',
        '  sudo dance      — make the bot dance',
        '  sudo hack       — ???',
        '  coffee          — ☕',
        '  joke            — random programmer joke',
        '  quote           — tech wisdom',
        '  date            — current date & time',
        '  weather         — Coimbatore weather',
        '  github          — open GitHub',
        '  linkedin        — open LinkedIn',
        '  email           — open email',
        '  secret          — ...',
        '  clear           — clear output',
      ], 'info');
    } else if (c === 'whoami') {
      addOutput([
        'Akash Rengaraj',
        '  — 2nd-year B.Tech AI & Data Science, Kathir College of Engineering',
        '  — Full-stack developer (React, Node, Flutter, Python)',
        '  — IoT enthusiast, cybersecurity learner, club leader',
        '  — HackIndia 2025 Top 10 Finalist',
        '  — Coimbatore, Tamil Nadu | Available for internship immediately',
      ], 'success');
    } else if (c === 'about') {
      navigate('/about');
      addOutput('Navigating to /about...', 'success');
    } else if (c === 'achievements') {
      navigate('/achievements');
      addOutput('Navigating to /achievements...', 'success');
    } else if (c === 'resume-view') {
      navigate('/resume-view');
      addOutput('Opening interactive resume...', 'success');
    } else if (c === 'ls') {
      addOutput(['home/  about/  projects/  achievements/  contact/  resume-view/'], 'info');
    } else if (c === 'cat bio.txt') {
      addOutput([
        'Full-stack developer & AI/DS student who builds real products from scratch.',
        'Led a team to Top 10 at HackIndia 2025. Runs the AI&DS club at Kathir College.',
        'Comfortable with React, Node, Flutter, Python, Arduino, and anything that solves a real problem.',
        'Available for internship immediately. Open to full-stack, IoT, AI/ML, or security roles.',
      ], 'success');
    } else if (c === 'cat skills.txt') {
      addOutput([
        'Frontend   : React 19, TypeScript, Next.js, Framer Motion, GSAP',
        'Backend    : Node.js, Express, FastAPI, Python',
        'Databases  : MongoDB, PostgreSQL, Firebase, Hive',
        'Mobile     : Flutter, Dart',
        'IoT        : Arduino, Raspberry Pi, ESP32',
        'AI/ML      : scikit-learn, TensorFlow basics, RAG systems',
        'Security   : Google Cybersecurity Professional, CTF participant',
        'Tools      : Git, Vite, Docker (basics), Vercel, Railway',
      ], 'success');
    } else if (c === 'cat resume.pdf') {
      window.open('/Akash_Resume.pdf', '_blank');
      addOutput('Resume opened in new tab ↗', 'success');
    } else if (c === 'cat .easter-eggs') {
      addOutput([
        'Hidden interactions in this portfolio:',
        '  1. Konami code (↑↑↓↓←→←→BA) → matrix rain + bot dance',
        '  2. Type "sudo" anywhere on home (not in terminal) → green flash',
        '  3. Long-press (1s) the bot → particle explosion + reassembly',
        '  4. Double-click bot → dance mode',
        '  5. Hover over HackIndia badge (achievements tab) → confetti',
        '  6. This command. You found it. Good work.',
        '  Type "secret" for a hidden mini-CV.',
      ], 'info');
    } else if (c === 'secret') {
      addOutput([
        '╔════════════════════════════════════════╗',
        '║         AKASH.EXE — HIDDEN STATS       ║',
        '╠════════════════════════════════════════╣',
        '║  Debugging style  : console.log wizard ║',
        '║  Commits at 2am   : very often         ║',
        '║  Favourite editor : antigravity        ║',
        '║  Tabs vs Spaces   : spaces. fight me.  ║',
        '║  Dream stack      : Assembly + C       ║',
        '║  Fuelled by       : coffee and thrill  ║',
        '║  Available for    : your internship 🚀 ║',
        '╚════════════════════════════════════════╝',
      ], 'success');
    } else if (c === 'projects') {
      addOutput([
        'Projects:',
        '  1. Get Up — Flutter student productivity app',
        '  2. Jewellery E-Commerce — React + Node.js full-stack',
        '  3. Icecream Website — React 19 + Framer Motion frontend',
        '  4. Portfolio — React 19 + Vite + Firebase (you\'re looking at it)',
      ], 'info');
      setTimeout(() => navigate('/projects'), 1200);
      addOutput('Navigating to /projects...', 'success');
    } else if (c === 'contact' || c === 'hire') {
      addOutput('Navigating to /contact...', 'success');
      setTimeout(() => navigate('/contact'), 600);
    } else if (c === 'clear') {
      setOutput([]);
      return;
    } else if (c === 'theme dark') {
      document.body.className = '';
      localStorage.setItem('theme', 'dark');
      addOutput('Theme set to dark.', 'success');
    } else if (c === 'theme light') {
      document.body.className = 'light-mode';
      localStorage.setItem('theme', 'light');
      addOutput('Theme set to light.', 'success');
    } else if (c === 'sudo dance') {
      triggerBotCommand({ type: 'dance' });
      addOutput('Bot dance mode activated 💃', 'success');
    } else if (c === 'sudo hack') {
      setMatrixActive(true);
      triggerBotCommand({ type: 'speak', text: 'Initiating hack sequence...', mood: 'DANCE' });
      addOutput('> h4ck1ng th3 m41nfr4m3...', 'success');
      setTimeout(() => setMatrixActive(false), 5000);
    } else if (c === 'coffee') {
      addOutput([
        '     ( (',
        '      ) )',
        '    ........',
        '    |      |]',
        '    \\      /',
        '     `----\'',
        '  ☕ Here\'s your coffee. You\'ve earned it.',
      ], 'info');
    } else if (c === 'joke') {
      addOutput(JOKES[Math.floor(Math.random() * JOKES.length)], 'info');
    } else if (c === 'quote') {
      addOutput(QUOTES[Math.floor(Math.random() * QUOTES.length)], 'info');
    } else if (c === 'date') {
      addOutput(new Date().toString(), 'info');
    } else if (c === 'weather') {
      addOutput('Fetching Coimbatore weather...', 'info');
      try {
        const res = await fetch('https://wttr.in/coimbatore?format=3');
        const text = await res.text();
        addOutput(text.trim(), 'success');
      } catch {
        addOutput('weather: connection failed. Check your internet.', 'error');
      }
    } else if (c === 'github') {
      window.open('https://github.com/Akash-rengaraj', '_blank');
      addOutput('GitHub opened ↗', 'success');
    } else if (c === 'linkedin') {
      window.open('https://www.linkedin.com/in/akash-rengaraj-b45177355', '_blank');
      addOutput('LinkedIn opened ↗', 'success');
    } else if (c === 'email') {
      window.open('mailto:akashrengaraj2007@gmail.com', '_self');
      addOutput('Email client opened.', 'success');
    } else {
      addOutput(`bash: ${raw}: command not found. Type 'help' for available commands.`, 'error');
    }
  }, [addOutput, navigate, triggerBotCommand]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      execute(input);
      setInput('');
      setHistIdx(-1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const nextIdx = Math.min(histIdx + 1, history.current.length - 1);
      setHistIdx(nextIdx);
      setInput(history.current[nextIdx] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = Math.max(histIdx - 1, -1);
      setHistIdx(nextIdx);
      setInput(nextIdx === -1 ? '' : history.current[nextIdx] || '');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const match = AUTOCOMPLETE.find(cmd => cmd.startsWith(input) && cmd !== input);
      if (match) setInput(match);
    }
  };

  const konami = useRef([]);
  const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];

  useEffect(() => {
    const handleKonami = (e) => {
      konami.current = [...konami.current, e.key].slice(-10);
      if (konami.current.join(',') === KONAMI.join(',')) {
        setMatrixActive(true);
        triggerBotCommand({ type: 'dance' });
        setTimeout(() => setMatrixActive(false), 10000);
      }
    };
    window.addEventListener('keydown', handleKonami);
    return () => window.removeEventListener('keydown', handleKonami);
  }, [triggerBotCommand]);

  return (
    <>
      {matrixActive && <MatrixRain />}
      <div className="terminal-input-area">
        {output.length > 0 && (
          <div className="terminal-output" ref={outputRef}>
            {output.map(line => (
              <div key={line.id} className={`output-line output-${line.type}`}>
                {line.text}
              </div>
            ))}
          </div>
        )}
        <div className="terminal-prompt-row">
          <span className="prompt-prefix">akash@portfolio:~$</span>
          <input
            ref={inputRef}
            className="terminal-prompt-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoCapitalize="none"
            autoComplete="off"
            aria-label="Terminal command input"
          />
          <span className="prompt-cursor" />
        </div>
      </div>
    </>
  );
}

function MatrixRain() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const cols = Math.floor(canvas.width / 16);
    const drops = Array(cols).fill(1);
    const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノABCDEF0123456789<>{}[]';

    const draw = () => {
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#00ff00';
      ctx.font = '14px monospace';
      drops.forEach((y, i) => {
        const char = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(char, i * 16, y * 16);
        if (y * 16 > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      });
    };

    const interval = setInterval(draw, 33);
    return () => clearInterval(interval);
  }, []);

  return <canvas ref={canvasRef} className="matrix-rain" />;
}

export default TerminalInput;
