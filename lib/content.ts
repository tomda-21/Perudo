// =============================================================
//  Contenus administrables (phrases, bruitages, gobelets, maps)
//  + réglages du jeu + apparence.
//  Ce fichier est partagé entre le serveur et le navigateur.
//  Les valeurs par défaut = le contenu d'origine (lib/catalog.ts) :
//  le jeu marche même si la base est vide ou injoignable.
// =============================================================
import { HOME_ART, MAPS, PHRASES, SOUNDS, FxAnim, CupCondition, FX_COOLDOWN_MS } from "./catalog";
import { ChallengeItem, cleanEconomy, DEFAULT_ECONOMY, EconomyConfig } from "./economy";
export type { ChallengeItem } from "./economy";

export type Status = "draft" | "published" | "disabled";

// price = 0 : gratuit pour tout le monde ; > 0 : à acheter dans la boutique
export type PhraseItem = { id: string; text: string; audio?: string | null; price?: number };
export type SoundItem = { id: string; label: string; icon: string; file?: string | null; synth?: string | null; volume: number; anim: FxAnim; price?: number };
export type CupCategory = "exploit" | "mystery" | "shop";
export type Rarity = "commun" | "rare" | "épique" | "légendaire";
export type CupItem = {
  id: string; name: string; description?: string; rarity: Rarity;
  cond: CupCondition; skin: string; image?: string | null;
  category?: CupCategory; price?: number; fx?: "none" | "sparkle" | "flames" | "smoke" | "glow";
};
export type ReactionItem = { id: string; label: string; emoji: string; price: number };
export const FRAME_STYLES = ["gold", "neon", "fire", "ice", "rainbow", "jungle"] as const;
export type FrameItem = { id: string; name: string; style: (typeof FRAME_STYLES)[number]; price: number };
export const VICTORY_STYLES = ["confetti", "fireworks", "goldrain", "hearts", "stars"] as const;
export type VictoryItem = { id: string; name: string; style: (typeof VICTORY_STYLES)[number]; price: number };
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
  reactions: ReactionItem[]; frames: FrameItem[]; victories: VictoryItem[]; challenges: ChallengeItem[];
  settings: GameSettings; appearance: Appearance; economy: EconomyConfig;
};

const BUILTIN_SKINS = ["classic", "royal", "crystal", "infernal", "celestial", "tropical"];

// Les gobelets d'origine : illustrations découpées depuis les planches de Tom
const cup = (id: string, name: string, category: CupCategory, rarity: Rarity, cond: CupCondition, description: string, fx: CupItem["fx"] = "none"): CupItem =>
  ({ id, name, description, rarity, cond, skin: "custom", image: `/art/cups/${id}.webp`, category, price: 0, fx });
export const DEFAULT_CUPS: CupItem[] = [
  cup("classic", "Classique", "exploit", "commun", { type: "none" }, "Offert à la création du compte"),
  cup("tiki", "Tiki", "exploit", "rare", { type: "played", n: 3 }, "Bois sculpté et esprit tropical"),
  cup("pirate", "Pirate", "exploit", "rare", { type: "played", n: 12 }, "Bandeau rouge et tête de mort"),
  cup("neon", "Néon", "exploit", "épique", { type: "played", n: 35 }, "Lumières roses et bleues", "glow"),
  cup("bronze", "Bronze", "exploit", "rare", { type: "wins", n: 1 }, "Ta première victoire"),
  cup("royal", "Royal", "exploit", "épique", { type: "wins", n: 8 }, "Or, couronne et velours"),
  cup("celestial", "Céleste", "exploit", "légendaire", { type: "wins", n: 25 }, "Ailes d'ange et lumière céleste", "glow"),
  cup("detective", "Détecteur de mensonges", "exploit", "épique", { type: "liarWins", n: 15 }, "15 « Menteur ! » réussis"),
  cup("oracle", "Oracle", "exploit", "épique", { type: "exactWins", n: 5 }, "5 « Exact ! » réussis", "sparkle"),
  cup("phoenix", "Phénix", "exploit", "légendaire", { type: "phoenix", n: 1 }, "Gagner après être tombé à un seul dé", "flames"),
  cup("invincible", "Invincible", "exploit", "légendaire", { type: "flawless", n: 1 }, "Gagner sans perdre un seul dé", "flames"),
  cup("glacier", "Glaciaire", "mystery", "rare", { type: "special" }, "Glace et cristaux bleus", "sparkle"),
  cup("volcanic", "Volcanique", "mystery", "rare", { type: "special" }, "Roche et fissures de lave", "flames"),
  cup("abyssal", "Abyssal", "mystery", "rare", { type: "special" }, "Vagues et ancre des profondeurs"),
  cup("sylvan", "Sylvestre", "mystery", "rare", { type: "special" }, "Bois vivant et feuillages"),
  cup("galactic", "Galactique", "mystery", "épique", { type: "special" }, "Étoiles et galaxies", "sparkle"),
  cup("genie", "Génie", "mystery", "épique", { type: "special" }, "Lampe magique et fumée", "smoke"),
  cup("lucky", "Porte-Bonheur", "mystery", "épique", { type: "special" }, "Chat porte-bonheur"),
  cup("crystal", "Cristal", "mystery", "légendaire", { type: "special" }, "Reflets irisés de pierres précieuses", "sparkle"),
];

export const DEFAULT_CHALLENGES: ChallengeItem[] = [
  { id: "d-games2", name: "Habitué", period: "daily", metric: "games", target: 2, doblons: 40, fragments: 0 },
  { id: "d-win1", name: "Gagnant du jour", period: "daily", metric: "wins", target: 1, doblons: 40, fragments: 0 },
  { id: "d-liar3", name: "Fin limier", period: "daily", metric: "liarWins", target: 3, doblons: 40, fragments: 0 },
  { id: "d-bids15", name: "Grande gueule", period: "daily", metric: "bids", target: 15, doblons: 40, fragments: 0 },
  { id: "d-exact1", name: "Dans le mille", period: "daily", metric: "exactWins", target: 1, doblons: 40, fragments: 0 },
  { id: "d-games3", name: "Marathonien", period: "daily", metric: "games", target: 3, doblons: 40, fragments: 0 },
  { id: "w-games10", name: "Pilier de comptoir", period: "weekly", metric: "games", target: 10, doblons: 150, fragments: 0 },
  { id: "w-wins4", name: "Série gagnante", period: "weekly", metric: "wins", target: 4, doblons: 150, fragments: 1 },
  { id: "w-liar10", name: "Chasseur de bluff", period: "weekly", metric: "liarWins", target: 10, doblons: 150, fragments: 0 },
  { id: "w-bids60", name: "Moulin à paroles", period: "weekly", metric: "bids", target: 60, doblons: 150, fragments: 0 },
  { id: "w-exact3", name: "Voyant extralucide", period: "weekly", metric: "exactWins", target: 3, doblons: 150, fragments: 1 },
];

export const DEFAULT_CONTENT: PublicContent = {
  phrases: [
    ...PHRASES.map((p) => ({ id: p.id, text: p.text, audio: null, price: 0 })),
    { id: "allin", text: "all in !", audio: null, price: 200 },
    { id: "jelsens", text: "je le sens pas…", audio: null, price: 200 },
    { id: "trop-facile", text: "trop facile", audio: null, price: 200 },
  ],
  sounds: [
    ...SOUNDS.map((s) => ({ id: s.id, label: s.label, icon: s.icon, file: null, synth: s.id, volume: 1, anim: s.anim, price: 0 })),
    { id: "klaxon", label: "Klaxon", icon: "📯", file: null, synth: "klaxon", volume: 1, anim: "pop", price: 300 },
    { id: "tambour", label: "Roulement", icon: "🥁", file: null, synth: "tambour", volume: 1, anim: "shake", price: 300 },
  ],
  cups: DEFAULT_CUPS,
  maps: MAPS.map((m) => ({ id: m.id, name: m.name, icon: m.icon, scene: m.id, image: null, layers: [], anims: [], felt: null, random: true })),
  reactions: [
    { id: "rire", label: "Rire", emoji: "😂", price: 0 }, { id: "surprise", label: "Surprise", emoji: "😱", price: 0 },
    { id: "suspicion", label: "Suspicion", emoji: "🤨", price: 0 }, { id: "bravo", label: "Bravo", emoji: "👏", price: 0 },
    { id: "provoc", label: "Provoc", emoji: "🔥", price: 0 }, { id: "moquerie", label: "Moquerie", emoji: "😈", price: 0 },
    { id: "clown", label: "Clown", emoji: "🤡", price: 350 }, { id: "goat", label: "GOAT", emoji: "🐐", price: 350 },
    { id: "respect", label: "Respect", emoji: "🫡", price: 350 }, { id: "caca", label: "Caca", emoji: "💩", price: 350 },
  ],
  frames: [
    { id: "gold", name: "Cadre doré", style: "gold", price: 600 }, { id: "neon", name: "Néon", style: "neon", price: 600 },
    { id: "fire", name: "Flammes", style: "fire", price: 600 }, { id: "ice", name: "Givre", style: "ice", price: 600 },
    { id: "rainbow", name: "Arc-en-ciel", style: "rainbow", price: 600 }, { id: "jungle", name: "Jungle", style: "jungle", price: 600 },
  ],
  victories: [
    { id: "confetti", name: "Confettis", style: "confetti", price: 0 }, { id: "fireworks", name: "Feu d'artifice", style: "fireworks", price: 1200 },
    { id: "goldrain", name: "Pluie d'or", style: "goldrain", price: 1200 }, { id: "hearts", name: "Cœurs", style: "hearts", price: 1200 },
    { id: "stars", name: "Étoiles filantes", style: "stars", price: 1200 },
  ],
  challenges: DEFAULT_CHALLENGES,
  settings: DEFAULT_SETTINGS,
  appearance: DEFAULT_APPEARANCE,
  economy: DEFAULT_ECONOMY,
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
  return { text, audio: asset(d.audio), price: price(d.price) };
}
const price = (x: unknown) => { const v = Math.round(Number(x)); return Number.isFinite(v) ? Math.min(1_000_000, Math.max(0, v)) : 0; };
export function cleanSound(d: Record<string, unknown>): Omit<SoundItem, "id"> {
  const label = str(d.label, 24);
  if (!label) throw new ContentError("Donne un nom au bruitage");
  const anims: FxAnim[] = ["shake", "tomatoes", "clap", "laugh", "pop", "sad"];
  const file = asset(d.file);
  const synth = typeof d.synth === "string" && [...SOUNDS.map((s) => s.id), "klaxon", "tambour"].includes(d.synth) ? d.synth : null;
  if (!file && !synth) throw new ContentError("Importe un fichier audio pour ce bruitage");
  const vol = Number(d.volume);
  return {
    label, icon: str(d.icon, 8) || "🔊", file, synth,
    volume: Number.isFinite(vol) ? Math.min(1, Math.max(0.05, vol)) : 1,
    anim: anims.includes(d.anim as FxAnim) ? (d.anim as FxAnim) : "pop",
    price: price(d.price),
  };
}
export function cleanCup(d: Record<string, unknown>): Omit<CupItem, "id"> {
  const name = str(d.name, 24);
  if (!name) throw new ContentError("Donne un nom au gobelet");
  const c = (d.cond ?? {}) as Record<string, unknown>;
  const categories: CupCategory[] = ["exploit", "mystery", "shop"];
  const category = categories.includes(d.category as CupCategory) ? (d.category as CupCategory) : "exploit";
  const types = ["none", "special", "wins", "played", "liarWins", "exactWins", "winStreak", "phoenix", "flawless"];
  let type = types.includes(String(c.type)) ? String(c.type) : "none";
  if (category !== "exploit") type = "special"; // mystères et boutique : jamais par exploit
  if (category === "exploit" && type === "special") type = "none";
  const n = Math.round(Number(c.n));
  if (type !== "none" && type !== "special" && (!Number.isFinite(n) || n < 1 || n > 10000)) throw new ContentError("Le nombre d'actions doit être entre 1 et 10 000");
  const skin = BUILTIN_SKINS.includes(String(d.skin)) ? String(d.skin) : "custom";
  const image = asset(d.image) ?? (typeof d.image === "string" && /^\/art\/cups\/[a-z0-9-]+\.webp$/.test(d.image) ? d.image : null);
  if (skin === "custom" && !image) throw new ContentError("Un nouveau gobelet a besoin d'une illustration");
  const fxs = ["none", "sparkle", "flames", "smoke", "glow"];
  const rarities: CupItem["rarity"][] = ["commun", "rare", "épique", "légendaire"];
  return {
    name, description: str(d.description, 140),
    rarity: rarities.includes(d.rarity as CupItem["rarity"]) ? (d.rarity as CupItem["rarity"]) : "commun",
    cond: (type === "none" || type === "special" ? { type } : { type, n }) as CupCondition,
    skin, image, category,
    price: category === "shop" ? Math.max(1, price(d.price)) : 0,
    fx: (fxs.includes(String(d.fx)) ? String(d.fx) : "none") as CupItem["fx"],
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

export function cleanReaction(d: Record<string, unknown>): Omit<ReactionItem, "id"> {
  const label = str(d.label, 20), emoji = str(d.emoji, 8);
  if (!label || !emoji) throw new ContentError("Il faut un nom et un emoji");
  return { label, emoji, price: price(d.price) };
}
export function cleanFrame(d: Record<string, unknown>): Omit<FrameItem, "id"> {
  const name = str(d.name, 24);
  if (!name) throw new ContentError("Donne un nom au cadre");
  return { name, style: FRAME_STYLES.includes(d.style as FrameItem["style"]) ? (d.style as FrameItem["style"]) : "gold", price: price(d.price) };
}
export function cleanVictory(d: Record<string, unknown>): Omit<VictoryItem, "id"> {
  const name = str(d.name, 24);
  if (!name) throw new ContentError("Donne un nom à l'animation");
  return { name, style: VICTORY_STYLES.includes(d.style as VictoryItem["style"]) ? (d.style as VictoryItem["style"]) : "confetti", price: price(d.price) };
}
export function cleanChallenge(d: Record<string, unknown>): Omit<ChallengeItem, "id"> {
  const name = str(d.name, 30);
  if (!name) throw new ContentError("Donne un nom au défi");
  const metrics = ["games", "wins", "liarWins", "exactWins", "bids"];
  const t = Math.round(Number(d.target));
  if (!Number.isFinite(t) || t < 1 || t > 1000) throw new ContentError("L'objectif doit être entre 1 et 1000");
  return {
    name, period: d.period === "weekly" ? "weekly" : "daily",
    metric: (metrics.includes(String(d.metric)) ? String(d.metric) : "games") as ChallengeItem["metric"],
    target: t, doblons: price(d.doblons), fragments: Math.min(10, price(d.fragments)),
  };
}
export { cleanEconomy };
