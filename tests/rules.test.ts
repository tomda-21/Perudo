import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addPlayer, callExact, callLiar, checkBid, countMatching, newGame,
  nextRound, placeBid, startGame, viewFor, GameState,
} from "../lib/rules";

function setup(n = 3): GameState {
  const s = newGame("TEST");
  for (let i = 0; i < n; i++) addPlayer(s, `p${i}`, `Joueur${i}`, `tok${i}`);
  startGame(s, "p0");
  return s;
}
/** Force des dés et le joueur qui commence */
function rig(s: GameState, hands: number[][], starter = "p0") {
  s.players.forEach((p, i) => { p.hand = hands[i]; p.diceCount = hands[i].length; });
  s.turnId = starter;
}

test("ouverture : pax interdit", () => {
  assert.match(checkBid(null, { qty: 2, face: 1 }, false, 15)!, /pax/);
  assert.equal(checkBid(null, { qty: 2, face: 3 }, false, 15), null);
});

test("montée classique", () => {
  const p = { qty: 3, face: 4 };
  assert.equal(checkBid(p, { qty: 3, face: 5 }, false, 15), null);
  assert.equal(checkBid(p, { qty: 4, face: 2 }, false, 15), null);
  assert.ok(checkBid(p, { qty: 3, face: 3 }, false, 15));
  assert.ok(checkBid(p, { qty: 2, face: 6 }, false, 15));
});

test("passage aux pax : moitié arrondie au-dessus", () => {
  assert.equal(checkBid({ qty: 5, face: 4 }, { qty: 3, face: 1 }, false, 15), null);
  assert.ok(checkBid({ qty: 5, face: 4 }, { qty: 2, face: 1 }, false, 15));
  assert.equal(checkBid({ qty: 6, face: 4 }, { qty: 3, face: 1 }, false, 15), null);
});

test("retour des pax : double + 1", () => {
  assert.equal(checkBid({ qty: 3, face: 1 }, { qty: 7, face: 2 }, false, 15), null);
  assert.ok(checkBid({ qty: 3, face: 1 }, { qty: 6, face: 6 }, false, 15));
  assert.equal(checkBid({ qty: 3, face: 1 }, { qty: 4, face: 1 }, false, 15), null);
});

test("pas plus de dés que ceux en jeu", () => {
  assert.ok(checkBid(null, { qty: 16, face: 3 }, false, 15));
});

test("comptage : 1 jokers sauf palifico et sauf pax", () => {
  const hands = [[1, 3, 3], [1, 1, 5]];
  assert.equal(countMatching(hands, 3, false), 5);
  assert.equal(countMatching(hands, 3, true), 2);
  assert.equal(countMatching(hands, 1, false), 3);
});

test("menteur : l'annonceur perd si l'annonce est fausse", () => {
  const s = setup();
  rig(s, [[2, 2, 3, 4, 5], [6, 6, 6, 6, 6], [5, 5, 5, 5, 5]]);
  placeBid(s, "p0", { qty: 4, face: 2 }); // seulement deux 2
  callLiar(s, "p1");
  assert.equal(s.reveal!.loserId, "p0");
  assert.equal(s.players[0].diceCount, 4);
  assert.equal(s.nextStarterId, "p0");
});

test("menteur : le contestataire perd si l'annonce est juste", () => {
  const s = setup();
  rig(s, [[2, 2, 1, 4, 5], [2, 6, 6, 6, 6], [5, 5, 5, 5, 5]]);
  placeBid(s, "p0", { qty: 4, face: 2 }); // 2,2,1(joker),2 = 4
  callLiar(s, "p1");
  assert.equal(s.reveal!.loserId, "p1");
});

test("exact juste : +1 dé (max 5)", () => {
  const s = setup();
  rig(s, [[2, 2, 3, 4], [2, 6, 6, 6, 6], [5, 5, 5, 5, 5]]);
  placeBid(s, "p0", { qty: 3, face: 2 }); // exactement trois 2
  callExact(s, "p1");
  assert.equal(s.reveal!.gainerId, "p1");
  assert.equal(s.players[1].diceCount, 5); // déjà à 5 → reste 5
  const s2 = setup();
  rig(s2, [[2, 2, 3, 4], [2, 6, 6, 6, 6], [5, 5, 5, 5, 5]]);
  placeBid(s2, "p0", { qty: 3, face: 2 });
  placeBid(s2, "p1", { qty: 3, face: 3 }); // un 3 seulement
  placeBid(s2, "p2", { qty: 4, face: 6 }); // quatre 6 exactement
  callExact(s2, "p0");
  assert.equal(s2.players[0].diceCount, 5);
  assert.equal(s2.nextStarterId, "p0");
});

test("exact faux : −1 dé", () => {
  const s = setup();
  rig(s, [[2, 2, 3, 4, 5], [6, 6, 6, 6, 6], [5, 5, 5, 5, 5]]);
  placeBid(s, "p0", { qty: 3, face: 2 });
  callExact(s, "p1");
  assert.equal(s.reveal!.loserId, "p1");
  assert.equal(s.players[1].diceCount, 4);
});

test("palifico : seulement la première fois à 1 dé", () => {
  const s = setup();
  rig(s, [[2, 3], [6, 6, 6, 6, 6], [5, 5, 5, 5, 5]]);
  placeBid(s, "p0", { qty: 5, face: 2 });
  callLiar(s, "p1"); // faux → p0 tombe à 1 dé
  assert.equal(s.players[0].diceCount, 1);
  nextRound(s, "p1");
  assert.equal(s.palifico, true);
  // pendant le palifico les 1 ne comptent pas comme jokers
  rig(s, [[1], [1, 1, 3, 4, 5], [3, 5, 5, 5, 5]], "p0");
  placeBid(s, "p0", { qty: 2, face: 3 });
  callLiar(s, "p1"); // seulement deux 3 → juste → p1 perd
  assert.equal(s.reveal!.count, 2);
  assert.equal(s.reveal!.loserId, "p1");
  nextRound(s, "p0");
  assert.equal(s.palifico, false); // p0 toujours à 1 dé, mais plus de palifico
});

test("palifico après un exact raté aussi", () => {
  const s = setup();
  rig(s, [[2, 3, 4, 5, 6], [6, 6], [5, 5, 5, 5, 5]]);
  placeBid(s, "p0", { qty: 2, face: 6 });
  callExact(s, "p1"); // il y a trois 6 → faux
  assert.equal(s.players[1].diceCount, 1);
  nextRound(s, "p0");
  assert.equal(s.palifico, true);
  assert.equal(s.turnId, "p1");
});

test("élimination, joueur suivant et victoire", () => {
  const s = setup(2);
  rig(s, [[2], [6, 6]]);
  s.players[0].palificoUsed = true;
  placeBid(s, "p0", { qty: 2, face: 2 });
  callLiar(s, "p1");
  assert.equal(s.phase, "finished");
  assert.equal(s.winnerId, "p1");
});

test("éliminé → c'est le suivant qui commence", () => {
  const s = setup(3);
  rig(s, [[6, 6], [3], [5, 5]]);
  s.players[1].palificoUsed = true;
  placeBid(s, "p0", { qty: 2, face: 6 });
  placeBid(s, "p1", { qty: 4, face: 3 });
  callLiar(s, "p2");
  assert.equal(s.reveal!.eliminatedId, "p1");
  assert.equal(s.nextStarterId, "p2");
});

test("tour : on ne joue pas hors de son tour", () => {
  const s = setup();
  rig(s, [[2, 2, 3, 4, 5], [6, 6, 6, 6, 6], [5, 5, 5, 5, 5]]);
  assert.throws(() => placeBid(s, "p1", { qty: 2, face: 3 }), /tour/);
});

test("vue joueur : on ne voit pas les dés des autres", () => {
  const s = setup();
  const v = viewFor(s, "p1");
  assert.equal(v.me!.hand.length, 5);
  assert.ok(!("hand" in v.players[0]));
  assert.ok(!("token" in v.players[0]));
});
