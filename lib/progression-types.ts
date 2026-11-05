// Forme des données de progression envoyées au navigateur (voir lib/progression.ts).
import type { ChallengeMetric, Title } from "./economy";

export type PublicPrize = { id: string; label: string; icon: string; weight: number };
export type PublicEconomy = {
  rewards: { complete: { doblons: number; xp: number }; win: { doblons: number; xp: number }; liar: { doblons: number; xp: number }; exact: { doblons: number; xp: number }; dailyChallenge: number; weeklyChallenge: number; dailyChallengeXp: number; weeklyChallengeXp: number };
  levelRewards: { level: number; doblons: number; frame?: string | null }[];
  levelAfter: { every: number; doblons: number };
  limits: { liarPerGame: number; exactPerGame: number };
  official: { minHumans: number; minRounds: number; allowBots: boolean };
  fragments: { needed: number; allOwnedDoblons: number };
  wheel: { cooldownHours: number; duplicateDoblons: number; prizes: PublicPrize[] };
};
export type ChallengeView = {
  id: string; name: string; period: "daily" | "weekly"; metric: ChallengeMetric; target: number;
  have: number; done: boolean; doblons: number; xp: number; fragments: number; ends: string;
};
export type Owned = { phrase: string[]; sound: string[]; reaction: string[]; frame: string[]; victory: string[]; cup: string[] };
export type Progress =
  | { member: false; economy: PublicEconomy }
  | {
      member: true; economy: PublicEconomy;
      doblons: number; xp: number; fragments: number;
      level: { level: number; into: number; need: number };
      titles: { id: string; name: string }[]; allTitles: Title[];
      title: string | null; titleId: string | null; frame: string | null; victory: string | null;
      owned: Owned;
      wheel: { ready: boolean; next: string | null };
      challenges: ChallengeView[];
      history: { kind: string; doblons: number; xp: number; fragments: number; at: string; label: string }[];
      stats: { phoenix: number; flawless: number; bids: number };
    };
export type SpinResult = { prizeId: string; label: string; icon: string; item: string | null; itemType: string | null; doblons: number; fragments: number; compensated: boolean; next: string };
