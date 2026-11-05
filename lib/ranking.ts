// Classements entre amis (§ 44) — calcul pur, partagé serveur / tests.
// Ordre : victoires, puis taux de victoire, puis parties terminées.
// Mensuel : mêmes règles, limité au mois civil (Paris) ; ne touche jamais aux stats permanentes.
export type RankRow = { id: string; name: string; wins: number; played: number };
export type Ranked = RankRow & { rate: number; rank: number };

export function rankPlayers(rows: RankRow[]): Ranked[] {
  const list = rows.map((r) => ({ ...r, rate: r.played ? r.wins / r.played : 0 }));
  list.sort((a, b) => b.wins - a.wins || b.rate - a.rate || b.played - a.played || a.name.localeCompare(b.name, "fr"));
  let rank = 0;
  return list.map((r, i) => {
    const p = list[i - 1];
    if (!p || p.wins !== r.wins || p.rate !== r.rate || p.played !== r.played) rank = i + 1; // ex aequo = même rang
    return { ...r, rank };
  });
}

/** Premier instant du mois civil en cours à Paris (ISO, UTC). */
export function parisMonthStart(now = new Date()) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit" });
  const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value]));
  const y = +p.year, m = +p.month;
  // minuit à Paris le 1er = 23 h ou 22 h UTC la veille selon l'heure d'été
  for (const off of [1, 2]) {
    const d = new Date(Date.UTC(y, m - 1, 1, 0) - off * 3600_000);
    const hh = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", day: "2-digit", hourCycle: "h23" }).formatToParts(d);
    const h = Object.fromEntries(hh.map((x) => [x.type, x.value]));
    if (h.hour === "00" && h.day === "01") return d.toISOString();
  }
  return new Date(Date.UTC(y, m - 1, 1)).toISOString();
}
