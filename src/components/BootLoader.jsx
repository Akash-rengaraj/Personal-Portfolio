import { useState, useEffect } from 'react';

const BOOT_LINES = [
  { text: 'BIOS v2.0.25 — akashr.dev initialized', delay: 0 },
  { text: 'Loading kernel modules... [OK]', delay: 120 },
  { text: 'Mounting filesystems... [OK]', delay: 220 },
  { text: 'Starting network services... [OK]', delay: 360 },
  { text: 'Connecting to Firebase... [OK]', delay: 480 },
  { text: 'Loading portfolio modules:', delay: 600 },
  { text: '  projects.json ............. [OK]', delay: 700 },
  { text: '  skills.json ............... [OK]', delay: 800 },
  { text: '  hackathons.json ........... [OK]', delay: 880 },
  { text: 'Starting terminal interface... [OK]', delay: 980 },
  { text: '', delay: 1080 },
  { text: 'Welcome, recruiter. You\'re in for a treat.', delay: 1120, special: true },
];

const TOTAL_DURATION = 1800;

function BootLoader({ onDone }) {
  const [visibleLines, setVisibleLines] = useState([]);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const timers = BOOT_LINES.map(({ text, delay, special }) =>
      setTimeout(() => setVisibleLines(prev => [...prev, { text, special }]), delay)
    );

    const fadeTimer = setTimeout(() => setFading(true), TOTAL_DURATION);
    const doneTimer = setTimeout(() => onDone(), TOTAL_DURATION + 500);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div className={`boot-loader ${fading ? 'boot-fading' : ''}`} aria-label="Loading portfolio">
      <div className="boot-lines">
        {visibleLines.map((line, i) => (
          <div key={i} className={`boot-line ${line.special ? 'boot-special' : ''}`}>
            {line.text}
          </div>
        ))}
        <span className="boot-cursor" />
      </div>
    </div>
  );
}

export default BootLoader;
