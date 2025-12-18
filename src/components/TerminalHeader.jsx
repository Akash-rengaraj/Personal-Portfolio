import React from 'react';
import ThemeToggle from './ThemeToggle';

function TerminalHeader({ onToggleTheme }) {
  return (
    <div className="terminal-header">
      <div className="window-buttons">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div className="title">akashr.one</div>
      <ThemeToggle onToggleTheme={onToggleTheme} />
    </div>
  );
}

export default TerminalHeader;