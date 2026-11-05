// Phase 5 : gains définitifs, formule de niveau, paliers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanEconomy, DEFAULT_ECONOMY, levelRewardsUpTo, xpStep } from "../lib/economy";

test("gains par défaut = tableau du cahier des charges", () => {
  const R = DEFAULT_ECONOMY.rewards;
  assert.deepEqual([R.complete, R.win, R.liar, R.exact], [{ doblons: 20, xp: 40 }, { doblons: 35, xp: 70 }, { doblons: 5, xp: 10 }, { doblons: 10, xp: 15 }]);
  assert.deepEqual([R.dailyChallenge, R.dailyChallengeXp, R.weeklyChallenge, R.weeklyChallengeXp], [25, 30, 100, 120]);
  assert.deepEqual(DEFAULT_ECONOMY.limits, { liarPerGame: 3, exactPerGame: 2 });
  assert.equal(DEFAULT_ECONOMY.official.allowBots, true);
  assert.equal(DEFAULT_ECONOMY.official.minHumans, 1);
});

test("XP du niveau n à n+1 = 100 + 30(n−1) + (n−1)²", () => {
  for (const n of [1, 2, 5, 10, 50, 200]) assert.equal(xpStep(DEFAULT_ECONOMY, n), 100 + 30 * (n - 1) + (n - 1) ** 2);
});

test("paliers : 5, 10, 20, 30, 50 puis tous les 10 niveaux", () => {
  const at = (l: number) => levelRewardsUpTo(DEFAULT_ECONOMY, l).map((r) => r.level);
  assert.deepEqual(at(4), []);
  assert.deepEqual(at(5), [5]);
  assert.deepEqual(at(49), [5, 10, 20, 30]);
  assert.deepEqual(at(75), [5, 10, 20, 30, 50, 60, 70]);
  const r = levelRewardsUpTo(DEFAULT_ECONOMY, 50);
  assert.deepEqual(r.map((x) => x.doblons), [25, 50, 100, 150, 250]);
  assert.equal(r.find((x) => x.level === 20)!.frame, "bronze-gobelin");
  assert.equal(r.find((x) => x.level === 50)!.frame, "gold-anim");
});

test("réglages admin : nettoyés et bornés", () => {
  const e = cleanEconomy({ ...DEFAULT_ECONOMY, levels: { base: -5, step: "x", quad: 2 }, levelRewards: [{ level: 30, doblons: 9 }, { level: 7, doblons: 1, frame: "" }] } as never);
  assert.equal(e.levels.base, 10); assert.equal(e.levels.quad, 2);
  assert.deepEqual(e.levelRewards.map((r) => r.level), [7, 30]);
  assert.equal(e.levelRewards[0].frame, null);
});

import { parisMonthStart, rankPlayers } from "../lib/ranking";
test("classement : victoires, puis taux, puis parties ; ex aequo", () => {
  const r = rankPlayers([
    { id: "a", name: "A", wins: 5, played: 20 }, { id: "b", name: "B", wins: 5, played: 10 },
    { id: "c", name: "C", wins: 7, played: 30 }, { id: "d", name: "D", wins: 5, played: 10 }, { id: "e", name: "E", wins: 0, played: 0 },
  ]);
  assert.deepEqual(r.map((x) => x.id), ["c", "b", "d", "a", "e"]);
  assert.deepEqual(r.map((x) => x.rank), [1, 2, 2, 4, 5]);
});
test("mois civil à Paris (heure d'hiver et d'été)", () => {
  assert.equal(parisMonthStart(new Date("2026-11-15T12:00:00Z")), "2026-10-31T23:00:00.000Z");
  assert.equal(parisMonthStart(new Date("2026-07-03T12:00:00Z")), "2026-06-30T22:00:00.000Z");
  assert.equal(parisMonthStart(new Date("2026-10-31T23:30:00Z")), "2026-10-31T23:00:00.000Z"); // déjà le 1er novembre à Paris
});
