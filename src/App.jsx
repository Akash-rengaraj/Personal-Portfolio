import { useState, useEffect } from 'react';
import { db } from './firebase/config';
import { ref, onValue, runTransaction } from 'firebase/database';

import TerminalHeader from './components/TerminalHeader';
import Navigation from './components/Navigation';
import StatsWidget from './components/StatsWidget';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import ProjectsPage from './pages/ProjectsPage';
import EventsPage from './pages/EventsPage';
import LinksPage from './pages/LinksPage';

function App() {
  const [activePage, setActivePage] = useState('home');
  const [theme, setTheme] = useState('dark');
  const [viewCount, setViewCount] = useState(0);

  // Effect for handling the theme change on the body
  useEffect(() => {
    document.body.className = theme === 'light' ? 'light-mode' : '';
  }, [theme]);

  // Effect for Firebase page view counter
  useEffect(() => {
    const counterRef = ref(db, 'pageViews');
    // Increment count only once per session
    runTransaction(counterRef, (current) => (current || 0) + 1);
    // Listen for real-time updates to the count
    const unsubscribe = onValue(counterRef, (snapshot) => {
      setViewCount(snapshot.val() || 0);
    });
    // Cleanup the listener when the component unmounts
    return () => unsubscribe();
  }, []); // Empty dependency array means this runs only once on mount

  const toggleTheme = () => {
    setTheme(currentTheme => (currentTheme === 'dark' ? 'light' : 'dark'));
  };

  // Renders the current page based on the activePage state
  const renderPage = () => {
    switch (activePage) {
      case 'about': return <AboutPage />;
      case 'projects': return <ProjectsPage />;
      case 'events': return <EventsPage viewCount={viewCount} />;
      case 'links': return <LinksPage />;
      case 'home':
      default: return <HomePage />;
    }
  };

  return (
    <div className="terminal">
      <TerminalHeader onToggleTheme={toggleTheme} />
      <div className="terminal-content">
        {renderPage()}
        <Navigation activePage={activePage} onNavigate={setActivePage} />
        <StatsWidget />
      </div>
    </div>
  );
}

export default App;