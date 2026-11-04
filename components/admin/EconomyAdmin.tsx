"use client";
// Économie : récompenses, limites, parties officielles, roue, fragments,
// niveaux, titres — plus les statistiques. Brouillon → Publier, avec historique.
import { useEffect, useState } from "react";
import { Field } from "./kit";
import { adminApi } from "./kit";
import { Publisher, useSetting } from "./OtherAdmin";
import { DEFAULT_ECONOMY, EconomyConfig, levelOf, Title, WheelPrize, xpStep } from "@/lib/economy";

type Stats = {
  accounts: number; earned: number; spent: number; balance_total: number; balance_max: number; xp_total: number; spins: number;
  spins_by_prize: Record<string, number>; items: Record<string, number>; by_kind: Record<string, { n: number; doblons: number }>;
  challenges: Record<string, number>; top: { name: string; doblons: number; xp: number }[];
};

const Num = ({ label, value, onChange, min = 0, max = 100000, hint }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; hint?: string }) => (
  <Field label={label} hint={hint}><input type="number" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} /></Field>
);

export function EconomyStats() {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { adminApi<Stats>("econ_stats").then(setS).catch((e) => setErr(e.message)); }, []);
  if (!s) return <p className="muted">{err || "Chargement des statistiques…"}</p>;
  const KIND: Record<string, string> = { game: "Parties", challenge: "Défis", wheel: "Roue", shop: "Boutique", fragments: "Fragments", admin: "Ajustements admin" };
  return (
    <div className="a-section">
      <div className="stat-grid">
        <div className="stat"><div className="stat-value">👤 {s.accounts}</div><div className="stat-label">Comptes</div></div>
        <div className="stat"><div className="stat-value">🪙 {s.earned}</div><div className="stat-label">Doblons gagnés</div></div>
        <div className="stat"><div className="stat-value">🛒 {s.spent}</div><div className="stat-label">Doblons dépensés</div></div>
        <div className="stat"><div className="stat-value">💰 {s.balance_total}</div><div className="stat-label">En circulation (max {s.balance_max})</div></div>
        <div className="stat"><div className="stat-value">🎡 {s.spins}</div><div className="stat-label">Tours de roue</div></div>
        <div className="stat"><div className="stat-value">✨ {s.xp_total}</div><div className="stat-label">XP total</div></div>
      </div>
      <div className="a-cols">
        <div><b>Par source</b><ul className="a-mini">{Object.entries(s.by_kind).map(([k, v]) => <li key={k}>{KIND[k] ?? k} : {v.n} fois · {v.doblons} 🪙</li>)}</ul></div>
        <div><b>Lots de la roue tirés</b><ul className="a-mini">{Object.entries(s.spins_by_prize).map(([k, v]) => <li key={k}>{k} : {v} ({s.spins ? Math.round((v / s.spins) * 100) : 0} %)</li>)}</ul></div>
        <div><b>Défis réussis</b><ul className="a-mini">{Object.entries(s.challenges).map(([k, v]) => <li key={k}>{k} : {v}</li>)}</ul></div>
        <div><b>Objets les plus possédés</b><ul className="a-mini">{Object.entries(s.items).slice(0, 12).map(([k, v]) => <li key={k}>{k} : {v}</li>)}</ul></div>
        <div><b>Plus gros portefeuilles</b><ul className="a-mini">{s.top.map((t, i) => <li key={i}>{t.name} : {t.doblons} 🪙 · {t.xp} XP</li>)}</ul></div>
      </div>
    </div>
  );
}

export default function EconomyAdmin() {
  const s = useSetting<EconomyConfig>("economy", DEFAULT_ECONOMY);
  const [view, setView] = useState<"settings" | "stats">("settings");
  if (!s.draft) return <p className="muted">{s.msg || "Chargement…"}</p>;
  const e = { ...DEFAULT_ECONOMY, ...s.draft };
  const set = (p: Partial<EconomyConfig>) => s.setDraft({ ...e, ...p });
  const R = e.rewards;
  const rew = (k: "complete" | "win" | "liar" | "exact", f: "doblons" | "xp", v: number) => set({ rewards: { ...R, [k]: { ...R[k], [f]: v } } });
  const prizes = e.wheel.prizes;
  const setPrize = (i: number, p: Partial<WheelPrize>) => set({ wheel: { ...e.wheel, prizes: prizes.map((x, j) => (j === i ? { ...x, ...p } : x)) } });
  const total = prizes.filter((p) => p.active).reduce((n, p) => n + Number(p.weight || 0), 0);
  const setTitle = (i: number, t: Partial<Title>) => set({ titles: e.titles.map((x, j) => (j === i ? ({ ...x, ...t } as Title) : x)) });

  return (
    <div className="a-section">
      <div className="tabs">
        <button className={view === "settings" ? "on" : ""} onClick={() => setView("settings")}>⚙️ Réglages</button>
        <button className={view === "stats" ? "on" : ""} onClick={() => setView("stats")}>📈 Statistiques</button>
      </div>
      {view === "stats" ? <EconomyStats /> : (
        <div className="a-form">
          <p className="a-note">Tout est cosmétique : ces réglages ne changent jamais les règles ni les dés. Publier s&apos;applique aux parties qui se terminent ensuite.</p>

          <div className="section-title">Récompenses de fin de partie (comptes uniquement)</div>
          <table className="a-table">
            <thead><tr><th></th><th>Doblons</th><th>XP</th></tr></thead>
            <tbody>
              {([["complete", "Partie officielle terminée"], ["win", "Bonus de victoire"], ["liar", "« Menteur ! » réussi"], ["exact", "« Exact ! » réussi"]] as const).map(([k, l]) => (
                <tr key={k}><td>{l}</td>
                  <td><input type="number" min={0} value={R[k].doblons} onChange={(ev) => rew(k, "doblons", Number(ev.target.value))} /></td>
                  <td><input type="number" min={0} value={R[k].xp} onChange={(ev) => rew(k, "xp", Number(ev.target.value))} /></td></tr>
              ))}
            </tbody>
          </table>
          <div className="a-cols">
            <Num label="Max « Menteur ! » récompensés par partie" value={e.limits.liarPerGame} max={50} onChange={(n) => set({ limits: { ...e.limits, liarPerGame: n } })} />
            <Num label="Max « Exact ! » récompensés par partie" value={e.limits.exactPerGame} max={50} onChange={(n) => set({ limits: { ...e.limits, exactPerGame: n } })} />
          </div>

          <div className="section-title">Partie officielle (anti-triche)</div>
          <div className="a-cols">
            <Num label="Vrais joueurs minimum" value={e.official.minHumans} min={2} max={8} onChange={(n) => set({ official: { ...e.official, minHumans: n } })} />
            <Num label="Manches minimum" value={e.official.minRounds} min={1} max={50} onChange={(n) => set({ official: { ...e.official, minRounds: n } })} />
          </div>
          <label className="toggle-row"><span>Les parties avec des bots rapportent aussi</span><input type="checkbox" checked={e.official.allowBots} onChange={(ev) => set({ official: { ...e.official, allowBots: ev.target.checked } })} /><span className="switch" /></label>
          <p className="a-hint">Un joueur qui quitte avant la fin ne touche rien. Chaque partie ne peut être récompensée qu&apos;une fois par joueur (vérifié en base).</p>

          <div className="section-title">Défis</div>
          <p className="a-hint">Les récompenses de chaque défi se règlent dans l&apos;onglet « Défis ». Fuseau de référence : Europe/Paris.</p>

          <div className="section-title">Roue du Gobelin</div>
          <div className="a-cols">
            <Num label="Délai entre deux tours (heures)" value={e.wheel.cooldownHours} min={1} max={168} onChange={(n) => set({ wheel: { ...e.wheel, cooldownHours: n } })} />
            <Num label="Compensation d'un doublon (Doblons)" value={e.wheel.duplicateDoblons} onChange={(n) => set({ wheel: { ...e.wheel, duplicateDoblons: n } })} />
          </div>
          <table className="a-table">
            <thead><tr><th>Actif</th><th>Icône</th><th>Nom</th><th>Type</th><th>Quantité</th><th>%</th><th></th></tr></thead>
            <tbody>
              {prizes.map((p, i) => (
                <tr key={i}>
                  <td><input type="checkbox" checked={p.active} onChange={(ev) => setPrize(i, { active: ev.target.checked })} /></td>
                  <td><input className="a-xs" value={p.icon} maxLength={4} onChange={(ev) => setPrize(i, { icon: ev.target.value })} /></td>
                  <td><input value={p.label} maxLength={30} onChange={(ev) => setPrize(i, { label: ev.target.value })} /></td>
                  <td><select value={p.type} onChange={(ev) => setPrize(i, { type: ev.target.value as WheelPrize["type"] })}>
                    <option value="doblons">Doblons</option><option value="fragment">Fragments</option><option value="mystery">Gobelet mystère</option>
                    <option value="phrase">Phrase ou réaction</option><option value="sound">Son</option><option value="reaction">Réaction</option>
                  </select></td>
                  <td>{p.type === "doblons" || p.type === "fragment" ? <input type="number" min={0} value={p.amount} onChange={(ev) => setPrize(i, { amount: Number(ev.target.value) })} /> : <span className="muted small">au hasard</span>}</td>
                  <td><input type="number" min={0} step={0.5} value={p.weight} onChange={(ev) => setPrize(i, { weight: Number(ev.target.value) })} /></td>
                  <td><button className="a-link" onClick={() => set({ wheel: { ...e.wheel, prizes: prizes.filter((_, j) => j !== i) } })}>Retirer</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="a-row">
            <button className="gbtn gbtn-dark gbtn-sm" disabled={prizes.length >= 12} onClick={() => set({ wheel: { ...e.wheel, prizes: [...prizes, { id: `lot${Date.now() % 100000}`, label: "Nouveau lot", icon: "🎁", type: "doblons", amount: 50, weight: 0, active: true }] } })}>＋ Ajouter un lot</button>
            <b className={Math.abs(total - 100) < 0.01 ? "ok-text" : "error"}>Total des lots actifs : {total} % {Math.abs(total - 100) < 0.01 ? "✓" : "(doit faire 100 %)"}</b>
          </div>
          <p className="a-hint">Les probabilités sont affichées aux joueurs telles quelles. Objet déjà possédé (ou plus rien à gagner) : compensation en Doblons.</p>

          <div className="section-title">Fragments mystère</div>
          <div className="a-cols">
            <Num label="Fragments pour un gobelet mystère" value={e.fragments.needed} min={1} max={100} onChange={(n) => set({ fragments: { ...e.fragments, needed: n } })} />
            <Num label="Compensation si tous les mystères sont possédés" value={e.fragments.allOwnedDoblons} onChange={(n) => set({ fragments: { ...e.fragments, allOwnedDoblons: n } })} />
          </div>

          <div className="section-title">Niveaux</div>
          <div className="a-cols">
            <Num label="XP du niveau 1 → 2" value={e.levels.base} min={10} onChange={(n) => set({ levels: { ...e.levels, base: n } })} />
            <Num label="XP en plus à chaque niveau" value={e.levels.step} onChange={(n) => set({ levels: { ...e.levels, step: n } })} />
          </div>
          <p className="a-hint">Aperçu : niveau 5 = {[1, 2, 3, 4].reduce((n, l) => n + xpStep(e, l), 0)} XP · niveau 10 = {Array.from({ length: 9 }, (_, i) => xpStep(e, i + 1)).reduce((a, b) => a + b, 0)} XP · avec 1000 XP on est niveau {levelOf(e, 1000).level}. Une partie gagnée ≈ {R.complete.xp + R.win.xp} XP.</p>

          <div className="section-title">Titres</div>
          <table className="a-table">
            <thead><tr><th>Titre</th><th>Débloqué par</th><th></th><th></th></tr></thead>
            <tbody>
              {e.titles.map((t, i) => (
                <tr key={i}>
                  <td><input value={t.name} maxLength={32} onChange={(ev) => setTitle(i, { name: ev.target.value })} /></td>
                  <td><select value={t.cond.type} onChange={(ev) => setTitle(i, { cond: ev.target.value === "cup" ? { type: "cup", id: "phoenix" } : { type: "level", n: 1 } })}>
                    <option value="level">Niveau</option><option value="cup">Gobelet obtenu</option></select></td>
                  <td>{t.cond.type === "level"
                    ? <input type="number" min={1} max={999} value={t.cond.n} onChange={(ev) => setTitle(i, { cond: { type: "level", n: Number(ev.target.value) } })} />
                    : <input value={t.cond.id} placeholder="id du gobelet" onChange={(ev) => setTitle(i, { cond: { type: "cup", id: ev.target.value } })} />}</td>
                  <td><button className="a-link" onClick={() => set({ titles: e.titles.filter((_, j) => j !== i) })}>Retirer</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="gbtn gbtn-dark gbtn-sm" onClick={() => set({ titles: [...e.titles, { id: `t${Date.now() % 100000}`, name: "Nouveau titre", cond: { type: "level", n: 5 } }] })}>＋ Ajouter un titre</button>

          <Publisher {...s} />
        </div>
      )}
    </div>
  );
}
