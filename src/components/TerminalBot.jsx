import { useState, useEffect, useRef, useId, useCallback } from 'react';

const TALK_INTERVAL = 5000;
const MAX_SPEED = 150;        // px per second at full cruise
const STEER = 3.2;            // how quickly velocity bends toward the desired heading
const ARRIVE_RADIUS = 110;    // start easing off this far from the target
const BOT_W = 66;
const BOTTOM_CLEARANCE = 130; // keep clear of the prompt row
const EDGE = 12;
const DRAG_THRESHOLD = 4;

const PHRASES = {
  idle: [
    "Compiling thoughts...",
    "Scanning for merge conflicts...",
    "Does this simpler code max memory?",
    "I dream of electronic sheep.",
    "Pro tip: Refreshing fixes everything.",
    "Waiting for input...",
    "System status: groovy.",
  ],
  hover: [
    "Whoa! Personal space protocol initiated!",
    "I'm not a tooltip!",
    "You found the easter egg (me).",
    "Don't debug me, bro.",
    "My hitbox is sensitive."
  ],
  click: [
    "Ouch! That was a pointer event.",
    "Console.log('Ouch')",
    "Do I look like a button?",
    "Stop propagation!",
    "Event listener triggered."
  ],
  drag: [
    "Weeeee! I'm flying!",
    "Recalculating coordinates...",
    "Is this a drag-and-drop interface?",
    "Setting absolute position...",
    "Help! I'm being refactored!"
  ],
  dance: [
    "Look at me go!",
    "Raving in the DOM!",
    "CSS animations are fun.",
    "Boop beep boop!",
    "Party mode: ACTIVATED."
  ]
};

const MOODS = {
  IDLE: { color: "#3dffb8" },
  HAPPY: { color: "#40d9ff" },
  ANNOYED: { color: "#ffb347" },
  SURPRISED: { color: "#ff6fd8" },
  DIZZY: { color: "#ff5c70" },
  DANCE: { color: "#ffe45c" }
};

const BUBBLE_WIDTH = 240;
const LOOK_RANGE = 2.6;

/** Glowing face drawn on the bot's OLED visor for the given mood. */
function BotFace({ mood }) {
  switch (mood) {
    case 'HAPPY':
      return (
        <g className="bot-face">
          <path d="M20.5 33 q4 -6 8 0 M35.5 33 q4 -6 8 0" className="bot-stroke" />
          <path d="M28.5 37.5 q3.5 3 7 0" className="bot-stroke thin" />
          <ellipse cx="18.5" cy="37" rx="2.6" ry="1.4" className="bot-blush" />
          <ellipse cx="45.5" cy="37" rx="2.6" ry="1.4" className="bot-blush" />
        </g>
      );
    case 'ANNOYED':
      return (
        <g className="bot-face">
          <path d="M21 28 l7 3.5 l-7 3.5 M43 28 l-7 3.5 l7 3.5" className="bot-stroke" />
          <path d="M28.5 39 h7" className="bot-stroke thin" />
        </g>
      );
    case 'SURPRISED':
      return (
        <g className="bot-face">
          <circle cx="24.5" cy="31" r="4.2" className="bot-stroke" />
          <circle cx="39.5" cy="31" r="4.2" className="bot-stroke" />
          <circle cx="32" cy="38.8" r="1.8" className="bot-fill" />
        </g>
      );
    case 'DIZZY':
      return (
        <g className="bot-face">
          <circle cx="24.5" cy="31" r="4" className="bot-stroke bot-spin" />
          <circle cx="39.5" cy="31" r="4" className="bot-stroke bot-spin" />
          <circle cx="24.5" cy="31" r="1.2" className="bot-fill" />
          <circle cx="39.5" cy="31" r="1.2" className="bot-fill" />
        </g>
      );
    case 'DANCE':
      return (
        <g className="bot-face">
          <path d="M20.5 32 q2 -3 4 0 t4 0 M35.5 32 q2 -3 4 0 t4 0" className="bot-stroke" />
          <path d="M28 37 q4 4 8 0" className="bot-stroke thin" />
          <ellipse cx="18.5" cy="36.5" rx="2.6" ry="1.4" className="bot-blush" />
          <ellipse cx="45.5" cy="36.5" rx="2.6" ry="1.4" className="bot-blush" />
        </g>
      );
    default:
      return (
        <g className="bot-face bot-look">
          <rect x="21.5" y="26.5" width="6" height="9" rx="3" className="bot-fill bot-blink" />
          <rect x="36.5" y="26.5" width="6" height="9" rx="3" className="bot-fill bot-blink" />
        </g>
      );
  }
}

/** The bot's SVG body: shell, visor, antenna, arms and thruster. */
function BotSprite({ mood, uid }) {
  return (
    <svg className="bot-svg" viewBox="0 0 64 84" width="66" height="87" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-shell`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="bot-shell-hi" />
          <stop offset="1" className="bot-shell-lo" />
        </linearGradient>
        <radialGradient id={`${uid}-thrust`} cx="0.5" cy="0.2" r="0.6">
          <stop offset="0" stopColor="var(--bot-accent)" stopOpacity="0.95" />
          <stop offset="1" stopColor="var(--bot-accent)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* thruster */}
      <ellipse className="bot-thrust" cx="32" cy="76" rx="9" ry="7" fill={`url(#${uid}-thrust)`} />

      {/* antenna */}
      <path d="M32 14 V6.5" className="bot-antenna" />
      <circle cx="32" cy="5" r="3.2" className="bot-antenna-tip" />

      {/* arms */}
      <rect className="bot-arm bot-arm-l" x="12.5" y="53" width="6" height="14" rx="3" fill={`url(#${uid}-shell)`} />
      <rect className="bot-arm bot-arm-r" x="45.5" y="53" width="6" height="14" rx="3" fill={`url(#${uid}-shell)`} />

      {/* body */}
      <rect x="17" y="50" width="30" height="20" rx="10" fill={`url(#${uid}-shell)`} className="bot-shell" />
      <circle cx="32" cy="60" r="2.6" className="bot-core" />

      {/* neck */}
      <rect x="28" y="46" width="8" height="5" rx="2" className="bot-neck" />

      {/* head */}
      <rect x="5" y="30" width="5" height="11" rx="2.5" className="bot-ear" />
      <rect x="54" y="30" width="5" height="11" rx="2.5" className="bot-ear" />
      <rect x="8" y="13" width="48" height="35" rx="15" fill={`url(#${uid}-shell)`} className="bot-shell" />
      <rect x="13" y="19" width="38" height="23.5" rx="10" className="bot-visor" />
      <BotFace mood={mood} />
      <path d="M17 22.5 q6 -2.4 13 -1.4" className="bot-visor-glare" />
    </svg>
  );
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];

const TerminalBot = ({ initialMood = 'IDLE' }) => {
  const [mood, setMood] = useState(initialMood);
  const [message, setMessage] = useState('');
  const [typed, setTyped] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isDancing, setIsDancing] = useState(false);
  const [exploding, setExploding] = useState(false);
  const [particles, setParticles] = useState([]);

  const uid = useId().replace(/:/g, '');
  const botRef = useRef(null);

  // Motion state lives in refs so the rAF loop never triggers React renders
  const bounds = useRef({ w: 0, h: 0 });
  const pos = useRef({ x: -1, y: -1 });
  const vel = useRef({ x: 0, y: 0 });
  const target = useRef(null);
  const nextWanderAt = useRef(0);
  const dragging = useRef(false);
  const dancing = useRef(false);
  const messageRef = useRef('');
  const drag = useRef({ offsetX: 0, offsetY: 0, startX: 0, startY: 0, moved: false, exploded: false });
  const timers = useRef({ speak: null, dance: null, longPress: null, explode: null });

  /** Keep a point inside the area the bot is allowed to roam. */
  const clampPoint = useCallback((x, y) => {
    const { w, h } = bounds.current;
    return {
      x: Math.min(Math.max(EDGE, x), Math.max(EDGE, w - BOT_W - EDGE)),
      y: Math.min(Math.max(EDGE + 20, y), Math.max(EDGE + 20, h - BOTTOM_CLEARANCE)),
    };
  }, []);

  /** Push the current position/lean straight onto the element. */
  const applyTransform = useCallback(() => {
    const el = botRef.current;
    if (!el) return;
    const { x, y } = pos.current;
    const speed = Math.hypot(vel.current.x, vel.current.y);
    const tilt = Math.max(-12, Math.min(12, (vel.current.x / MAX_SPEED) * 12));
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    el.style.setProperty('--bot-tilt', `${tilt.toFixed(2)}deg`);
    el.dataset.running = speed > 25 ? '1' : '0';
    el.dataset.side = x > bounds.current.w - BUBBLE_WIDTH - 40 ? 'left' : 'right';
  }, []);

  const randomSpot = useCallback(() => {
    const { w, h } = bounds.current;
    return clampPoint(Math.random() * w, Math.random() * h);
  }, [clampPoint]);

  const speak = useCallback((text, tempMood = null, duration = 4000) => {
    clearTimeout(timers.current.speak);
    messageRef.current = text;
    setMessage(text);
    if (tempMood) setMood(tempMood);
    timers.current.speak = setTimeout(() => {
      messageRef.current = '';
      setMessage('');
      if (!dragging.current && !dancing.current) setMood('IDLE');
    }, duration);
  }, []);

  const stopDancing = useCallback(() => {
    clearTimeout(timers.current.dance);
    dancing.current = false;
    setIsDancing(false);
  }, []);

  const startDancing = useCallback(() => {
    if (dragging.current) return;
    clearTimeout(timers.current.dance);
    dancing.current = true;
    target.current = null;
    setIsDancing(true);
    speak(pick(PHRASES.dance), 'DANCE');
    timers.current.dance = setTimeout(() => {
      stopDancing();
      setMood('IDLE');
      nextWanderAt.current = performance.now() + 1500;
    }, 5000);
  }, [speak, stopDancing]);

  const triggerExplosion = useCallback(() => {
    const chars = ['|', '/', '\\', '-', 'o', '*', '+', '~', '#', '='];
    setParticles(Array.from({ length: 18 }, (_, i) => ({
      id: i,
      char: pick(chars),
      angle: (i / 18) * Math.PI * 2,
      dist: 30 + Math.random() * 50,
      color: pick(['#00ffff', '#3dffb8', '#ff6fd8', '#ffe45c', '#ffffff']),
    })));
    setExploding(true);
    speak('EXPLODE.exe executed!', 'DIZZY', 2500);
    clearTimeout(timers.current.explode);
    timers.current.explode = setTimeout(() => {
      setExploding(false);
      setParticles([]);
      speak('Reassembled. Nice try.', 'HAPPY', 2500);
    }, 2200);
  }, [speak]);

  // Track the roaming area; re-clamp when the screen resizes
  useEffect(() => {
    const el = botRef.current;
    const parent = el?.offsetParent;
    if (!parent) return;
    const measure = () => {
      bounds.current = { w: parent.clientWidth, h: parent.clientHeight };
      if (pos.current.x < 0) {
        pos.current = clampPoint(parent.clientWidth - 110, parent.clientHeight - 140);
      } else {
        pos.current = clampPoint(pos.current.x, pos.current.y);
      }
      if (target.current) target.current = clampPoint(target.current.x, target.current.y);
      applyTransform();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [applyTransform, clampPoint]);

  // Motion loop: steer toward a target, ease into arrival, idle, repeat
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    nextWanderAt.current = performance.now() + 2500;
    let raf;
    let last = performance.now();

    const step = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (bounds.current.w && !dragging.current) {
        if (!reducedMotion && !target.current && !dancing.current && now >= nextWanderAt.current) {
          target.current = randomSpot();
        }

        let desiredX = 0;
        let desiredY = 0;
        if (target.current && !dancing.current) {
          const dx = target.current.x - pos.current.x;
          const dy = target.current.y - pos.current.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 2) {
            target.current = null;
            nextWanderAt.current = now + 2500 + Math.random() * 4500;
          } else {
            const speed = Math.max(14, MAX_SPEED * Math.min(1, dist / ARRIVE_RADIUS));
            desiredX = (dx / dist) * speed;
            desiredY = (dy / dist) * speed;
          }
        }

        const blend = Math.min(1, dt * STEER);
        vel.current.x += (desiredX - vel.current.x) * blend;
        vel.current.y += (desiredY - vel.current.y) * blend;
        pos.current = clampPoint(pos.current.x + vel.current.x * dt, pos.current.y + vel.current.y * dt);
        applyTransform();
      }
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [applyTransform, clampPoint, randomSpot]);

  // External bot commands (terminal input, window buttons)
  useEffect(() => {
    const handleBotCommand = (e) => {
      const { type, text, mood: cmdMood } = e.detail;
      if (type === 'speak' && text) speak(text, cmdMood || 'HAPPY', 3500);
      else if (type === 'dance') startDancing();
    };
    window.addEventListener('botCommand', handleBotCommand);
    return () => window.removeEventListener('botCommand', handleBotCommand);
  }, [speak, startDancing]);

  // Greeting + periodic chatter
  useEffect(() => {
    const greet = setTimeout(() => speak('Welcome to my terminal! Feel free to look around.', 'HAPPY', 5000), 500);
    const chatter = setInterval(() => {
      if (messageRef.current || dragging.current || dancing.current || Math.random() < 0.6) return;
      if (Math.random() < 0.2) startDancing();
      else speak(pick(PHRASES.idle));
    }, TALK_INTERVAL);
    return () => {
      clearTimeout(greet);
      clearInterval(chatter);
    };
  }, [speak, startDancing]);

  // Clear every pending timer on unmount
  useEffect(() => {
    const pending = timers.current;
    return () => Object.values(pending).forEach(clearTimeout);
  }, []);

  // Type the speech bubble out character by character
  useEffect(() => {
    if (!message) {
      setTyped('');
      return;
    }
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setTyped(message.slice(0, i));
      if (i >= message.length) clearInterval(timer);
    }, 22);
    return () => clearInterval(timer);
  }, [message]);

  // Eyes follow the cursor — written straight to CSS vars, no re-render
  useEffect(() => {
    const handleLook = (e) => {
      const el = botRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 3);
      const dist = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, dist / 220);
      el.style.setProperty('--look-x', `${(dx / dist) * LOOK_RANGE * reach}px`);
      el.style.setProperty('--look-y', `${(dy / dist) * LOOK_RANGE * reach}px`);
    };
    window.addEventListener('pointermove', handleLook);
    return () => window.removeEventListener('pointermove', handleLook);
  }, []);

  // ── Pointer interaction (mouse + touch) ─────────────
  const handlePointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const el = botRef.current;
    const parent = el?.offsetParent;
    if (!parent) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);

    const rect = parent.getBoundingClientRect();
    drag.current = {
      offsetX: e.clientX - rect.left - pos.current.x,
      offsetY: e.clientY - rect.top - pos.current.y,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      exploded: false,
    };
    dragging.current = true;
    target.current = null;
    vel.current = { x: 0, y: 0 };
    stopDancing();
    setIsDragging(true);

    clearTimeout(timers.current.longPress);
    timers.current.longPress = setTimeout(() => {
      if (!drag.current.moved) {
        drag.current.exploded = true;
        triggerExplosion();
      }
    }, 900);
  };

  const handlePointerMove = (e) => {
    if (!dragging.current) return;
    const d = drag.current;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > DRAG_THRESHOLD) {
      d.moved = true;
      clearTimeout(timers.current.longPress);
      speak('Whoa!', 'DIZZY', 1500);
    }
    if (!d.moved) return;
    const rect = botRef.current.offsetParent.getBoundingClientRect();
    pos.current = clampPoint(e.clientX - rect.left - d.offsetX, e.clientY - rect.top - d.offsetY);
    applyTransform();
  };

  const handlePointerUp = () => {
    if (!dragging.current) return;
    clearTimeout(timers.current.longPress);
    dragging.current = false;
    setIsDragging(false);
    // stay where it was dropped for a moment before roaming again
    target.current = null;
    vel.current = { x: 0, y: 0 };
    nextWanderAt.current = performance.now() + 4000;

    const d = drag.current;
    if (d.exploded) return;
    if (d.moved) speak(pick(PHRASES.drag), 'HAPPY');
    else speak(pick(PHRASES.click), 'ANNOYED');
  };

  const handlePointerEnter = (e) => {
    if (e.pointerType !== 'mouse' || dragging.current || dancing.current) return;
    // pause so it can be caught, rather than fleeing
    target.current = null;
    nextWanderAt.current = performance.now() + 3000;
    speak(pick(PHRASES.hover), 'SURPRISED', 2500);
  };

  const classes = [
    'terminal-bot',
    isDancing && 'dancing',
    isDragging && 'dragging',
    exploding && 'exploding',
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={botRef}
      className={classes}
      style={{ '--bot-accent': MOODS[mood].color }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerEnter={handlePointerEnter}
      onDoubleClick={startDancing}
    >
      {exploding && particles.map(p => (
        <span
          key={p.id}
          className="bot-particle"
          style={{
            color: p.color,
            '--px': `${Math.cos(p.angle) * p.dist}px`,
            '--py': `${Math.sin(p.angle) * p.dist}px`,
          }}
        >
          {p.char}
        </span>
      ))}
      {message && (
        <div className="bot-bubble" role="status">
          <span className="bot-bubble-prompt">›</span>
          <span>{typed}</span>
          {typed.length < message.length && <span className="bot-bubble-caret" />}
        </div>
      )}
      <div className="bot-float">
        <div className="bot-character">
          <BotSprite mood={mood} uid={uid} />
        </div>
      </div>
    </div>
  );
};

export default TerminalBot;
