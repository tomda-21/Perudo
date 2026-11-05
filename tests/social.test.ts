// Quitter, maps, statistiques (refonte graphique)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addBot, addPlayer, botStep, callLiar, countsForStats, leaveGame, newGame, nextRound,
  placeBid, restart, startGame, takeResults, turnKey, viewFor, GameState,
} from "../lib/rules";
import { CUPS, MAPS, isUnlocked, Stats } from "../lib/catalog";

const prof = (n: string) => ({ profileId: `prof-${n}`, avatar: "gobelin", cup: "classic" });

test("quitter la salle d'attente : retiré, et l'hôte est transmis", () => {
  const s = newGame("T");
  addPlayer(s, "h", "Tom", "t"); addPlayer(s, "a", "Ami", "t2");
  leaveGame(s, "h");
  assert.equal(s.players.length, 1);
  assert.equal(s.players[0].isHost, true);
});

test("quitter pendant son tour : éliminé, le tour passe au suivant", () => {
  const s = newGame("T");
  for (const n of ["a", "b", "c"]) addPlayer(s, n, n, n);
  startGame(s, "a");
  s.turnId = "b";
  leaveGame(s, "b");
  assert.equal(s.players[1].diceCount, 0);
  assert.equal(s.turnId, "c");
  assert.equal(s.phase, "bidding");
});

test("quitter alors qu'on a la dernière annonce : l'annonce est effacée", () => {
  const s = newGame("T");
  for (const n of ["a", "b", "c"]) addPlayer(s, n, n, n);
  startGame(s, "a");
  s.turnId = "a";
  placeBid(s, "a", { qty: 2, face: 3 });
  leaveGame(s, "a");
  assert.equal(s.bid, null);
  assert.doesNotThrow(() => placeBid(s, s.turnId!, { qty: 1, face: 4 }));
});

test("à 2 joueurs, si l'un quitte, l'autre gagne", () => {
  const s = newGame("T");
  addPlayer(s, "a", "a", "a", prof("a")); addPlayer(s, "b", "b", "b", prof("b"));
  startGame(s, "a");
  leaveGame(s, "a");
  assert.equal(s.phase, "finished");
  assert.equal(s.winnerId, "b");
});

test("partie contre des bots seulement : on quitte, tout s'arrête, rien n'est compté", () => {
  const s = newGame("T");
  addPlayer(s, "h", "Tom", "t", prof("h"));
  addBot(s, "h"); addBot(s, "h");
  startGame(s, "h");
  leaveGame(s, "h");
  assert.equal(s.abandoned, true);
  assert.equal(s.phase, "finished");
  assert.deepEqual(takeResults(s), []);
});

test("stats : comptées seulement avec 2 humains, et une seule fois", () => {
  const s: GameState = newGame("T");
  addPlayer(s, "a", "a", "a", prof("a")); addPlayer(s, "b", "b", "b", prof("b"));
  addBot(s, "a");
  assert.equal(countsForStats(s), true);
  startGame(s, "a");
  s.players[0].hand = [2, 2, 2, 2, 2]; s.players[1].hand = [3, 3, 3, 3, 3]; s.players[2].hand = [4, 4, 4, 4, 4];
  s.turnId = "a";
  placeBid(s, "a", { qty: 9, face: 6 });
  callLiar(s, "b");
  assert.equal(s.players[1].st!.liarWins, 1);
  // on termine la partie avec les bots pour tout le monde
  s.players.forEach((p) => (p.isBot = true));
  while (s.phase !== "finished") s.phase === "reveal" ? nextRound(s, "a") : botStep(s, turnKey(s));
  s.players.slice(0, 2).forEach((p) => (p.isBot = false));
  const rows = takeResults(s);
  assert.equal(rows.length, 2);
  assert.equal(rows.filter((r) => r.won).length <= 1, true);
  assert.match(rows[0].game_id, /^T:[a-z0-9]+:1$/); // identifiant unique par partie
  assert.deepEqual(takeResults(s), []); // jamais deux fois
  restart(s, s.players.find((p) => p.isHost)!.id);
  assert.equal(s.gameNo, 2);
  assert.equal(s.recorded, false);
});

test("solo contre des bots : partie d'entraînement, non comptée", () => {
  const s = newGame("T");
  addPlayer(s, "h", "Tom", "t", prof("h"));
  addBot(s, "h");
  assert.equal(countsForStats(s), false);
});

test("gobelets : conditions de déblocage", () => {
  const st = (o: Partial<Stats>): Stats => ({ played: 0, wins: 0, losses: 0, rate: 0, liarCalls: 0, liarWins: 0, exactCalls: 0, exactWins: 0, winStreak: 0, bestWinStreak: 0, ...o });
  const royal = CUPS.find((c) => c.id === "royal")!;
  assert.equal(isUnlocked(CUPS[0].cond, st({})), true);
  assert.equal(isUnlocked(royal.cond, st({ wins: 4 })), false);
  assert.equal(isUnlocked(royal.cond, st({ wins: 5 })), true);
});
