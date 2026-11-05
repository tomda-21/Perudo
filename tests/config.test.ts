// Réglages admin : figés par partie
import { test } from "node:test";
import assert from "node:assert/strict";
import { addBot, addPlayer, botStep, callExact, callLiar, newGame, nextRound, placeBid, startGame, turnKey } from "../lib/rules";
import { cleanCup, cleanMap, cleanSettings, cleanSound, ContentError } from "../lib/content";

test("nombre de dés au départ réglable (figé à la création)", () => {
  const s = newGame("T", undefined, { config: { startDice: 3, exactEnabled: true, palificoEnabled: true } });
  addPlayer(s, "a", "a", "a"); addBot(s, "a");
  assert.deepEqual(s.players.map((p) => p.diceCount), [3, 3]);
  startGame(s, "a");
  assert.equal(s.players[0].hand.length, 3);
});

test("exact désactivé : refusé, et les bots ne le tentent pas", () => {
  const s = newGame("T", undefined, { config: { startDice: 5, exactEnabled: false, palificoEnabled: true } });
  addPlayer(s, "a", "a", "a"); addPlayer(s, "b", "b", "b");
  startGame(s, "a"); s.turnId = "a";
  placeBid(s, "a", { qty: 1, face: 3 });
  assert.throws(() => callExact(s, "b"), /désactivé/);
  const g = newGame("T", undefined, { config: { startDice: 5, exactEnabled: false, palificoEnabled: true } });
  addPlayer(g, "h", "h", "h"); for (let i = 0; i < 4; i++) addBot(g, "h");
  g.players[0].isBot = true; startGame(g, "h");
  while (g.phase !== "finished") { if (g.phase === "reveal") { assert.equal(g.reveal!.call, "liar"); nextRound(g, "h"); } else botStep(g, turnKey(g)); }
});

test("palifico désactivé : jamais déclenché", () => {
  const s = newGame("T", undefined, { config: { startDice: 2, exactEnabled: true, palificoEnabled: false } });
  addPlayer(s, "a", "a", "a"); addPlayer(s, "b", "b", "b");
  startGame(s, "a");
  s.players[0].hand = [2, 3]; s.players[1].hand = [5, 5]; s.turnId = "a";
  placeBid(s, "a", { qty: 4, face: 2 });
  callLiar(s, "b"); // a tombe à 1 dé
  nextRound(s, "b");
  assert.equal(s.palifico, false);
});

test("validation des contenus admin", () => {
  assert.throws(() => cleanCup({ name: "Neuf", cond: { type: "wins", n: 5 }, skin: "custom" }), ContentError); // pas d'illustration
  assert.throws(() => cleanCup({ name: "X", cond: { type: "wins", n: 0 } }), ContentError);
  assert.equal(cleanCup({ name: "Or", cond: { type: "played", n: 12 }, skin: "royal" }).cond.type, "played");
  assert.throws(() => cleanSound({ label: "Boum" }), ContentError); // ni fichier ni son d'origine
  assert.equal(cleanSound({ label: "Boum", synth: "rire", volume: 9 }).volume, 1);
  assert.throws(() => cleanMap({ name: "Lune" }), ContentError); // pas d'image
  assert.deepEqual(cleanMap({ name: "Lune", image: "0b2c2f1e-1111-4222-8333-444455556666", anims: ["embers", "laser"] }).anims, ["embers"]);
  const st = cleanSettings({ startDice: 99, fxCooldownSec: 0 });
  assert.equal(st.startDice, 6); assert.equal(st.fxCooldownSec, 1);
});
