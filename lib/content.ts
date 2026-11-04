// =============================================================
//  Contenus administrables (phrases, bruitages, gobelets, maps)
//  + réglages du jeu + apparence.
//  Ce fichier est partagé entre le serveur et le navigateur.
//  Les valeurs par défaut = le contenu d'origine (lib/catalog.ts) :
//  le jeu marche même si la base est vide ou injoignable.
// =============================================================
import { CUPS, HOME_ART, MAPS, PHRASES, SOUNDS, FxAnim, CupCondition, FX_COOLDOWN_MS } from "./catalog";

export type Status = "draft" | "published" | "disabled";

export type PhraseItem = { id: string; text: string; audio?: string | null };
export type SoundItem = { id: string; label: string; icon: string; file?: string | null; synth?: string | null; volume: number; anim: FxAnim };
export type CupItem = {
  id: string; name: string; description?: string; rarity: "commun" | "rare" | "épique" | "légendaire";
  cond: CupCondition; skin: string; image?: string | null;
};
export const MAP_ANIMS = ["none", "embers", "sparkles", "float", "clouds", "rain"] as const;
export type MapAnim = (typeof MAP_ANIMS)[number];
export type MapItem = {
  id: string; name: string; icon: string; scene?: string | null; image?: string | null; layers?: string[];
  anims: MapAnim[]; felt?: string | null; random: boolean;
};

export type GameSettings = {
  startDice: number; // dés au départ pour les nouveaux salons
  exactEnabled: boolean;
  palificoEnabled: boolean;
  fxEnabled: boolean; // soundboard + phrases
  fxCooldownSec: number;
};
export type Appearance = {
  colors: { gold: string; plum: string; green: string; red: string; purple: string; felt: string };
  logo?: string | null; // image qui remplace le logo dessiné
  homeBackground?: string | null;
  mascot?: string | null;
  tagline: string;
};

export const DEFAULT_SETTINGS: GameSettings = { startDice: 5, exactEnabled: true, palificoEnabled: true, fxEnabled: true, fxCooldownSec: FX_COOLDOWN_MS / 1000 };
export const DEFAULT_APPEARANCE: Appearance = {
  colors: { gold: "#ffcf4a", plum: "#2a1640", green: "#4fc244", red: "#e2453c", purple: "#8d4ee8", felt: "#2f8a52" },
  logo: null, homeBackground: HOME_ART.art ? HOME_ART.background : null, mascot: null, tagline: "T'oses bluffer ?",
};

/** Contenu tel que le jeu le reçoit (uniquement ce qui est publié). */
export type PublicContent = {
  phrases: PhraseItem[]; sounds: SoundItem[]; cups: CupItem[]; maps: MapItem[];
  settings: GameSettings; appearance: Appearance;
};

const BUILTIN_SKINS = ["classic", "royal", "crystal", "infernal", "celestial", "tropical"];
const RARITY: Record<string, CupItem["rarity"]> = { classic: "commun", royal: "rare", crystal: "rare", infernal: "épique", celestial: "épique", tropical: "légendaire" };

export const DEFAULT_CONTENT: PublicContent = {
  phrases: PHRASES.map((p) => ({ id: p.id, text: p.text, audio: null })),
  sounds: SOUNDS.map((s) => ({ id: s.id, label: s.label, icon: s.icon, file: null, synth: s.id, volume: 1, anim: s.anim })),
  cups: CUPS.map((c) => ({ id: c.id, name: c.name, description: "", rarity: RARITY[c.id] ?? "commun", cond: c.cond, skin: c.id, image: null })),
  maps: MAPS.map((m) => ({ id: m.id, name: m.name, icon: m.icon, scene: m.id, image: null, layers: [], anims: [], felt: null, random: true })),
  settings: DEFAULT_SETTINGS,
  appearance: DEFAULT_APPEARANCE,
};

export const assetUrl = (id?: string | null) => (id ? (id.startsWith("/") ? id : `/api/asset/${id}`) : null);

// ---------- validation (le serveur n'enregistre que des données propres) ----------
const str = (x: unknown, max: number) => String(x ?? "").trim().slice(0, max);
const isAsset = (x: unknown) => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x);
const asset = (x: unknown) => (isAsset(x) ? (x as string) : null);
const color = (x: unknown, d: string) => (typeof x === "string" && /^#[0-9a-f]{6}$/i.test(x) ? x : d);
export const slug = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "item";

export class ContentError extends Error {}

export function cleanPhrase(d: Record<string, unknown>): Omit<PhraseItem, "id"> {
  const text = str(d.text, 60);
  if (!text) throw new ContentError("La phrase est vide");
  return { text, audio: asset(d.audio) };
}
export function cleanSound(d: Record<string, unknown>): Omit<SoundItem, "id"> {
  const label = str(d.label, 24);
  if (!label) throw new ContentError("Donne un nom au bruitage");
  const anims: FxAnim[] = ["shake", "tomatoes", "clap", "laugh", "pop", "sad"];
  const file = asset(d.file);
  const synth = typeof d.synth === "string" && SOUNDS.some((s) => s.id === d.synth) ? d.synth : null;
  if (!file && !synth) throw new ContentError("Importe un fichier audio pour ce bruitage");
  const vol = Number(d.volume);
  return {
    label, icon: str(d.icon, 8) || "🔊", file, synth,
    volume: Number.isFinite(vol) ? Math.min(1, Math.max(0.05, vol)) : 1,
    anim: anims.includes(d.anim as FxAnim) ? (d.anim as FxAnim) : "pop",
  };
}
export function cleanCup(d: Record<string, unknown>): Omit<CupItem, "id"> {
  const name = str(d.name, 24);
  if (!name) throw new ContentError("Donne un nom au gobelet");
  const c = (d.cond ?? {}) as Record<string, unknown>;
  const types = ["none", "wins", "played", "liarWins", "winStreak"];
  const type = types.includes(String(c.type)) ? String(c.type) : "none";
  const n = Math.round(Number(c.n));
  if (type !== "none" && (!Number.isFinite(n) || n < 1 || n > 10000)) throw new ContentError("Le nombre d'actions doit être entre 1 et 10 000");
  const skin = BUILTIN_SKINS.includes(String(d.skin)) ? String(d.skin) : "custom";
  const image = asset(d.image);
  if (skin === "custom" && !image) throw new ContentError("Un nouveau gobelet a besoin d'une illustration");
  const rarities: CupItem["rarity"][] = ["commun", "rare", "épique", "légendaire"];
  return {
    name, description: str(d.description, 140),
    rarity: rarities.includes(d.rarity as CupItem["rarity"]) ? (d.rarity as CupItem["rarity"]) : "commun",
    cond: (type === "none" ? { type: "none" } : { type, n }) as CupCondition,
    skin, image,
  };
}
export function cleanMap(d: Record<string, unknown>): Omit<MapItem, "id"> {
  const name = str(d.name, 30);
  if (!name) throw new ContentError("Donne un nom à la map");
  const scene = typeof d.scene === "string" && MAPS.some((m) => m.id === d.scene) ? d.scene : null;
  const image = asset(d.image);
  if (!scene && !image) throw new ContentError("Une nouvelle map a besoin d'une image de fond");
  const layers = Array.isArray(d.layers) ? d.layers.filter(isAsset).slice(0, 3) as string[] : [];
  const anims = Array.isArray(d.anims) ? (d.anims.filter((a) => MAP_ANIMS.includes(a as MapAnim) && a !== "none") as MapAnim[]).slice(0, 3) : [];
  return {
    name, icon: str(d.icon, 8) || "🗺️", scene, image, layers, anims,
    felt: typeof d.felt === "string" && /^#[0-9a-f]{6}$/i.test(d.felt) ? d.felt : null,
    random: d.random !== false,
  };
}
export function cleanSettings(d: Record<string, unknown>): GameSettings {
  const n = (x: unknown, lo: number, hi: number, def: number) => {
    const v = Math.round(Number(x));
    return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def;
  };
  return {
    startDice: n(d.startDice, 1, 6, 5),
    exactEnabled: d.exactEnabled !== false,
    palificoEnabled: d.palificoEnabled !== false,
    fxEnabled: d.fxEnabled !== false,
    fxCooldownSec: n(d.fxCooldownSec, 1, 30, 3),
  };
}
export function cleanAppearance(d: Record<string, unknown>): Appearance {
  const c = (d.colors ?? {}) as Record<string, unknown>;
  const D = DEFAULT_APPEARANCE.colors;
  return {
    colors: { gold: color(c.gold, D.gold), plum: color(c.plum, D.plum), green: color(c.green, D.green), red: color(c.red, D.red), purple: color(c.purple, D.purple), felt: color(c.felt, D.felt) },
    logo: asset(d.logo), homeBackground: asset(d.homeBackground), mascot: asset(d.mascot),
    tagline: str(d.tagline, 40) || DEFAULT_APPEARANCE.tagline,
  };
}

/** CSS des couleurs de l'apparence (injecté dans la page). */
export function appearanceCss(a: Appearance) {
  const c = a.colors;
  return `:root{--gold:${c.gold};--plum:${c.plum};--btn-green:${c.green};--btn-red:${c.red};--btn-purple:${c.purple};--felt:${c.felt};}`;
}
