"use client";
// Réglages du joueur, gardés sur cet appareil.
import { useEffect, useState } from "react";

export type Settings = {
  volume: number; // général, 0 → 1
  musicVol: number; // musique
  ambientVol: number; // ambiance
  sfxVol: number; // effets sonores (jeu, bruitages, voix)
  mutedPlayers: string[]; // joueurs coupés localement (id de profil)
  showDice: boolean; // mes dés affichés en permanence (masquables)
  gameSounds: boolean; // sons du jeu (dés, menteur…)
  soundboard: boolean; // bruitages des autres joueurs
  voices: boolean; // voix des phrases cultes
  bubbles: boolean; // bulles et réactions visibles
  reduceMotion: boolean;
};

const DEFAULTS: Settings = { volume: 0.8, musicVol: 0.6, ambientVol: 0.6, sfxVol: 1, mutedPlayers: [], showDice: true, gameSounds: true, soundboard: true, voices: true, bubbles: true, reduceMotion: false };
const KEY = "perudo:settings";
const listeners = new Set<(s: Settings) => void>();
let current: Settings = DEFAULTS;
let loaded = false;

function load() {
  if (loaded || typeof window === "undefined") return current;
  loaded = true;
  try {
    current = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
    // ancien réglage « son coupé »
    if (localStorage.getItem("perudo:muted") === "1") current.gameSounds = false;
  } catch {}
  return current;
}

export const getSettings = () => load();

export function setSettings(patch: Partial<Settings>) {
  current = { ...load(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch {}
  if (typeof document !== "undefined") document.documentElement.classList.toggle("reduce-motion", current.reduceMotion);
  listeners.forEach((l) => l(current));
}

export function useSettings(): [Settings, (p: Partial<Settings>) => void] {
  const [s, setS] = useState<Settings>(DEFAULTS);
  useEffect(() => {
    setS(load());
    document.documentElement.classList.toggle("reduce-motion", load().reduceMotion);
    listeners.add(setS);
    return () => { listeners.delete(setS); };
  }, []);
  return [s, setSettings];
}
