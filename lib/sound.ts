"use client";
// =============================================================
//  Sons du jeu — fabriqués en direct par le navigateur (Web Audio),
//  donc aucun fichier à télécharger, rien de payant.
//  Les navigateurs (surtout sur mobile) bloquent le son tant que
//  l'utilisateur n'a pas touché l'écran : on « débloque » au 1er clic.
// =============================================================

import { getSettings, setSettings } from "./settings";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

export const isMuted = () => !getSettings().gameSounds;
export function setMuted(m: boolean) { setSettings({ gameSounds: !m }); }

/** Sortie générale, réglée par le volume des paramètres. */
export function out(a: AudioContext) {
  if (!master) { master = a.createGain(); master.connect(a.destination); }
  master.gain.value = getSettings().volume;
  return master;
}

export function ac() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

/** À appeler sur le premier geste de l'utilisateur. */
export function unlockAudio() { ac(); }

function noiseBurst(a: AudioContext, at: number, dur: number, freq: number, gain: number) {
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
  const src = a.createBufferSource();
  src.buffer = buf;
  const bp = a.createBiquadFilter();
  bp.type = "bandpass"; bp.frequency.value = freq; bp.Q.value = 1.2;
  const g = a.createGain(); g.gain.value = gain;
  src.connect(bp).connect(g).connect(out(a));
  src.start(at);
}

function tone(a: AudioContext, at: number, f0: number, f1: number, dur: number, gain: number, type: OscillatorType = "triangle") {
  const o = a.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, at);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), at + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(out(a));
  o.start(at); o.stop(at + dur + 0.02);
}

function play(fn: (a: AudioContext, t: number) => void) {
  if (!getSettings().gameSounds) return;
  const a = ac();
  if (!a || a.state !== "running") return;
  fn(a, a.currentTime + 0.01);
}

export const sounds = {
  /** Dés qui s'entrechoquent dans le gobelet, puis gobelet posé. */
  shake: () => play((a, t) => {
    for (let i = 0; i < 14; i++) noiseBurst(a, t + i * 0.06 + Math.random() * 0.03, 0.05, 2500 + Math.random() * 2500, 0.35);
    noiseBurst(a, t + 0.95, 0.12, 300, 0.9); // le « boum » sur la table
  }),
  bid: () => play((a, t) => tone(a, t, 520, 780, 0.12, 0.15)),
  yourTurn: () => play((a, t) => { tone(a, t, 660, 660, 0.12, 0.12, "sine"); tone(a, t + 0.13, 880, 880, 0.18, 0.12, "sine"); }),
  liar: () => play((a, t) => { tone(a, t, 300, 120, 0.45, 0.3, "sawtooth"); noiseBurst(a, t, 0.2, 800, 0.5); }),
  exact: () => play((a, t) => { [523, 659, 784].forEach((f, i) => tone(a, t + i * 0.08, f, f, 0.25, 0.15)); }),
  lose: () => play((a, t) => tone(a, t, 440, 180, 0.5, 0.2)),
  gain: () => play((a, t) => tone(a, t, 500, 1000, 0.3, 0.18)),
  win: () => play((a, t) => { [523, 659, 784, 1046].forEach((f, i) => tone(a, t + i * 0.12, f, f, 0.4, 0.16)); }),
};
