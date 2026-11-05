// Classements : statistiques lues en base (résultats enregistrés par le serveur uniquement).
import "server-only";
import { srv5 } from "./srv";
import { parisMonthStart, rankPlayers, RankRow } from "./ranking";

/** `players` : moi + mes amis (la liste d'amis arrive en phase 8). */
export async function rankings(players: { id: string; name: string }[], now = new Date()) {
  const ids = players.map((p) => p.id);
  const [all, month] = await Promise.all([
    srv5<{ profile_id: string; wins: number; played: number }[]>("rank_stats", { ids }),
    srv5<{ profile_id: string; wins: number; played: number }[]>("rank_stats", { ids, from: parisMonthStart(now) }),
  ]);
  const rows = (src: typeof all): RankRow[] => players.map((p) => {
    const r = src.find((x) => x.profile_id === p.id);
    return { id: p.id, name: p.name, wins: Number(r?.wins ?? 0), played: Number(r?.played ?? 0) };
  });
  return { permanent: rankPlayers(rows(all)), monthly: rankPlayers(rows(month)) };
}
