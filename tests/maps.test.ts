// Maps : tirées au hasard par le serveur à chaque nouvelle partie, jamais choisies.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as R from "../lib/rules";
import { addPlayer, botStep, drawMap, newGame, nextRound, restart, startGame, turnKey, viewFor } from "../lib/rules";

const table = (pool?: string[]) => {
  const s = newGame("MAP");
  addPlayer(s, "h", "Hôte", "th"); addPlayer(s, "a", "Ami", "ta");
  return { s, start: () => startGame(s, "h", pool) };
};
const finish = (s: R.GameState) => {
  s.players.forEach((p) => (p.isBot = true));
  while (s.phase !== "finished") s.phase === "reveal" ? nextRound(s, "h") : botStep(s, turnKey(s));
  s.players.forEach((p) => (p.isBot = false));
};

test("aucune fonction ni action ne permet de choisir la map", () => {
  assert.equal((R as Record<string, unknown>).setMap, undefined);
  const s = newGame("MAP", "hell"); // ancien paramètre : ignoré
  assert.equal(s.map, undefined, "pas de map en salle d'attente : elle est tirée au lancement");
});

test("tirage au lancement parmi les maps activées uniquement", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) { const { s, start } = table(["beach", "hell", "casino"]); start(); seen.add(s.map!); }
  assert.deepEqual([...seen].sort(), ["beach", "casino", "hell"]);
  const { s, start } = table(["heaven"]); start();
  assert.equal(s.map, "heaven", "une seule map active : on la prend");
});

test("même map pour tous les joueurs, stable pendant la partie et les reconnexions", () => {
  const { s, start } = table(["beach", "hell", "heaven", "street", "casino"]); start();
  const m = s.map;
  assert.equal(viewFor(s, "h").map, m); assert.equal(viewFor(s, "a").map, m); assert.equal(viewFor(s, null).map, m);
  for (let i = 0; i < 6 && s.phase !== "finished"; i++) { s.players.forEach((p) => (p.isBot = true)); botStep(s, turnKey(s)); if (s.phase === "reveal") nextRound(s, "h"); }
  assert.equal(s.map, m, "la map ne change pas entre les manches");
});

test("rejouer = nouveau tirage, jamais deux fois de suite la même map (≥ 2 maps)", () => {
  const pool = ["beach", "hell", "heaven", "street", "casino"];
  const { s, start } = table(pool); start();
  let prev = s.map!;
  for (let g = 0; g < 40; g++) {
    finish(s);
    restart(s, "h", pool);
    assert.notEqual(s.map, prev, "pas de répétition immédiate");
    assert.ok(pool.includes(s.map!));
    prev = s.map!;
  }
  // avec une seule map, elle revient forcément
  const one = table(["beach"]); one.start(); finish(one.s); restart(one.s, "h", ["beach"]);
  assert.equal(one.s.map, "beach");
});

test("drawMap : exclusion de la précédente, liste vide = maps d'origine", () => {
  for (let i = 0; i < 50; i++) assert.equal(drawMap(["a", "b"], "a"), "b");
  assert.ok(R.DEFAULT_POOL.includes(drawMap([], null)));
});
