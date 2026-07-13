import { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import TerminalHeader from '../components/TerminalHeader';
import Navigation from '../components/Navigation';
import StatsWidget from '../components/StatsWidget';

import { useApp } from '../context/AppContext';

function TerminalLayout({ onToggleTheme }) {
  const location = useLocation();
  const { triggerBotCommand } = useApp();
  const [terminalEffect, setTerminalEffect] = useState('');
  const [flashVisible, setFlashVisible] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const outletRef = useRef(null);
  const prevPath = useRef(location.pathname);

  const handleWindowButton = (btn) => {
    if (btn === 1) {
      triggerBotCommand({ type: 'speak', text: "Cannot close — too impressive 😤", mood: 'ANNOYED' });
      document.querySelector('.terminal')?.classList.add('terminal-shake');
      setTimeout(() => {
        document.querySelector('.terminal')?.classList.remove('terminal-shake');
      }, 600);
    } else if (btn === 2) {
      setTerminalEffect('minimised');
      setTimeout(() => setTerminalEffect(''), 700);
    } else if (btn === 3) {
      setFlashVisible(true);
      triggerBotCommand({ type: 'speak', text: "Already full screen, my friend!", mood: 'HAPPY' });
      setTimeout(() => setFlashVisible(false), 400);
    }
  };

  // Page sweep transition on route change
  useEffect(() => {
    if (prevPath.current !== location.pathname) {
      prevPath.current = location.pathname;
      setSweeping(true);
      setTimeout(() => setSweeping(false), 700);
    }
  }, [location.pathname]);

  // Scroll-triggered reveal via IntersectionObserver
  useEffect(() => {
    const outlet = outletRef.current;
    if (!outlet) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    // Observe current reveal elements
    const observe = () => {
      outlet.querySelectorAll('.reveal:not(.revealed)').forEach(el => observer.observe(el));
    };

    observe();

    // Re-observe after route changes (MutationObserver watches for new .reveal nodes)
    const mutObs = new MutationObserver(observe);
    mutObs.observe(outlet, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutObs.disconnect();
    };
  }, [location.pathname]);

  return (
    <>

      <div className={`terminal ${terminalEffect}`}>
        {flashVisible && <div className="terminal-flash" />}
        {sweeping && <div className="page-sweep" aria-hidden="true" />}
        <TerminalHeader onToggleTheme={onToggleTheme} onWindowButton={handleWindowButton} />
        <div className="terminal-content">
          <div ref={outletRef} key={location.pathname} className="page-outlet">
            <Outlet />
          </div>
          <Navigation />
          <StatsWidget />
        </div>
      </div>
    </>
  );
}

export default TerminalLayout;
