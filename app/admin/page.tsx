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
import { api, auth, getProfileCreds, syncAccount } from "@/lib/client";
import ContentAdmin from "@/components/admin/ContentAdmin";
import EconomyAdmin from "@/components/admin/EconomyAdmin";
import { AppearanceAdmin, AuditAdmin, Dashboard, PlayersAdmin, SettingsAdmin } from "@/components/admin/OtherAdmin";

const TABS = [
  ["dash", "📊", "Tableau de bord"], ["phrase", "💬", "Phrases cultes"], ["sound", "🔊", "Bruitages"],
  ["cup", "🥤", "Gobelets"], ["map", "🗺️", "Maps"],
  ["economy", "🪙", "Économie et roue"], ["challenge", "🎯", "Défis"], ["reaction", "😂", "Réactions"], ["frame", "🖼️", "Cadres de profil"], ["victory", "🎆", "Animations de victoire"],
  ["look", "🎨", "Apparence"], ["game", "⚙️", "Paramètres du jeu"],
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
          {(["phrase", "sound", "cup", "map", "reaction", "frame", "victory", "challenge"] as const).map((k) => tab === k && <ContentAdmin key={k} kind={k} />)}
          {tab === "economy" && <EconomyAdmin />}
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
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // § 67 : l'accès suit le COMPTE connecté (e-mail vérifié), jamais un pseudo ni une valeur du navigateur
  async function submit() {
    setErr(""); setBusy(true);
    try {
      await syncAccount().catch(() => {});
      const { data } = await auth().getSession();
      if (!data.session) throw new Error("Connecte-toi d'abord à ton compte : Accueil → Mon profil → Me connecter.");
      await api.myProfile();
      const c = getProfileCreds();
      const r = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${data.session.access_token}`, ...(c ? { "x-profile-id": c.id, "x-profile-key": c.key } : {}) },
        body: JSON.stringify({ mode: "account" }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "Connexion refusée");
      onDone();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  // essai automatique : si le compte admin est déjà connecté, on entre directement
  useEffect(() => { submit(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <main className="center-screen">
      <Scene id="casino" />
      <div className="panel stack narrow">
        <div className="panel-title"><span>Perudo Admin</span></div>
        <p className="muted small center-text">Réservé au compte administrateur. L&apos;accès se fait avec ton compte connecté (aucun mot de passe supplémentaire).</p>
        <button className="gbtn gbtn-gold gbtn-xl" disabled={busy} onClick={submit}>{busy ? "Vérification…" : "🔐 Entrer avec mon compte"}</button>
        {err && <p className="error">{err}</p>}
        <Link href="/" className="plaque-btn">🏠 Accueil</Link>
      </div>
    </main>
  );
}
