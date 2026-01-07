import React, { useState, useEffect, useRef } from 'react';

const TALK_INTERVAL = 5000;
const MOVEMENT_SPEED = 2; // Faster!

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
  IDLE: { eyes: "[ o_o ]", color: "#00ff00" },
  HAPPY: { eyes: "[ ^_^ ]", color: "#00ffff" },
  ANNOYED: { eyes: "[ >_< ]", color: "#ff9900" },
  SURPRISED: { eyes: "[ O_O ]", color: "#ff00ff" },
  DIZZY: { eyes: "[ @_@ ]", color: "#ff3333" },
  DANCE: { eyes: "[ ~_~ ]", color: "#ffff00" }
};

const TerminalBot = () => {
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [target, setTarget] = useState(null);
  
  // States
  const [isDragging, setIsDragging] = useState(false);
  const [mood, setMood] = useState('IDLE');
  const [message, setMessage] = useState('');
  const [direction, setDirection] = useState(1); 
  const [isDancing, setIsDancing] = useState(false);

  // Refs
  const dragOffset = useRef({ x: 0, y: 0 });
  const botRef = useRef(null);
  const containerSize = useRef({ w: 0, h: 0 });

  // Initialize and track container size
  useEffect(() => {
    const updateContainerSize = () => {
      if (botRef.current && botRef.current.offsetParent) {
        const parent = botRef.current.offsetParent;
        containerSize.current = {
          w: parent.clientWidth,
          h: parent.clientHeight
        };
        // Initial positioning
        if (pos.x === 50 && pos.y === 50) {
            setPos({ 
                x: parent.clientWidth / 2 - 20, 
                y: parent.clientHeight - 100 
            });
        }
      }
    };

    updateContainerSize();
    window.addEventListener('resize', updateContainerSize);
    return () => window.removeEventListener('resize', updateContainerSize);
  }, []);

  // 1. Random Wandering Logic
  useEffect(() => {
    if (isDragging || isDancing) return;

    const moveInterval = setInterval(() => {
        if (!containerSize.current.w) return;

      if (!target) {
        // Pick a new target occasionally
        if (Math.random() < 0.03) {
          const padding = 50;
          const w = containerSize.current.w;
          const h = containerSize.current.h;
          
          const newX = Math.max(padding, Math.min(w - padding, Math.random() * w));
          const newY = Math.max(padding, Math.min(h - 120, Math.random() * h)); // Increased bottom padding
          
          setTarget({ x: newX, y: newY });
          setDirection(newX > pos.x ? 1 : -1);
        }
        return;
      }

      // Move towards target
      setPos(current => {
        const dx = target.x - current.x;
        const dy = target.y - current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < MOVEMENT_SPEED) {
          setTarget(null); 
          return target;
        }

        const angle = Math.atan2(dy, dx);
        let nextX = current.x + Math.cos(angle) * MOVEMENT_SPEED;
        let nextY = current.y + Math.sin(angle) * MOVEMENT_SPEED;

        // Hard Constraints
        nextX = Math.max(0, Math.min(containerSize.current.w - 40, nextX));
        nextY = Math.max(0, Math.min(containerSize.current.h - 120, nextY)); // Increased bottom padding

        return { x: nextX, y: nextY };
      });

    }, 20);

    return () => clearInterval(moveInterval);
  }, [target, isDragging, isDancing]);

  // 2. Dragging Logic
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging && botRef.current.offsetParent) {
        const parentRect = botRef.current.offsetParent.getBoundingClientRect();
        
        let newX = e.clientX - parentRect.left - dragOffset.current.x;
        let newY = e.clientY - parentRect.top - dragOffset.current.y;
        
        newX = Math.max(0, Math.min(containerSize.current.w - 40, newX));
        newY = Math.max(0, Math.min(containerSize.current.h - 120, newY)); // Increased bottom padding

        setPos({ x: newX, y: newY });
        setMood('DIZZY');
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        setMood('IDLE');
        speak(PHRASES.drag[Math.floor(Math.random() * PHRASES.drag.length)]);
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // 3. Talking Logic
  const speak = (text, tempMood = null, duration = 4000) => {
    setMessage(text);
    if (tempMood) setMood(tempMood);
    
    setTimeout(() => {
      setMessage('');
      if (!isDragging && !isDancing) setMood('IDLE');
    }, duration);
  };
  
  // Initial Greeting
  useEffect(() => {
      // Small delay to ensure render
      const timer = setTimeout(() => {
          speak("Welcome to my terminal! Feel free to look around.", "HAPPY", 5000);
      }, 500);
      return () => clearTimeout(timer);
  }, []);

  // Periodic random chatter & Dance
  useEffect(() => {
    const talkTimer = setInterval(() => {
      // Allow talking even if dragging, but prioritize drag phrases
      if (!message && (isDragging || Math.random() > 0.6)) {
        if (isDragging) {
           speak(PHRASES.drag[Math.floor(Math.random() * PHRASES.drag.length)], 'DIZZY');
        } else if (Math.random() < 0.2) { 
           // Random dance chance if not dragging
           startDancing();
        } else {
           speak(PHRASES.idle[Math.floor(Math.random() * PHRASES.idle.length)]);
        }
      }
    }, TALK_INTERVAL);
    return () => clearInterval(talkTimer);
  }, [isDragging, message, isDancing]);

  const startDancing = () => {
      if (isDragging) return; // Don't dance if being dragged
      setIsDancing(true);
      setMood('DANCE');
      speak(PHRASES.dance[Math.floor(Math.random() * PHRASES.dance.length)], 'DANCE');
      setTimeout(() => {
          setIsDancing(false);
          setMood('IDLE');
      }, 5000);
  };


  // Interaction Handlers
  const handleMouseDown = (e) => {
    e.preventDefault(); 
    setIsDragging(true);
    setIsDancing(false); 
    const botRect = botRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - botRect.left,
      y: e.clientY - botRect.top
    };
    speak("Whoa!", "SURPRISED");
  };

  const handleMouseEnter = () => {
    if (!isDragging && !isDancing) {
      setMood('SURPRISED');
      if(!target && containerSize.current.w > 0) {
          const w = containerSize.current.w;
          const h = containerSize.current.h;
          setTarget({
            x: Math.max(50, Math.min(w - 50, pos.x + (Math.random() - 0.5) * 400)), 
            y: Math.max(50, Math.min(h - 50, pos.y + (Math.random() - 0.5) * 400))
          });
      }
      speak(PHRASES.hover[Math.floor(Math.random() * PHRASES.hover.length)]);
    }
  };

  const handleClick = (e) => {
    e.stopPropagation(); 
    if (!isDragging) {
      speak(PHRASES.click[Math.floor(Math.random() * PHRASES.click.length)], 'ANNOYED');
      setIsDancing(false); 
    }
  };

  // Determine classes and animation frame
  const isRunning = target && !isDragging && !isDancing;
  const classes = `terminal-bot advanced ${isRunning ? 'running' : ''} ${isDancing ? 'dancing' : ''}`;
  
  // Improved 4-frame walk cycle (100ms per frame)
  // 0: / \  (Open)
  // 1: | \  (Right Step)
  // 2: | |  (Closed - Mid)
  // 3: / |  (Left Step)
  const legFrame = Math.floor(Date.now() / 100) % 4;
  let legs = ' / \\';
  
  if (isDragging) {
      legs = ' / \\'; // Dangle legs
  } else if (isRunning) {
      if (legFrame === 0) legs = ' / \\';
      if (legFrame === 1) legs = ' | \\';
      if (legFrame === 2) legs = ' | |'; // Feet together
      if (legFrame === 3) legs = ' / |';
  }

  return (
    <div 
      ref={botRef}
      className={classes}
      style={{ 
        left: pos.x, 
        top: pos.y, 
        color: MOODS[mood].color,
        position: 'absolute', 
        cursor: isDragging ? 'grabbing' : 'grab',
        zIndex: 50
      }}
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      onClick={handleClick}
      onDoubleClick={startDancing}
    >
      {message && (
        <div className="bot-bubble" style={{ borderColor: MOODS[mood].color, color: MOODS[mood].color }}>
          {message}
        </div>
      )}
      <div className={`bot-character ${direction === -1 ? 'facing-left' : ''}`}>
        <div className="bot-head">
          <span className="antenna">|</span>
          <span className="eyes">{MOODS[mood].eyes}</span>
        </div>
        <div className="bot-body">
           /|\
        </div>
        <div className="bot-legs">
           {legs}
        </div>
      </div>
    </div>
  );
};

export default TerminalBot;
