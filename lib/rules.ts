// =============================================================
//  Moteur de règles du Perudo — version maison de Tom & co
// =============================================================
//  - « Menteur » à la place de « dudo »
//  - « Pax » = miser sur les 1 (interdit en première annonce)
//  - Passer aux pax : quantité divisée par deux (arrondie au-dessus)
//  - Revenir des pax : au moins le double + 1
//  - « Exact » : juste → +1 dé (max 5) ; faux → −1 dé
//  - Palifico : uniquement la première manche où un joueur tombe
//    à 1 dé ; pendant cette manche les 1 ne sont pas jokers
// =============================================================

import { randomBytes, randomInt, randomUUID } from "crypto";
import { BOT_NAMES, decide } from "./bot";
import { BOT_AVATARS, MAPS } from "./catalog";

export const MAX_DICE = 5;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;

import { Bid, checkBid, countMatching } from "./bids";
export type { Bid } from "./bids";
export { checkBid, countMatching } from "./bids";
export type Phase = "lobby" | "bidding" | "reveal" | "finished";

export type Player = {
  id: string;
  name: string;
  seat: number;
  token: string; // secret, jamais envoyé aux autres joueurs
  hand: number[]; // secret tant que la manche n'est pas révélée
  diceCount: number;
  palificoUsed: boolean;
  isHost: boolean;
  isBot: boolean; // joué automatiquement par le serveur
  profileId?: string | null; // profil permanent (stats, gobelets)
  avatar?: string | null; // avatar par défaut, ou "photo:<profil>:<version>"
  cup?: string; // gobelet équipé (purement cosmétique)
  left?: boolean; // a quitté la partie
  st?: PlayerStats; // exploits de la partie en cours
  frame?: string | null; title?: string | null; victory?: string | null; level?: number | null; fxOwned?: string[] | null;
};

// bids : annonces valides ; lost : dés perdus ; one : est tombé à 1 dé (pour le Phénix)
export type PlayerStats = { liarCalls: number; liarWins: number; exactCalls: number; exactWins: number; bids?: number; lost?: number; one?: boolean };
const freshStats = (): PlayerStats => ({ liarCalls: 0, liarWins: 0, exactCalls: 0, exactWins: 0, bids: 0, lost: 0, one: false });

export type Reveal = {
  call: "liar" | "exact";
  callerId: string;
  bidderId: string;
  bid: Bid;
  count: number;
  palifico: boolean;
  hands: Record<string, number[]>;
  loserId: string | null; // celui qui perd un dé
  gainerId: string | null; // celui qui gagne un dé (exact réussi)
  eliminatedId: string | null;
};

export type GameState = {
  code: string;
  phase: Phase;
  round: number;
  palifico: boolean; // la manche en cours est-elle un palifico ?
  palificoNext: boolean;
  players: Player[];
  turnId: string | null;
  bid: Bid | null;
  bidderId: string | null;
  history: { playerId: string; bid: Bid }[];
  reveal: Reveal | null;
  nextStarterId: string | null;
  winnerId: string | null;
  map?: string; // décor de la partie (cosmétique)
  config?: GameConfig; // règles figées à la création du salon
  uid?: string;
  gameNo?: number; // numéro de la partie dans ce salon (rejouer = +1)
  recorded?: boolean; // résultats déjà enregistrés dans les stats ?
  abandoned?: boolean; // plus aucun humain : partie arrêtée, non comptée
};

export class RuleError extends Error {}

/** Variantes réglables par l'admin. Figées dans chaque partie dès sa création. */
export type GameConfig = { startDice: number; exactEnabled: boolean; palificoEnabled: boolean };
export const DEFAULT_CONFIG: GameConfig = { startDice: MAX_DICE, exactEnabled: true, palificoEnabled: true };
const cfg = (s: GameState) => s.config ?? DEFAULT_CONFIG;
const startDice = (s: GameState) => cfg(s).startDice;

/** Maps autorisées (gérées par l'admin) : toutes, et celles du tirage au hasard. */
export type MapPool = { all: string[]; random: string[] };
export const DEFAULT_POOL: MapPool = { all: MAPS.map((m) => m.id), random: MAPS.map((m) => m.id) };
const pick = (list: string[]) => list[randomInt(0, list.length)];

// ---------- utilitaires ----------

export const alive = (s: GameState) => s.players.filter((p) => p.diceCount > 0);
export const totalDice = (s: GameState) =>
  alive(s).reduce((n, p) => n + p.diceCount, 0);
const byId = (s: GameState, id: string) => {
  const p = s.players.find((x) => x.id === id);
  if (!p) throw new RuleError("Joueur introuvable");
  return p;
};

/** Prochain joueur encore en vie après `fromId` (sens des sièges). */
export function nextAliveAfter(s: GameState, fromId: string): string {
  const seats = [...s.players].sort((a, b) => a.seat - b.seat);
  const i = seats.findIndex((p) => p.id === fromId);
  for (let k = 1; k <= seats.length; k++) {
    const p = seats[(i + k) % seats.length];
    if (p.diceCount > 0) return p.id;
  }
  throw new RuleError("Plus aucun joueur en vie");
}

const roll = (n: number) => Array.from({ length: n }, () => randomInt(1, 7));

// ---------- création / lobby ----------

export function newGame(code: string, map?: string, opts: { config?: GameConfig; pool?: MapPool } = {}): GameState {
  const pool = opts.pool ?? DEFAULT_POOL;
  const randomPool = pool.random.length ? pool.random : pool.all;
  return {
    code,
    map: map && pool.all.includes(map) ? map : pick(randomPool.length ? randomPool : DEFAULT_POOL.all),
    config: opts.config ?? DEFAULT_CONFIG,
    gameNo: 1,
    uid: randomInt(0, 2 ** 40).toString(36), // identifiant unique (un code de salon peut resservir)
    recorded: false,
    phase: "lobby",
    round: 0,
    palifico: false,
    palificoNext: false,
    players: [],
    turnId: null,
    bid: null,
    bidderId: null,
    history: [],
    reveal: null,
    nextStarterId: null,
    winnerId: null,
  };
}

// cosmétiques : purement visuels, aucun effet sur le jeu
export type PlayerExtra = { profileId?: string | null; avatar?: string | null; cup?: string; frame?: string | null; title?: string | null; victory?: string | null; level?: number | null; fxOwned?: string[] | null };

export function addPlayer(s: GameState, id: string, name: string, token: string, extra: PlayerExtra = {}) {
  if (s.phase !== "lobby") throw new RuleError("La partie a déjà commencé");
  if (s.players.length >= MAX_PLAYERS) throw new RuleError("La table est pleine");
  const clean = name.trim().slice(0, 20);
  if (!clean) throw new RuleError("Choisis un pseudo");
  if (s.players.some((p) => p.name.toLowerCase() === clean.toLowerCase()))
    throw new RuleError("Ce pseudo est déjà pris");
  s.players.push({
    id,
    name: clean,
    seat: s.players.length,
    token,
    hand: [],
    diceCount: startDice(s),
    palificoUsed: false,
    isHost: s.players.length === 0,
    isBot: false,
    profileId: extra.profileId ?? null,
    avatar: extra.avatar ?? null,
    cup: extra.cup ?? "classic",
    frame: extra.frame ?? null, title: extra.title ?? null, victory: extra.victory ?? null, level: extra.level ?? null, fxOwned: extra.fxOwned ?? null,
    st: freshStats(),
  });
}

export function setMap(s: GameState, byPlayerId: string, map: string, pool: MapPool = DEFAULT_POOL) {
  const p = byId(s, byPlayerId);
  if (!p.isHost) throw new RuleError("Seul l'hôte peut choisir la map");
  if (s.phase !== "lobby") throw new RuleError("La partie a déjà commencé");
  if (map === "random") s.map = pick(pool.random.length ? pool.random : pool.all);
  else if (pool.all.includes(map)) s.map = map;
  else throw new RuleError("Map inconnue");
}

/** Un joueur quitte : il est retiré (salle d'attente) ou éliminé (partie en cours). */
export function leaveGame(s: GameState, playerId: string) {
  const p = byId(s, playerId);
  const humansLeft = () => s.players.filter((x) => !x.isBot && !x.left);
  if (s.phase === "lobby") {
    s.players = s.players.filter((x) => x.id !== playerId);
    s.players.forEach((x, i) => (x.seat = i));
  } else {
    p.left = true;
    if (s.phase !== "finished") {
      const wasTurn = s.turnId === playerId;
      // son annonce en cours n'a plus de sens : la manche repart de zéro
      if (s.phase === "bidding" && s.bidderId === playerId) { s.bid = null; s.bidderId = null; }
      p.diceCount = 0;
      p.hand = [];
      const alivePlayers = alive(s);
      if (alivePlayers.length <= 1) {
        s.phase = "finished";
        s.turnId = null;
        s.winnerId = alivePlayers[0]?.id ?? null;
      } else if (s.phase === "bidding" && wasTurn) {
        s.turnId = nextAliveAfter(s, playerId);
      } else if (s.phase === "reveal" && s.nextStarterId === playerId) {
        s.nextStarterId = nextAliveAfter(s, playerId);
      }
    }
  }
  // l'hôte part : un autre humain reprend la main
  if (p.isHost) {
    p.isHost = false;
    const next = humansLeft()[0];
    if (next) next.isHost = true;
  }
  // plus aucun humain : on arrête tout (et rien n'est compté)
  if (humansLeft().length === 0) {
    s.abandoned = true;
    if (s.phase !== "lobby") { s.phase = "finished"; s.turnId = null; }
  }
}

/** Une partie compte dans les stats seulement avec au moins 2 vrais joueurs. */
export const countsForStats = (s: GameState) =>
  !s.abandoned && s.players.filter((p) => !p.isBot && p.profileId).length >= 2;

export type ResultRow = {
  game_id: string; profile_id: string; won: boolean; humans: number; rounds: number;
  liar_calls: number; liar_wins: number; exact_calls: number; exact_wins: number;
  // pour les récompenses (non stockés dans la table des résultats)
  extra: { bids: number; phoenix: boolean; flawless: boolean; left: boolean; bots: number };
};

/**
 * À appeler quand une partie se termine. Renvoie les lignes à enregistrer
 * (une seule fois grâce à `recorded`) — vide si la partie ne compte pas.
 */
export function takeResults(s: GameState): ResultRow[] {
  if (s.phase !== "finished" || s.recorded) return [];
  s.recorded = true;
  if (!countsForStats(s)) return [];
  const humans = s.players.filter((p) => !p.isBot && p.profileId);
  return humans.map((p) => ({
    game_id: s.uid ? `${s.code}:${s.uid}:${s.gameNo ?? 1}` : `${s.code}:${s.gameNo ?? 1}`,
    profile_id: p.profileId!,
    won: s.winnerId === p.id,
    humans: humans.length,
    rounds: s.round,
    liar_calls: p.st?.liarCalls ?? 0,
    liar_wins: p.st?.liarWins ?? 0,
    exact_calls: p.st?.exactCalls ?? 0,
    exact_wins: p.st?.exactWins ?? 0,
    extra: {
      bids: p.st?.bids ?? 0,
      phoenix: s.winnerId === p.id && !!p.st?.one,
      flawless: s.winnerId === p.id && (p.st?.lost ?? 0) === 0,
      left: !!p.left,
      bots: s.players.filter((x) => x.isBot).length,
    },
  }));
}

// ---------- bots ----------

export function addBot(s: GameState, byPlayerId: string) {
  const host = byId(s, byPlayerId);
  if (!host.isHost) throw new RuleError("Seul l'hôte peut ajouter des bots");
  if (s.phase !== "lobby") throw new RuleError("La partie a déjà commencé");
  if (s.players.length >= MAX_PLAYERS) throw new RuleError("La table est pleine");
  const taken = new Set(s.players.map((p) => p.name.toLowerCase()));
  const free = BOT_NAMES.filter((n) => !taken.has(n.toLowerCase()));
  const name = free[randomInt(0, free.length)] ?? `Bot ${s.players.length + 1}`;
  s.players.push({
    id: randomUUID(),
    name,
    seat: s.players.length,
    token: randomBytes(24).toString("hex"),
    hand: [],
    diceCount: startDice(s),
    palificoUsed: false,
    isHost: false,
    isBot: true,
    avatar: BOT_AVATARS[s.players.length % BOT_AVATARS.length],
    cup: "classic",
    st: freshStats(),
  });
}

export function removeBot(s: GameState, byPlayerId: string, botId: string) {
  const host = byId(s, byPlayerId);
  if (!host.isHost) throw new RuleError("Seul l'hôte peut retirer des bots");
  if (s.phase !== "lobby") throw new RuleError("La partie a déjà commencé");
  const bot = byId(s, botId);
  if (!bot.isBot) throw new RuleError("Ce joueur n'est pas un bot");
  s.players = s.players.filter((p) => p.id !== botId);
  s.players.forEach((p, i) => (p.seat = i));
}

/** Identifie précisément « ce moment » de la partie (pour ne pas jouer deux fois le même coup). */
export const turnKey = (s: GameState) => `${s.round}:${s.history.length}:${s.turnId ?? "-"}`;

/** Fait jouer le bot dont c'est le tour. */
export function botStep(s: GameState, expectedKey: string) {
  if (s.phase !== "bidding") throw new RuleError("Ce n'est pas le moment");
  if (turnKey(s) !== expectedKey) throw new RuleError("Coup déjà joué");
  const bot = s.players.find((p) => p.id === s.turnId);
  if (!bot || !bot.isBot) throw new RuleError("Ce n'est pas le tour d'un bot");
  const d = decide({ hand: bot.hand, bid: s.bid, totalDice: totalDice(s), palifico: s.palifico });
  try {
    if (d.type === "liar") return callLiar(s, bot.id);
    if (d.type === "exact") return cfg(s).exactEnabled ? callExact(s, bot.id) : callLiar(s, bot.id);
    return placeBid(s, bot.id, { qty: d.qty, face: d.face });
  } catch {
    // filet de sécurité : si jamais l'annonce choisie n'est pas valable
    if (s.bid) return callLiar(s, bot.id);
    return placeBid(s, bot.id, { qty: 1, face: 2 });
  }
}

// ---------- déroulé d'une manche ----------

function startRound(s: GameState, starterId: string) {
  s.round += 1;
  s.palifico = s.palificoNext;
  s.palificoNext = false;
  for (const p of s.players) p.hand = p.diceCount > 0 ? roll(p.diceCount) : [];
  s.phase = "bidding";
  s.turnId = starterId;
  s.bid = null;
  s.bidderId = null;
  s.history = [];
  s.reveal = null;
  s.nextStarterId = null;
}

export function startGame(s: GameState, byPlayerId: string) {
  const p = byId(s, byPlayerId);
  if (!p.isHost) throw new RuleError("Seul l'hôte peut lancer la partie");
  if (s.phase !== "lobby") throw new RuleError("La partie a déjà commencé");
  if (s.players.length < MIN_PLAYERS) throw new RuleError("Il faut au moins 2 joueurs");
  const starter = s.players[randomInt(0, s.players.length)];
  startRound(s, starter.id);
}

function assertTurn(s: GameState, playerId: string) {
  if (s.phase !== "bidding") throw new RuleError("Ce n'est pas le moment d'annoncer");
  if (s.turnId !== playerId) throw new RuleError("Ce n'est pas ton tour");
}

export function placeBid(s: GameState, playerId: string, bid: Bid) {
  assertTurn(s, playerId);
  const err = checkBid(s.bid, bid, s.palifico, totalDice(s));
  if (err) throw new RuleError(err);
  s.bid = { qty: bid.qty, face: bid.face };
  s.bidderId = playerId;
  s.history.push({ playerId, bid: s.bid });
  const me = byId(s, playerId);
  me.st ??= freshStats();
  me.st.bids = (me.st.bids ?? 0) + 1;
  s.turnId = nextAliveAfter(s, playerId);
}

function loseDie(s: GameState, playerId: string) {
  const p = byId(s, playerId);
  p.diceCount -= 1;
  p.st ??= freshStats();
  p.st.lost = (p.st.lost ?? 0) + 1;
  if (p.diceCount === 1) p.st.one = true;
  // Palifico : seulement la toute première fois que le joueur tombe à 1 dé
  if (p.diceCount === 1 && !p.palificoUsed && cfg(s).palificoEnabled) {
    p.palificoUsed = true;
    s.palificoNext = true;
  }
  return p.diceCount === 0;
}

function finishResolution(s: GameState, reveal: Reveal, starterCandidate: string) {
  s.reveal = reveal;
  s.turnId = null;
  const left = alive(s);
  if (left.length === 1) {
    s.phase = "finished";
    s.winnerId = left[0].id;
    s.palificoNext = false;
    return;
  }
  s.phase = "reveal";
  const cand = byId(s, starterCandidate);
  s.nextStarterId = cand.diceCount > 0 ? cand.id : nextAliveAfter(s, cand.id);
}

function snapshotHands(s: GameState) {
  const hands: Record<string, number[]> = {};
  for (const p of alive(s)) hands[p.id] = [...p.hand];
  return hands;
}

export function callLiar(s: GameState, playerId: string) {
  assertTurn(s, playerId);
  if (!s.bid || !s.bidderId) throw new RuleError("Personne n'a encore annoncé");
  const hands = snapshotHands(s);
  const count = countMatching(Object.values(hands), s.bid.face, s.palifico);
  const bidWasTrue = count >= s.bid.qty;
  const loserId = bidWasTrue ? playerId : s.bidderId;
  const caller = byId(s, playerId);
  caller.st ??= freshStats();
  caller.st.liarCalls++;
  if (!bidWasTrue) caller.st.liarWins++;
  const eliminated = loseDie(s, loserId);
  finishResolution(
    s,
    {
      call: "liar",
      callerId: playerId,
      bidderId: s.bidderId,
      bid: s.bid,
      count,
      palifico: s.palifico,
      hands,
      loserId,
      gainerId: null,
      eliminatedId: eliminated ? loserId : null,
    },
    loserId
  );
}

export function callExact(s: GameState, playerId: string) {
  assertTurn(s, playerId);
  if (!cfg(s).exactEnabled) throw new RuleError("« Exact » est désactivé dans ce salon");
  if (!s.bid || !s.bidderId) throw new RuleError("Personne n'a encore annoncé");
  const hands = snapshotHands(s);
  const count = countMatching(Object.values(hands), s.bid.face, s.palifico);
  const me = byId(s, playerId);
  let loserId: string | null = null;
  let gainerId: string | null = null;
  let eliminated = false;
  me.st ??= freshStats();
  me.st.exactCalls++;
  if (count === s.bid.qty) {
    me.st.exactWins++;
    if (me.diceCount < startDice(s)) me.diceCount += 1;
    gainerId = playerId;
  } else {
    loserId = playerId;
    eliminated = loseDie(s, playerId);
  }
  finishResolution(
    s,
    {
      call: "exact",
      callerId: playerId,
      bidderId: s.bidderId,
      bid: s.bid,
      count,
      palifico: s.palifico,
      hands,
      loserId,
      gainerId,
      eliminatedId: eliminated ? playerId : null,
    },
    playerId
  );
}

export function nextRound(s: GameState, playerId: string) {
  byId(s, playerId);
  if (s.phase !== "reveal" || !s.nextStarterId)
    throw new RuleError("La manche n'est pas terminée");
  startRound(s, s.nextStarterId);
}

export function restart(s: GameState, playerId: string) {
  const p = byId(s, playerId);
  if (!p.isHost) throw new RuleError("Seul l'hôte peut relancer une partie");
  if (s.phase !== "finished") throw new RuleError("La partie n'est pas terminée");
  // ceux qui ont quitté ne reviennent pas à la table
  s.players = s.players.filter((x) => !x.left);
  s.players.forEach((x, i) => (x.seat = i));
  if (s.players.length < MIN_PLAYERS) throw new RuleError("Il faut au moins 2 joueurs");
  for (const x of s.players) {
    x.diceCount = startDice(s);
    x.palificoUsed = false;
    x.hand = [];
    x.st = freshStats();
  }
  s.gameNo = (s.gameNo ?? 1) + 1;
  s.recorded = false;
  s.abandoned = false;
  s.round = 0;
  s.winnerId = null;
  s.palificoNext = false;
  startRound(s, s.players[randomInt(0, s.players.length)].id);
}

// ---------- ce que voit chaque joueur ----------

export type PublicPlayer = Omit<Player, "token" | "hand">;
export type PlayerView = Omit<GameState, "players"> & {
  players: PublicPlayer[];
  me: { id: string; hand: number[] } | null;
  totalDice: number;
  turnKey: string;
};

export function viewFor(s: GameState, playerId: string | null): PlayerView {
  const me = playerId ? s.players.find((p) => p.id === playerId) ?? null : null;
  return {
    ...s,
    players: s.players.map(({ token: _t, hand: _h, ...pub }) => pub),
    me: me ? { id: me.id, hand: s.phase === "bidding" ? me.hand : [] } : null,
    totalDice: totalDice(s),
    turnKey: turnKey(s),
  };
}
