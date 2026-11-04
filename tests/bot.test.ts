import { test } from "node:test";
import assert from "node:assert/strict";
import { decide, probTrue } from "../lib/bot";
import { checkBid } from "../lib/bids";
import {
  addBot, addPlayer, botStep, newGame, nextRound, removeBot, startGame, turnKey, GameState,
} from "../lib/rules";

test("probabilités : annonce évidente vs impossible", () => {
  const v = { hand: [3, 3, 3, 1, 5], bid: null, totalDice: 10, palifico: false };
  assert.equal(probTrue(v, { qty: 4, face: 3 }), 1); // j'ai déjà 4 (dont un pax)
  assert.equal(probTrue(v, { qty: 11, face: 3 }), 0);
});

test("le bot n'ouvre jamais sur les pax et fait toujours une annonce valable", () => {
  for (let i = 0; i < 500; i++) {
    const hand = Array.from({ length: 5 }, () => 1 + Math.floor(Math.random() * 6));
    const d = decide({ hand, bid: null, totalDice: 20, palifico: false });
    assert.equal(d.type, "bid");
    if (d.type === "bid") assert.equal(checkBid(null, d, false, 20), null);
  }
});

test("le bot crie menteur sur une annonce absurde", () => {
  const d = decide({ hand: [2, 3, 4, 5, 6], bid: { qty: 9, face: 6 }, totalDice: 10, palifico: false }, () => 0.5);
  assert.equal(d.type, "liar");
});

test("lobby : ajouter / retirer des bots (hôte seulement, 8 max)", () => {
  const s = newGame("T");
  addPlayer(s, "h", "Tom", "t");
  addPlayer(s, "a", "Ami", "t2");
  assert.throws(() => addBot(s, "a"), /hôte/);
  for (let i = 0; i < 6; i++) addBot(s, "h");
  assert.equal(s.players.length, 8);
  assert.throws(() => addBot(s, "h"), /pleine/);
  const bot = s.players.find((p) => p.isBot)!;
  removeBot(s, "h", bot.id);
  assert.equal(s.players.length, 7);
  assert.deepEqual(s.players.map((p) => p.seat), [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(new Set(s.players.map((p) => p.name)).size, 7); // noms uniques
});

test("un bot ne joue pas deux fois le même coup", () => {
  const s = newGame("T");
  addPlayer(s, "h", "Tom", "t");
  addBot(s, "h");
  startGame(s, "h");
  s.turnId = s.players[1].id;
  const key = turnKey(s);
  botStep(s, key);
  assert.throws(() => botStep(s, key));
});

/** Partie complète jouée uniquement par des bots, avec nos règles. */
function fullBotGame(nBots: number) {
  const s: GameState = newGame("T");
  addPlayer(s, "h", "Tom", "t");
  for (let i = 0; i < nBots; i++) addBot(s, "h");
  s.players[0].isBot = true; // l'hôte aussi devient un bot pour le test
  startGame(s, "h");
  let steps = 0;
  while (s.phase !== "finished") {
    if (s.phase === "reveal") nextRound(s, "h");
    else botStep(s, turnKey(s));
    if (++steps > 5000) throw new Error("La partie ne se termine pas");
  }
  return { s, steps };
}

test("100 parties 100 % bots se terminent sans erreur (2 à 8 joueurs)", () => {
  let palificos = 0, exacts = 0;
  for (let g = 0; g < 100; g++) {
    const { s } = fullBotGame(1 + (g % 7));
    assert.ok(s.winnerId);
    assert.equal(s.players.filter((p) => p.diceCount > 0).length, 1);
    palificos += s.players.filter((p) => p.palificoUsed).length;
    if (s.reveal?.call === "exact") exacts++;
  }
  assert.ok(palificos > 0, "les palificos doivent se déclencher");
});
