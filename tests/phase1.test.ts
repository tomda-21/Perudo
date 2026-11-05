// Phase 1 (moteur) : Exact restreint et hors tour, Palifico verrouillé,
// temps par joueur côté serveur, manches automatiques, relais des absents.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addBot, addPlayer, AWAY_MS, botStep, callExact, callLiar, canExact, isAway, MAX_PLAYERS,
  newGame, placeBid, startGame, tick, touch, turnKey, viewFor, GameState,
} from "../lib/rules";
import { minimalRaise } from "../lib/bids";

function setup(n = 3): GameState {
  const s = newGame("P1");
  for (let i = 0; i < n; i++) addPlayer(s, `p${i}`, `Joueur${i}`, `tok${i}`);
  startGame(s, "p0");
  return s;
}
function rig(s: GameState, hands: number[][], starter = "p0") {
  s.players.forEach((p, i) => { p.hand = hands[i]; p.diceCount = hands[i].length; });
  s.turnId = starter;
}
const expire = (s: GameState) => { s.deadline = Date.now() - 1; };

test("6 joueurs maximum", () => {
  assert.equal(MAX_PLAYERS, 6);
  const s = newGame("M");
  addPlayer(s, "h", "H", "t");
  for (let i = 0; i < 5; i++) addBot(s, "h");
  assert.throws(() => addBot(s, "h"), /pleine/);
  assert.throws(() => addPlayer(s, "x", "X", "tx"), /pleine/);
});

test("Exact : interdit à l'auteur de la dernière annonce", () => {
  const s = setup(3);
  rig(s, [[2, 3], [3, 3], [4, 5]]);
  placeBid(s, "p0", { qty: 3, face: 3 });
  assert.equal(canExact(s, "p0"), false);
  assert.throws(() => callExact(s, "p0"), /propre annonce/);
});

test("Exact : hors de son tour, avant l'annonce suivante", () => {
  const s = setup(3);
  rig(s, [[2, 3], [3, 3], [4, 5]]);
  placeBid(s, "p0", { qty: 3, face: 3 }); // c'est à p1, mais p2 crie Exact
  assert.equal(s.turnId, "p1");
  callExact(s, "p2", 1);
  assert.equal(s.phase, "reveal");
  assert.equal(s.reveal!.callerId, "p2");
  assert.equal(s.reveal!.gainerId, "p2"); // trois 3 : juste
  assert.equal(s.players[2].diceCount, 3);
});

test("Exact : trop tard si une nouvelle annonce a été validée entre-temps", () => {
  const s = setup(3);
  rig(s, [[2, 3], [3, 3], [4, 5]]);
  placeBid(s, "p0", { qty: 2, face: 3 });
  const seen = s.history.length; // p2 voit 2×3…
  placeBid(s, "p1", { qty: 3, face: 3 }); // …mais p1 surenchérit d'abord
  assert.throws(() => callExact(s, "p2", seen), /Trop tard/);
});

test("Exact : interdit à 2 joueurs et en Palifico", () => {
  const two = setup(2);
  rig(two, [[2, 3], [3, 3]]);
  placeBid(two, "p0", { qty: 2, face: 3 });
  assert.throws(() => callExact(two, "p1"), /2 joueurs/);
  const pal = setup(3);
  rig(pal, [[2], [3, 3], [4, 5]]);
  pal.palifico = true;
  placeBid(pal, "p0", { qty: 1, face: 2 });
  assert.throws(() => callExact(pal, "p1"), /Palifico/);
  assert.equal(viewFor(pal, "p1").canExact, false);
});

test("Exact juste : +1 dé, jamais plus de 5", () => {
  const s = setup(3);
  rig(s, [[2, 3], [3, 3, 3, 3, 3], [4, 5]]);
  placeBid(s, "p0", { qty: 6, face: 3 });
  callExact(s, "p1");
  assert.equal(s.reveal!.gainerId, "p1");
  assert.equal(s.players[1].diceCount, 5);
});

test("Palifico : une seule fois par joueur, il commence la manche", () => {
  const s = setup(3);
  rig(s, [[2, 2], [3, 3], [4, 5]]);
  placeBid(s, "p0", { qty: 1, face: 4 });
  callLiar(s, "p1"); // un 4 → vrai, p1 perd → 1 dé → palifico
  assert.equal(s.players[1].diceCount, 1);
  assert.equal(s.nextStarterId, "p1");
  expire(s); tick(s);
  assert.equal(s.phase, "bidding");
  assert.equal(s.palifico, true);
  assert.equal(s.turnId, "p1");
  assert.equal(s.players[1].palificoUsed, true);
  // il regagne un dé puis retombe à 1 : pas de second palifico
  s.players[1].diceCount = 2;
  rig(s, [[2, 2], [6, 6], [4, 5]], "p0");
  s.palifico = false;
  placeBid(s, "p0", { qty: 1, face: 4 });
  callLiar(s, "p1");
  assert.equal(s.players[1].diceCount, 1);
  assert.equal(s.palificoNext, false);
});

test("temps écoulé : surenchère minimale automatique", () => {
  const s = setup(3);
  rig(s, [[2, 3], [3, 3], [4, 5]]);
  placeBid(s, "p0", { qty: 2, face: 4 });
  expire(s);
  assert.equal(tick(s), true);
  assert.deepEqual(s.bid, { qty: 2, face: 5 });
  assert.equal(s.history.at(-1)!.auto, true);
  assert.equal(s.turnId, "p2");
  assert.ok(s.deadline! > Date.now() + 25_000); // nouveau tour de 30 s
});

test("temps écoulé : ouverture automatique (jamais sur les pax hors Palifico)", () => {
  const s = setup(3);
  rig(s, [[1, 1, 6], [3, 3], [4, 5]]);
  expire(s); tick(s);
  assert.equal(s.bid!.qty, 1);
  assert.notEqual(s.bid!.face, 1);
  assert.equal(s.bid!.face, 6);
});

test("temps écoulé : Dudo automatique si aucune surenchère possible", () => {
  const s = setup(2);
  rig(s, [[2], [3]]);
  placeBid(s, "p0", { qty: 2, face: 6 });
  assert.deepEqual(minimalRaise(s.bid!, false, 2), { qty: 1, face: 1 }); // 2×6 → 1 pax reste possible
  s.bid = { qty: 2, face: 1 }; // 2 pax sur 2 dés : plus rien au-dessus
  assert.equal(minimalRaise(s.bid, false, 2), null);
  expire(s); tick(s);
  assert.equal(s.phase === "reveal" || s.phase === "finished", true);
  assert.equal(s.reveal!.call, "liar");
  assert.equal(s.reveal!.callerId, "p1");
});

test("temps écoulé en Palifico : on garde la valeur", () => {
  const s = setup(3);
  rig(s, [[2], [3, 3], [4, 5]]);
  s.palifico = true;
  placeBid(s, "p0", { qty: 1, face: 1 }); // ouverture pax permise en Palifico
  expire(s); tick(s);
  assert.deepEqual(s.bid, { qty: 2, face: 1 });
});

test("le temps ne s'écoule pas avant l'échéance ; la révélation passe seule", () => {
  const s = setup(3);
  rig(s, [[2, 3], [3, 3], [4, 5]]);
  assert.equal(tick(s), false);
  placeBid(s, "p0", { qty: 2, face: 3 });
  callLiar(s, "p1");
  assert.equal(s.phase, "reveal");
  assert.equal(tick(s), false); // animations de révélation : on attend
  const round = s.round;
  expire(s); tick(s);
  assert.equal(s.phase, "bidding");
  assert.equal(s.round, round + 1);
  // la manche démarre avec un délai de secouage en plus des 30 s
  assert.ok(s.deadline! > Date.now() + 30_000);
});

test("absent depuis 60 s : un bot joue à sa place, il garde ses dés et reprend la main", () => {
  const s = setup(3);
  rig(s, [[2, 3], [3, 3], [4, 5]], "p1");
  const p1 = s.players[1];
  assert.throws(() => botStep(s, turnKey(s)), /bot/); // présent : personne ne joue pour lui
  p1.seen = Date.now() - AWAY_MS - 1;
  assert.equal(isAway(p1), true);
  assert.deepEqual(viewFor(s, "p0").away, ["p1"]);
  botStep(s, turnKey(s));
  assert.notEqual(s.turnId, "p1");
  assert.equal(p1.diceCount, 2);
  assert.equal(touch(s, "p1"), true); // il revient
  assert.equal(isAway(p1), false);
  assert.equal(touch(s, "p1"), false); // pas d'écriture à chaque lecture
});

test("les dés des adversaires restent secrets, le nombre de dés est public", () => {
  const s = setup(3);
  const v = viewFor(s, "p0");
  assert.equal(v.me!.hand.length, 5);
  assert.ok(v.players.every((p) => !("hand" in p) && !("token" in p)));
  assert.deepEqual(v.players.map((p) => p.diceCount), [5, 5, 5]);
});
