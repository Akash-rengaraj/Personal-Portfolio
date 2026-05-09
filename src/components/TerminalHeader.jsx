import ThemeToggle from './ThemeToggle';

function TerminalHeader({ onToggleTheme, onWindowButton }) {
  return (
    <div className="terminal-header">
      <div className="window-buttons">
        <span
          className="wb-close"
          title="Close"
          onClick={() => onWindowButton?.(1)}
          role="button"
          aria-label="Close (easter egg)"
        />
        <span
          className="wb-minimise"
          title="Minimise"
          onClick={() => onWindowButton?.(2)}
          role="button"
          aria-label="Minimise (easter egg)"
        />
        <span
          className="wb-maximise"
          title="Maximise"
          onClick={() => onWindowButton?.(3)}
          role="button"
          aria-label="Maximise (easter egg)"
        />
      </div>
      <div className="title">akashr.dev</div>
      <ThemeToggle onToggleTheme={onToggleTheme} />
    </div>
  );
}

export default TerminalHeader;
