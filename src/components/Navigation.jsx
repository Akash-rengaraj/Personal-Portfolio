import React from 'react';

function Navigation({ activePage, onNavigate }) {
  const navLinks = [
    { name: 'home', page: 'home' },
    { name: 'about', page: 'about' },
    { name: 'resume', page: 'resume', external: true, href:'/Akash_Resume.pdf' },
    { name: 'projects', page: 'projects' },
    { name: 'honor', page: 'events' },
    { name: 'links & contacts', page: 'links' },
  ];

  return (
    <nav className="nav">
      <a href="https://github.com/Akash-rengaraj" target="_blank" rel="noopener noreferrer">tmux</a>
      {navLinks.map(link => (
        <a
          key={link.name}
          href={link.external ? link.href : '#'}
          target={link.external ? '_blank' : '_self'}
          rel={link.external ? 'noopener noreferrer' : ''}
          className={activePage === link.page ? 'active' : ''}
          onClick={(e) => {
            if (!link.external) {
              e.preventDefault();
              onNavigate(link.page);
            }
          }}
        >
          {link.name}
        </a>
      ))}
    </nav>
  );
}

export default Navigation;