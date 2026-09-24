import { useState, useEffect, useRef } from 'react';

const BOOT_LINES = [
  { text: 'BIOS v2.0.25 — akashr.dev initialized', delay: 0 },
  { text: 'Loading kernel modules... [OK]', delay: 70 },
  { text: 'Mounting filesystems... [OK]', delay: 140 },
  { text: 'Starting network services... [OK]', delay: 210 },
  { text: 'Loading portfolio modules:', delay: 300 },
  { text: '  projects.json ............. [OK]', delay: 370 },
  { text: '  skills.json ............... [OK]', delay: 430 },
  { text: '  blog.md ................... [OK]', delay: 490 },
  { text: 'Starting terminal interface... [OK]', delay: 560 },
  { text: '', delay: 620 },
  { text: 'Welcome, recruiter. You\'re in for a treat.', delay: 650, special: true },
];

const TOTAL_DURATION = 900;
const FADE_DURATION = 250;

/** First-visit boot sequence. Any key, click or tap skips it. */
function BootLoader({ onDone }) {
  const [visibleLines, setVisibleLines] = useState([]);
  const [fading, setFading] = useState(false);
  const finished = useRef(false);

  useEffect(() => {
    const finish = () => {
      if (finished.current) return;
      finished.current = true;
      setFading(true);
      setTimeout(onDone, FADE_DURATION);
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onDone();
      return undefined;
    }

    const timers = BOOT_LINES.map(({ text, delay, special }) =>
      setTimeout(() => setVisibleLines(prev => [...prev, { text, special }]), delay)
    );
    const doneTimer = setTimeout(finish, TOTAL_DURATION);

    window.addEventListener('keydown', finish);
    window.addEventListener('pointerdown', finish);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(doneTimer);
      window.removeEventListener('keydown', finish);
      window.removeEventListener('pointerdown', finish);
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
      <div className="boot-skip" aria-hidden="true">press any key to skip</div>
    </div>
  );
}

export default BootLoader;
