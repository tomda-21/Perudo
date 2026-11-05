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
import Victory from "./Victory";
import { api, auth, authError, forgetProfile, Progress, syncAccount } from "@/lib/client";
import type { SpinResult } from "@/lib/progression-types";
import { useContent } from "@/lib/content-client";
import { METRIC_LABEL } from "@/lib/economy";
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
        {(() => {
          const lv = p.level.level, E = p.economy;
          const last = Math.max(0, ...E.levelRewards.map((r) => r.level));
          const next = E.levelRewards.find((r) => r.level > lv)
            ?? (E.levelAfter.every > 0 ? { level: last + Math.ceil(Math.max(1, lv - last + 1) / E.levelAfter.every) * E.levelAfter.every, doblons: E.levelAfter.doblons, frame: null } : null);
          return next ? <div className="muted small">Prochain palier : niveau {next.level} → +{next.doblons} Doblons{next.frame ? " + un cadre" : ""}</div> : null;
        })()}
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
  return <p className="guest-note">🔒 Réservé aux joueurs avec un compte. Ouvre <b>Mon profil</b> pour en créer un (gratuit, avec ton e-mail).</p>;
}

// ---------- ROUE DU GOBELIN ----------
/** Réactions du gobelin selon le lot. */
function quip(r: SpinResult) {
  if (r.prizeId === "mystery" && r.item) return "QUOI ?! Un gobelet mystère ! Tu as triché ? 😱";
  if (r.compensated) return "Tu as déjà tout, gourmand… voilà des Doblons. 🙄";
  if (r.item) return "Joli ! Ça va briller à la table. ✨";
  if (r.fragments) return "Un fragment ! Plus que quelques-uns… 🧩";
  if (r.doblons >= 100) return "Le jackpot du gobelin ! 💰";
  if (r.doblons >= 40) return "Pas mal, pas mal… 😏";
  return "Bon… c'est mieux que rien ! 😅";
}
// parts en bois (chêne clair / noyer) bordées d'or ; la couleur sert aussi de repère dans la liste des chances
const COLORS = ["#b9773a", "#7a4520", "#c98d4a", "#5e3418", "#a8662e", "#6d3c1b", "#c07f3e", "#55301a", "#b57235", "#68391c", "#c48745", "#5a321a"];

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
            <svg viewBox="-118 -118 236 236" className="wheel wheel-wood" style={{ transform: `rotateX(16deg) rotate(${angle}deg)`, transition: spinning ? "transform 4.1s cubic-bezier(.12,.75,.12,1)" : "none" }}>
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
              {/* jante dorée cloutée (bois sculpté et or) */}
              <defs>
                <radialGradient id="whub"><stop offset="0" stopColor="#ffe9a8" /><stop offset=".55" stopColor="#d79a2b" /><stop offset="1" stopColor="#6b4210" /></radialGradient>
                <linearGradient id="wrim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff0b8" /><stop offset=".5" stopColor="#c98a1e" /><stop offset="1" stopColor="#7a4c0c" /></linearGradient>
              </defs>
              <circle r="104" fill="none" stroke="url(#wrim)" strokeWidth="10" />
              {Array.from({ length: 16 }, (_, k) => <circle key={k} cx={104 * Math.cos((k * Math.PI) / 8)} cy={104 * Math.sin((k * Math.PI) / 8)} r="3.2" fill="#fff6d0" stroke="#7a4c0c" strokeWidth="1" />)}
              <circle r="18" fill="url(#whub)" stroke="#5a3608" strokeWidth="3" />
            </svg>
          </div>
          <div className="wheel-side">
            {!p.member ? <GuestNote /> : (
              <>
                <Coins n={p.doblons} frag={p.fragments} />
                <div className="wheel-goblin"><Avatar name="Gobelin" avatar="gobelin" size={54} /><span className="bubble">{spinning ? "Ça tourne, ça tourne… 🤞" : res ? quip(res) : p.wheel.ready ? "Allez, tente ta chance !" : "Reviens plus tard, la roue se repose !"}</span></div>
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
            <p className="muted small">Un tour gratuit toutes les {p.economy.wheel.cooldownHours} h, tiré par le serveur. Gobelet mystère déjà tous possédés : {p.economy.wheel.duplicateDoblons} Doblons à la place ; fragment : {p.economy.fragments.allOwnedDoblons} Doblons. Aucun tour supplémentaire, même en Doblons.</p>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ---------- BOUTIQUE (§ 50–56 : apparence conservée) ----------
type ShopTab = "chest" | "frame" | "victory" | "cup" | "earn";
const SHOP_TABS: { id: ShopTab; label: string }[] = [
  { id: "chest", label: "🧰 Coffres" }, { id: "frame", label: "🖼️ Cadres" }, { id: "victory", label: "🎆 Victoires" },
  { id: "cup", label: "👑 Prestige" }, { id: "earn", label: "🪙 Gagner des Doblons" },
];
const VICTORY_ICON: Record<string, string> = { confetti: "🎊", fireworks: "🎆", goldrain: "🪙", hearts: "💖", stars: "🌠" };
const CAT_LABEL: Record<string, string> = { common: "Cosmétique commun", rare: "Cosmétique rare", epic: "Cosmétique épique", legendary: "Cosmétique légendaire", fragment: "Fragment universel", mystery: "Gobelet mystère" };
const RARITY_CLS: Record<string, string> = { commun: "r-common", rare: "r-rare", "épique": "r-epic", "légendaire": "r-legend" };
type ShopItem = { id: string; name: string; price: number; style?: string; level?: number; rarity?: string };
type ChestResult = { chest: string; cat: string; item: { type: string; id: string; name: string; rarity?: string } | null; doblons: number; fragments: number; compensated: boolean; converted: boolean };

/** Aperçu « 3D » léger : l'objet tourne sur un socle (CSS, pas de moteur 3D). */
function Preview3D({ kind, item, onClose }: { kind: "frame" | "victory" | "cup"; item: ShopItem; onClose: () => void }) {
  return (
    <div className="p3d-back" onClick={onClose}>
      <div className="p3d" onClick={(e) => e.stopPropagation()}>
        <div className={`p3d-stage ${kind}`}>
          <div className="p3d-spin">
            {kind === "frame" ? <span className={`frame frame-${item.style}`}><Avatar name="Moi" avatar="gobelin" size={120} /></span>
              : kind === "cup" ? <Cup state="show" size="lg" skin={item.id} />
              : <span className="p3d-emoji">{VICTORY_ICON[item.style ?? ""] ?? "🎉"}</span>}
          </div>
          {kind === "victory" && <div className="p3d-victory"><Victory style={item.style ?? "confetti"} /></div>}
          <div className="p3d-floor" />
        </div>
        <b>{item.name}</b>
        {item.rarity && <span className={`rbadge ${RARITY_CLS[item.rarity] ?? ""}`}>{item.rarity}</span>}
        <button className="gbtn gbtn-dark gbtn-sm" onClick={onClose}>Fermer</button>
      </div>
    </div>
  );
}

/** Ouverture de coffre : secousse, éclat à la couleur de la rareté, révélation. */
function ChestOpening({ tier, res, onClose }: { tier: string; res: ChestResult; onClose: () => void }) {
  const C = useContent();
  const [stage, setStage] = useState<"shake" | "open">("shake");
  useEffect(() => { const t = setTimeout(() => setStage("open"), tier === "epic" ? 1500 : tier === "rare" ? 1200 : 950); return () => clearTimeout(t); }, [tier]);
  const glow = res.item?.rarity ? RARITY_CLS[res.item.rarity] : res.cat === "mystery" ? "r-legend" : res.cat === "fragment" ? "r-rare" : "r-common";
  useEffect(() => { if (stage === "open") (glow === "r-legend" || glow === "r-epic" ? sounds.win : sounds.gain)(); }, [stage, glow]);
  return (
    <div className="chest-open-back" onClick={stage === "open" ? onClose : undefined}>
      <div className={`chest-open t-${tier} ${stage} ${glow}`} onClick={(e) => e.stopPropagation()}>
        <div className="chest-rays" />
        <div className={`chest-box t-${tier}`}><span className="chest-lid" /><span className="chest-body" /><span className="chest-lock" /></div>
        {stage === "open" && (
          <div className="chest-reveal">
            {res.item ? <>
              <div className="chest-item">
                {res.item.type === "frame" ? <span className={`frame frame-${C.frames.find((f) => f.id === res.item!.id)?.style ?? "gold"}`}><Avatar name="Moi" avatar="gobelin" size={80} /></span>
                  : res.item.type === "cup" ? <Cup state="show" size="lg" skin={res.item.id} />
                  : <span className="big">{VICTORY_ICON[C.victories.find((v) => v.id === res.item!.id)?.style ?? ""] ?? "🎉"}</span>}
              </div>
              <b>{res.item.name}</b>
              {res.item.rarity && <span className={`rbadge ${RARITY_CLS[res.item.rarity] ?? ""}`}>{res.item.rarity}</span>}
            </> : res.fragments ? <><div className="big">🧩</div><b>+{res.fragments} fragment universel</b></>
              : <><div className="big">🪙</div><b>+{res.doblons} Doblons</b>
                <span className="muted small">{res.converted ? "Tu as déjà tous les mystères : fragment converti." : "Tu possédais déjà tout ce qui était tiré : compensation."}</span></>}
            <button className="gbtn gbtn-gold gbtn-sm" onClick={onClose}>Super !</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function ShopModal({ onClose, prog, onCupBought }: { onClose: () => void; prog: ProgressState; onCupBought?: () => void }) {
  const c = useContent();
  const p = prog.data;
  const [tab, setTab] = useState<ShopTab>("chest");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ShopItem | null>(null);
  const [opening, setOpening] = useState<{ tier: string; res: ChestResult } | null>(null);

  const items: ShopItem[] =
    tab === "frame" ? c.frames.map((x) => ({ id: x.id, name: x.name, price: x.price, style: x.style, rarity: x.reward ? "légendaire" : x.rarity, level: x.reward ? p?.economy.levelRewards.find((r) => r.frame === x.id)?.level ?? 0 : undefined }))
    : tab === "victory" ? c.victories.map((x) => ({ id: x.id, name: x.name, price: x.price, style: x.style, rarity: x.price ? x.rarity : undefined }))
    : tab === "cup" ? c.cups.filter((x) => x.category === "shop").map((x) => ({ id: x.id, name: x.name, price: x.price ?? 0, rarity: x.rarity }))
    : [];
  const kind = tab === "frame" || tab === "victory" || tab === "cup" ? tab : null;

  const has = (id: string, price: number) => !price || (p?.member && kind ? p.owned[kind].includes(id) : false);
  const equipped = (id: string) => p?.member && ((tab === "frame" && p.frame === id) || (tab === "victory" && (p.victory ?? "confetti") === id));

  async function run(body: Record<string, unknown>, ok: string) {
    setBusy(true); setMsg("");
    try {
      const r = await api.progressAction(body);
      if (body.op === "chest") setOpening({ tier: String(body.id), res: r.result as ChestResult });
      prog.setData(r.progress); setMsg(ok);
      if (body.type === "cup" || (body.op === "chest" && (r.result as ChestResult).item?.type === "cup")) onCupBought?.();
    }
    catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }
  const E = c.economy;

  return (
    <Modal title="Boutique" onClose={onClose} wide>
      {!p ? <p className="muted">Chargement…</p> : (
        <>
          <div className="shop-head">{p.member ? <Coins n={p.doblons} frag={p.fragments} /> : <GuestNote />}</div>
          <div className="tabs">{SHOP_TABS.map((t) => <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => { setTab(t.id); setMsg(""); }}>{t.label}</button>)}</div>

          {tab === "chest" && (
            <div className="shop-grid chests">
              {E.chests.map((ch) => (
                <div key={ch.id} className={`shop-card chest-card t-${ch.id}`}>
                  <div className="shop-visual"><div className={`chest-box small t-${ch.id}`}><span className="chest-lid" /><span className="chest-body" /><span className="chest-lock" /></div></div>
                  <div className="shop-name">{ch.name}</div>
                  {/* § 54 : probabilités visibles avant l'achat */}
                  <table className="odds">
                    <tbody>
                      {CHEST_CAT_ORDER.filter((k) => ch.odds[k] > 0).map((k) => <tr key={k}><td>{CAT_LABEL[k]}</td><td>{ch.odds[k]} %</td></tr>)}
                    </tbody>
                  </table>
                  <div className="muted small">Déjà tout possédé ? Compensation : {ch.compensation} Doblons</div>
                  <button className="gbtn gbtn-gold gbtn-sm" disabled={busy || !p.member || (p.member && p.doblons < ch.price)}
                    onClick={() => confirm(`Ouvrir « ${ch.name} » pour ${ch.price} Doblons ?`) && run({ op: "chest", id: ch.id }, "")}>
                    🪙 {ch.price}
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === "earn" && (
            <ul className="earn-list">
              <li><span>🎲</span> Partie terminée <b>+{E.rewards.complete.doblons}</b></li>
              <li><span>🏆</span> Victoire <b>+{E.rewards.win.doblons}</b></li>
              <li><span>⚡</span> Dudo réussi <b>+{E.rewards.liar.doblons}</b> <em>(max {E.limits.liarPerGame} par partie)</em></li>
              <li><span>🎯</span> Exact réussi <b>+{E.rewards.exact.doblons}</b> <em>(max {E.limits.exactPerGame} par partie)</em></li>
              <li><span>🗓️</span> Défi du jour <b>+{E.rewards.dailyChallenge}</b> · défi de la semaine <b>+{E.rewards.weeklyChallenge}</b></li>
              <li><span>🎡</span> Roue du Gobelin : 1 tour gratuit toutes les {E.wheel.cooldownHours} h</li>
              <li><span>⭐</span> Paliers de niveau (5, 10, 20, 30, 50…)</li>
              <li><span>🚫</span> Aucun achat en argent réel, aucun tour de roue payant.</li>
            </ul>
          )}

          {kind && (items.length === 0 ? <p className="muted center-text">Rien dans cette catégorie pour l&apos;instant.</p> : (
            <div className="shop-grid">
              {items.map((x) => {
                // cadres de palier : possédés seulement une fois le niveau atteint
                const own = x.level !== undefined ? !!(p.member && p.owned.frame.includes(x.id)) : has(x.id, x.price);
                return (
                  <div key={x.id} className={`shop-card ${own ? "owned" : ""}`}>
                    <div className="shop-visual">
                      {tab === "frame" ? <span className={`frame frame-${x.style}`}><Avatar name="Moi" avatar="gobelin" size={56} /></span>
                        : tab === "victory" ? <span className="big">{VICTORY_ICON[x.style ?? ""] ?? "🎉"}</span>
                        : <Cup state="show" size="lg" skin={x.id} />}
                    </div>
                    <div className="shop-name">{x.name}</div>
                    {x.rarity && <span className={`rbadge ${RARITY_CLS[x.rarity] ?? ""}`}>{x.rarity}</span>}
                    <button className="pill pill-btn" onClick={() => setPreview(x)}>👁 Aperçu 3D</button>
                    {own ? (
                      (tab === "frame" || tab === "victory")
                        ? equipped(x.id) ? <div className="pill pill-green">Équipé</div>
                          : <button className="pill pill-btn" disabled={busy || !p.member} onClick={() => run({ op: "equip", field: tab, value: x.id }, "Équipé !")}>Équiper</button>
                        : <div className="pill pill-green">{x.price ? "Possédé" : "Gratuit"}</div>
                    ) : x.level !== undefined ? (
                      <div className="pill">🔒 Niveau {x.level || "?"}</div>
                    ) : (
                      <button className="gbtn gbtn-gold gbtn-sm" disabled={busy || !p.member || (p.member && p.doblons < x.price)}
                        onClick={() => confirm(`Acheter « ${x.name} » pour ${x.price} Doblons ?`) && run({ op: "buy", type: tab, id: x.id }, "Acheté ! Disponible tout de suite.")}>
                        🪙 {x.price.toLocaleString("fr-FR")}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          {tab === "frame" && p.member && p.frame && <p className="center-text"><button className="pill pill-btn" onClick={() => run({ op: "equip", field: "frame", value: null }, "Cadre retiré")}>Retirer mon cadre</button></p>}
          {msg && <p className="hint center-text">{msg}</p>}
          <p className="muted small center-text">Sons, phrases, réactions et gobelet Classique sont offerts à tous. Tout est cosmétique : rien ne change les dés ni les chances de gagner. Les Doblons se gagnent uniquement en jouant.</p>
          {preview && kind && <Preview3D kind={kind} item={preview} onClose={() => setPreview(null)} />}
          {opening && <ChestOpening tier={opening.tier} res={opening.res} onClose={() => setOpening(null)} />}
        </>
      )}
    </Modal>
  );
}
const CHEST_CAT_ORDER = ["common", "rare", "epic", "legendary", "fragment", "mystery"] as const;

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
                    <span>🪙 {c.doblons} · ✨ {c.xp} XP{c.fragments ? ` + 🧩 ${c.fragments}` : ""}</span>
                  </div>
                  <div className="muted small">{c.target} {METRIC_LABEL[c.metric]}</div>
                  <div className="progress"><span style={{ width: `${(c.have / c.target) * 100}%` }} /><em>{c.have}/{c.target}</em></div>
                </div>
              ))}
            </div>
          ))}
          <p className="muted small">Heure de référence : Paris (minuit, et lundi minuit pour la semaine). Toutes les parties terminées comptent, bots compris. La récompense est versée automatiquement.</p>
        </div>
      )}
    </Modal>
  );
}
