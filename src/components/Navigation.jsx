import { NavLink } from 'react-router-dom';

const githubIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '4px', verticalAlign: 'middle' }}>
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-3.795-.735-.54-1.38-1.335-1.755-1.335-1.755-1.095-.75.075-.735.075-.735 1.2.075 1.83 1.23 1.83 1.23 1.08 1.86 2.805 1.32 3.495 1.005.105-.78.42-1.32.765-1.62-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405 1.02 0 2.04.135 3 .405 2.28-1.545 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.92 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.285 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
  </svg>
);

/*
 * `label` is what desktop shows (unchanged); on phones the nav becomes a
 * bottom tab bar that shows `icon` + `short` instead. Only one label is ever
 * displayed, so the accessible name always matches the visible text. `secondary` links are
 * dropped from the phone tab bar (they're reachable from Home and Contact).
 */
const LINKS = [
  { to: '/', label: 'home', short: 'home', icon: 'fa-solid fa-house', end: true },
  { to: '/about', label: 'about', short: 'about', icon: 'fa-solid fa-user' },
  { to: '/resume-view', label: 'resume', short: 'resume', icon: 'fa-solid fa-file-lines', secondary: true },
  { to: '/projects', label: 'projects', short: 'work', icon: 'fa-solid fa-folder-open' },
  { to: '/achievements', label: 'achievements', short: 'wins', icon: 'fa-solid fa-trophy' },
  { to: '/blog', label: 'blog', short: 'blog', icon: 'fa-solid fa-pen-nib' },
  { to: '/contact', label: 'links & contacts', short: 'contact', icon: 'fa-solid fa-paper-plane' },
];

function Navigation() {
  return (
    <nav className="nav" aria-label="Main">
      <a href="https://github.com/Akash-rengaraj" target="_blank" rel="noopener noreferrer" className="nav-external nav-secondary">
        {githubIcon}github
      </a>
      {LINKS.map(({ to, label, short, icon, end, secondary }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => [isActive && 'active', secondary && 'nav-secondary'].filter(Boolean).join(' ')}
        >
          <i className={`nav-icon ${icon}`} aria-hidden="true" />
          <span className="nav-label-full">{label}</span>
          <span className="nav-label-short">{short}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default Navigation;
