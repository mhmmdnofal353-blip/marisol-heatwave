// Procedural sound: every effect and the music loop are synthesised with
// WebAudio — no audio files. The engine and siren are continuous voices whose
// pitch and volume the game drives each frame; the rest are one-shot blips.

let ctx = null;
let master = null;
let muted = false;
let engineNodes = null;
let sirenNodes = null;
let musicTimer = null;
let musicStep = 0;

/** Create the context on the first user gesture; safe to call often. */
export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
}

/** Flip the mute and return the new state. */
export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

/** Whether sound is currently muted. */
export function isMuted() {
  return muted;
}

function env(gain, t0, peak, decay) {
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
}

function tone(freq, dur, type = 'sine', vol = 0.2, slideTo = null, delay = 0) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  env(gain, t0, vol, dur);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise(dur, vol = 0.3, freq = 1200, q = 0.8, delay = 0) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = ctx.createGain();
  env(gain, t0, vol, dur);
  src.connect(filter).connect(gain).connect(master);
  src.start(t0);
}

/** A pistol shot: a crack of noise over a low thump. */
export function sfxShot() {
  noise(0.09, 0.5, 2600, 0.6);
  tone(140, 0.08, 'square', 0.25, 60);
}

/** A bullet striking metal or flesh. */
export function sfxHit() {
  noise(0.05, 0.25, 900, 1.2);
}

/** A car body crumpling. */
export function sfxCrash(strength = 1) {
  noise(0.22, 0.35 * strength, 300, 0.5);
  tone(80, 0.2, 'triangle', 0.3 * strength, 40);
}

/** Tyres losing grip. */
export function sfxSkid(amount) {
  if (!ctx || amount <= 0.05) return;
  noise(0.08, 0.1 * amount, 1800, 2.5);
}

/** A car door and a seatbelt: entering or stealing a car. */
export function sfxDoor() {
  tone(220, 0.06, 'square', 0.12, 140);
  noise(0.05, 0.12, 700, 1, 0.05);
}

/** Cash register of the soul: a job paid out. */
export function sfxCash() {
  tone(880, 0.09, 'sine', 0.22);
  tone(1318, 0.14, 'sine', 0.22, null, 0.08);
}

/** A package picked up, a checkpoint crossed. */
export function sfxPickup() {
  tone(660, 0.07, 'triangle', 0.2);
  tone(990, 0.1, 'triangle', 0.2, null, 0.06);
}

/** Mission complete: a small major arpeggio. */
export function sfxMissionPass() {
  [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'triangle', 0.22, null, i * 0.09));
}

/** Mission failed: two falling notes. */
export function sfxMissionFail() {
  tone(392, 0.2, 'triangle', 0.22, 311);
  tone(311, 0.3, 'triangle', 0.22, 233, 0.18);
}

/** Busted or wasted sting. */
export function sfxSting() {
  tone(196, 0.5, 'sawtooth', 0.16, 98);
  noise(0.4, 0.12, 200, 0.6);
}

/** A nearby car horn. */
export function sfxHorn() {
  tone(370, 0.18, 'square', 0.08);
  tone(466, 0.18, 'square', 0.06, null, 0.01);
}

/** An explosion: filtered noise rolling off into a sub thump. */
export function sfxExplosion() {
  noise(0.7, 0.6, 160, 0.4);
  tone(60, 0.6, 'sine', 0.5, 30);
}

/** Start or stop the player's engine voice; `speed01` pitches it each frame. */
export function engine(on, speed01 = 0) {
  if (!ctx) return;
  if (on && !engineNodes) {
    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = 'sawtooth';
    sub.type = 'square';
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    gain.gain.value = 0.0;
    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain).connect(master);
    osc.start();
    sub.start();
    engineNodes = { osc, sub, gain, filter };
  }
  if (!on && engineNodes) {
    const nodes = engineNodes;
    engineNodes = null;
    nodes.gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
    setTimeout(() => {
      try {
        nodes.osc.stop();
        nodes.sub.stop();
      } catch { /* already stopped */ }
    }, 250);
    return;
  }
  if (engineNodes) {
    const f = 55 + speed01 * 165;
    engineNodes.osc.frequency.value = f;
    engineNodes.sub.frequency.value = f / 2;
    engineNodes.filter.frequency.value = 400 + speed01 * 1400;
    engineNodes.gain.gain.value = 0.05 + speed01 * 0.075;
  }
}

/** Drive the police siren voice: 0 silent, up to 1 loud. */
export function siren(level) {
  if (!ctx) return;
  if (level > 0.02 && !sirenNodes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 950;
    lfo.frequency.value = 0.65;
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain).connect(osc.frequency);
    gain.gain.value = 0;
    osc.connect(gain).connect(master);
    osc.start();
    lfo.start();
    sirenNodes = { osc, gain, lfo };
  }
  if (sirenNodes) {
    sirenNodes.gain.gain.value = level * 0.055;
    if (level <= 0.02) {
      const nodes = sirenNodes;
      sirenNodes = null;
      setTimeout(() => {
        try {
          nodes.osc.stop();
          nodes.lfo.stop();
        } catch { /* already stopped */ }
      }, 120);
    }
  }
}

/** The Marisol loop: a slow synthwave bass over warm pads, scheduled ahead. */
export function startMusic() {
  if (!ctx || musicTimer) return;
  const bass = [110, 110, 130.8, 98]; // A2 A2 C3 G2
  const pads = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 196, 246.9]];
  musicTimer = setInterval(() => {
    if (!ctx || muted) return;
    const bar = musicStep % 4;
    for (let i = 0; i < 4; i++) tone(bass[bar], 0.22, 'triangle', 0.16, null, i * 0.24);
    pads[bar].forEach((f) => tone(f, 0.95, 'sine', 0.045));
    musicStep += 1;
  }, 960);
}
