import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import TerminalBot from '../components/TerminalBot';

function NotFoundPage() {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([
    { type: 'input', text: 'cd /that-page' },
    { type: 'error', text: 'bash: cd: that-page: No such file or directory' },
    { type: 'info', text: 'Type "help" to see available commands or click links below.' }
  ]);
  
  // Game states
  const [gameState, setGameState] = useState(null); // 'guess'
  const [secretNumber, setSecretNumber] = useState(0);

  const inputRef = useRef(null);
  const navigate = useNavigate();

  // Konami Code & Matrix cleanup
  useEffect(() => {
    inputRef.current?.focus();
    
    const konami = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let konamiIndex = 0;
    
    const handleGlobalKeyDown = (e) => {
        if (e.key === konami[konamiIndex]) {
            konamiIndex++;
            if (konamiIndex === konami.length) {
                // Trigger Easter Egg
                document.body.classList.add('spin-mode');
                setTimeout(() => document.body.classList.remove('spin-mode'), 3000);
                setHistory(prev => [...prev, { type: 'info', text: '🎮 KONAMI CODE ACTIVATED! Do a barrel roll! 🎮' }]);
                scrollToBottom();
                konamiIndex = 0;
            }
        } else {
            konamiIndex = 0;
        }
    };
    
    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      document.body.classList.remove('matrix-mode');
      document.body.classList.remove('spin-mode');
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 50);
  };

  const simulateHacking = () => {
    const hackLines = [
        "Bypassing proxy server...",
        "Cracking 256-bit encryption...",
        "Downloading database tables...",
        "Extracting passwords...",
        "ACCESS GRANTED. Welcome, Neo."
    ];
    
    setHistory(prev => [...prev, { type: 'input', text: 'hack' }, { type: 'info', text: 'Initiating mainframe breach...' }]);
    
    hackLines.forEach((line, i) => {
        setTimeout(() => {
            setHistory(prev => [...prev, { type: i === hackLines.length - 1 ? 'error' : 'info', text: line }]);
            scrollToBottom();
        }, (i + 1) * 800);
    });
  };

  const handleCommand = (cmd) => {
    const trimmedCmd = cmd.trim().toLowerCase();
    
    if (trimmedCmd === '') {
      setHistory(prev => [...prev, { type: 'input', text: '' }]);
      return;
    }

    let response = [];

    // Handle ongoing games first
    if (gameState === 'guess') {
      const guess = parseInt(trimmedCmd);
      if (trimmedCmd === 'quit') {
        setGameState(null);
        response = [{ type: 'info', text: 'Quit guessing game. Returning to terminal.' }];
      } else if (isNaN(guess)) {
        response = [{ type: 'error', text: 'Please enter a valid number, or "quit".' }];
      } else {
        if (guess < secretNumber) {
          response = [{ type: 'info', text: 'Higher!' }];
        } else if (guess > secretNumber) {
          response = [{ type: 'info', text: 'Lower!' }];
        } else {
          response = [{ type: 'info', text: '🎉 You guessed it! Returning to normal terminal.' }];
          setGameState(null);
        }
      }
      setHistory(prev => [...prev, { type: 'input', text: cmd }, ...response]);
      return;
    }

    switch (trimmedCmd) {
      case 'help':
        response = [
          { type: 'info', text: '[ AVAILABLE COMMANDS ]' },
          { type: 'info', text: '  home      - Go to home page' },
          { type: 'info', text: '  about     - Go to about page' },
          { type: 'info', text: '  projects  - View projects' },
          { type: 'info', text: '  contact   - Reach out' },
          { type: 'info', text: '  clear     - Clear terminal history' },
          { type: 'info', text: '  matrix    - Toggle matrix mode' },
          { type: 'info', text: '  guess     - Play a number guessing game' },
          { type: 'info', text: '  ls        - List directory contents' },
          { type: 'info', text: '  hack      - Initiate mainframe breach' },
          { type: 'info', text: '  whoami    - Print user information' },
          { type: 'info', text: '  date      - Print the system date' },
          { type: 'info', text: '  sudo      - Superuser do' }
        ];
        break;
      case 'home':
        response = [{ type: 'info', text: 'Navigating to /home...' }];
        setTimeout(() => navigate('/'), 600);
        break;
      case 'about':
        response = [{ type: 'info', text: 'Navigating to /about...' }];
        setTimeout(() => navigate('/about'), 600);
        break;
      case 'projects':
      case 'work':
        response = [{ type: 'info', text: 'Navigating to /projects...' }];
        setTimeout(() => navigate('/projects'), 600);
        break;
      case 'contact':
        response = [{ type: 'info', text: 'Navigating to /contact...' }];
        setTimeout(() => navigate('/contact'), 600);
        break;
      case 'clear':
        setHistory([]);
        return;
      case 'matrix':
        const isMatrix = document.body.classList.contains('matrix-mode');
        if (isMatrix) {
          document.body.classList.remove('matrix-mode');
          response = [{ type: 'info', text: 'Matrix mode deactivated. Back to reality.' }];
        } else {
          document.body.classList.add('matrix-mode');
          response = [{ type: 'info', text: 'Matrix mode activated. Follow the white rabbit...' }];
        }
        break;
      case 'guess':
        setSecretNumber(Math.floor(Math.random() * 100) + 1);
        setGameState('guess');
        response = [{ type: 'info', text: 'I am thinking of a number between 1 and 100. Enter your guess (or "quit"):' }];
        break;
      case 'ls':
      case 'll':
      case 'ls -la':
        response = [
            { type: 'info', text: 'drwxr-xr-x  2 root  root  4096 ./' },
            { type: 'info', text: 'drwxr-xr-x  2 root  root  4096 ../' },
            { type: 'info', text: '-rw-r--r--  1 root  root    42 secrets.txt' },
            { type: 'info', text: '-rwxr-xr-x  1 root  root   666 do_not_run.sh' }
        ];
        break;
      case 'cat secrets.txt':
        response = [{ type: 'error', text: 'cat: secrets.txt: Permission denied. (Nice try though)' }];
        break;
      case 'cat do_not_run.sh':
      case './do_not_run.sh':
      case 'bash do_not_run.sh':
      case 'sh do_not_run.sh':
        response = [{ type: 'error', text: 'FATAL ERROR: System corruption imminent! (Just kidding)' }];
        const el = document.getElementById('404');
        if (el) {
          el.classList.add('shake-intense');
          setTimeout(() => el.classList.remove('shake-intense'), 500);
        }
        break;
      case 'whoami':
        response = [{ type: 'info', text: 'A lost internet traveler wandering through the digital void.' }];
        break;
      case 'date':
        response = [{ type: 'info', text: new Date().toString() }];
        break;
      case 'hack':
        simulateHacking();
        return; // simulateHacking handles adding the input and response
      case 'rm -rf /':
      case 'rm -rf /*':
        response = [{ type: 'error', text: 'Nice try, but you do not have root privileges here.' }];
        break;
      case 'sudo':
        response = [{ type: 'error', text: 'bash: sudo: permission denied. Your incident has been reported.' }];
        break;
      case 'echo':
        response = [{ type: 'info', text: '' }]; 
        break;
      default:
        if (trimmedCmd.startsWith('echo ')) {
            response = [{ type: 'info', text: cmd.substring(5) }];
        } else {
            response = [{ type: 'error', text: `bash: ${trimmedCmd}: command not found` }];
        }
    }

    setHistory(prev => [
      ...prev,
      { type: 'input', text: cmd },
      ...response
    ]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleCommand(input);
      setInput('');
      scrollToBottom();
    }
  };

  const handleClick = () => {
    inputRef.current?.focus();
  };

  return (
    <>
      <Helmet>
        <title>404 — akashr.dev</title>
      </Helmet>
      <div className="page active not-found-page" id="404" onClick={handleClick}>
        <div className="not-found-content">
          <h1 className="glitch-404" data-text="404">404</h1>
          <p className="not-found-subtitle">PAGE_NOT_FOUND</p>
          
          <div className="not-found-interactive-terminal">
            <div className="terminal-history">
              {history.map((line, index) => (
                <div key={index} className={`history-line ${line.type}`}>
                  {line.type === 'input' && <span className="prompt">root@akash:~$ </span>}
                  {line.text}
                </div>
              ))}
            </div>
            <div className="terminal-input-line">
              <span className="prompt">root@akash:~$ </span>
              <span className="typed-text">{input}</span>
              <span className="cursor-blink">█</span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="hidden-input"
                autoComplete="off"
                spellCheck="false"
              />
            </div>
          </div>

          <div className="not-found-quick-links">
            <p className="links-title">[ OR CLICK HERE ]</p>
            <div className="not-found-paths">
              <Link to="/">/home</Link>
              <Link to="/about">/about</Link>
              <Link to="/projects">/projects</Link>
              <Link to="/contact">/contact</Link>
            </div>
          </div>
        </div>
        <TerminalBot initialMood="DIZZY" />
      </div>
    </>
  );
}

export default NotFoundPage;
