// Enchères sur les pax : y aller, y rester, et surtout EN REVENIR.
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkBid, minQtyFor } from "../lib/bids";
import { addPlayer, botStep, callLiar, newGame, nextRound, placeBid, startGame, turnKey, GameState } from "../lib/rules";

const ok = (prev: [number, number], next: [number, number], pal = false) =>
  checkBid({ qty: prev[0], face: prev[1] }, { qty: next[0], face: next[1] }, pal, 30) === null;

test("cas demandés par Tom", () => {
  assert.ok(ok([4, 2], [2, 1]), "4 dés de 2 → 2 pax");
  assert.ok(ok([5, 4], [3, 1]), "5 dés de 4 → 3 pax");
  assert.ok(ok([2, 1], [5, 3]), "2 pax → 5 dés de 3");
  assert.ok(!ok([2, 1], [4, 6]), "2 pax → 4 dés de 6 interdit");
  assert.ok(ok([2, 1], [3, 1]), "2 pax → 3 pax");
  assert.ok(ok([3, 1], [7, 2]), "3 pax → 7 dés de 2");
  assert.ok(!ok([3, 1], [6, 6]), "3 pax → 6 dés de 6 interdit");
});

test("après 2 pax : toutes les valeurs normales sont possibles dès 5 dés", () => {
  for (let f = 2; f <= 6; f++) {
    assert.ok(ok([2, 1], [5, f]), `5 dés de ${f}`);
    assert.ok(!ok([2, 1], [4, f]), `4 dés de ${f} interdit`);
  }
  assert.ok(!ok([2, 1], [2, 1]), "2 pax → 2 pax interdit (il faut surenchérir)");
  assert.ok(ok([4, 2], [3, 1]) && !ok([4, 2], [1, 1]), "5 → pax : ceil(4/2) = 2 minimum");
  assert.ok(ok([5, 3], [3, 1]) && !ok([5, 3], [2, 1]), "ceil(5/2) = 3");
  // séquence complète de Tom
  assert.ok(ok([4, 2], [2, 1]) && ok([2, 1], [5, 3]));
});

test("minimum proposé par l'interface = minimum accepté par le serveur", () => {
  for (const pal of [false, true])
    for (let pq = 1; pq <= 8; pq++)
      for (let pf = 1; pf <= 6; pf++)
        for (let f = 1; f <= 6; f++) {
          const prev = { qty: pq, face: pf };
          const m = minQtyFor(prev, f, pal);
          if (m === null) { for (let q = 1; q <= 40; q++) assert.notEqual(checkBid(prev, { qty: q, face: f }, pal, 40), null); continue; }
          assert.equal(checkBid(prev, { qty: m, face: f }, pal, 40), null, `min ${m}×${f} après ${pq}×${pf} (palifico ${pal})`);
          if (m > 1) assert.notEqual(checkBid(prev, { qty: m - 1, face: f }, pal, 40), null, `${m - 1}×${f} devrait être refusé`);
        }
  assert.equal(minQtyFor(null, 1, false), null); // jamais d'ouverture sur les pax
  assert.equal(minQtyFor({ qty: 2, face: 1 }, 6, false), 5);
});

test("palifico : valeur verrouillée, seule la quantité monte ; ouverture sur les pax permise", () => {
  assert.ok(!ok([4, 2], [2, 1], true), "pas de passage aux pax en palifico");
  assert.ok(!ok([2, 1], [2, 3], true), "valeur verrouillée");
  assert.ok(!ok([2, 3], [3, 4], true), "valeur verrouillée même en montant la quantité");
  assert.ok(ok([2, 3], [3, 3], true));
  assert.ok(!ok([2, 3], [2, 3], true));
  assert.ok(ok([2, 1], [3, 1], true), "pax verrouillés : 3 pax");
  assert.equal(checkBid(null, { qty: 1, face: 1 }, true, 10), null, "ouverture sur les pax en palifico");
  assert.notEqual(checkBid(null, { qty: 1, face: 1 }, false, 10), null, "interdit hors palifico");
});

test("serveur : la séquence 4×2 → 2 pax → 5×3 passe dans une vraie partie", () => {
  const s = newGame("PAX");
  addPlayer(s, "a", "A", "ta"); addPlayer(s, "b", "B", "tb"); addPlayer(s, "c", "C", "tc");
  startGame(s, "a");
  s.palifico = false;
  const p1 = s.turnId!; placeBid(s, p1, { qty: 4, face: 2 });
  const p2 = s.turnId!; placeBid(s, p2, { qty: 2, face: 1 });
  const p3 = s.turnId!;
  assert.throws(() => placeBid(s, p3, { qty: 4, face: 6 }), /au moins 5/);
  placeBid(s, p3, { qty: 5, face: 3 });
  assert.deepEqual(s.bid, { qty: 5, face: 3 });
});

test("bots : ils savent revenir des pax vers une valeur normale", () => {
  let back = 0, toPax = 0, games = 0;
  for (let g = 0; g < 150; g++) {
    const s: GameState = newGame("BOT");
    for (let i = 0; i < 4; i++) addPlayer(s, `p${i}`, `P${i}`, `t${i}`);
    startGame(s, "p0");
    s.players.forEach((p) => (p.isBot = true));
    let guard = 0, last = s.history.length;
    while (s.phase !== "finished" && guard++ < 2000) {
      if (s.phase === "reveal") { nextRound(s, "p0"); last = 0; continue; }
      botStep(s, turnKey(s));
      const h = s.history;
      for (let i = Math.max(1, last); i < h.length; i++) {
        if (h[i - 1].bid.face === 1 && h[i].bid.face !== 1) {
          back++;
          assert.ok(h[i].bid.qty >= h[i - 1].bid.qty * 2 + 1 || s.palifico, "retour légal");
        }
        if (h[i - 1].bid.face !== 1 && h[i].bid.face === 1) toPax++;
      }
      last = h.length;
    }
    assert.equal(s.phase, "finished");
    games++;
  }
  assert.ok(toPax > 0, "les bots passent parfois aux pax");
  assert.ok(back > 0, `les bots reviennent parfois des pax (${back} fois sur ${games} parties)`);
  void callLiar;
});
