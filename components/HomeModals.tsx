"use client";
// Fenêtres de l'accueil : Jouer (créer / rejoindre), Succès, Gagner des Doblons.
import { useState } from "react";
import { Modal } from "./Panel";
import Cup from "./Cup";
import { condLabel, condProgress } from "@/lib/catalog";
import type { MyProfile } from "@/lib/client";
import type { ProgressState } from "./Progress";
import { levelOf } from "@/lib/economy";
import { useContent } from "@/lib/content-client";

// ---------- JOUER ----------
export function PlayModal({ name, setName, code, setCode, busy, error, onCreate, onJoin, onRules, onClose }: {
  name: string; setName: (s: string) => void; code: string; setCode: (s: string) => void; busy: boolean; error: string;
  onCreate: () => void; onJoin: () => void; onRules: () => void; onClose: () => void;
}) {
  return (
    <Modal title="Jouer" onClose={onClose}>
      <div className="play-panel">
        <label className="field-icon">
          <span aria-hidden="true">👤</span>
          <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="Ton pseudo de partie" aria-label="Ton pseudo de partie" autoFocus />
        </label>
        <button className="gbtn gbtn-gold gbtn-xl" disabled={busy} onClick={onCreate}>
          <span className="gbtn-ico">▶</span> Créer une partie
        </button>
        <p className="muted small center-text">Tu pourras ajouter des bots et inviter tes potes avec le code ou le lien du salon.</p>
        <div className="divider"><span>ou</span></div>
        <form className="join-row" onSubmit={(e) => { e.preventDefault(); onJoin(); }}>
          <input className="code-input" value={code} maxLength={6} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Code" aria-label="Code de partie" />
          <button className="gbtn gbtn-purple" disabled={busy}>🔗 Rejoindre</button>
        </form>
        {error && <p className="error">{error}</p>}
        <button className="plaque-btn" onClick={onRules}>📖 Nos règles</button>
      </div>
    </Modal>
  );
}

// ---------- SUCCÈS (accomplissements, calculés depuis les vraies données) ----------
export function SuccessModal({ onClose, profile, prog, onAccount }: { onClose: () => void; profile: MyProfile | null; prog: ProgressState; onAccount: () => void }) {
  const p = prog.data;
  const { economy } = useContent();
  const [tab, setTab] = useState<"exploits" | "titles" | "records">("exploits");
  if (!profile) return <Modal title="Succès" onClose={onClose}><p className="muted">Chargement…</p></Modal>;
  const member = !!profile.account;
  const exploits = profile.cups.filter((c) => (c.category ?? "exploit") === "exploit" && c.cond.type !== "none");
  const done = exploits.filter((c) => profile.unlocked.includes(c.id)).length;
  const lvl = p?.member ? p.level.level : levelOf(economy, 0).level;
  const titles = p?.member ? p.allTitles : economy.titles;
  const owned = new Set(p?.member ? p.titles.map((t) => t.id) : []);
  const s = profile.stats;
  const records: [string, string, number | string][] = [
    ["🎲", "Parties jouées", s.played], ["🏆", "Victoires", s.wins], ["📊", "Taux de victoire", `${s.rate} %`],
    ["🔥", "Meilleure série de victoires", s.bestWinStreak], ["🤥", "« Menteur ! » réussis", s.liarWins], ["🎯", "« Exact ! » réussis", s.exactWins],
    ["🐦‍🔥", "Victoires après être tombé à 1 dé", s.phoenix ?? 0], ["🛡️", "Victoires sans perdre un dé", s.flawless ?? 0], ["🗣️", "Annonces faites", s.bids ?? 0],
  ];
  return (
    <Modal title="Succès" onClose={onClose} wide>
      {!member && (
        <p className="guest-note">👤 Les succès se débloquent avec un compte (gratuit, sans e-mail). Tes parties déjà jouées comptent dès sa création. <button className="pill pill-btn" onClick={onAccount}>Créer mon compte</button></p>
      )}
      <div className="success-head">
        <div><b>{done}</b> / {exploits.length} exploits</div>
        <div><b>{owned.size}</b> / {titles.length} titres</div>
        <div>Niveau <b>{lvl}</b></div>
      </div>
      <div className="tabs">
        <button className={tab === "exploits" ? "on" : ""} onClick={() => setTab("exploits")}>🏅 Exploits</button>
        <button className={tab === "titles" ? "on" : ""} onClick={() => setTab("titles")}>🎖️ Titres</button>
        <button className={tab === "records" ? "on" : ""} onClick={() => setTab("records")}>📜 Records</button>
      </div>
      {tab === "exploits" && (
        <ul className="success-list">
          {exploits.map((c) => {
            const ok = profile.unlocked.includes(c.id);
            const pr = condProgress(c.cond, s);
            return (
              <li key={c.id} className={ok ? "done" : ""}>
                <span className="success-cup"><Cup state="show" size="md" skin={c.id} /></span>
                <div className="success-main">
                  <b>{ok ? "✅ " : ""}{c.name}</b>
                  <span className="muted small">{condLabel(c.cond)}</span>
                  {!ok && member && <div className="progress"><span style={{ width: `${(pr.have / pr.need) * 100}%` }} /><em>{pr.have}/{pr.need}</em></div>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {tab === "titles" && (
        <ul className="success-list">
          {titles.map((t) => (
            <li key={t.id} className={owned.has(t.id) ? "done" : ""}>
              <span className="success-ico">{owned.has(t.id) ? "🎖️" : "🔒"}</span>
              <div className="success-main"><b>{t.name}</b><span className="muted small">{t.cond.type === "level" ? `Atteindre le niveau ${t.cond.n}` : `Obtenir le gobelet ${profile.cups.find((c) => c.id === (t.cond as { id: string }).id)?.name ?? ""}`}</span></div>
            </li>
          ))}
        </ul>
      )}
      {tab === "records" && (
        <div className="stat-grid">
          {records.map(([i, l, v]) => <div key={l} className="stat"><div className="stat-value"><span>{i}</span> {v}</div><div className="stat-label">{l}</div></div>)}
        </div>
      )}
      <p className="muted small center-text">Seules les parties avec au moins 2 vrais joueurs comptent. Tout est cosmétique : rien ne change les dés.</p>
    </Modal>
  );
}

// ---------- COMMENT GAGNER DES DOBLONS (bouton « + », jamais d'argent réel) ----------
export function EarnModal({ onClose, onWheel, onChallenges }: { onClose: () => void; onWheel: () => void; onChallenges: () => void }) {
  const { economy: e } = useContent();
  const R = e.rewards;
  return (
    <Modal title="Gagner des Doblons" onClose={onClose}>
      <p className="center-text">Les Doblons se gagnent <b>uniquement en jouant</b> — aucun achat avec de l&apos;argent réel.</p>
      <ul className="earn-list">
        <li><span>🎲</span> Partie officielle terminée <b>+{R.complete.doblons}</b></li>
        <li><span>🏆</span> Victoire <b>+{R.win.doblons}</b></li>
        <li><span>🤥</span> « Menteur ! » réussi <b>+{R.liar.doblons}</b> <em>(max {e.limits.liarPerGame} par partie)</em></li>
        <li><span>🎯</span> « Exact ! » réussi <b>+{R.exact.doblons}</b> <em>(max {e.limits.exactPerGame} par partie)</em></li>
        <li><span>🗓️</span> Défis du jour et de la semaine <button className="pill pill-btn" onClick={onChallenges}>Voir</button></li>
        <li><span>🎡</span> Roue du Gobelin, toutes les {e.wheel.cooldownHours} h <button className="pill pill-btn" onClick={onWheel}>Tourner</button></li>
      </ul>
      <p className="muted small center-text">Partie officielle : au moins {e.official.minHumans} vrais joueurs et {e.official.minRounds} manches{e.official.allowBots ? "" : ", sans bot"}. Il faut un compte.</p>
    </Modal>
  );
}
