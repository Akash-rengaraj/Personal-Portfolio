import React from 'react';
import TerminalBot from '../components/TerminalBot';

// This component replicates the typewriter effect using CSS animations
// defined in your existing stylesheet.
function Typewriter() {
  return (
    <div className="tagline" role="presentation">
      <div className="typewriter-container">
        <div className="line-wrapper">
          <span className="typewriter first-line">Self taught fullstack developer</span>
          <div className="cursor" id="cursor1" style={{ animation: 'none', opacity: 0 }}></div>
        </div>
        <div className="line-wrapper">
          <span className="typewriter second-line">love to learn new things everyday and I'm always looking for new challenges to tackle :)</span>
          <div className="cursor" id="cursor2" style={{ animation: 'none', opacity: 0 }}></div>
        </div>
      </div>
    </div>
  );
}

function HomePage() {
  const asciiArt = `
 █████╗ ██╗  ██╗ █████╗ ███████╗██╗  ██╗    ██████╗ 
██╔══██╗██║ ██╔╝██╔══██╗██╔════╝██║  ██║    ██╔══██╗
███████║█████╔╝ ███████║███████╗███████║    ██████╔╝
██╔══██║██╔═██╗ ██╔══██║╚════██║██╔══██║    ██╔══██╗
██║  ██║██║  ██╗██║  ██║███████║██║  ██║    ██║  ██║
╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝    ╚═╝  ╚═╝`;

  return (
    <div className="page active" id="home">
      <div>
        <pre className="ascii-art">{asciiArt}</pre>
        <Typewriter />
      </div>
      <TerminalBot />
    </div>
  );
}

export default HomePage;