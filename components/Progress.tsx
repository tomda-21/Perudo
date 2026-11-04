"use client";
// =============================================================
//  Progression : compte, niveau et titre, Roue du Gobelin, boutique, défis.
//  Le navigateur ne fait qu'AFFICHER : chaque gain, achat ou tirage est
//  décidé et enregistré par le serveur.
// =============================================================
import { useCallback, useEffect, useState } from "react";
import { Modal } from "./Panel";
import Avatar from "./Avatar";
import Cup from "./Cup";
import { api, forgetProfile, Progress, saveProfileCreds } from "@/lib/client";
import type { SpinResult } from "@/lib/progression-types";
import { useContent } from "@/lib/content-client";
import { METRIC_LABEL } from "@/lib/economy";
import { previewSound, previewVoice } from "@/lib/sfx";
import { sounds, unlockAudio } from "@/lib/sound";

/** Progression partagée par toutes les fenêtres de l'accueil. */
export function useProgress() {
  const [data, setData] = useState<Progress | null>(null);
  const reload = useCallback(() => api.progress().then(setData).catch(() => {}), []);
  useEffect(() => { reload(); }, [reload]);
  return { data, setData, reload };
}
export type ProgressState = ReturnType<typeof useProgress>;

export function Coins({ n, frag }: { n: number; frag?: number }) {
  return (
    <span className="wallet">
      <span className="coin-pill" title="Doblons">🪙 {n.toLocaleString("fr-FR")}</span>
      {frag !== undefined && <span className="frag-pill" title="Fragments mystère">🧩 {frag}</span>}
    </span>
  );
}

function useCountdown(iso: string | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!iso) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [iso]);
  if (!iso) return null;
  const ms = Math.max(0, new Date(iso).getTime() - now);
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  return { ms, text: h > 24 ? `${Math.floor(h / 24)} j ${h % 24} h` : `${h} h ${String(m).padStart(2, "0")} min ${String(s).padStart(2, "0")} s` };
}

// ---------- COMPTE (dans Mon profil) ----------
export function AccountBox({ account, onChange }: { account: { login: string; since: string } | null; onChange: () => void }) {
  const [mode, setMode] = useState<null | "create" | "login">(null);
  const [login, setLogin] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true); setMsg("");
    try {
      if (mode === "create") { await api.createAccount(login, pw); onChange(); setMode(null); }
      else {
        const c = await api.login(login, pw);
        saveProfileCreds(c); // cet appareil utilise désormais le compte
        location.reload();
      }
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }

  if (account) {
    return (
      <div className="account-box">
        <div>✅ Compte <b>{account.login}</b> — ta progression est sauvegardée et disponible sur tous tes appareils.</div>
        <button className="gbtn gbtn-dark gbtn-sm" onClick={() => {
          if (!confirm("Se déconnecter de cet appareil ? Tu pourras te reconnecter avec ton identifiant et ton mot de passe.")) return;
          forgetProfile(); location.reload();
        }}>Se déconnecter</button>
      </div>
    );
  }
  return (
    <div className="account-box guest">
      {!mode && <>
        <div>👤 Tu joues en <b>invité</b> : pas de Doblons, pas d&apos;XP ni de gobelets d&apos;exploit. Crée un compte gratuit pour garder ta progression (tes stats actuelles sont conservées).</div>
        <div className="row-wrap">
          <button className="gbtn gbtn-gold gbtn-sm" onClick={() => setMode("create")}>Créer mon compte</button>
          <button className="gbtn gbtn-dark gbtn-sm" onClick={() => setMode("login")}>J&apos;ai déjà un compte</button>
        </div>
      </>}
      {mode && (
        <form className="account-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <b>{mode === "create" ? "Créer mon compte" : "Me connecter"}</b>
          <input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="Identifiant (ex. tom_21)" autoComplete="username" maxLength={20} />
          <input value={pw} onChange={(e) => setPw(e.target.value)} type="password" placeholder="Mot de passe (8 caractères min.)" autoComplete={mode === "create" ? "new-password" : "current-password"} />
          {mode === "login" && <p className="muted small">Ce téléphone/ordinateur utilisera ton compte (le profil invité actuel de cet appareil sera laissé de côté).</p>}
          {mode === "create" && <p className="muted small">Pas d&apos;e-mail demandé. Note bien ton mot de passe : il ne peut pas être récupéré pour l&apos;instant (l&apos;admin peut t&apos;aider).</p>}
          <div className="row-wrap">
            <button className="gbtn gbtn-gold gbtn-sm" disabled={busy}>{mode === "create" ? "Créer" : "Connexion"}</button>
            <button type="button" className="gbtn gbtn-dark gbtn-sm" onClick={() => { setMode(null); setMsg(""); }}>Annuler</button>
          </div>
          {msg && <p className="error">{msg}</p>}
        </form>
      )}
    </div>
  );
}

// ---------- NIVEAU + TITRE ----------
export function LevelCard({ prog }: { prog: ProgressState }) {
  const p = prog.data;
  const [msg, setMsg] = useState("");
  if (!p?.member) return null;
  const pct = Math.round((p.level.into / p.level.need) * 100);
  return (
    <div className="level-card">
      <div className="level-badge">{p.level.level}</div>
      <div className="level-main">
        <div className="level-top"><b>Niveau {p.level.level}</b><Coins n={p.doblons} frag={p.fragments} /></div>
        <div className="xp-bar" title={`${p.level.into} / ${p.level.need} XP`}><span style={{ width: `${pct}%` }} /><em>{p.level.into} / {p.level.need} XP</em></div>
        <label className="title-pick">
          <span>Titre affiché</span>
          <select value={p.titleId ?? ""} onChange={async (e) => {
            setMsg("");
            try { const r = await api.progressAction({ op: "equip", field: "title", value: e.target.value || null }); prog.setData(r.progress); }
            catch (err) { setMsg((err as Error).message); }
          }}>
            <option value="">(par défaut) {p.titles[0]?.name ?? "—"}</option>
            {p.titles.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <div className="muted small">
          Titres à débloquer : {p.allTitles.filter((t) => !p.titles.some((u) => u.id === t.id)).map((t) => `${t.name} (${t.cond.type === "level" ? `niv. ${t.cond.n}` : "gobelet"})`).join(" · ") || "aucun, bravo !"}
        </div>
        {msg && <p className="error">{msg}</p>}
      </div>
    </div>
  );
}

export function HistoryList({ prog }: { prog: ProgressState }) {
  const p = prog.data;
  if (!p?.member || !p.history.length) return null;
  return (
    <>
      <div className="section-title">Historique des Doblons</div>
      <ul className="ledger">
        {p.history.map((h, i) => (
          <li key={i}>
            <span>{h.label}</span>
            <span className={h.doblons < 0 ? "neg" : "pos"}>{h.doblons > 0 ? "+" : ""}{h.doblons ? `${h.doblons} 🪙` : ""}{h.xp ? ` +${h.xp} XP` : ""}{h.fragments ? ` ${h.fragments > 0 ? "+" : ""}${h.fragments} 🧩` : ""}</span>
            <span className="muted small">{new Date(h.at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function GuestNote() {
  return <p className="guest-note">🔒 Réservé aux joueurs avec un compte. Ouvre <b>Mon profil</b> pour en créer un (gratuit, sans e-mail).</p>;
}

// ---------- ROUE DU GOBELIN ----------
const COLORS = ["#e8b04a", "#c0392b", "#2e86c1", "#27ae60", "#8e44ad", "#d35400", "#16a085", "#7f8c8d", "#f39c12", "#2c3e50", "#e84393", "#00b894"];

export function WheelModal({ onClose, prog }: { onClose: () => void; prog: ProgressState }) {
  const p = prog.data;
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [res, setRes] = useState<SpinResult | null>(null);
  const [msg, setMsg] = useState("");
  const cd = useCountdown(p?.member && !p.wheel.ready ? p.wheel.next : null);
  const prizes = p?.economy.wheel.prizes ?? [];
  // les parts ont la même taille ; les probabilités réelles sont affichées à côté
  const seg = 360 / Math.max(1, prizes.length);

  async function spin() {
    if (!p?.member || spinning) return;
    unlockAudio(); setMsg(""); setRes(null); setSpinning(true);
    try {
      const r = await api.progressAction<SpinResult>({ op: "spin" });
      const i = Math.max(0, prizes.findIndex((x) => x.id === r.result.prizeId));
      // le serveur a déjà choisi : on fait juste tourner jusqu'à la bonne part
      const target = 360 * 6 + (360 - (i * seg + seg / 2));
      setAngle((a) => a - (a % 360) + target);
      const tick = setInterval(() => sounds.bid(), 180);
      setTimeout(() => { clearInterval(tick); setSpinning(false); setRes(r.result); prog.setData(r.progress); sounds.win(); }, 4200);
    } catch (e) { setSpinning(false); setMsg((e as Error).message); prog.reload(); }
  }

  return (
    <Modal title="Roue du Gobelin" onClose={onClose} wide>
      {!p ? <p className="muted">Chargement…</p> : (
        <div className="wheel-layout">
          <div className="wheel-wrap">
            <div className="wheel-pointer">▼</div>
            <svg viewBox="-110 -110 220 220" className="wheel" style={{ transform: `rotate(${angle}deg)`, transition: spinning ? "transform 4.1s cubic-bezier(.12,.75,.12,1)" : "none" }}>
              {prizes.map((x, i) => {
                const a0 = ((i * seg - 90) * Math.PI) / 180, a1 = (((i + 1) * seg - 90) * Math.PI) / 180;
                const mid = ((i * seg + seg / 2 - 90) * Math.PI) / 180;
                const large = seg > 180 ? 1 : 0;
                return (
                  <g key={x.id}>
                    <path d={`M0 0 L${100 * Math.cos(a0)} ${100 * Math.sin(a0)} A100 100 0 ${large} 1 ${100 * Math.cos(a1)} ${100 * Math.sin(a1)} Z`} fill={COLORS[i % COLORS.length]} stroke="#3b2414" strokeWidth="2" />
                    <text x={64 * Math.cos(mid)} y={64 * Math.sin(mid)} fontSize="22" textAnchor="middle" dominantBaseline="central">{x.icon}</text>
                  </g>
                );
              })}
              <circle r="16" fill="#3b2414" stroke="#e8b04a" strokeWidth="4" />
            </svg>
          </div>
          <div className="wheel-side">
            {!p.member ? <GuestNote /> : (
              <>
                <Coins n={p.doblons} frag={p.fragments} />
                {res ? (
                  <div className="wheel-result">
                    <div className="big">{res.icon}</div>
                    <b>{res.item ? `${res.label} : ${res.item}` : res.label}</b>
                    {res.compensated && <div className="muted small">Tu avais déjà tout : compensé par {res.doblons} Doblons.</div>}
                  </div>
                ) : null}
                <button className="gbtn gbtn-gold gbtn-xl" disabled={spinning || !p.wheel.ready} onClick={spin}>
                  {spinning ? "Ça tourne…" : p.wheel.ready ? "🎡 Tourner la roue" : "Revient bientôt"}
                </button>
                {!p.wheel.ready && cd && <p className="center-text">Prochain tour dans <b>{cd.text}</b></p>}
              </>
            )}
            {msg && <p className="error">{msg}</p>}
            <div className="section-title">Chances de gain</div>
            <ul className="odds">
              {prizes.map((x, i) => <li key={x.id}><span className="dot" style={{ background: COLORS[i % COLORS.length] }} /> {x.icon} {x.label} <b>{x.weight} %</b></li>)}
            </ul>
            <p className="muted small">Un tour gratuit toutes les {p.economy.wheel.cooldownHours} h, tiré par le serveur. Si tu gagnes un objet que tu possèdes déjà : {p.economy.wheel.duplicateDoblons} Doblons à la place. Aucun achat en argent réel.</p>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ---------- BOUTIQUE ----------
type ShopTab = "phrase" | "sound" | "reaction" | "frame" | "victory" | "cup";
const SHOP_TABS: { id: ShopTab; label: string }[] = [
  { id: "phrase", label: "💬 Phrases" }, { id: "sound", label: "🔊 Sons" }, { id: "reaction", label: "😂 Réactions" },
  { id: "frame", label: "🖼️ Cadres" }, { id: "victory", label: "🎆 Victoires" }, { id: "cup", label: "🥤 Gobelets" },
];

export function ShopModal({ onClose, prog, onCupBought }: { onClose: () => void; prog: ProgressState; onCupBought?: () => void }) {
  const c = useContent();
  const p = prog.data;
  const [tab, setTab] = useState<ShopTab>("phrase");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const items: { id: string; name: string; price: number; icon?: string; preview?: () => void; style?: string }[] =
    tab === "phrase" ? c.phrases.map((x) => ({ id: x.id, name: `« ${x.text} »`, price: x.price ?? 0, preview: () => previewVoice(x.text, x.audio) }))
    : tab === "sound" ? c.sounds.map((x) => ({ id: x.id, name: x.label, icon: x.icon, price: x.price ?? 0, preview: () => { unlockAudio(); previewSound(x); } }))
    : tab === "reaction" ? c.reactions.map((x) => ({ id: x.id, name: x.label, icon: x.emoji, price: x.price }))
    : tab === "frame" ? c.frames.map((x) => ({ id: x.id, name: x.name, price: x.price, style: x.style }))
    : tab === "victory" ? c.victories.map((x) => ({ id: x.id, name: x.name, price: x.price, style: x.style }))
    : c.cups.filter((x) => x.category === "shop").map((x) => ({ id: x.id, name: x.name, price: x.price ?? 0 }));

  const has = (id: string, price: number) => !price || (p?.member ? p.owned[tab].includes(id) : false);
  const equipped = (id: string) => p?.member && ((tab === "frame" && p.frame === id) || (tab === "victory" && (p.victory ?? "confetti") === id));

  async function run(body: Record<string, unknown>, ok: string) {
    setBusy(true); setMsg("");
    try { const r = await api.progressAction(body); prog.setData(r.progress); setMsg(ok); if (body.type === "cup") onCupBought?.(); }
    catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <Modal title="Boutique" onClose={onClose} wide>
      {!p ? <p className="muted">Chargement…</p> : (
        <>
          <div className="shop-head">{p.member ? <Coins n={p.doblons} frag={p.fragments} /> : <GuestNote />}</div>
          <div className="tabs">{SHOP_TABS.map((t) => <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => { setTab(t.id); setMsg(""); }}>{t.label}</button>)}</div>
          {items.length === 0 ? <p className="muted center-text">Rien dans cette catégorie pour l&apos;instant.</p> : (
            <div className="shop-grid">
              {items.map((x) => {
                const own = has(x.id, x.price);
                return (
                  <div key={x.id} className={`shop-card ${own ? "owned" : ""}`}>
                    <div className="shop-visual">
                      {tab === "frame" ? <span className={`frame frame-${x.style}`}><Avatar name="Moi" avatar="gobelin" size={56} /></span>
                        : tab === "victory" ? <span className="big">{({ confetti: "🎊", fireworks: "🎆", goldrain: "🪙", hearts: "💖", stars: "🌠" } as Record<string, string>)[x.style ?? ""] ?? "🎉"}</span>
                        : tab === "cup" ? <Cup state="show" size="lg" skin={x.id} />
                        : <span className="big">{x.icon ?? "💬"}</span>}
                    </div>
                    <div className="shop-name">{x.name}</div>
                    {x.preview && <button className="pill pill-btn" onClick={x.preview}>▶ Écouter</button>}
                    {own ? (
                      (tab === "frame" || tab === "victory")
                        ? equipped(x.id) ? <div className="pill pill-green">Équipé</div>
                          : <button className="pill pill-btn" disabled={busy || !p.member} onClick={() => run({ op: "equip", field: tab, value: x.id }, "Équipé !")}>Équiper</button>
                        : <div className="pill pill-green">{x.price ? "Possédé" : "Gratuit"}</div>
                    ) : (
                      <button className="gbtn gbtn-gold gbtn-sm" disabled={busy || !p.member || (p.member && p.doblons < x.price)}
                        onClick={() => confirm(`Acheter « ${x.name} » pour ${x.price} Doblons ?`) && run({ op: "buy", type: tab, id: x.id }, "Acheté ! Disponible tout de suite.")}>
                        🪙 {x.price}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {tab === "frame" && p.member && p.frame && <p className="center-text"><button className="pill pill-btn" onClick={() => run({ op: "equip", field: "frame", value: null }, "Cadre retiré")}>Retirer mon cadre</button></p>}
          {msg && <p className="hint center-text">{msg}</p>}
          <p className="muted small center-text">Tout est cosmétique : rien ne change les dés ni les chances de gagner. Les Doblons se gagnent uniquement en jouant (aucun achat en argent réel).</p>
        </>
      )}
    </Modal>
  );
}

// ---------- DÉFIS ----------
export function ChallengesModal({ onClose, prog }: { onClose: () => void; prog: ProgressState }) {
  const p = prog.data;
  const day = p?.member ? p.challenges.find((c) => c.period === "daily")?.ends ?? null : null;
  const week = p?.member ? p.challenges.find((c) => c.period === "weekly")?.ends ?? null : null;
  const cdD = useCountdown(day), cdW = useCountdown(week);
  return (
    <Modal title="Défis" onClose={onClose}>
      {!p ? <p className="muted">Chargement…</p> : !p.member ? <GuestNote /> : (
        <div className="challenges">
          {(["daily", "weekly"] as const).map((per) => (
            <div key={per}>
              <div className="section-title">{per === "daily" ? "Défis du jour" : "Défis de la semaine"} <span className="muted small">— renouvelés dans {(per === "daily" ? cdD : cdW)?.text ?? "…"}</span></div>
              {p.challenges.filter((c) => c.period === per).map((c) => (
                <div key={c.id} className={`challenge ${c.done ? "done" : ""}`}>
                  <div className="challenge-top">
                    <b>{c.done ? "✅ " : ""}{c.name}</b>
                    <span>🪙 {c.doblons}{c.fragments ? ` + 🧩 ${c.fragments}` : ""}</span>
                  </div>
                  <div className="muted small">{c.target} {METRIC_LABEL[c.metric]}</div>
                  <div className="progress"><span style={{ width: `${(c.have / c.target) * 100}%` }} /><em>{c.have}/{c.target}</em></div>
                </div>
              ))}
            </div>
          ))}
          <p className="muted small">Heure de référence : Paris (minuit, et lundi minuit pour la semaine). Seules les parties officielles comptent : au moins {p.economy.official.minHumans} vrais joueurs et {p.economy.official.minRounds} manches{p.economy.official.allowBots ? "" : ", sans bot"}. La récompense est versée automatiquement.</p>
        </div>
      )}
    </Modal>
  );
}
