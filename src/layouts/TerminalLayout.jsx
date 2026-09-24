import { useState, useEffect, useRef, Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { profile } from '../data/profile';
import TerminalHeader from '../components/TerminalHeader';
import Navigation from '../components/Navigation';
import StatsWidget from '../components/StatsWidget';
import PageLoader from '../components/PageLoader';

import { useApp } from '../context/AppContext';

function TerminalLayout({ onToggleTheme }) {
  const location = useLocation();
  const { triggerBotCommand } = useApp();
  const [terminalEffect, setTerminalEffect] = useState('');
  const [flashVisible, setFlashVisible] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const outletRef = useRef(null);
  const contentRef = useRef(null);
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

  // Reserve the strip the bottom nav occupies (its height changes as it wraps)
  useEffect(() => {
    const content = contentRef.current;
    const nav = content?.querySelector('.nav');
    if (!content || !nav) return;

    const NAV_GAP = 10;
    const measure = () => {
      // offset-based so the lid-opening 3D transform can't skew the numbers
      const space = content.clientHeight - nav.offsetTop + NAV_GAP;
      content.style.setProperty('--nav-space', `${Math.max(0, space)}px`);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    observer.observe(nav);
    return () => observer.disconnect();
  }, []);

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

  const canonical = location.pathname === '/' ? `${profile.site}/` : `${profile.site}${location.pathname.replace(/\/$/, '')}`;

  return (
    <>
      <Helmet>
        <link rel="canonical" href={canonical} />
      </Helmet>
      <div className="scene-backdrop" aria-hidden="true">
        <div className="scene-glow" />
        <div className="scene-floor" />
        <div className="scene-grain" />
      </div>

      <div className="laptop">
        <div className="laptop-lid">
          <div className="laptop-bezel">
            <span className="laptop-camera" aria-hidden="true" />
            <div className="laptop-screen">
              <div className={`terminal ${terminalEffect}`}>
                {flashVisible && <div className="terminal-flash" />}
                {sweeping && <div className="page-sweep" aria-hidden="true" />}
                <TerminalHeader onToggleTheme={onToggleTheme} onWindowButton={handleWindowButton} />
                <div ref={contentRef} className="terminal-content">
                  <div
                    ref={outletRef}
                    key={location.pathname}
                    className="page-outlet is-contained"
                  >
                    <Suspense fallback={<PageLoader />}>
                      <Outlet />
                    </Suspense>
                  </div>
                  <Navigation />
                  <StatsWidget />
                </div>
              </div>
              <div className="screen-glare" aria-hidden="true" />
            </div>
          </div>
        </div>
        <div className="laptop-base" aria-hidden="true">
          <div className="laptop-deck" />
          <div className="laptop-front" />
        </div>
        <div className="laptop-shadow" aria-hidden="true" />
      </div>
    </>
  );
}

export default TerminalLayout;
