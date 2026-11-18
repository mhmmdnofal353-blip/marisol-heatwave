// audio.js — all of Marisol Heatwave's sound, synthesised with WebAudio.
// There are no audio files: one-shot effects are little envelopes of tone
// and filtered noise, the engine and the police siren are standing voices
// whose pitch and volume the game drives every frame, and the music is a
// slow synthwave loop scheduled bar by bar. Nothing sounds until the first
// user gesture creates the context, as browsers require.

let actx = null;
let bus = null;
let isMutedNow = false;
let engineVoice = null;
let sirenVoice = null;
let musicTimer = null;
let musicBar = 0;

/** Create (or resume) the audio context. Safe to call on every gesture. */
export function initAudio() {
  if (actx) {
    if (actx.state === 'suspended') actx.resume();
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    actx = new AC();
    bus = actx.createGain();
    bus.gain.value = isMutedNow ? 0 : 0.5;
    bus.connect(actx.destination);
  } catch {
    actx = null;
  }
}

/** Flip the mute switch; returns the new muted state. */
export function toggleMute() {
  isMutedNow = !isMutedNow;
  if (bus) bus.gain.value = isMutedNow ? 0 : 0.5;
  return isMutedNow;
}

/** Whether the game is currently muted. */
export function isMuted() {
  return isMutedNow;
}

/** A quick attack-and-decay envelope on a gain node. */
function envelope(gain, start, peak, seconds) {
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
}

/** One oscillator blip, optionally sliding to a second frequency. */
function tone(freq, seconds, type = 'sine', volume = 0.2, slideTo = null, delay = 0) {
  if (!actx) return;
  const start = actx.currentTime + delay;
  const osc = actx.createOscillator();
  const gain = actx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + seconds);
  envelope(gain, start, volume, seconds);
  osc.connect(gain);
  gain.connect(bus);
  osc.start(start);
  osc.stop(start + seconds + 0.05);
}

/** One burst of band-passed noise: shots, crashes, skids, explosions. */
function noise(seconds, volume = 0.3, centre = 1200, q = 0.8, delay = 0) {
  if (!actx) return;
  const start = actx.currentTime + delay;
  const length = Math.max(1, Math.floor(actx.sampleRate * seconds));
  const buffer = actx.createBuffer(1, length, actx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = actx.createBufferSource();
  source.buffer = buffer;
  const filter = actx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = centre;
  filter.Q.value = q;
  const gain = actx.createGain();
  envelope(gain, start, volume, seconds);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(bus);
  source.start(start);
}

/** A pistol shot: a crack over a low thump. */
export function sfxShot() {
  noise(0.09, 0.5, 2600, 0.6);
  tone(140, 0.08, 'square', 0.25, 60);
}

/** A bullet or a body meeting something solid. */
export function sfxHit() {
  noise(0.05, 0.25, 900, 1.2);
}

/** Bent metal, scaled by the strength of the impact. */
export function sfxCrash(strength = 1) {
  noise(0.22, 0.35 * strength, 300, 0.5);
  tone(80, 0.2, 'triangle', 0.3 * strength, 40);
}

/** Tyres at the edge of grip; `amount` is 0..1. */
export function sfxSkid(amount) {
  if (!actx || amount <= 0.05) return;
  noise(0.08, 0.1 * amount, 1800, 2.5);
}

/** A car door opening and closing: getting in, or being pulled out. */
export function sfxDoor() {
  tone(220, 0.06, 'square', 0.12, 140);
  noise(0.05, 0.12, 700, 1, 0.05);
}

/** Money arriving: two bright notes. */
export function sfxCash() {
  tone(880, 0.09, 'sine', 0.22);
  tone(1318, 0.14, 'sine', 0.22, null, 0.08);
}

/** A pickup or a checkpoint: a small rising pair. */
export function sfxPickup() {
  tone(660, 0.07, 'triangle', 0.2);
  tone(990, 0.1, 'triangle', 0.2, null, 0.06);
}

/** A hidden parcel banked: three bright notes climbing, with a sparkle. */
export function sfxStash() {
  tone(784, 0.08, 'triangle', 0.2);
  tone(988, 0.08, 'triangle', 0.2, null, 0.07);
  tone(1318, 0.16, 'sine', 0.24, null, 0.14);
  noise(0.12, 0.05, 5200, 1.4, 0.1);
}

/** Mission passed: a four-note major arpeggio. */
export function sfxMissionPass() {
  const notes = [523, 659, 784, 1046];
  notes.forEach((freq, i) => tone(freq, 0.16, 'triangle', 0.22, null, i * 0.09));
}

/** Mission failed: two notes falling away. */
export function sfxMissionFail() {
  tone(392, 0.2, 'triangle', 0.22, 311);
  tone(311, 0.3, 'triangle', 0.22, 233, 0.18);
}

/** The busted / wasted sting. */
export function sfxSting() {
  tone(196, 0.5, 'sawtooth', 0.16, 98);
  noise(0.4, 0.12, 200, 0.6);
}

/** A traffic horn, close enough to hear. */
export function sfxHorn() {
  tone(370, 0.18, 'square', 0.08);
  tone(466, 0.18, 'square', 0.06, null, 0.01);
}

/** An explosion: low noise rolling into a sub-bass thump. */
export function sfxExplosion() {
  noise(0.7, 0.6, 160, 0.4);
  tone(60, 0.6, 'sine', 0.5, 30);
}

function stopVoice(voice, nodes) {
  if (!actx || !voice) return;
  voice.gain.gain.linearRampToValueAtTime(0.0001, actx.currentTime + 0.15);
  setTimeout(() => {
    for (const node of nodes) {
      try { node.stop(); } catch { /* already silent */ }
    }
  }, 250);
}

/**
 * The player's engine voice. Call with on=true and a 0..1 speed fraction
 * every frame while driving; on=false parks it.
 */
export function engine(on, speed01 = 0) {
  if (!actx) return;
  if (on && !engineVoice) {
    const osc = actx.createOscillator();
    const sub = actx.createOscillator();
    const filter = actx.createBiquadFilter();
    const gain = actx.createGain();
    osc.type = 'sawtooth';
    sub.type = 'square';
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    gain.gain.value = 0;
    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    osc.start();
    sub.start();
    engineVoice = { osc, sub, filter, gain };
  }
  if (!on) {
    if (engineVoice) {
      const voice = engineVoice;
      engineVoice = null;
      stopVoice(voice, [voice.osc, voice.sub]);
    }
    return;
  }
  if (engineVoice) {
    const freq = 55 + speed01 * 165;
    engineVoice.osc.frequency.value = freq;
    engineVoice.sub.frequency.value = freq / 2;
    engineVoice.filter.frequency.value = 400 + speed01 * 1400;
    engineVoice.gain.gain.value = 0.05 + speed01 * 0.075;
  }
}

/** The police siren voice: `level` is 0 (silent) to 1 (on top of you). */
export function siren(level) {
  if (!actx) return;
  if (level > 0.02 && !sirenVoice) {
    const osc = actx.createOscillator();
    const lfo = actx.createOscillator();
    const lfoDepth = actx.createGain();
    const gain = actx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 950;
    lfo.frequency.value = 0.65;
    lfoDepth.gain.value = 260;
    lfo.connect(lfoDepth);
    lfoDepth.connect(osc.frequency);
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(bus);
    osc.start();
    lfo.start();
    sirenVoice = { osc, lfo, gain };
  }
  if (!sirenVoice) return;
  sirenVoice.gain.gain.value = level * 0.055;
  if (level <= 0.02) {
    const voice = sirenVoice;
    sirenVoice = null;
    setTimeout(() => {
      try { voice.osc.stop(); } catch { /* already silent */ }
      try { voice.lfo.stop(); } catch { /* already silent */ }
    }, 120);
  }
}

/** The Marisol loop: a slow synthwave bass line under warm pads. */
export function startMusic() {
  if (!actx || musicTimer) return;
  const bassLine = [110, 110, 130.8, 98]; // A2, A2, C3, G2
  const padChords = [
    [220, 261.6, 329.6],
    [174.6, 220, 261.6],
    [196, 246.9, 293.7],
    [164.8, 196, 246.9],
  ];
  musicTimer = setInterval(() => {
    if (!actx || isMutedNow) return;
    const bar = musicBar % 4;
    for (let beat = 0; beat < 4; beat++) {
      tone(bassLine[bar], 0.22, 'triangle', 0.16, null, beat * 0.24);
    }
    for (const freq of padChords[bar]) tone(freq, 0.95, 'sine', 0.045);
    musicBar += 1;
  }, 960);
}
