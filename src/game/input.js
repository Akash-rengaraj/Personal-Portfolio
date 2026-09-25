/**
 * Merges keyboard, gamepad, on-screen touch pads and optional tilt steering
 * into one driving input: { throttle, brake, steer (-1 left … +1 right), handbrake }.
 * One-shot actions (camera, cruise, pause…) are reported through `onAction`.
 */
const KEY_ACTIONS = {
  KeyC: 'camera',
  KeyZ: 'cruise',
  KeyP: 'photo',
  KeyM: 'mute',
  KeyR: 'reset',
  Escape: 'pause',
  KeyH: 'help',
};

const DRIVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

/* Gamepad buttons (standard mapping) → actions, fired on press */
const PAD_ACTIONS = { 3: 'camera', 2: 'cruise', 9: 'pause', 8: 'photo' };

export class DriveInput {
  constructor({ onAction, target = window }) {
    this.onAction = onAction;
    this.target = target;
    this.keys = new Set();
    this.touch = { left: false, right: false, brake: false, handbrake: false, gas: false };
    this.autoThrottle = false;
    this.tilt = null;
    this.padPressed = new Set();
    this.state = { throttle: 0, brake: 0, steer: 0, handbrake: false, manual: false };

    this.handleKeyDown = (e) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, button')) {
        if (e.code !== 'Escape') return;
      }
      if (DRIVE_KEYS.has(e.code)) {
        e.preventDefault();
        this.keys.add(e.code);
      }
      const action = KEY_ACTIONS[e.code];
      if (action && !e.repeat) {
        e.preventDefault();
        this.onAction(action);
      }
    };
    this.handleKeyUp = (e) => this.keys.delete(e.code);
    this.handleBlur = () => this.keys.clear();
    this.handleOrientation = (e) => {
      if (this.tilt === null || e.gamma === null) return;
      // in landscape the steering-wheel tilt shows up on beta instead of gamma
      const rotation = screen.orientation?.angle ?? window.orientation ?? 0;
      const tilt = rotation === 90 ? e.beta : rotation === 270 || rotation === -90 ? -e.beta : e.gamma;
      this.tilt = Math.max(-1, Math.min(1, tilt / 28));
    };

    target.addEventListener('keydown', this.handleKeyDown);
    target.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
  }

  /** Enables tilt steering; iOS asks for permission first. Returns whether it worked. */
  async enableTilt() {
    try {
      const Orientation = window.DeviceOrientationEvent;
      if (!Orientation) return false;
      if (typeof Orientation.requestPermission === 'function') {
        const result = await Orientation.requestPermission();
        if (result !== 'granted') return false;
      }
      this.tilt = 0;
      window.addEventListener('deviceorientation', this.handleOrientation);
      return true;
    } catch {
      return false;
    }
  }

  disableTilt() {
    this.tilt = null;
    window.removeEventListener('deviceorientation', this.handleOrientation);
  }

  setTouch(partial) {
    Object.assign(this.touch, partial);
  }

  /** Reads all devices into `this.state` (call once per simulation step batch). */
  read() {
    const k = this.keys;
    const t = this.touch;
    let throttle = k.has('KeyW') || k.has('ArrowUp') || t.gas ? 1 : 0;
    let brake = k.has('KeyS') || k.has('ArrowDown') || t.brake ? 1 : 0;
    let steer = (k.has('KeyD') || k.has('ArrowRight') || t.right ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') || t.left ? 1 : 0);
    let handbrake = k.has('Space') || t.handbrake;

    if (this.tilt !== null && steer === 0) steer = this.tilt;

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad || pad.mapping !== 'standard') continue;
      const stick = pad.axes[0] ?? 0;
      if (Math.abs(stick) > 0.12) steer = Math.sign(stick) * ((Math.abs(stick) - 0.12) / 0.88);
      throttle = Math.max(throttle, pad.buttons[7]?.value ?? 0);
      brake = Math.max(brake, pad.buttons[6]?.value ?? 0);
      handbrake = handbrake || Boolean(pad.buttons[0]?.pressed);
      for (const [index, action] of Object.entries(PAD_ACTIONS)) {
        const pressed = Boolean(pad.buttons[index]?.pressed);
        const id = `${pad.index}:${index}`;
        if (pressed && !this.padPressed.has(id)) this.onAction(action);
        if (pressed) this.padPressed.add(id);
        else this.padPressed.delete(id);
      }
    }

    const manual = throttle > 0 || brake > 0 || steer !== 0 || handbrake;
    if (this.autoThrottle && brake === 0) throttle = Math.max(throttle, 1);

    const s = this.state;
    s.throttle = throttle;
    s.brake = brake;
    s.steer = Math.max(-1, Math.min(1, steer));
    s.handbrake = handbrake;
    s.manual = manual;
    s.manualSteer = steer !== 0;
    return s;
  }

  dispose() {
    this.target.removeEventListener('keydown', this.handleKeyDown);
    this.target.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    this.disableTilt();
  }
}
