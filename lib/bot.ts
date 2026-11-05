// =============================================================
//  Le cerveau des bots
// =============================================================
//  Un bot ne voit QUE ce qu'un vrai joueur voit : ses propres dés,
//  l'annonce en cours et le nombre total de dés en jeu.
//  Il estime la probabilité qu'une annonce soit vraie, puis choisit :
//  surenchérir, crier « Menteur ! » ou crier « Exact ! ».
//  Un peu de hasard le rend moins prévisible (il bluffe parfois).
// =============================================================

import { Bid, checkBid } from "./bids";

export type BotView = {
  hand: number[];
  bid: Bid | null;
  totalDice: number;
  palifico: boolean;
  canExact?: boolean; // Exact permis ? (pas sa propre annonce, pas en Palifico, pas à 2 joueurs)
};

export type BotDecision =
  | { type: "bid"; qty: number; face: number }
  | { type: "liar" }
  | { type: "exact" };

// ---------- petites maths ----------

function choose(n: number, k: number) {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

/** Probabilité d'avoir exactement k succès sur n dés (proba p chacun). */
const pExactly = (n: number, k: number, p: number) =>
  choose(n, k) * p ** k * (1 - p) ** (n - k);

/** Probabilité d'avoir au moins k succès sur n dés. */
function pAtLeast(n: number, k: number, p: number) {
  if (k <= 0) return 1;
  if (k > n) return 0;
  let s = 0;
  for (let i = k; i <= n; i++) s += pExactly(n, i, p);
  return s;
}

/** Chance qu'un dé inconnu corresponde à la valeur (pax jokers ou non). */
const faceChance = (face: number, palifico: boolean) =>
  face === 1 || palifico ? 1 / 6 : 2 / 6;

/** Combien de mes dés comptent pour cette valeur. */
const mine = (hand: number[], face: number, palifico: boolean) =>
  hand.filter((d) => d === face || (!palifico && face !== 1 && d === 1)).length;

/** Probabilité que l'annonce soit vraie, vue par ce bot. */
export function probTrue(v: BotView, bid: Bid) {
  const unknown = v.totalDice - v.hand.length;
  const need = bid.qty - mine(v.hand, bid.face, v.palifico);
  return pAtLeast(unknown, need, faceChance(bid.face, v.palifico));
}

/** Probabilité qu'il y ait pile le bon nombre. */
export function probExact(v: BotView, bid: Bid) {
  const unknown = v.totalDice - v.hand.length;
  const need = bid.qty - mine(v.hand, bid.face, v.palifico);
  if (need < 0) return 0;
  return pExactly(unknown, need, faceChance(bid.face, v.palifico));
}

// ---------- décision ----------

export function decide(v: BotView, rand: () => number = Math.random): BotDecision {
  // Toutes les annonces autorisées, avec leur probabilité d'être vraies
  const options: { bid: Bid; p: number }[] = [];
  const maxQty = v.bid ? Math.min(v.totalDice, v.bid.qty * 2 + 3) : v.totalDice;
  for (let qty = 1; qty <= maxQty; qty++)
    for (let face = 1; face <= 6; face++) {
      const bid = { qty, face };
      if (checkBid(v.bid, bid, v.palifico, v.totalDice) === null)
        options.push({ bid, p: probTrue(v, bid) });
    }

  // On préfère les annonces sûres, mais aussi les plus « petites »
  // (inutile de monter trop haut), avec un peu de hasard pour bluffer.
  const score = (o: { bid: Bid; p: number }) =>
    o.p - o.bid.qty * 0.015 + (rand() - 0.5) * 0.25;
  const best = options.reduce<{ bid: Bid; p: number; s: number } | null>((acc, o) => {
    const s = score(o);
    return !acc || s > acc.s ? { ...o, s } : acc;
  }, null);

  // Première annonce de la manche : on part de la valeur qu'on a le plus,
  // et on annonce un peu en dessous de ce qu'on espère trouver sur la table
  if (!v.bid) {
    const unknown = v.totalDice - v.hand.length;
    let face = 2;
    let bestMine = -1;
    for (let f = 2; f <= 6; f++) {
      const m = mine(v.hand, f, v.palifico) + rand() * 0.9; // hasard pour départager
      if (m > bestMine) { bestMine = m; face = f; }
    }
    const expected = mine(v.hand, face, v.palifico) + unknown * faceChance(face, v.palifico);
    const qty = Math.max(1, Math.min(v.totalDice, Math.floor(expected - 1 + rand() * 1.5)));
    return { type: "bid", qty, face };
  }

  const pCurrent = probTrue(v, v.bid);
  const pEx = probExact(v, v.bid);

  // « Exact ! » quand c'est vraiment plausible (et pas à chaque fois)
  if (v.canExact !== false && pEx > 0.33 && rand() < 0.4) return { type: "exact" };

  // « Menteur ! » si l'annonce semble fausse et qu'on n'a pas mieux
  const bestP = best?.p ?? 0;
  if (!best || (pCurrent < 0.4 && 1 - pCurrent > bestP + 0.1)) return { type: "liar" };

  return { type: "bid", qty: best.bid.qty, face: best.bid.face };
}

// ---------- noms ----------

export const BOT_NAMES = [
  "Pablo", "Rosa", "Diego", "Carmen", "Hugo", "Lola", "Tito", "Inès",
  "Paco", "Nina", "Rico", "Alma",
];
