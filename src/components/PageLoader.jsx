/** Terminal-styled placeholder shown while a page chunk downloads. */
function PageLoader({ fullscreen = false }) {
  return (
    <div className={`page-loader ${fullscreen ? 'is-fullscreen' : ''}`} role="status" aria-live="polite">
      <span className="page-loader-prompt">$</span> loading<span className="page-loader-dots" aria-hidden="true" />
    </div>
  );
}

export default PageLoader;
