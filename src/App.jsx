import { useState, useEffect, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import BootLoader from './components/BootLoader';
import { db } from './firebase/config';
import { ref, onValue, runTransaction } from 'firebase/database';

import { AppContext } from './context/AppContext';
import TerminalLayout from './layouts/TerminalLayout';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import ProjectsPage from './pages/ProjectsPage';
import EventsPage from './pages/EventsPage';
import LinksPage from './pages/LinksPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import ResumeViewPage from './pages/ResumeViewPage';
import NotFoundPage from './pages/NotFoundPage';

function App() {
  const [booting, setBooting] = useState(() => !sessionStorage.getItem('booted'));
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem('theme');
    if (stored) return stored;
    if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
    return 'dark';
  });
  const [viewCount, setViewCount] = useState(0);

  const handleBootDone = useCallback(() => {
    sessionStorage.setItem('booted', '1');
    setBooting(false);
  }, []);

  useEffect(() => {
    document.body.className = theme === 'light' ? 'light-mode' : '';
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const counterRef = ref(db, 'pageViews');
    runTransaction(counterRef, (current) => (current || 0) + 1);
    const unsubscribe = onValue(counterRef, (snapshot) => {
      setViewCount(snapshot.val() || 0);
    });
    return () => unsubscribe();
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  const triggerBotCommand = useCallback((detail) => {
    window.dispatchEvent(new CustomEvent('botCommand', { detail }));
  }, []);

  if (booting) return <BootLoader onDone={handleBootDone} />;

  return (
    <AppContext.Provider value={{ theme, viewCount, triggerBotCommand }}>
      <Routes>
        <Route element={<TerminalLayout onToggleTheme={toggleTheme} />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/achievements" element={<EventsPage />} />
          <Route path="/contact" element={<LinksPage />} />
          <Route path="/projects/:slug" element={<ProjectDetailPage />} />
        </Route>
        <Route path="/resume-view" element={<ResumeViewPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppContext.Provider>
  );
}

export default App;
