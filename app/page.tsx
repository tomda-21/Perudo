"use client";
// =============================================================
//  ACCUEIL — scène de casino tropical (illustrations découpées depuis
//  la maquette de Tom), gobelin mascotte, logo PERUDO, bouton Jouer,
//  et les 5 menus : Roue, Boutique, Défis, Mes gobelets, Succès.
//  Ordinateur : une « scène » 2348 × 1284 mise à l'échelle de l'écran.
//  Téléphone : même univers, réorganisé en colonne.
// =============================================================
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { api, lastName, rememberName, saveSession } from "@/lib/client";
import Avatar from "@/components/Avatar";
import Logo from "@/components/Logo";
import { assetUrl } from "@/lib/content";
import { useContent } from "@/lib/content-client";
import { CupsModal, ProfileModal, RulesModal, SettingsModal, useMyProfile } from "@/components/Menus";
import { ChallengesModal, ShopModal, useProgress, WheelModal } from "@/components/Progress";
import { EarnModal, PlayModal, SuccessModal } from "@/components/HomeModals";
import { sounds, unlockAudio } from "@/lib/sound";
import { useSettings } from "@/lib/settings";

type Menu = null | "play" | "profile" | "cups" | "settings" | "rules" | "wheel" | "shop" | "challenges" | "success" | "earn";
const A = "/art/home/";
const STAGE_W = 2348, STAGE_H = 1284;

/** Position d'un élément dans la scène (pixels de la maquette d'origine). */
const at = (x: number, y: number, w?: number, h?: number): CSSProperties => ({ left: x, top: y, ...(w ? { width: w } : {}), ...(h ? { height: h } : {}) });

function useCountdown(iso: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (!iso) return; const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, [iso]);
  if (!iso) return null;
  const ms = Math.max(0, new Date(iso).getTime() - now);
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return ms <= 0 ? null : `${h}h ${String(m).padStart(2, "0")}m`;
}

/** Échelle de la scène (couvre l'écran) + mode téléphone. */
function useStage() {
  const [v, setV] = useState({ s: 0.6, mobile: false, hs: 0.6, left: 18, right: 18, top: 14 });
  useEffect(() => {
    const f = () => {
      const w = window.innerWidth, h = window.innerHeight;
      const mobile = w / h < 1.15 || w < 700;
      // on recouvre l'écran, mais sans trop rogner les côtés (gobelin, gros dé) :
      // sur un écran plus « carré », le ciel est prolongé en haut à la place
      const cover = Math.max(w / STAGE_W, h / STAGE_H);
      const wide = w / h >= STAGE_W / STAGE_H;
      const s = Math.min(cover, wide
        ? Math.max(h / STAGE_H, w / (STAGE_W * 1.25))     // très large : décor prolongé sur les côtés
        : Math.max(w / (STAGE_W - 20), (h * 0.8) / STAGE_H)); // plus carré : ciel prolongé en haut
      // le profil et les Doblons se posent à l'emplacement prévu dans le décor,
      // tout en restant toujours entièrement visibles
      const sl = (w - STAGE_W * s) / 2, st = h - STAGE_H * s, hs = Math.max(0.5, s);
      setV({
        s, mobile, hs,
        left: Math.max(12, sl + 22 * s), top: Math.max(12, st + 18 * s),
        right: Math.max(12, w - (sl + 2338 * s)),
      });
    };
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return v;
}

export default function Home() {
  const router = useRouter();
  const profile = useMyProfile();
  const prog = useProgress();
  const [settings] = useSettings();
  const { appearance } = useContent();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [menu, setMenu] = useState<Menu>(null);
  const { s, mobile, hs, left, right, top } = useStage();

  useEffect(() => setName((n) => n || lastName()), []);
  useEffect(() => { if (profile.data) setName((n) => n || profile.data!.profile.name); }, [profile.data]);
  // la progression suit le profil (création d'un compte, connexion)
  useEffect(() => { if (profile.data) prog.reload(); }, [profile.data?.profile.id, profile.data?.account?.login]); // eslint-disable-line react-hooks/exhaustive-deps
  // lien d'invitation éventuel : /?code=ABCD ouvre directement « Rejoindre »
  useEffect(() => {
    const c = new URLSearchParams(location.search).get("code");
    if (c) { setCode(c.toUpperCase().slice(0, 6)); setMenu("play"); }
  }, []);

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

  const open = (m: Menu) => { unlockAudio(); sounds.bid(); setMenu(m); };
  const me = profile.data?.profile;
  const p = prog.data;
  const wheelCd = useCountdown(p?.member ? p.wheel.next : null);
  const wheelChip = !p ? "…" : !p.member ? "Compte requis" : p.wheel.ready || !wheelCd ? "Prête !" : wheelCd;

  // défi terminé pas encore vu → pastille « ! »
  const doneKey = p?.member ? p.challenges.filter((c) => c.done).map((c) => `${c.id}@${c.ends}`).sort().join(",") : "";
  const [seen, setSeen] = useState("");
  useEffect(() => { try { setSeen(localStorage.getItem("perudo:seen-challenges") ?? ""); } catch {} }, []);
  const challengeAlert = !!doneKey && doneKey !== seen;
  const openChallenges = () => { try { localStorage.setItem("perudo:seen-challenges", doneKey); } catch {} setSeen(doneKey); open("challenges"); };

  const bg = appearance.homeBackground ? assetUrl(appearance.homeBackground) : null;
  const goblin = appearance.mascot ? assetUrl(appearance.mascot)! : `${A}goblin.webp`;
  const calm = settings.reduceMotion;

  const cards = useMemo(() => [
    { id: "wheel", label: "Roue du Gobelin", img: "card-wheel", pos: at(297, 922, 351, 338), onClick: () => open("wheel") },
    { id: "shop", label: "Boutique", img: "card-shop", pos: at(644, 947, 352, 283), onClick: () => open("shop") },
    { id: "challenges", label: "Défis", img: "card-challenges", pos: at(1004, 937, 352, 293), onClick: openChallenges },
    { id: "cups", label: "Mes gobelets", img: "card-cups", pos: at(1354, 942, 356, 288), onClick: () => open("cups") },
    { id: "success", label: "Succès", img: "card-success", pos: at(1714, 947, 346, 283), onClick: () => open("success") },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [doneKey, seen]);

  // ---------- éléments communs ----------
  const ProfileBadge = (
    <button className="hp-profile" onClick={() => open("profile")} aria-label="Mon profil">
      <span className={`hp-avatar ${p?.member && p.frame ? `frame frame-${p.frame}` : ""}`}>
        {me ? <Avatar name={me.name} avatar={me.publicAvatar} size={mobile ? 54 : 128} /> : <span className="avatar" />}
      </span>
      <span className="hp-info">
        <b className="hp-name">{me?.name ?? "…"}</b>
        {p?.member ? (
          <>
            <span className="hp-level"><img src={`${A}ico-trophy.webp`} alt="" /> Niveau {p.level.level}{p.title ? <em> · {p.title}</em> : null}</span>
            <span className="hp-xp"><span style={{ width: `${Math.round((p.level.into / p.level.need) * 100)}%` }} /><i>{p.level.into} / {p.level.need} XP</i></span>
          </>
        ) : (
          <>
            <span className="hp-level">Mode invité</span>
            <span className="hp-guest">Créer un compte / Se connecter</span>
          </>
        )}
      </span>
    </button>
  );
  const Wallet = (
    <div className="hp-wallet">
      <img src={`${A}ico-coin.webp`} alt="" />
      <b>{p?.member ? p.doblons.toLocaleString("fr-FR") : "—"}</b>
      <button className="hp-plus" onClick={() => open("earn")} aria-label="Comment gagner des Doblons"><img src={`${A}ico-plus.webp`} alt="" /></button>
    </div>
  );
  const TopButtons = (
    <>
      <button className="hp-btn" onClick={() => open("cups")}><img src={`${A}ico-trophy.webp`} alt="" /><span>Mes gobelets</span></button>
      <button className="hp-btn" onClick={() => open("profile")}><img src={`${A}ico-profile.webp`} alt="" /><span>Mon profil</span></button>
      <button className="hp-gear" onClick={() => open("settings")} aria-label="Paramètres"><img src={`${A}ico-gear.webp`} alt="" /></button>
    </>
  );
  const Card = (c: (typeof cards)[number], style?: CSSProperties) => (
    <button key={c.id} className={`hcard hcard-${c.id}`} style={style} onClick={c.onClick}>
      <img src={`${A}${c.img}.webp`} alt="" draggable={false} />
      {c.id === "wheel" ? (
        <>
          <span className="hcard-ribbon">Roue du</span>
          <span className="hcard-label">Gobelin</span>
          <span className="hcard-chip">{wheelChip}</span>
        </>
      ) : <span className="hcard-label">{c.label}</span>}
      {c.id === "challenges" && challengeAlert && <span className="hcard-alert" aria-label="Nouveau défi réussi">!</span>}
    </button>
  );

  return (
    <main className={`home2 ${mobile ? "is-mobile" : "is-desktop"} ${calm ? "calm" : ""}`}>
      {!mobile ? (
        <>
          <div className="stage" style={{ width: STAGE_W, height: STAGE_H, transform: `translateX(-50%) scale(${s})` }}>
            <span className="stage-sky" aria-hidden="true" />
            <span className="stage-side stage-side-l" aria-hidden="true" />
            <span className="stage-side stage-side-r" aria-hidden="true" />
            <img className="stage-bg" src={bg ?? `${A}bg.webp`} alt="" draggable={false} />
            {/* cascade, lanternes, néons */}
            <span className="fx-waterfall" style={at(2030, 460, 155, 300)} />
            {[[250, 372, 120], [70, 465, 110], [2285, 700, 120], [1655, 548, 150], [1948, 222, 120], [1110, 600, 70], [1880, 640, 80]].map(([x, y, r], i) => (
              <span key={i} className="fx-glow" style={{ left: x - r, top: y - r, width: r * 2, height: r * 2, animationDelay: `${i * 0.7}s` }} />
            ))}
            <div className="fx-motes" aria-hidden="true">{Array.from({ length: 22 }, (_, i) => <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 1.3) % 9}s`, animationDuration: `${9 + (i % 5) * 2}s` }} />)}</div>

            <img className="goblin" src={goblin} alt="Le gobelin, mascotte de Perudo" style={at(90, 300, 740, 640)} draggable={false} />
            {appearance.tagline && <div className="goblin-bubble" style={at(372, 236)}>{appearance.tagline}</div>}

            <img className="hdie die-float" src={`${A}die-a.webp`} alt="" style={at(982, 12, 92, 89)} />
            <div className="stage-logo" style={at(815, 108, 730, 362)}><Logo image={appearance.logo} shine={!calm} /></div>
            <img className="hdie die-wobble" src={`${A}die-b.webp`} alt="" style={at(1579, 862, 99, 99)} />
            <img className="hdie die-wobble" src={`${A}die-c.webp`} alt="" style={at(2134, 829, 152, 142)} />

            <button className="play-sign" style={at(814, 664, 749, 249)} onClick={() => { unlockAudio(); sounds.shake(); setMenu("play"); }}>
              <img src={`${A}play.webp`} alt="" draggable={false} />
              <span>Jouer</span>
            </button>
            {cards.map((c) => Card(c, c.pos))}
          </div>
          <div className="hhud hhud-left" style={{ transform: `scale(${hs})`, left, top }}>{ProfileBadge}</div>
          <div className="hhud hhud-right" style={{ transform: `scale(${hs})`, right, top }}>{Wallet}{TopButtons}</div>
        </>
      ) : (
        <>
          <div className="m-bg" style={{ backgroundImage: `url(${bg ?? `${A}bg-mobile.webp`})` }}>
            <span className="fx-waterfall m-wf" />
            <div className="fx-motes" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <span key={i} style={{ left: `${(i * 41) % 100}%`, animationDelay: `${(i * 1.7) % 9}s` }} />)}</div>
          </div>
          <div className="m-top">{ProfileBadge}<div className="m-top-right">{Wallet}<button className="hp-gear" onClick={() => open("settings")} aria-label="Paramètres"><img src={`${A}ico-gear.webp`} alt="" /></button></div></div>
          <div className="m-logo"><Logo image={appearance.logo} shine={!calm} /><img className="hdie die-float m-die" src={`${A}die-a.webp`} alt="" /></div>
          <div className="m-middle">
            <img className="goblin m-goblin" src={goblin} alt="Le gobelin, mascotte de Perudo" draggable={false} />
            <button className="play-sign m-play" onClick={() => { unlockAudio(); sounds.shake(); setMenu("play"); }}>
              <img src={`${A}play.webp`} alt="" draggable={false} />
              <span>Jouer</span>
            </button>
          </div>
          <nav className="m-cards">{cards.map((c) => Card(c))}</nav>
        </>
      )}

      {menu === "play" && <PlayModal name={name} setName={setName} code={code} setCode={setCode} busy={busy} error={error}
        onCreate={() => go("create")} onJoin={() => go("join")} onRules={() => setMenu("rules")} onClose={() => setMenu(null)} />}
      {menu === "profile" && <ProfileModal profile={profile} prog={prog} onClose={() => setMenu(null)} />}
      {menu === "cups" && <CupsModal profile={profile} prog={prog} openShop={() => setMenu("shop")} onClose={() => setMenu(null)} />}
      {menu === "settings" && <SettingsModal onClose={() => setMenu(null)} />}
      {menu === "rules" && <RulesModal onClose={() => setMenu(null)} />}
      {menu === "wheel" && <WheelModal prog={prog} onClose={() => { setMenu(null); api.myProfile().then(profile.setData).catch(() => {}); }} />}
      {menu === "shop" && <ShopModal prog={prog} onClose={() => setMenu(null)} />}
      {menu === "challenges" && <ChallengesModal prog={prog} onClose={() => setMenu(null)} />}
      {menu === "success" && <SuccessModal profile={profile.data} prog={prog} onAccount={() => setMenu("profile")} onClose={() => setMenu(null)} />}
      {menu === "earn" && <EarnModal onWheel={() => setMenu("wheel")} onChallenges={openChallenges} onClose={() => setMenu(null)} />}
    </main>
  );
}
