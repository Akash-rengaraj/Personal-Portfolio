import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import BootLoader from './components/BootLoader';
import PageLoader from './components/PageLoader';
import { AppContext } from './context/AppContext';
import TerminalLayout from './layouts/TerminalLayout';
import HomePage from './pages/HomePage';
import { subscribeToViews } from './firebase/viewCounter';

/* Every page except the landing page is split into its own chunk */
const pageImports = {
  about: () => import('./pages/AboutPage'),
  projects: () => import('./pages/ProjectsPage'),
  projectDetail: () => import('./pages/ProjectDetailPage'),
  achievements: () => import('./pages/EventsPage'),
  contact: () => import('./pages/LinksPage'),
  blog: () => import('./pages/BlogPage'),
  blogPost: () => import('./pages/BlogPostPage'),
  resume: () => import('./pages/ResumeViewPage'),
  notFound: () => import('./pages/NotFoundPage'),
};

const AboutPage = lazy(pageImports.about);
const ProjectsPage = lazy(pageImports.projects);
const ProjectDetailPage = lazy(pageImports.projectDetail);
const EventsPage = lazy(pageImports.achievements);
const LinksPage = lazy(pageImports.contact);
const BlogPage = lazy(pageImports.blog);
const BlogPostPage = lazy(pageImports.blogPost);
const ResumeViewPage = lazy(pageImports.resume);
const NotFoundPage = lazy(pageImports.notFound);
/* The game pulls in three.js, so it is never part of the idle prefetch */
const DrivePage = lazy(() => import('./pages/DrivePage'));

/** Run `task` when the browser is idle (falls back to a timeout). */
const whenIdle = (task, timeout = 2000) =>
  'requestIdleCallback' in window
    ? window.requestIdleCallback(task, { timeout })
    : window.setTimeout(task, timeout);

/** ms after the first real screen before background work (view counter, chunk prefetch) starts */
const DEFERRED_WORK_DELAY = 2500;

const shouldBoot = () =>
  !sessionStorage.getItem('booted') && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function App() {
  const [booting, setBooting] = useState(shouldBoot);
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem('theme');
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
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

  // Firebase + remaining page chunks wait until the first real screen has painted
  // and the main thread is free, so they never compete with it for bandwidth or CPU
  useEffect(() => {
    if (booting) return undefined;
    let unsubscribe;
    let cancelled = false;

    const timer = window.setTimeout(() => whenIdle(async () => {
      if (cancelled) return;
      try {
        const stop = await subscribeToViews(setViewCount);
        if (cancelled) stop();
        else unsubscribe = stop;
      } catch (err) {
        console.warn('view counter unavailable:', err);
      }
      Object.values(pageImports).forEach(load => load().catch(() => {}));
    }), DEFERRED_WORK_DELAY);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      unsubscribe?.();
    };
  }, [booting]);

  const toggleTheme = useCallback(() => {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  const triggerBotCommand = useCallback((detail) => {
    window.dispatchEvent(new CustomEvent('botCommand', { detail }));
  }, []);

  const contextValue = useMemo(
    () => ({ theme, setTheme, viewCount, triggerBotCommand }),
    [theme, viewCount, triggerBotCommand]
  );

  if (booting) return <BootLoader onDone={handleBootDone} />;

  return (
    <AppContext.Provider value={contextValue}>
      <Routes>
        <Route element={<TerminalLayout onToggleTheme={toggleTheme} />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:slug" element={<ProjectDetailPage />} />
          <Route path="/achievements" element={<EventsPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          <Route path="/contact" element={<LinksPage />} />
        </Route>
        <Route path="/drive" element={<Suspense fallback={<PageLoader fullscreen />}><DrivePage /></Suspense>} />
        <Route path="/resume-view" element={<Suspense fallback={<PageLoader fullscreen />}><ResumeViewPage /></Suspense>} />
        <Route path="*" element={<Suspense fallback={<PageLoader fullscreen />}><NotFoundPage /></Suspense>} />
      </Routes>
    </AppContext.Provider>
  );
}

export default App;
