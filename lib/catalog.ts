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
  { id: "casino", name: "Casino du Gobelin", icon: "🎰", image: "/art/game/map-casino.webp", art: false },
] as const;
/** Décors de partie intégrés (table comprise) ; une map importée dans l'admin les remplace. */
export const GAME_SCENES = ["beach", "hell", "heaven", "street", "casino"] as const;
/** V2 : décor sans table ni barre intégrées (la table est posée par-dessus). */
/** V2 : décor complet (cartes incrustées du bas retirées), aligné pixel pour pixel sur la table. */
export const gameBg3 = (scene: string) => (scene === "casino" || scene === "beach" ? `/art/game/bg3-${scene}.webp` : gameBg(scene));
export const gameBg2 = (scene: string) => (scene === "casino" || scene === "beach" ? `/art/game/bg2-${scene}.webp` : gameBg(scene));
export const gameBg = (scene: string) => `/art/game/map-${(GAME_SCENES as readonly string[]).includes(scene) ? scene : "beach"}.webp`;
export const gameTable = (scene: string) => `/art/game/table-${(GAME_SCENES as readonly string[]).includes(scene) ? scene : "beach"}.webp`;

// Illustrations de l'accueil (même principe)
export const HOME_ART = { background: "/art/home/background.webp", mascot: "/art/home/mascot.webp", art: false };
export type MapId = (typeof MAPS)[number]["id"];
export const isMapId = (x: unknown): x is MapId => MAPS.some((m) => m.id === x);

// ---------- GOBELETS ----------
// Conditions possibles : wins (victoires), played (parties terminées),
// liarWins (« Menteur ! » réussis), winStreak (victoires d'affilée).
export type CupCondition =
  | { type: "none" | "special" }
  | { type: "wins" | "played" | "liarWins" | "exactWins" | "winStreak" | "phoenix" | "flawless"; n: number };
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
  phoenix?: number; flawless?: number; bids?: number;
};

export function condProgress(c: CupCondition, s: Stats): { have: number; need: number } {
  if (c.type === "none") return { have: 1, need: 1 };
  if (c.type === "special") return { have: 0, need: 1 }; // roue, fragments ou boutique
  const have = { wins: s.wins, played: s.played, liarWins: s.liarWins, exactWins: s.exactWins, winStreak: s.bestWinStreak, phoenix: s.phoenix ?? 0, flawless: s.flawless ?? 0 }[c.type];
  const n = (c as { n: number }).n;
  return { have: Math.min(have, n), need: n };
}
export const isUnlocked = (c: CupCondition, s: Stats) => {
  const p = condProgress(c, s);
  return p.have >= p.need;
};
export function condLabel(c: CupCondition) {
  if (c.type === "none") return "Offert";
  if (c.type === "special") return "Roue, fragments ou boutique";
  if (c.type === "phoenix") return c.n > 1 ? `Gagner ${c.n} fois après être tombé à 1 dé` : "Gagner après être tombé à 1 dé";
  if (c.type === "flawless") return c.n > 1 ? `Gagner ${c.n} fois sans perdre un dé` : "Gagner sans perdre un seul dé";
  const unit = { wins: "victoires", played: "parties terminées", liarWins: "« Menteur ! » réussis", exactWins: "« Exact ! » réussis", winStreak: "victoires d'affilée" }[c.type];
  const n = (c as { n: number }).n;
  return `${n} ${n === 1 ? unit.replace("victoires", "victoire").replace("parties terminées", "partie terminée").replace("réussis", "réussi") : unit}`;
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
