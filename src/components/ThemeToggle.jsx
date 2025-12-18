import React from 'react';

function ThemeToggle({ onToggleTheme }) {
  return (
    <div className="theme-toggle" onClick={onToggleTheme} style={{ cursor: 'pointer' }}>
      <div className="bulb"></div>
      <div className="chain"></div>
    </div>
  );
}

export default ThemeToggle;