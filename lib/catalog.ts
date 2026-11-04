// =============================================================
//  CATALOGUE — tout ce qui est « contenu » du jeu, au même endroit.
//  Tom : pour ajouter une map, un gobelet, un son ou une phrase,
//  c'est ici. Pas besoin de toucher au reste de l'application.
// =============================================================

// ---------- MAPS (décors) ----------
// `image` : illustration à déposer dans /public. Passe `art` à true
// une fois le fichier ajouté (voir ASSETS.md) ; sinon le décor dessiné
// en code s'affiche.
export const MAPS = [
  { id: "beach", name: "Plage tropicale", icon: "🌴", image: "/art/maps/beach.webp", art: false },
  { id: "hell", name: "Enfer", icon: "🔥", image: "/art/maps/hell.webp", art: false },
  { id: "heaven", name: "Paradis", icon: "🪽", image: "/art/maps/heaven.webp", art: false },
  { id: "street", name: "Rue urbaine", icon: "🏙️", image: "/art/maps/street.webp", art: false },
] as const;

// Illustrations de l'accueil (même principe)
export const HOME_ART = { background: "/art/home/background.webp", mascot: "/art/home/mascot.webp", art: false };
export type MapId = (typeof MAPS)[number]["id"];
export const isMapId = (x: unknown): x is MapId => MAPS.some((m) => m.id === x);

// ---------- GOBELETS ----------
// Conditions possibles : wins (victoires), played (parties terminées),
// liarWins (« Menteur ! » réussis), winStreak (victoires d'affilée).
export type CupCondition = { type: "none" } | { type: "wins" | "played" | "liarWins" | "winStreak"; n: number };
// `art` : passe à true quand l'illustration /public/art/cups/<id>.webp existe.
export const CUPS: { id: string; name: string; cond: CupCondition; art: boolean }[] = [
  { id: "classic", name: "Classique", cond: { type: "none" }, art: false },
  { id: "royal", name: "Royal", cond: { type: "wins", n: 5 }, art: false },
  { id: "crystal", name: "Cristal", cond: { type: "played", n: 15 }, art: false },
  { id: "infernal", name: "Infernal", cond: { type: "played", n: 30 }, art: false },
  { id: "celestial", name: "Céleste", cond: { type: "wins", n: 20 }, art: false },
  { id: "tropical", name: "Tropical", cond: { type: "played", n: 50 }, art: false },
];
export const isCupId = (x: unknown) => CUPS.some((c) => c.id === x);

export type Stats = {
  played: number; wins: number; losses: number; rate: number;
  liarCalls: number; liarWins: number; exactCalls: number; exactWins: number;
  winStreak: number; bestWinStreak: number;
};

export function condProgress(c: CupCondition, s: Stats): { have: number; need: number } {
  if (c.type === "none") return { have: 1, need: 1 };
  const have = c.type === "wins" ? s.wins : c.type === "played" ? s.played : c.type === "liarWins" ? s.liarWins : s.bestWinStreak;
  return { have: Math.min(have, c.n), need: c.n };
}
export const isUnlocked = (c: CupCondition, s: Stats) => {
  const p = condProgress(c, s);
  return p.have >= p.need;
};
export function condLabel(c: CupCondition) {
  if (c.type === "none") return "Disponible";
  const unit = { wins: "victoires", played: "parties", liarWins: "menteurs réussis", winStreak: "victoires d'affilée" }[c.type];
  return `${c.n} ${unit}`;
}

// ---------- AVATARS PAR DÉFAUT ----------
// Portraits tirés des maquettes de Tom (dans /public/art/avatars).
export const AVATARS = ["gobelin", "lola", "pablo", "max", "julie", "hugo"] as const;
export const isAvatarId = (x: unknown) => AVATARS.includes(x as (typeof AVATARS)[number]);
export const BOT_AVATARS = ["max", "lola", "pablo", "julie", "hugo", "gobelin"];

// ---------- SOUNDBOARD ----------
// `file` : un vrai enregistrement à déposer dans /public/sounds (facultatif).
// Sans fichier, le son est fabriqué par le navigateur (synthèse).
export type FxAnim = "shake" | "tomatoes" | "clap" | "laugh" | "pop" | "sad";
export const SOUNDS: { id: string; label: string; icon: string; file?: string; anim: FxAnim }[] = [
  { id: "prout", label: "Prout", icon: "💨", anim: "shake" },
  { id: "gros-prout", label: "Gros prout", icon: "🌪️", anim: "shake" },
  { id: "rot", label: "Rot", icon: "🤢", anim: "shake" },
  { id: "bouh", label: "Bouuuuh !", icon: "👎", anim: "tomatoes" },
  { id: "applaudissements", label: "Applaudis.", icon: "👏", anim: "clap" },
  { id: "rire", label: "Rire", icon: "😂", anim: "laugh" },
  { id: "surprise", label: "Surprise", icon: "😱", anim: "pop" },
  { id: "deception", label: "Déception", icon: "😭", anim: "sad" },
];

// Phrases cultes — formulations exactes, à ne pas corriger !
// `audio` : enregistrement de vos voix dans /public/voices (facultatif).
export const PHRASES: { id: string; text: string; audio?: string }[] = [
  { id: "chauffer", text: "rien que tu fais chauffer" },
  { id: "mg", text: "ah oui mg" },
  { id: "fort", text: "c'est fort" },
  { id: "hype", text: "0 hype" },
  { id: "jouer", text: "tsais pas jouer" },
  { id: "cul", text: "mange moi l'cul" },
];

export const FX_COOLDOWN_MS = 3000; // anti-spam entre deux sons/phrases
