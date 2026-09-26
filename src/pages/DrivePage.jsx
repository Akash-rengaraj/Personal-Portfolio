import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { DriveEngine, FPS_OPTIONS, hasWebGL } from '../game/engine';
import { PAINTS } from '../game/carModel';
import { TERRAIN_OPTIONS } from '../game/biomes';
import { parseSeed, randomSeed } from '../game/rng';

const SETTINGS_KEY = 'zen-drive-settings';
const DEFAULT_SETTINGS = {
  paint: PAINTS[0].id, quality: 'auto', fps: 'auto', muted: false, music: true, transmission: 'auto', assists: 'full', terrain: 'mixed', pops: false,
};
const ASSIST_LABELS = { full: 'full', sport: 'sport', off: 'drift (off)' };
const QUALITY_NOTES = {
  low: '30 fps · short view · light trees, no clouds or shadows — for older laptops and phones',
  medium: '60 fps · clouds · mid view distance · detailed trees close by',
  high: '60 fps · far view · shadows, birds, ferns and logs — for gaming PCs',
};
const FPS_LABELS = { auto: 'auto', 30: '30', 60: '60', max: 'max' };

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* private mode: settings just won't persist */
  }
}

const paintHex = (id) => (PAINTS.find(p => p.id === id) ?? PAINTS[0]).hex;
const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches;
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const KEY_HELP = [
  ['W / ↑', 'accelerate'],
  ['S / ↓', 'brake · reverse'],
  ['A D / ← →', 'steer'],
  ['space', 'handbrake'],
  ['E / Q', 'shift up / down'],
  ['T', 'auto ⇄ manual gearbox'],
  ['B', 'pops & bangs'],
  ['Z', 'cruise (autopilot)'],
  ['C', 'camera'],
  ['P', 'photo mode'],
  ['R', 'back to the road'],
  ['M', 'mute'],
  ['esc', 'pause'],
];

/** Hold-to-press pad for touch controls. */
function TouchPad({ label, icon, onChange, className }) {
  const set = (on) => (e) => {
    e.preventDefault();
    if (on) e.currentTarget.setPointerCapture?.(e.pointerId);
    onChange(on);
  };
  return (
    <button
      type="button"
      className={`zd-pad ${className}`}
      aria-label={label}
      onPointerDown={set(true)}
      onPointerUp={set(false)}
      onPointerCancel={set(false)}
      onLostPointerCapture={set(false)}
      onContextMenu={e => e.preventDefault()}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}

function Compass({ heading }) {
  return (
    <div className="zd-compass" aria-hidden="true">
      <span className="zd-compass-needle" style={{ transform: `rotate(${heading}deg)` }}>▲</span>
    </div>
  );
}

/** Runs a HUD action, then hands keyboard focus straight back to the game. */
const hudClick = (fn) => (e) => {
  e.currentTarget.blur();
  fn();
};

function Hud({ stats, onPause, onCamera, onMute, touch, notice }) {
  return (
    <div className="zd-hud">
      {notice && <div className="zd-notice" role="status">{notice}</div>}
      <div className="zd-hud-top">
        <div className="zd-chip">
          <span className="zd-prompt">$</span> zen-drive <span className="zd-dim">--seed {stats.seed}</span>
        </div>
        <div className="zd-hud-actions">
          <button type="button" className="zd-icon-btn" onClick={hudClick(onCamera)} aria-label={`Camera: ${stats.camera}. Switch camera`}>
            <i className="fa-solid fa-video" aria-hidden="true" />
          </button>
          <button type="button" className="zd-icon-btn" onClick={hudClick(onMute)} aria-label={stats.muted ? 'Unmute' : 'Mute'}>
            <i className={`fa-solid ${stats.muted ? 'fa-volume-xmark' : 'fa-volume-low'}`} aria-hidden="true" />
          </button>
          <button type="button" className="zd-icon-btn" onClick={hudClick(onPause)} aria-label="Pause menu">
            <i className="fa-solid fa-pause" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="zd-hud-place">
        <span>{stats.biome}</span>
        <span className="zd-dim">· {stats.time}</span>
      </div>

      <div className={`zd-dash ${touch ? 'is-touch' : ''}`}>
        <div className="zd-tach" aria-hidden="true">
          <span className="zd-tach-fill" style={{ transform: `scaleX(${Math.min(1, stats.rpmNorm)})` }} />
          <span className="zd-tach-red" />
        </div>
        <Compass heading={stats.heading} />
        <div className="zd-speed">
          <span className="zd-speed-value">{String(stats.speed).padStart(3, '\u2007')}</span>
          <span className="zd-speed-unit">km/h</span>
        </div>
        <div className="zd-dash-side">
          <span className={`zd-gear ${stats.shiftLight ? 'is-shift' : ''}`}>{stats.gear}</span>
          <span className="zd-dim">{stats.transmission === 'auto' ? 'auto' : 'manual'}</span>
        </div>
        <div className="zd-dash-side zd-dash-rpm">
          <span>{String(stats.rpm).padStart(4, '\u2007')}</span>
          <span className="zd-dim">rpm · {stats.distance.toFixed(1)} km</span>
        </div>
      </div>
      {stats.drifting && <div className="zd-drift" aria-hidden="true">drift</div>}

      {stats.cruise && (
        <div className={`zd-cruise ${touch ? 'is-touch' : ''}`} role="status">
          <i className="fa-solid fa-gauge-simple" aria-hidden="true" /> cruise {stats.cruiseSpeed} km/h
          {!touch && <span className="zd-dim"> · W/S adjust · Z off</span>}
        </div>
      )}
      {stats.offRoad && (
        <div className={`zd-toast ${touch ? 'is-touch' : ''}`} role="status">
          lost? {touch ? 'tap ⟲ in the menu' : 'press R'} to return to the road
        </div>
      )}
      {stats.debug && (
        <pre className="zd-debug">
          {`fps ${stats.debug.fps}  calls ${stats.debug.calls}  tris ${stats.debug.triangles}\nchunks ${stats.debug.chunks}  queue ${stats.debug.queue}  q ${stats.quality}`}
        </pre>
      )}
    </div>
  );
}

function Intro({ seed, touch, onStart }) {
  const buttonRef = useRef(null);
  useEffect(() => {
    buttonRef.current?.focus();
  }, []);
  return (
    <div className="zd-intro" role="dialog" aria-modal="true" aria-labelledby="zd-title">
      <div className="zd-intro-card">
        <p className="zd-line"><span className="zd-prompt">$</span> ./zen-drive --seed {seed}</p>
        <p className="zd-line zd-dim">generating endless road… ok</p>
        <p className="zd-line zd-dim">planting forests… ok</p>
        <h1 id="zd-title" className="zd-title">zen drive</h1>
        <p className="zd-lede">No timer, no score, no crashes. A 600 km/h GT car with real tyre physics, an endless winding road and the sunset. Drive as long as you like.</p>
        {touch ? (
          <ul className="zd-keys zd-keys-touch">
            <li><kbd>◀ ▶</kbd> steer</li>
            <li><kbd>■</kbd> brake</li>
            <li><kbd>≋</kbd> drift</li>
            <li>cruise is on — the car keeps its lane until you steer</li>
          </ul>
        ) : (
          <ul className="zd-keys">
            {KEY_HELP.slice(0, 6).map(([key, what]) => <li key={key}><kbd>{key}</kbd> {what}</li>)}
          </ul>
        )}
        <button ref={buttonRef} type="button" className="zd-start" onClick={onStart}>
          [ {touch ? 'tap' : 'press enter'} to drive ]
        </button>
        <Link to="/" className="zd-back">← back to portfolio</Link>
      </div>
    </div>
  );
}

/** Row of toggle buttons for a single choice. */
function Segmented({ options, value, onChange, labels = {}, wrap = false }) {
  return (
    <div className={`zd-segmented ${wrap ? 'is-wrap' : ''}`}>
      {options.map(option => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          className={value === option ? 'is-active' : ''}
          onClick={() => onChange(option)}
        >
          {labels[option] ?? option}
        </button>
      ))}
    </div>
  );
}

function PauseMenu({ stats, settings, touch, tilt, onResume, onNewRoad, onReset, onSetting, onTilt, onCopy, copied }) {
  const firstRef = useRef(null);
  useEffect(() => {
    firstRef.current?.focus();
  }, []);
  return (
    <div className="zd-menu-backdrop">
      <div className="zd-menu" role="dialog" aria-modal="true" aria-labelledby="zd-menu-title">
        <h2 id="zd-menu-title" className="zd-menu-title"><span className="zd-prompt">$</span> paused</h2>
        <div className="zd-menu-actions">
          <button ref={firstRef} type="button" className="zd-menu-btn is-primary" onClick={onResume}>▶ resume</button>
          <button type="button" className="zd-menu-btn" onClick={onReset}>⟲ back to the road</button>
          <button type="button" className="zd-menu-btn" onClick={onNewRoad}>✦ new random road</button>
          <button type="button" className="zd-menu-btn" onClick={onCopy}>{copied ? '✓ link copied' : '⧉ share this road'}</button>
        </div>

        <fieldset className="zd-field">
          <legend>paint</legend>
          <div className="zd-swatches">
            {PAINTS.map(p => (
              <button
                key={p.id}
                type="button"
                className={`zd-swatch ${settings.paint === p.id ? 'is-active' : ''}`}
                style={{ '--swatch': `#${p.hex.toString(16).padStart(6, '0')}` }}
                aria-label={p.label}
                aria-pressed={settings.paint === p.id}
                onClick={() => onSetting('paint', p.id)}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="zd-field">
          <legend>gearbox</legend>
          <Segmented options={['auto', 'manual']} value={stats.transmission} onChange={v => onSetting('transmission', v)} />
          <p className="zd-note">{touch ? 'manual: use the + / − buttons' : 'E / Q shift up and down · T switches'}</p>
        </fieldset>

        <fieldset className="zd-field">
          <legend>driving assists</legend>
          <Segmented options={['full', 'sport', 'off']} labels={ASSIST_LABELS} value={settings.assists} onChange={v => onSetting('assists', v)} />
          <p className="zd-note">
            {settings.assists === 'full' && 'traction control, ABS and stability control on'}
            {settings.assists === 'sport' && 'ABS only — the rear steps out under power'}
            {settings.assists === 'off' && 'no assists: throttle and handbrake drifts are all you'}
          </p>
        </fieldset>

        <fieldset className="zd-field">
          <legend>terrain</legend>
          <Segmented options={TERRAIN_OPTIONS.map(t => t.id)} value={settings.terrain} onChange={v => onSetting('terrain', v)} wrap />
          <p className="zd-note">{settings.terrain === 'mixed' ? 'changes every 1.5 km as you drive' : 'this landscape everywhere'}</p>
        </fieldset>

        <fieldset className="zd-field">
          <legend>graphics</legend>
          <Segmented options={['auto', 'low', 'medium', 'high']} value={settings.quality} onChange={v => onSetting('quality', v)} />
          {settings.quality === 'auto' && (
            <p className="zd-note">
              auto picked <strong>{stats.quality}</strong> — {[stats.detected?.gpu, stats.detected?.reason].filter(Boolean).join(', ')}
              {stats.detected?.tier !== stats.quality && ' · stepped down to keep it smooth'}
            </p>
          )}
          <p className="zd-note">{QUALITY_NOTES[stats.quality]}</p>
        </fieldset>

        <fieldset className="zd-field">
          <legend>frame rate</legend>
          <Segmented options={FPS_OPTIONS} labels={FPS_LABELS} value={settings.fps} onChange={v => onSetting('fps', v)} />
          <p className="zd-note">
            ~{stats.fpsCap} fps on this {stats.refreshHz} Hz screen
            {settings.fps === 'max' ? ' · uses the most battery and CPU' : ' · lower caps save battery and CPU'}
          </p>
        </fieldset>

        <fieldset className="zd-field zd-toggles">
          <legend>sound</legend>
          <label><input type="checkbox" checked={!settings.muted} onChange={e => onSetting('muted', !e.target.checked)} /> sound effects</label>
          <label><input type="checkbox" checked={settings.music} onChange={e => onSetting('music', e.target.checked)} /> ambient music</label>
          <label><input type="checkbox" checked={settings.pops} onChange={e => onSetting('pops', e.target.checked)} /> pops &amp; bangs{touch ? '' : ' (B)'}</label>
          {touch && <label><input type="checkbox" checked={tilt} onChange={e => onTilt(e.target.checked)} /> tilt to steer</label>}
        </fieldset>

        {!touch && (
          <details className="zd-help">
            <summary>controls</summary>
            <ul className="zd-keys">
              {KEY_HELP.map(([key, what]) => <li key={key}><kbd>{key}</kbd> {what}</li>)}
              <li><kbd>gamepad</kbd> stick · RT / LT · A drift</li>
            </ul>
          </details>
        )}
        <p className="zd-note">seed {stats.seed} · {stats.distance.toFixed(1)} km driven</p>
        <Link to="/" className="zd-back">← back to portfolio</Link>
      </div>
    </div>
  );
}

/** /drive — a relaxing endless drive (three.js engine in src/game). */
function DrivePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSeed = parseSeed(searchParams.get('seed'));
  const [seed, setSeed] = useState(() => urlSeed ?? randomSeed());
  const [settings, setSettings] = useState(loadSettings);
  const [stats, setStats] = useState(null);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [photo, setPhoto] = useState(false);
  const [flash, setFlash] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tilt, setTilt] = useState(false);
  const [webgl] = useState(hasWebGL);
  const [engineFailed, setEngineFailed] = useState(false);
  const [notice, setNotice] = useState('');
  const noticeTimer = useRef(0);
  const [touch] = useState(isTouchDevice);
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const stateRef = useRef({ started, paused, photo });
  stateRef.current = { started, paused, photo };
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // keep the seed in the URL so the road can be shared
  useEffect(() => {
    if (urlSeed === seed) return;
    // keep any other parameters (e.g. ?debug) when the road changes
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      next.set('seed', String(seed));
      return next;
    }, { replace: true });
  }, [seed, urlSeed, setSearchParams]);

  const showNotice = useCallback((text) => {
    setNotice(text);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(''), 1800);
  }, []);

  const handleAction = useCallback((action) => {
    const engine = engineRef.current;
    const s = stateRef.current;
    if (!engine) return;
    if (action === 'pause') {
      if (!s.started) return;
      if (s.photo) {
        setPhoto(false);
        engine.setPhoto(false);
      } else if (s.paused) {
        setPaused(false);
        engine.resume();
      } else {
        setPaused(true);
        engine.pause();
      }
    } else if (action === 'photo') {
      if (!s.started || s.paused) return;
      const next = !s.photo;
      setPhoto(next);
      engine.setPhoto(next);
    } else if (action === 'reset-flash') {
      setFlash(true);
      window.setTimeout(() => setFlash(false), 450);
    } else if (action === 'over-rev') {
      showNotice('way too fast for that gear — the engine would burst');
    } else if (action === 'transmission-changed' || action === 'mute-changed' || action === 'pops-changed') {
      const next = { ...settingsRef.current, transmission: engine.vehicle.transmission, muted: engine.audio.muted, pops: engine.crackle };
      setSettings(next);
      saveSettings(next);
      if (action === 'pops-changed') showNotice(engine.crackle ? 'pops & bangs on — lift off at high revs' : 'pops & bangs off');
    }
  }, [showNotice]);

  useEffect(() => {
    if (!webgl || !canvasRef.current) return undefined;
    const current = settingsRef.current;
    let engine;
    try {
      engine = new DriveEngine({
        canvas: canvasRef.current,
        seed,
        paint: paintHex(current.paint),
        quality: current.quality,
        fps: current.fps,
        touch,
        reducedMotion: prefersReducedMotion(),
        muted: current.muted,
        music: current.music,
        terrain: current.terrain,
        transmission: current.transmission,
        assists: current.assists,
        pops: current.pops,
        onStats: setStats,
        onAction: handleAction,
      });
    } catch (err) {
      console.warn('zen drive failed to start:', err);
      setEngineFailed(true);
      return undefined;
    }
    setEngineFailed(false);
    engineRef.current = engine;
    if (stateRef.current.started) engine.start();
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // a new terrain regenerates the world, like a new seed
  }, [seed, settings.terrain, webgl, touch, handleAction]);

  // Enter / Space starts the drive from the intro
  useEffect(() => {
    if (started) return undefined;
    const onKey = (e) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        begin();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function begin() {
    setStarted(true);
    engineRef.current?.start();
    canvasRef.current?.focus({ preventScroll: true });
  }

  const updateSetting = (key, value) => {
    const next = { ...settingsRef.current, [key]: value };
    setSettings(next);
    saveSettings(next);
    const engine = engineRef.current;
    if (!engine) return;
    if (key === 'paint') engine.setPaint(paintHex(value));
    if (key === 'quality') engine.setQuality(value);
    if (key === 'fps') engine.setFps(value);
    if (key === 'muted') engine.setMuted(value);
    if (key === 'music') engine.setMusic(value);
    if (key === 'transmission') engine.setTransmission(value);
    if (key === 'assists') engine.setAssists(value);
    if (key === 'pops') engine.setPops(value);
    if (key === 'terrain') setPaused(false);
  };

  const resume = () => {
    setPaused(false);
    engineRef.current?.resume();
    canvasRef.current?.focus({ preventScroll: true });
  };

  const newRoad = () => {
    setPaused(false);
    setSeed(randomSeed());
  };

  const resetToRoad = () => {
    engineRef.current?.resetToRoad();
    resume();
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/drive?seed=${seed}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copy this link', `${window.location.origin}/drive?seed=${seed}`);
    }
  };

  const toggleTilt = async (on) => {
    const ok = await engineRef.current?.setTilt(on);
    setTilt(Boolean(on && ok));
  };

  const savePhoto = async () => {
    const blob = await engineRef.current?.capture();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zen-drive-${seed}.png`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const touchSet = (key) => (on) => engineRef.current?.setTouch({ [key]: on });

  return (
    <div className={`zd-page ${photo ? 'is-photo' : ''}`}>
      <Helmet>
        <title>Zen Drive — a relaxing endless drive · akashr.dev</title>
        <meta name="description" content="A 3D driving game in the browser: a GT-style sports car with real tyre physics and a 6-speed gearbox, endless procedural roads, six terrains, day and night. Built with three.js by Akash Rengaraj." />
      </Helmet>

      {/* a fresh canvas per road: the old engine force-loses its WebGL context on dispose */}
      <canvas
        key={`${seed}-${settings.terrain}`}
        ref={canvasRef}
        className="zd-canvas"
        aria-label="Zen Drive: a 3D car on an endless winding road"
        tabIndex={-1}
      />
      <p className="visually-hidden">
        A relaxing driving game. Use W, A, S and D or the arrow keys to drive, Z for cruise control and Escape to pause.
      </p>

      {webgl && engineFailed && (
        <div className="zd-intro">
          <div className="zd-intro-card">
            <p className="zd-line"><span className="zd-prompt">$</span> ./zen-drive --seed {seed}</p>
            <p className="zd-line zd-error">error: couldn&apos;t start the 3D renderer.</p>
            <p className="zd-lede">The graphics context was busy or lost. Reloading usually fixes it.</p>
            <button type="button" className="zd-start" onClick={() => window.location.reload()}>[ reload ]</button>
            <Link to="/" className="zd-back">← back to portfolio</Link>
          </div>
        </div>
      )}

      {!webgl && (
        <div className="zd-intro">
          <div className="zd-intro-card">
            <p className="zd-line"><span className="zd-prompt">$</span> ./zen-drive</p>
            <p className="zd-line zd-error">error: WebGL isn&apos;t available in this browser.</p>
            <p className="zd-lede">Try a recent Chrome, Firefox, Safari or Edge with hardware acceleration switched on.</p>
            <Link to="/" className="zd-back">← back to portfolio</Link>
          </div>
        </div>
      )}

      {webgl && !engineFailed && !started && <Intro seed={seed} touch={touch} onStart={begin} />}

      {webgl && started && stats && !photo && (
        <Hud
          stats={stats}
          touch={touch}
          onPause={() => handleAction('pause')}
          onCamera={() => engineRef.current?.handleAction('camera')}
          onMute={() => updateSetting('muted', !settings.muted)}
          notice={notice}
        />
      )}

      {webgl && started && touch && !paused && !photo && (
        <div className="zd-touch">
          <div className="zd-touch-left">
            <TouchPad label="Steer left" icon="◀" className="zd-pad-steer" onChange={touchSet('left')} />
            <TouchPad label="Steer right" icon="▶" className="zd-pad-steer" onChange={touchSet('right')} />
          </div>
          <div className="zd-touch-right">
            <TouchPad label="Drift" icon="≋" className="zd-pad-drift" onChange={touchSet('handbrake')} />
            <TouchPad label="Brake" icon="■" className="zd-pad-brake" onChange={touchSet('brake')} />
            {stats?.transmission === 'manual' && (
              <div className="zd-shift-pads">
                <button type="button" className="zd-pad zd-pad-shift" aria-label="Shift up" onClick={() => engineRef.current?.handleAction('shiftUp')}>+</button>
                <button type="button" className="zd-pad zd-pad-shift" aria-label="Shift down" onClick={() => engineRef.current?.handleAction('shiftDown')}>−</button>
              </div>
            )}
            <button type="button" className="zd-pad zd-pad-pops" aria-pressed={Boolean(stats?.pops)} aria-label="Pops and bangs" onClick={() => engineRef.current?.handleAction('pops')}>
              <span aria-hidden="true">✹</span>
            </button>
            <button type="button" className="zd-pad zd-pad-cruise" aria-pressed={stats?.cruise} onClick={() => engineRef.current?.handleAction('cruise')}>
              {stats?.cruise ? 'auto' : 'manual'}
            </button>
          </div>
        </div>
      )}

      {photo && (
        <div className="zd-photo-bar">
          <span className="zd-dim">photo mode</span>
          <button type="button" className="zd-menu-btn" onClick={() => engineRef.current?.handleAction('camera')}>camera</button>
          <button type="button" className="zd-menu-btn is-primary" onClick={savePhoto}>save png</button>
          <button type="button" className="zd-menu-btn" onClick={() => handleAction('photo')}>done</button>
        </div>
      )}

      {paused && stats && (
        <PauseMenu
          stats={stats}
          settings={settings}
          touch={touch}
          tilt={tilt}
          copied={copied}
          onResume={resume}
          onNewRoad={newRoad}
          onReset={resetToRoad}
          onSetting={updateSetting}
          onTilt={toggleTilt}
          onCopy={copyLink}
        />
      )}

      <div className={`zd-flash ${flash ? 'is-on' : ''}`} aria-hidden="true" />
    </div>
  );
}

export default DrivePage;
