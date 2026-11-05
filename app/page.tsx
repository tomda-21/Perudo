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
import { FriendsModal, useSocial } from "@/components/Friends";
import { Modal } from "@/components/Panel";
import { sounds, unlockAudio } from "@/lib/sound";
import { useSettings } from "@/lib/settings";

type Menu = null | "friends" | "play" | "profile" | "cups" | "settings" | "rules" | "wheel" | "shop" | "challenges" | "success" | "earn";
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
  const [v, setV] = useState({ s: 0.6, mobile: false, short: false, hsL: 0.6, hsR: 0.6, left: 12, right: 12, top: 12 });
  useEffect(() => {
    const f = () => {
      const w = window.innerWidth, h = window.innerHeight;
      const mobile = w / h < 1.15; // portrait → colonne ; tout écran en paysage garde la scène
      // on recouvre l'écran, mais sans trop rogner les côtés (gobelin, gros dé) :
      // sur un écran plus « carré », le ciel est prolongé en haut à la place
      const cover = Math.max(w / STAGE_W, h / STAGE_H);
      const wide = w / h >= STAGE_W / STAGE_H;
      const s = Math.min(cover, wide
        ? Math.max(h / STAGE_H, w / (STAGE_W * 1.25))     // très large : décor prolongé sur les côtés
        : Math.max(w / (STAGE_W - 20), (h * 0.8) / STAGE_H)); // plus carré : ciel prolongé en haut
      // le profil (gauche) et les Doblons + menus (droite) se calent sur les bords de l'écran,
      // et rétrécissent si besoin pour ne jamais toucher le logo au centre
      const short = h < 560;
      const gap = (w - 730 * s * (short ? 0.82 : 1)) / 2 - 26;
      const base = Math.max(0.5, s);
      const logoTop = h - STAGE_H * s + 100 * s; // haut du logo à l'écran
      const clear = logoTop > 12 + 210 * base;   // le logo est sous les infos : pas besoin de rétrécir
      const hsL = clear ? base : Math.max(0.3, Math.min(base, gap / 570));
      const hsR = clear ? base : Math.max(0.3, Math.min(base, gap / (short ? 560 : 910)));
      const edge = 12;
      setV({ s, mobile, short, hsL, hsR, left: edge, right: edge, top: Math.max(edge, 10 * s) });
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
  const { s, mobile, short, hsL, hsR, left, right, top } = useStage();

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
  const social = useSocial(!!p?.member); // présence + notifications (comptes uniquement)
  const wheelCd = useCountdown(p?.member ? p.wheel.next : null);
  const wheelChip = !p ? "…" : !p.member ? "Connexion" : p.wheel.ready || !wheelCd ? "Prête !" : wheelCd;

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
            <span className="hp-guest"><span className="hp-guest-long">Créer un compte / </span>Se connecter</span>
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
      <button className="hp-btn hp-friends" aria-label="Amis" onClick={() => open("friends")}><span className="hp-emo">👥</span><span className="hp-lbl">Amis</span>{social.unread > 0 && <i className="hp-badge">{social.unread}</i>}</button>
      <button className="hp-btn hp-dup" aria-label="Mes gobelets" onClick={() => open("cups")}><img src={`${A}ico-trophy.webp`} alt="" /><span className="hp-lbl">Mes gobelets</span></button>
      <button className="hp-btn hp-dup" aria-label="Mon profil" onClick={() => open("profile")}><img src={`${A}ico-profile.webp`} alt="" /><span className="hp-lbl">Mon profil</span></button>
      <button className="hp-gear" onClick={() => open("settings")} aria-label="Paramètres"><img src={`${A}ico-gear.webp`} alt="" /></button>
    </>
  );
  // le gobelin est assis derrière une table de jeu : la table, au premier plan, cache le bas de son corps
  const GoblinAtTable = (
    <>
      <img className="goblin" src={goblin} alt="Le gobelin, mascotte de Perudo" draggable={false} />
      <img className="goblin-table" src={`${A}goblin-table.webp`} alt="" draggable={false} />
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
    <main className={`home2 ${mobile ? "is-mobile" : `is-desktop${short ? " is-short" : ""}`} ${calm ? "calm" : ""}`}>
      {!mobile ? (
        <>
          {/* décor de l'accueil : illustration panoramique plein écran (cover), indépendante des composants */}
          <div className="home-decor" style={bg ? { backgroundImage: `url(${bg})` } : undefined} aria-hidden="true" />
          <div className="stage" style={{ width: STAGE_W, height: STAGE_H, transform: `translateX(-50%) scale(${s})` }}>
            <div className="fx-motes" aria-hidden="true">{Array.from({ length: 22 }, (_, i) => <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 1.3) % 9}s`, animationDuration: `${9 + (i % 5) * 2}s` }} />)}</div>

            <div className="goblin-wrap" style={at(90, 300, 740, 640)}>{GoblinAtTable}</div>
            {appearance.tagline && <div className="goblin-bubble" style={at(372, 236)}>{appearance.tagline}</div>}

            <img className="hdie die-float" src={`${A}die-a.webp`} alt="" style={at(982, 12, 92, 89)} />
            <div className="stage-logo" style={at(815, 108, 730, 362)}><Logo image={appearance.logo} shine={!calm} /></div>

            <button className="play-sign" style={at(814, 664, 749, 249)} onClick={() => { unlockAudio(); sounds.shake(); setMenu("play"); }}>
              <img src={`${A}play.webp`} alt="" draggable={false} />
              <span>Jouer</span>
            </button>
            {cards.map((c) => Card(c, c.pos))}
          </div>
          <div className="hhud hhud-left" style={{ transform: `scale(${hsL})`, left, top }}>{ProfileBadge}</div>
          <div className="hhud hhud-right" style={{ transform: `scale(${hsR})`, right, top }}>{Wallet}{TopButtons}</div>
        </>
      ) : (
        <>
          <div className="m-bg" style={bg ? { backgroundImage: `url(${bg})` } : undefined}>
            <div className="fx-motes" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <span key={i} style={{ left: `${(i * 41) % 100}%`, animationDelay: `${(i * 1.7) % 9}s` }} />)}</div>
          </div>
          <div className="m-top">{ProfileBadge}<div className="m-top-right">{Wallet}<button className="hp-gear hp-friends-m" onClick={() => open("friends")} aria-label="Amis"><span>👥</span>{social.unread > 0 && <i className="hp-badge">{social.unread}</i>}</button><button className="hp-gear" onClick={() => open("settings")} aria-label="Paramètres"><img src={`${A}ico-gear.webp`} alt="" /></button></div></div>
          <div className="m-logo"><Logo image={appearance.logo} shine={!calm} /><img className="hdie die-float m-die" src={`${A}die-a.webp`} alt="" /></div>
          <div className="m-middle">
            <div className="goblin-wrap m-goblin">{GoblinAtTable}</div>
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
      {menu === "friends" && (p?.member
        ? <FriendsModal social={social} myPublicId={profile.data?.account?.login ?? null} onClose={() => { setMenu(null); social.load(); }}
            usableCups={(profile.data?.cups ?? []).filter((c) => (profile.data?.usable ?? profile.data?.unlocked ?? []).includes(c.id)).map((c) => ({ id: c.id, name: c.name }))} />
        : <Modal title="Amis" onClose={() => setMenu(null)}><p className="center-text">Les amis, invitations et classements sont réservés aux joueurs avec un compte.</p><p className="center-text"><button className="gbtn gbtn-gold" onClick={() => setMenu("profile")}>Créer mon compte</button></p></Modal>)}
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
