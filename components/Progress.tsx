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
import { api, auth, authError, forgetProfile, Progress, syncAccount } from "@/lib/client";
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

// ---------- COMPTE (dans Mon profil) : e-mail + mot de passe ----------
type Acc = { login: string; since: string; email?: string | null; nameChangesLeft?: number } | null;
export function AccountBox({ account, onChange }: { account: Acc; onChange: () => void }) {
  const [mode, setMode] = useState<null | "signup" | "login" | "forgot" | "delete">(null);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const back = `${location.origin}/`;

  async function run(fn: () => Promise<void>) {
    setBusy(true); setMsg(""); setInfo("");
    try { await fn(); } catch (e) { setMsg(authError(e)); } finally { setBusy(false); }
  }
  const signup = () => run(async () => {
    if (name.trim().length < 2) throw new Error("Choisis un pseudo (2 caractères minimum)");
    if (pw.length < 8) throw new Error("Mot de passe : 8 caractères minimum");
    if (pw !== pw2) throw new Error("Les deux mots de passe sont différents");
    const { data, error } = await auth().signUp({ email: email.trim(), password: pw, options: { emailRedirectTo: back, data: { name: name.trim() } } });
    if (error) throw error;
    if (data.user && data.user.identities?.length === 0) throw new Error("Un compte existe déjà avec cet e-mail");
    if (data.session) { await syncAccount(); location.reload(); return; }
    setInfo(`E-mail de confirmation envoyé à ${email.trim()}. Clique le lien, puis connecte-toi ici.`);
    setMode("login"); setPw(""); setPw2("");
  });
  const login = () => run(async () => {
    const { error } = await auth().signInWithPassword({ email: email.trim(), password: pw });
    if (error) throw error;
    forgetProfile(); // cet appareil passe sur le profil du compte
    await syncAccount();
    location.reload();
  });
  const forgot = () => run(async () => {
    const { error } = await auth().resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/compte/mot-de-passe` });
    if (error) throw error;
    setInfo("Si un compte existe avec cet e-mail, un lien pour choisir un nouveau mot de passe vient d'être envoyé.");
  });
  const logout = () => run(async () => {
    if (!confirm("Se déconnecter de cet appareil ?")) return;
    await auth().signOut().catch(() => {});
    forgetProfile(); location.reload();
  });
  const remove = () => run(async () => {
    if (!account?.email) throw new Error("Compte introuvable");
    if (name !== "SUPPRIMER") throw new Error("Écris SUPPRIMER pour confirmer");
    // on redemande le mot de passe : jeton frais
    const { data, error } = await auth().signInWithPassword({ email: account.email, password: pw });
    if (error || !data.session) throw error ?? new Error("Mot de passe incorrect");
    await api.deleteAccount(data.session.access_token);
    await auth().signOut().catch(() => {});
    forgetProfile(); location.reload();
  });

  const field = (v: string, set: (x: string) => void, ph: string, type = "text", ac = "off") =>
    <input value={v} onChange={(e) => set(e.target.value)} placeholder={ph} type={type} autoComplete={ac} />;
  const actions = (ok: string) => (
    <div className="row-wrap">
      <button className="gbtn gbtn-gold gbtn-sm" disabled={busy} type="submit">{ok}</button>
      <button type="button" className="gbtn gbtn-dark gbtn-sm" onClick={() => { setMode(null); setMsg(""); setInfo(""); }}>Annuler</button>
    </div>
  );

  if (account) {
    return (
      <div className="account-box">
        {mode !== "delete" ? <>
          <div>✅ Compte connecté — ta progression est sauvegardée sur tous tes appareils.</div>
          <div className="muted small">
            E-mail (privé) : <b>{account.email ?? "—"}</b> · Identifiant public : <b>#{account.login}</b>
            {account.nameChangesLeft !== undefined && <> · Changements de pseudo restants ce mois-ci : <b>{account.nameChangesLeft}</b></>}
          </div>
          <div className="row-wrap">
            <button className="gbtn gbtn-dark gbtn-sm" disabled={busy} onClick={logout}>Se déconnecter</button>
            <button className="gbtn gbtn-dark gbtn-sm" onClick={() => { setMode("delete"); setName(""); setPw(""); }}>Supprimer mon compte</button>
          </div>
        </> : (
          <form className="account-form" onSubmit={(e) => { e.preventDefault(); remove(); }}>
            <b>Supprimer définitivement mon compte</b>
            <p className="muted small">Doblons, XP, niveaux, succès, statistiques et collection seront effacés. C&apos;est irréversible.</p>
            {field(pw, setPw, "Mon mot de passe", "password", "current-password")}
            {field(name, setName, "Écris SUPPRIMER")}
            {actions("Supprimer")}
          </form>
        )}
        {msg && <p className="error">{msg}</p>}
      </div>
    );
  }
  return (
    <div className="account-box guest">
      {!mode && <>
        <div>👤 Tu joues en <b>invité</b> : rien n&apos;est sauvegardé (pas de Doblons, d&apos;XP, de stats ni de collection). Crée un compte gratuit avec ton e-mail pour garder ta progression.</div>
        <div className="row-wrap">
          <button className="gbtn gbtn-gold gbtn-sm" onClick={() => setMode("signup")}>Créer mon compte</button>
          <button className="gbtn gbtn-dark gbtn-sm" onClick={() => setMode("login")}>Me connecter</button>
        </div>
      </>}
      {mode === "signup" && (
        <form className="account-form" onSubmit={(e) => { e.preventDefault(); signup(); }}>
          <b>Créer mon compte</b>
          {field(name, setName, "Pseudo affiché", "text", "nickname")}
          {field(email, setEmail, "Adresse e-mail", "email", "email")}
          {field(pw, setPw, "Mot de passe (8 caractères min.)", "password", "new-password")}
          {field(pw2, setPw2, "Confirme le mot de passe", "password", "new-password")}
          <p className="muted small">Ta progression d&apos;invité n&apos;est pas reprise : le compte démarre à zéro.</p>
          {actions("Créer")}
        </form>
      )}
      {mode === "login" && (
        <form className="account-form" onSubmit={(e) => { e.preventDefault(); login(); }}>
          <b>Me connecter</b>
          {field(email, setEmail, "Adresse e-mail", "email", "email")}
          {field(pw, setPw, "Mot de passe", "password", "current-password")}
          <button type="button" className="link-btn small" onClick={() => { setMode("forgot"); setMsg(""); }}>Mot de passe oublié ?</button>
          {actions("Connexion")}
        </form>
      )}
      {mode === "forgot" && (
        <form className="account-form" onSubmit={(e) => { e.preventDefault(); forgot(); }}>
          <b>Mot de passe oublié</b>
          {field(email, setEmail, "Adresse e-mail du compte", "email", "email")}
          {actions("Recevoir le lien")}
        </form>
      )}
      {info && <p className="ok small">{info}</p>}
      {msg && <p className="error">{msg}</p>}
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
