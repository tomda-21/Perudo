"use client";
// =============================================================
//  Soundboard : bruitages et voix des phrases cultes.
//  - Si un fichier audio est indiqué dans lib/catalog.ts, il est joué.
//  - Sinon, le son est fabriqué en direct (synthèse Web Audio).
//  - Les phrases sans enregistrement peuvent être lues par la voix
//    de synthèse du navigateur (gratuite, intégrée au téléphone/ordi).
// =============================================================
import { ac, out } from "./sound";
import { getSettings } from "./settings";
import { PHRASES, SOUNDS } from "./catalog";

type Synth = (a: AudioContext, t: number, dest: AudioNode) => void;

function noiseBuffer(a: AudioContext, dur: number) {
  const b = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * dur)), a.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function env(a: AudioContext, g: GainNode, t: number, attack: number, hold: number, release: number, peak: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
}

/** Un « prout » : son grave, qui vibre, avec un peu de souffle. */
function fart(len: number, f0: number, wobble: number): Synth {
  return (a, t, dest) => {
    const o = a.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f0 * 0.75, t + len);
    // vibration irrégulière (le côté « flap-flap »)
    const lfo = a.createOscillator();
    lfo.type = "square";
    lfo.frequency.setValueAtTime(wobble, t);
    lfo.frequency.linearRampToValueAtTime(wobble * 0.6, t + len);
    const lfoGain = a.createGain(); lfoGain.gain.value = 0.5;
    const am = a.createGain(); am.gain.value = 0.5;
    lfo.connect(lfoGain).connect(am.gain);
    const lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 420; lp.Q.value = 4;
    const g = a.createGain(); env(a, g, t, 0.03, len * 0.6, len * 0.4, 0.9);
    o.connect(am).connect(lp).connect(g).connect(dest);
    const n = a.createBufferSource(); n.buffer = noiseBuffer(a, len);
    const nf = a.createBiquadFilter(); nf.type = "bandpass"; nf.frequency.value = 300; nf.Q.value = 0.8;
    const ng = a.createGain(); env(a, ng, t, 0.02, len * 0.5, len * 0.5, 0.25);
    n.connect(nf).connect(ng).connect(dest);
    [o, lfo, n].forEach((x) => { x.start(t); x.stop(t + len + 0.05); });
  };
}

/** Une voix « oooh / aaah » grossière (oscillateur + formants). */
function voice(a: AudioContext, t: number, dest: AudioNode, f: number[], durs: number[], formant: number, gain: number, type: OscillatorType = "sawtooth") {
  const o = a.createOscillator(); o.type = type;
  let tt = t;
  f.forEach((fr, i) => { o.frequency.setValueAtTime(fr, tt); if (f[i + 1]) o.frequency.linearRampToValueAtTime(f[i + 1], tt + durs[i]); tt += durs[i]; });
  const vib = a.createOscillator(); vib.frequency.value = 5.5;
  const vg = a.createGain(); vg.gain.value = f[0] * 0.02;
  vib.connect(vg).connect(o.frequency);
  const bp = a.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = formant; bp.Q.value = 3;
  const lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = formant * 2.5;
  const g = a.createGain(); const total = durs.reduce((x, y) => x + y, 0);
  env(a, g, t, 0.06, total * 0.7, total * 0.3, gain);
  o.connect(bp).connect(lp).connect(g).connect(dest);
  o.start(t); vib.start(t); o.stop(t + total + 0.05); vib.stop(t + total + 0.05);
}

const SYNTHS: Record<string, Synth> = {
  prout: fart(0.55, 95, 28),
  "gros-prout": (a, t, d) => { fart(0.5, 75, 22)(a, t, d); fart(0.9, 60, 16)(a, t + 0.45, d); },
  rot: (a, t, d) => {
    const o = a.createOscillator(); o.type = "sawtooth";
    o.frequency.setValueAtTime(120, t); o.frequency.linearRampToValueAtTime(70, t + 0.75);
    const am = a.createGain(); const lfo = a.createOscillator(); lfo.frequency.value = 38; lfo.type = "triangle";
    const lg = a.createGain(); lg.gain.value = 0.6; lfo.connect(lg).connect(am.gain);
    const bp = a.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 520; bp.Q.value = 2;
    const g = a.createGain(); env(a, g, t, 0.04, 0.45, 0.3, 1);
    o.connect(am).connect(bp).connect(g).connect(d);
    [o, lfo].forEach((x) => { x.start(t); x.stop(t + 0.85); });
  },
  bouh: (a, t, d) => {
    // une petite foule qui hue : plusieurs voix légèrement désaccordées
    [140, 155, 172, 190, 128].forEach((f, i) => voice(a, t + i * 0.05, d, [f, f * 0.92], [1.5], 480 + i * 30, 0.22));
  },
  applaudissements: (a, t, d) => {
    for (let i = 0; i < 46; i++) {
      const at = t + Math.random() * 1.7;
      const n = a.createBufferSource(); n.buffer = noiseBuffer(a, 0.03);
      const bp = a.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1200 + Math.random() * 1800; bp.Q.value = 1.4;
      const g = a.createGain(); env(a, g, at, 0.002, 0.004, 0.03, 0.5 + Math.random() * 0.5);
      n.connect(bp).connect(g).connect(d); n.start(at);
    }
  },
  rire: (a, t, d) => {
    // « ha ha ha ha » moqueur, de plus en plus grave
    [300, 285, 270, 255, 240, 225].forEach((f, i) => voice(a, t + i * 0.17, d, [f, f * 0.9], [0.12], 850, 0.45));
  },
  surprise: (a, t, d) => voice(a, t, d, [320, 520, 760], [0.25, 0.35], 700, 0.5),
  deception: (a, t, d) => {
    // le fameux « wah wah wah waaaah »
    const notes = [196, 185, 175, 165];
    notes.forEach((f, i) => {
      const len = i === 3 ? 1.0 : 0.32;
      const at = t + i * 0.38;
      const o = a.createOscillator(); o.type = "square"; o.frequency.value = f;
      if (i === 3) { const v = a.createOscillator(); v.frequency.value = 6; const vg = a.createGain(); vg.gain.value = 4; v.connect(vg).connect(o.frequency); v.start(at); v.stop(at + len); }
      const lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 6;
      lp.frequency.setValueAtTime(300, at); lp.frequency.linearRampToValueAtTime(1100, at + len * 0.5); lp.frequency.linearRampToValueAtTime(400, at + len);
      const g = a.createGain(); env(a, g, at, 0.03, len * 0.6, len * 0.35, 0.25);
      o.connect(lp).connect(g).connect(d); o.start(at); o.stop(at + len + 0.05);
    });
  },
};

// Pour éviter la cacophonie : pas plus de 3 bruitages en même temps
let playing = 0;

export function playSound(id: string) {
  const s = getSettings();
  if (!s.soundboard || s.volume <= 0) return;
  if (playing >= 3) return;
  const def = SOUNDS.find((x) => x.id === id);
  if (!def) return;
  playing++;
  setTimeout(() => (playing = Math.max(0, playing - 1)), 1800);
  if (def.file) {
    const el = new Audio(def.file);
    el.volume = s.volume;
    el.play().catch(() => {});
    return;
  }
  const a = ac();
  if (!a || a.state !== "running") return;
  SYNTHS[id]?.(a, a.currentTime + 0.02, out(a));
}

export function speakPhrase(id: string) {
  const s = getSettings();
  if (!s.voices || s.volume <= 0) return;
  const p = PHRASES.find((x) => x.id === id);
  if (!p) return;
  if (p.audio) {
    const el = new Audio(p.audio);
    el.volume = s.volume;
    el.play().catch(() => {});
    return;
  }
  // voix de synthèse du navigateur (aucun fichier : ce n'est pas votre voix !)
  try {
    const u = new SpeechSynthesisUtterance(p.text);
    u.lang = "fr-FR";
    u.rate = 1.05;
    u.volume = s.volume;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {}
}
