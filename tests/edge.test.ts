// Cas limites demandés dans le brief (phase 1)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addBot, addPlayer, botStep, callExact, callLiar, newGame, nextRound, placeBid,
  restart, startGame, turnKey, viewFor, GameState,
} from "../lib/rules";

function game(n = 3) {
  const s = newGame("T");
  for (let i = 0; i < n; i++) addPlayer(s, `p${i}`, `J${i}`, `t${i}`);
  startGame(s, "p0");
  return s;
}

test("distribution : 5 dés chacun, valeurs toujours entre 1 et 6", () => {
  for (let k = 0; k < 200; k++) {
    const s = game(4);
    for (const p of s.players) {
      assert.equal(p.hand.length, 5);
      assert.ok(p.hand.every((d) => Number.isInteger(d) && d >= 1 && d <= 6));
    }
  }
});

test("relance : chaque manche, le nombre de dés lancés = dés restants", () => {
  const s = game(3);
  s.players[0].hand = [2, 2, 2, 2, 2]; s.players[1].hand = [3, 3, 3, 3, 3]; s.players[2].hand = [4, 4, 4, 4, 4];
  s.turnId = "p0";
  placeBid(s, "p0", { qty: 9, face: 6 });
  callLiar(s, "p1");
  nextRound(s, "p1");
  assert.equal(s.players[0].hand.length, 4);
  assert.equal(s.players[1].hand.length, 5);
});

test("on ne peut pas jouer hors de son tour, ni une fois éliminé", () => {
  const s = game(3);
  const other = s.players.find((p) => p.id !== s.turnId)!;
  assert.throws(() => placeBid(s, other.id, { qty: 1, face: 3 }), /tour/);
  assert.throws(() => callLiar(s, s.turnId!), /annoncé/); // personne n'a encore annoncé
  assert.throws(() => callExact(s, s.turnId!), /annoncé/);
});

test("un joueur éliminé est sauté dans l'ordre du tour", () => {
  const s = game(3);
  s.players[1].diceCount = 0; s.players[1].hand = [];
  s.players[0].hand = [2, 2, 2, 2, 2]; s.players[2].hand = [5, 5, 5, 5, 5];
  s.turnId = "p0";
  placeBid(s, "p0", { qty: 2, face: 2 });
  assert.equal(s.turnId, "p2");
});

test("secret : pendant la manche, la vue d'un joueur ne contient aucun dé adverse", () => {
  const s = game(4);
  const v = JSON.stringify(viewFor(s, "p0"));
  for (const p of s.players.slice(1)) assert.ok(!v.includes(`"hand":[${p.hand.join(",")}]`) || p.hand.join() === s.players[0].hand.join());
  const spectator = viewFor(s, null);
  assert.equal(spectator.me, null);
  assert.ok(!JSON.stringify(spectator).includes("token"));
  assert.ok(!JSON.stringify(spectator).includes('"hand"'));
});

test("révélation : les dés deviennent publics seulement après menteur/exact", () => {
  const s = game(2);
  s.players[0].hand = [1, 4, 4, 2, 6]; s.players[1].hand = [4, 3, 3, 3, 1];
  s.turnId = "p0";
  placeBid(s, "p0", { qty: 4, face: 4 });
  callLiar(s, "p1");
  const v = viewFor(s, "p1");
  assert.deepEqual(v.reveal!.hands["p0"], [1, 4, 4, 2, 6]);
  assert.equal(v.reveal!.count, 5); // trois 4 + deux pax
  assert.equal(v.me!.hand.length, 0); // plus de main « secrète » pendant la révélation
});

test("une actualisation (relecture de l'état) ne relance jamais les dés", () => {
  const s = game(3);
  const before = JSON.stringify(s.players.map((p) => p.hand));
  viewFor(s, "p0"); viewFor(s, "p1"); viewFor(s, null);
  assert.equal(JSON.stringify(s.players.map((p) => p.hand)), before);
});

test("rejouer : tout le monde repart à 5 dés, palifico remis à zéro", () => {
  const s: GameState = newGame("T");
  addPlayer(s, "h", "Tom", "t");
  addBot(s, "h"); addBot(s, "h");
  s.players[0].isBot = true;
  startGame(s, "h");
  while (s.phase !== "finished") s.phase === "reveal" ? nextRound(s, "h") : botStep(s, turnKey(s));
  restart(s, "h");
  assert.ok(s.players.every((p) => p.diceCount === 5 && !p.palificoUsed && p.hand.length === 5));
  assert.equal(s.round, 1);
});
