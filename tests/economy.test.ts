// V3 : économie, progression, défis, gobelets
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanEconomy, DEFAULT_ECONOMY, drawPrize, EconomyError, levelOf, periodEnd, periodKeys, pickChallenges, titlesUnlocked,
} from "../lib/economy";
import { cleanCup, DEFAULT_CONTENT, DEFAULT_CUPS } from "../lib/content";
import { condLabel, isUnlocked, Stats } from "../lib/catalog";
import { addPlayer, callExact, callLiar, newGame, placeBid, startGame, takeResults, GameState } from "../lib/rules";

const S = (o: Partial<Stats>): Stats => ({ played: 0, wins: 0, losses: 0, rate: 0, liarCalls: 0, liarWins: 0, exactCalls: 0, exactWins: 0, winStreak: 0, bestWinStreak: 0, ...o });

test("roue : probabilités par défaut = brief, total 100 %", () => {
  const w = Object.fromEntries(DEFAULT_ECONOMY.wheel.prizes.map((p) => [p.id, p.weight]));
  assert.deepEqual(w, { d75: 40, d150: 25, cosmetic: 15, frag: 12, d300: 6, mystery: 2 });
  assert.throws(() => cleanEconomy({ ...DEFAULT_ECONOMY, wheel: { ...DEFAULT_ECONOMY.wheel, prizes: DEFAULT_ECONOMY.wheel.prizes.slice(1) } }), EconomyError);
  assert.doesNotThrow(() => cleanEconomy(DEFAULT_ECONOMY as unknown as Record<string, unknown>));
});

test("roue : le tirage pondéré respecte les poids", () => {
  const n: Record<string, number> = {};
  for (let i = 0; i < 20000; i++) { const p = drawPrize(DEFAULT_ECONOMY.wheel.prizes, Math.random()); n[p.id] = (n[p.id] ?? 0) + 1; }
  assert.ok(Math.abs(n.d75 / 20000 - 0.4) < 0.02);
  assert.ok(Math.abs((n.mystery ?? 0) / 20000 - 0.02) < 0.008);
  assert.equal(drawPrize(DEFAULT_ECONOMY.wheel.prizes, 0).id, "d75");
  assert.equal(drawPrize(DEFAULT_ECONOMY.wheel.prizes, 0.9999).id, "mystery");
});

test("niveaux et titres", () => {
  assert.deepEqual(levelOf(DEFAULT_ECONOMY, 0), { level: 1, into: 0, need: 120 });
  assert.equal(levelOf(DEFAULT_ECONOMY, 120).level, 2);
  assert.equal(levelOf(DEFAULT_ECONOMY, 120 + 180).level, 3);
  const t = titlesUnlocked(DEFAULT_ECONOMY, 3, ["phoenix"]).map((x) => x.id);
  assert.deepEqual(t, ["t1", "t2", "t7"]);
});

test("défis : 3 par période, identiques pour tout le monde, Exact exclu si désactivé", () => {
  const a = pickChallenges(DEFAULT_CONTENT.challenges, "daily", "d:2026-11-04", true).map((c) => c.id);
  const b = pickChallenges(DEFAULT_CONTENT.challenges, "daily", "d:2026-11-04", true).map((c) => c.id);
  assert.equal(a.length, 3); assert.deepEqual(a, b);
  for (let d = 1; d < 28; d++) {
    const k = `d:2026-11-${String(d).padStart(2, "0")}`;
    assert.ok(pickChallenges(DEFAULT_CONTENT.challenges, "daily", k, false).every((c) => c.metric !== "exactWins"));
  }
});

test("défis : fuseau Europe/Paris (minuit, semaine du lundi)", () => {
  // 23h30 UTC le mardi 3 nov = 0h30 le mercredi 4 à Paris
  const k = periodKeys(new Date("2026-11-03T23:30:00Z"));
  assert.equal(k.day, "d:2026-11-04");
  assert.equal(k.week, "w:2026-11-02");
  assert.equal(periodEnd(new Date("2026-11-04T10:00:00Z")).toISOString(), "2026-11-04T23:00:00.000Z");
  assert.equal(periodEnd(new Date("2026-07-04T10:00:00Z")).toISOString(), "2026-07-04T22:00:00.000Z"); // heure d'été
  assert.equal(periodEnd(new Date("2026-11-04T10:00:00Z"), true).toISOString(), "2026-11-08T23:00:00.000Z");
});

test("gobelets : 1 classique + 10 exploits + 8 mystères avec les bonnes conditions", () => {
  assert.equal(DEFAULT_CUPS.filter((c) => c.category === "exploit").length, 11);
  assert.equal(DEFAULT_CUPS.filter((c) => c.category === "mystery").length, 8);
  const need = Object.fromEntries(DEFAULT_CUPS.filter((c) => c.category === "exploit").map((c) => [c.id, c.cond]));
  assert.deepEqual(need.tiki, { type: "played", n: 3 });
  assert.deepEqual(need.neon, { type: "played", n: 35 });
  assert.deepEqual(need.celestial, { type: "wins", n: 25 });
  assert.deepEqual(need.detective, { type: "liarWins", n: 15 });
  assert.deepEqual(need.oracle, { type: "exactWins", n: 5 });
  assert.ok(isUnlocked(need.phoenix, S({ phoenix: 1 })));
  assert.ok(!isUnlocked(need.invincible, S({ wins: 30 })));
  assert.ok(DEFAULT_CUPS.every((c) => c.image === `/art/cups/${c.id}.webp`));
  assert.equal(condLabel({ type: "special" }), "Roue, fragments ou boutique");
  // un mystère ne peut jamais se débloquer par exploit
  assert.deepEqual(cleanCup({ name: "X", category: "mystery", cond: { type: "wins", n: 1 }, image: "/art/cups/tiki.webp" }).cond, { type: "special" });
});

test("boutique : les 6 phrases d'origine restent gratuites, prix du brief", () => {
  assert.equal(DEFAULT_CONTENT.phrases.filter((p) => !p.price).length, 6);
  assert.ok(DEFAULT_CONTENT.phrases.filter((p) => p.price).every((p) => p.price === 200));
  assert.ok(DEFAULT_CONTENT.sounds.filter((p) => p.price).every((p) => p.price === 300));
  assert.ok(DEFAULT_CONTENT.reactions.filter((p) => p.price).every((p) => p.price === 350));
  assert.ok(DEFAULT_CONTENT.frames.every((p) => p.price === 600));
  assert.ok(DEFAULT_CONTENT.victories.filter((p) => p.price).every((p) => p.price === 1200));
});

function duel(): GameState {
  const s = newGame("E");
  addPlayer(s, "a", "Ana", "ta", { profileId: "pa" });
  addPlayer(s, "b", "Bob", "tb", { profileId: "pb" });
  startGame(s, "a");
  return s;
}
test("suivi de partie : annonces, Phénix, Invincible", () => {
  const s = duel();
  const first = s.turnId!;
  placeBid(s, first, { qty: 1, face: 3 });
  assert.equal(s.players.find((p) => p.id === first)!.st!.bids, 1);
  // on force une fin : b tombe à 1 dé puis gagne, a ne perd... (simulé)
  const a = s.players[0], b = s.players[1];
  b.st!.one = true; b.st!.lost = 4; a.st!.lost = 0;
  s.phase = "finished"; s.winnerId = "b";
  const rows = takeResults(s);
  const rb = rows.find((r) => r.profile_id === "pb")!, ra = rows.find((r) => r.profile_id === "pa")!;
  assert.equal(rb.extra.phoenix, true); assert.equal(rb.extra.flawless, false);
  assert.equal(ra.extra.phoenix, false); assert.equal(ra.extra.flawless, false); // a n'a pas gagné
  assert.equal(rb.extra.bots, 0);
});
test("perdre un dé est compté (Invincible impossible ensuite)", () => {
  const s = duel();
  const first = s.turnId!;
  placeBid(s, first, { qty: 10, face: 6 }); // forcément faux (10 dés en jeu, 1 = joker)
  const other = s.turnId!;
  callLiar(s, other);
  assert.equal(s.players.find((p) => p.id === first)!.st!.lost, 1);
  void callExact;
});
