"use client";
// =============================================================
//  PERUDO ADMIN — accessible uniquement au compte administrateur.
//  La page elle-même ne protège rien : c'est le SERVEUR qui vérifie
//  le rôle admin à chaque appel. Sans session admin valide, aucune
//  donnée n'est renvoyée.
// =============================================================
import { useEffect, useState } from "react";
import Link from "next/link";
import Scene from "@/components/Scene";
import Logo from "@/components/Logo";
import { api, getProfileCreds } from "@/lib/client";
import ContentAdmin from "@/components/admin/ContentAdmin";
import { AppearanceAdmin, AuditAdmin, Dashboard, PlayersAdmin, SettingsAdmin } from "@/components/admin/OtherAdmin";

const TABS = [
  ["dash", "📊", "Tableau de bord"], ["phrase", "💬", "Phrases cultes"], ["sound", "🔊", "Bruitages"],
  ["cup", "🥤", "Gobelets"], ["map", "🗺️", "Maps"], ["look", "🎨", "Apparence"], ["game", "⚙️", "Paramètres du jeu"],
  ["players", "👥", "Joueurs"], ["audit", "📜", "Journal"],
] as const;
type Tab = (typeof TABS)[number][0];

export default function AdminPage() {
  const [state, setState] = useState<"loading" | "out" | "in">("loading");
  const [name, setName] = useState("");
  const [tab, setTab] = useState<Tab>("dash");

  const check = async () => {
    const r = await fetch("/api/admin/login", { cache: "no-store" }).then((x) => x.json()).catch(() => ({ admin: false }));
    setName(r.name ?? "");
    setState(r.admin ? "in" : "out");
  };
  useEffect(() => { check(); }, []);

  if (state === "loading") return <main className="center-screen"><Scene id="casino" /><p className="loading">Chargement…</p></main>;
  if (state === "out") return <Login onDone={check} />;

  return (
    <main className="admin-screen">
      <header className="admin-top">
        <div className="admin-brand"><Logo size="sm" /><span className="admin-tag">ADMIN</span></div>
        <div className="row-wrap">
          <span className="muted small">Connecté : <b>{name}</b></span>
          <Link href="/" className="gbtn gbtn-dark gbtn-sm">🏠 Voir le site</Link>
          <button className="gbtn gbtn-red gbtn-sm" onClick={async () => { await fetch("/api/admin/logout", { method: "POST" }); check(); }}>Déconnexion</button>
        </div>
      </header>
      <div className="admin-body">
        <nav className="admin-nav">
          {TABS.map(([id, ico, label]) => (
            <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}><span>{ico}</span> {label}</button>
          ))}
        </nav>
        <section className="panel admin-main">
          <div className="panel-title"><span>{TABS.find((t) => t[0] === tab)![2]}</span></div>
          {tab === "dash" && <Dashboard />}
          {(tab === "phrase" || tab === "sound" || tab === "cup" || tab === "map") && <ContentAdmin kind={tab} />}
          {tab === "look" && <AppearanceAdmin />}
          {tab === "game" && <SettingsAdmin />}
          {tab === "players" && <PlayersAdmin />}
          {tab === "audit" && <AuditAdmin />}
        </section>
      </div>
    </main>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"login" | "claim">("login");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr("");
    if (mode === "claim" && password !== password2) return setErr("Les deux mots de passe ne sont pas identiques");
    setBusy(true);
    try {
      await api.myProfile(); // le profil de cet appareil (créé au besoin)
      const c = getProfileCreds();
      const r = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json", ...(c ? { "x-profile-id": c.id, "x-profile-key": c.key } : {}) },
        body: JSON.stringify({ mode, code, password }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "Connexion refusée");
      onDone();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <main className="center-screen">
      <Scene id="casino" />
      <div className="panel stack narrow">
        <div className="panel-title"><span>Perudo Admin</span></div>
        {mode === "login" ? (
          <>
            <p className="muted small center-text">Réservé au créateur du jeu. Connexion avec le profil de cet appareil + ton mot de passe admin.</p>
            <input type="password" placeholder="Mot de passe admin" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} autoComplete="current-password" />
            <button className="gbtn gbtn-gold gbtn-xl" disabled={busy || !password} onClick={submit}>🔐 Se connecter</button>
            <button className="a-link" onClick={() => { setMode("claim"); setErr(""); }}>Première fois ? J&apos;ai un code d&apos;activation</button>
          </>
        ) : (
          <>
            <p className="muted small center-text">Le code d&apos;activation (à usage unique) fait de <b>ce profil</b> le compte administrateur. Choisis ensuite ton mot de passe admin.</p>
            <input placeholder="Code d'activation" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            <input type="password" placeholder="Nouveau mot de passe (10 caractères min.)" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            <input type="password" placeholder="Confirme le mot de passe" value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" />
            <button className="gbtn gbtn-gold gbtn-xl" disabled={busy || !code || !password} onClick={submit}>✨ Activer mon compte admin</button>
            <button className="a-link" onClick={() => { setMode("login"); setErr(""); }}>J&apos;ai déjà un mot de passe</button>
          </>
        )}
        {err && <p className="error">{err}</p>}
        <Link href="/" className="plaque-btn">🏠 Accueil</Link>
      </div>
    </main>
  );
}
