"use client";
// =============================================================
//  Accueil : décor de casino tropical, logo, panneau central,
//  accès Mon profil / Mes gobelets / Paramètres.
// =============================================================
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, lastName, rememberName, saveSession } from "@/lib/client";
import Scene from "@/components/Scene";
import Logo from "@/components/Logo";
import Avatar from "@/components/Avatar";
import { HOME_ART } from "@/lib/catalog";
import { CupsModal, ProfileModal, RulesModal, SettingsModal, useMyProfile } from "@/components/Menus";

type Menu = null | "profile" | "cups" | "settings" | "rules";

export default function Home() {
  const router = useRouter();
  const profile = useMyProfile();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [menu, setMenu] = useState<Menu>(null);

  // pseudo rapide : le dernier utilisé, sinon celui du profil
  useEffect(() => setName((n) => n || lastName()), []);
  useEffect(() => { if (profile.data) setName((n) => n || profile.data!.profile.name); }, [profile.data]);

  async function go(kind: "create" | "join") {
    setError("");
    if (!name.trim()) return setError("Choisis un pseudo");
    if (kind === "join" && code.trim().length < 4) return setError("Entre le code de la partie");
    setBusy(true);
    try {
      const r = kind === "create" ? await api.create(name) : await api.join(code.trim().toUpperCase(), name);
      rememberName(name);
      saveSession(r.code, { playerId: r.playerId, token: r.token });
      router.push(`/partie/${r.code}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const me = profile.data?.profile;

  return (
    <main className="home-screen">
      <Scene id="casino" />

      <nav className="home-top">
        <button className="tile-btn" onClick={() => setMenu("cups")}>
          <span className="tile-ico">🏆</span><span>Mes gobelets</span>
        </button>
        <button className="tile-btn" onClick={() => setMenu("profile")}>
          <span className="tile-ico">{me ? <Avatar name={me.name} avatar={me.publicAvatar} size={34} /> : "👤"}</span><span>Mon profil</span>
        </button>
        <button className="round-btn" onClick={() => setMenu("settings")} aria-label="Paramètres">⚙️</button>
      </nav>

      <div className="home-center">
        <Logo />

        <div className="home-mascot" aria-hidden="true">
          {HOME_ART.art ? <img src={HOME_ART.mascot} alt="" /> : (
            <>
              <Avatar name="Gobelin" avatar="gobelin" size={110} />
              <div className="mascot-bubble">T&apos;oses bluffer ?</div>
            </>
          )}
        </div>

        <section className="panel home-panel">
          <label className="field-icon">
            <span aria-hidden="true">👤</span>
            <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="Ton pseudo" aria-label="Ton pseudo" />
          </label>

          <button className="gbtn gbtn-gold gbtn-xl" disabled={busy} onClick={() => go("create")}>
            <span className="gbtn-ico">▶</span> Créer une partie
          </button>

          <div className="divider"><span>ou</span></div>

          <div className="join-row">
            <input className="code-input" value={code} maxLength={6} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Code" aria-label="Code de partie" />
            <button className="gbtn gbtn-purple" disabled={busy} onClick={() => go("join")}>🔗 Rejoindre</button>
          </div>

          {error && <p className="error">{error}</p>}

          <button className="plaque-btn" onClick={() => setMenu("rules")}>📖 Nos règles</button>
        </section>
      </div>

      {menu === "profile" && <ProfileModal profile={profile} onClose={() => setMenu(null)} />}
      {menu === "cups" && <CupsModal profile={profile} onClose={() => setMenu(null)} />}
      {menu === "settings" && <SettingsModal onClose={() => setMenu(null)} />}
      {menu === "rules" && <RulesModal onClose={() => setMenu(null)} />}
    </main>
  );
}
