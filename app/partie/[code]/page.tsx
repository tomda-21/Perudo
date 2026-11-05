"use client";
// =============================================================
//  La partie : décor, table, commandes, soundboard, quitter.
//  Cette page ne décide jamais du jeu : elle affiche l'état envoyé
//  par le serveur et lui transmet les actions du joueur.
// =============================================================
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Scene from "@/components/Scene";
import { CallFx, Countdown, LAND, MapIntro, Stage } from "@/components/GameStage";
import { Bar2 } from "@/components/GameBar";
import RotatePrompt from "@/components/RotatePrompt";
import Victory from "@/components/Victory";
import Avatar from "@/components/Avatar";
import { InviteFriends, useSocial } from "@/components/Friends";
import { Modal } from "@/components/Panel";
import { SettingsModal } from "@/components/Menus";
import { Lobby } from "@/components/GameControls";
import { gameBg3 } from "@/lib/catalog";
import { assetUrl } from "@/lib/content";
import { api, getSession, lastName, Progress, realtime, rememberName, saveSession, Session } from "@/lib/client";
import { sounds, unlockAudio } from "@/lib/sound";
import { useSettings } from "@/lib/settings";
import { useFx } from "@/lib/fx";
import { useContent } from "@/lib/content-client";
import type { PlayerView } from "@/lib/rules";

const faceLabel = (face: number) => (face === 1 ? "pax" : `${face}`);
const bidText = (b: { qty: number; face: number }) => `${b.qty} × ${faceLabel(b.face)}`;
const FX_MS = 1700;
const SHAKE_MS = 1300;

export default function GamePage() {
  const code = String(useParams<{ code: string }>().code).toUpperCase();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<PlayerView | null>(null);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [present, setPresent] = useState<Set<string> | null>(null);
  const [shaking, setShaking] = useState(false);
  // § 30 : mes dés restent visibles (réglage gardé sur l'appareil), un bouton les masque
  const [settings, setSettings] = useSettings();
  const peek = settings.showDice;
  const setPeek = (v: boolean | ((x: boolean) => boolean)) => setSettings({ showDice: typeof v === "function" ? v(settings.showDice) : v });
  const [zoom, setZoom] = useState(false); // petit zoom de caméra (Dudo, Exact, élimination, victoire)
  const [goblin, setGoblin] = useState<{ text: string; emo: string; key: number } | null>(null);
  const [pali, setPali] = useState<{ name: string; key: number } | null>(null);
  const [panel, setPanel] = useState<null | "sounds" | "phrases" | "reactions">(null);
  const [prog, setProg] = useState<Progress | null>(null);
  useSocial(!!prog?.member, code); // présence « en partie » pour mes amis
  const [gain, setGain] = useState<{ doblons: number; xp: number } | null>(null);
  const [dialog, setDialog] = useState<null | "quit" | "settings">(null);
  const [callFx, setCallFx] = useState<null | { kind: "liar" | "exact"; success: boolean; key: number }>(null);
  const [intro, setIntro] = useState<string | null>(null);
  // taille de la scène : la table remplit l'espace libre entre le haut et la barre de commandes
  const [sceneScale, setSceneScale] = useState(0.5);
  const ro = useRef<ResizeObserver | null>(null);
  const sceneRef = useCallback((el: HTMLElement | null) => {
    ro.current?.disconnect();
    if (!el) return;
    // la table garde une marge sur les côtés (bulles, pseudos) et ne devient jamais démesurée
    const fit = () => { const r = el.getBoundingClientRect(); setSceneScale(Math.max(0.15, Math.min((r.width * 0.94) / LAND.W, r.height / LAND.H, 1.6))); };
    ro.current = new ResizeObserver(fit); ro.current.observe(el); fit();
  }, []);
  const { maps: MAPS, phrases: PHRASES, reactions: REACTIONS, victories: VICTORIES, settings: game } = useContent();
  // ma progression : objets possédés pour le soundboard, gains de fin de partie
  useEffect(() => { api.progress().then(setProg).catch(() => {}); }, []);
  const owned = (kind: "phrase" | "sound" | "reaction", id: string, price?: number) => !price || (prog?.member ? prog.owned[kind].includes(id) : false);

  useEffect(() => {
    const u = () => unlockAudio();
    window.addEventListener("pointerdown", u, { once: true });
    return () => window.removeEventListener("pointerdown", u);
  }, []);

  // ---------- chargement + temps réel ----------
  const refresh = useCallback(async () => {
    try {
      const s = getSession(code);
      setSession(s);
      setView(await api.state(code, s?.token));
    } catch (e) {
      if ((e as Error).message.includes("introuvable")) setNotFound(true);
    }
  }, [code]);

  useEffect(() => {
    refresh();
    const ch = realtime()
      .channel(`partie-${code}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_pings", filter: `code=eq.${code}` }, refresh)
      .subscribe();
    const poll = setInterval(refresh, 8000); // filet de sécurité si le temps réel décroche
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      realtime().removeChannel(ch);
      clearInterval(poll);
      window.removeEventListener("focus", onFocus);
    };
  }, [code, refresh]);

  // ---------- présence : qui a la page ouverte ? ----------
  const myId = view?.me?.id ?? null;
  useEffect(() => {
    if (!myId) return;
    const ch = realtime().channel(`presence-${code}`, { config: { presence: { key: myId } } });
    ch.on("presence", { event: "sync" }, () => setPresent(new Set(Object.keys(ch.presenceState()))))
      .subscribe((status) => { if (status === "SUBSCRIBED") ch.track({ at: Date.now() }); });
    return () => { realtime().removeChannel(ch); };
  }, [code, myId]);

  const { fx, send } = useFx(code, myId, view?.players ?? []);

  // fin de partie : on va chercher ce que le serveur a crédité (rien n'est calculé ici)
  const finishedKey = view?.phase === "finished" ? `${view.gameNo ?? 1}` : null;
  useEffect(() => {
    if (!finishedKey || !prog?.member) { setGain(null); return; }
    const before = prog;
    const t = setTimeout(() => api.progress().then((p) => {
      if (p.member) setGain({ doblons: p.doblons - before.doblons, xp: p.xp - before.xp });
      setProg(p);
    }).catch(() => {}), 1800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishedKey]);

  async function act(body: Record<string, unknown>) {
    if (!session) return null;
    setBusy(true);
    setError("");
    try {
      const v = await api.action(code, session.token, body);
      setView(v);
      return v;
    } catch (e) {
      setError((e as Error).message);
      setTimeout(() => setError(""), 3500);
      return null;
    } finally {
      setBusy(false);
    }
  }

  // ---------- animations et sons déclenchés par les changements d'état ----------
  const prev = useRef<{ round: number; hist: number; phase: string; turn: string | null } | null>(null);
  useEffect(() => {
    if (!view) return;
    const p = prev.current;
    const now = { round: view.round, hist: view.history.length, phase: view.phase, turn: view.turnId };
    if (p) {
      if (view.phase === "bidding" && view.round !== p.round) {
        setShaking(true);
        sounds.shake();
        // § 34 : animation spéciale du Palifico
        if (view.palifico) { const n = view.players.find((x) => x.id === view.turnId)?.name ?? ""; setPali({ name: n, key: Date.now() }); setTimeout(() => setPali(null), 2600); }
        setTimeout(() => setShaking(false), SHAKE_MS);
      } else if (view.phase === "bidding" && now.hist > p.hist) {
        sounds.bid();
      }
      if (view.phase === "bidding" && view.turnId === myId && p.turn !== myId) {
        setTimeout(() => sounds.yourTurn(), view.round !== p.round ? SHAKE_MS : 0);
        try { navigator.vibrate?.(80); } catch {}
      }
      // nouvelle partie (lancement ou « rejouer ») : présentation de la map tirée au sort
      if (view.phase === "bidding" && view.round === 1 && p.round !== 1 && view.map) {
        setIntro(view.map);
        setTimeout(() => setIntro(null), 2300);
      }
      if ((view.phase === "reveal" || view.phase === "finished") && p.phase === "bidding" && view.reveal) {
        const r = view.reveal;
        setCallFx({ kind: r.call, success: r.call === "exact" ? !!r.gainerId : r.loserId !== r.callerId, key: Date.now() });
        setZoom(true); setTimeout(() => setZoom(false), 1100);
        // § 35 : le gobelin réagit APRÈS la révélation (il ne dévoile jamais un bluff)
        const g = view.phase === "finished" && view.winnerId ? { text: "Champion ! Champion !", emo: "🎉" }
          : r.eliminatedId ? { text: "Aïe… éliminé !", emo: "😬" }
          : r.call === "exact" && r.gainerId ? { text: "Bravo, pile poil !", emo: "👏" }
          : r.call === "liar" && r.loserId === r.callerId ? { text: "Ha ha ! Dudo raté !", emo: "😂" } : null;
        if (g) { const k = Date.now(); setTimeout(() => setGoblin({ ...g, key: k }), 900); setTimeout(() => setGoblin((x) => (x?.key === k ? null : x)), 4200); }
        setTimeout(() => setCallFx(null), FX_MS);
        if (r.call === "liar") { sounds.dudo(); sounds.liar(); } else { sounds.exactFx(); sounds.exact(); }
        setTimeout(() => (r.gainerId ? sounds.gain() : sounds.lose()), 700);
        if (view.phase === "finished" && !view.abandoned) setTimeout(() => sounds.win(), 1500);
      }
    }
    prev.current = now;
  }, [view, myId]);

  // ---------- horloge serveur : temps par joueur et manche suivante automatique ----------
  const skew = useRef(0);
  useEffect(() => { if (view?.now) skew.current = view.now - Date.now(); }, [view]);
  const deadline = view?.deadline ?? null;
  useEffect(() => {
    if (!deadline) return;
    // à l'échéance on relit l'état : le serveur joue le coup automatique / lance la manche
    const t = setTimeout(refresh, Math.max(300, deadline - (Date.now() + skew.current) + 400));
    return () => clearTimeout(t);
  }, [deadline, refresh]);

  // ---------- tours des bots (et relais des joueurs absents) ----------
  const botTurn = view?.phase === "bidding" &&
    (view.players.find((p) => p.id === view.turnId)?.isBot || view.away?.includes(view.turnId ?? ""));
  const botKey = botTurn ? view!.turnKey : null;
  useEffect(() => {
    if (!botKey || !session) return;
    const wait = (shaking ? SHAKE_MS : 0) + 1200 + Math.random() * 900;
    const t = setTimeout(async () => {
      try {
        setView(await api.action(code, session.token, { type: "bot", expect: botKey }));
      } catch {
        refresh(); // un autre joueur l'a déjà fait jouer : on se met juste à jour
      }
    }, wait);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botKey, session, code, refresh]);

  // ---------- quitter ----------
  async function quit() {
    setDialog(null);
    await act({ type: "leave" });
    try { localStorage.removeItem(`perudo:${code}`); } catch {}
    router.push("/");
  }

  // ---------- écrans spéciaux ----------
  if (notFound)
    return (
      <main className="center-screen">
        <Scene id="casino" />
        <div className="panel stack narrow">
          <h2>Partie introuvable</h2>
          <p className="muted">Vérifie le code « {code} ».</p>
          <Link className="gbtn gbtn-gold" href="/">Retour à l&apos;accueil</Link>
        </div>
      </main>
    );

  if (!view) return <main className="center-screen"><Scene id="casino" /><p className="loading">Chargement…</p></main>;

  const me = view.players.find((p) => p.id === view.me?.id) ?? null;
  const name = (id: string | null) => view.players.find((p) => p.id === id)?.name ?? "?";

  if (!me || me.left)
    return <JoinForm view={view} code={code} onJoined={(s) => { saveSession(code, s); refresh(); }} />;

  const share = async () => {
    const url = `${location.origin}/partie/${code}`;
    try {
      if (navigator.share) await navigator.share({ title: "Perudo", text: `Rejoins ma partie de Perudo (code ${code})`, url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch {}
  };

  const myTurn = view.phase === "bidding" && view.turnId === me.id;
  const imOut = view.phase !== "lobby" && me.diceCount === 0;
  const onlyBots = view.players.filter((p) => !p.isBot && !p.left).length === 1;

  const mapItem = MAPS.find((m) => m.id === view.map);
  const scene = mapItem?.scene ?? view.map ?? "casino";
  const barProps = { view, myTurn: myTurn && !shaking, busy, act, peek, onPeek: () => setPeek((x) => !x), shaking, waitingFor: name(view.turnId), imOut };
  const introMap = intro ? MAPS.find((m) => m.id === intro) : null;
  const calm = settings.reduceMotion;
  const customBg = mapItem?.image ? assetUrl(mapItem.image) : null;
  const decor = !customBg && scene === "casino"; // décor net du Casino du Gobelin (image dédiée, responsive en CSS)
  const bg = customBg || gameBg3(scene);

  // la scène (table + joueurs) occupe tout l'espace entre le haut et la barre ; les commandes restent en HTML
  const stage = (
    <Stage view={view} myId={me.id} geo={LAND} present={present} shaking={shaking} peek={false} showMine={peek} fx={fx} skew={skew.current}
      onCupClick={() => setPeek((x) => !x)} withBackground />
  );

  return (
    <main className={`gv2 phase-${view.phase} map-${scene} ${myTurn ? "my-turn" : ""} ${calm ? "calm" : ""} ${callFx ? `shake-${callFx.kind}` : ""}`}>
      <div className={`gv2-bg ${decor ? "decor" : ""}`} style={decor ? undefined : { backgroundImage: `url(${bg})` }} />
      {!calm && (mapItem?.anims?.length ?? 0) > 0 && (
        <div className="g2-ambient"><Scene id="__ambient__" override={{ scene: null, image: null, layers: [], anims: mapItem!.anims }} /></div>
      )}

      {/* zone supérieure : infos de partie, interactions, réglages, quitter */}
      <header className="gv2-top">
        <div className="gv2-info">
          <b>{view.phase === "lobby" ? "Salle d'attente" : view.phase === "finished" ? "Partie terminée" : `Manche ${view.round}`}</b>
          <span>{view.phase === "lobby" ? `Code ${view.code}` : mapItem?.name ?? ""}{imOut && view.phase !== "finished" ? " · spectateur" : ""}</span>
        </div>
        <div className="gv2-tools">
          {view.phase !== "finished" && game.fxEnabled && (["phrases", "reactions"] as const).map((k) => (
            <button key={k} className={`gv2-ico ${panel === k ? "on" : ""}`} onClick={() => setPanel(panel === k ? null : k)} aria-expanded={panel === k}
              aria-label={k === "phrases" ? "Phrases" : "Réactions"} title={k === "phrases" ? "Phrases" : "Réactions"}>{k === "phrases" ? "💬" : "😂"}</button>
          ))}
          <button className="gv2-ico" onClick={() => setSettings({ gameSounds: !settings.gameSounds })}
            aria-label={settings.gameSounds ? "Couper le son" : "Activer le son"} title={settings.gameSounds ? "Couper le son" : "Activer le son"}>{settings.gameSounds ? "🔊" : "🔇"}</button>
          <button className="gv2-ico" onClick={() => setDialog("settings")} aria-label="Paramètres" title="Paramètres">⚙️</button>
          <button className="gv2-quit" onClick={() => setDialog("quit")}>Quitter</button>
        </div>
      </header>

      {/* zone centrale : la table domine */}
      <section className="gv2-scene" ref={sceneRef}>
        <div className={`gv2-stage ${zoom ? "camzoom" : ""}`} style={{ width: LAND.W, height: LAND.H, ["--s" as string]: sceneScale, transform: `translate(-50%, -50%) scale(${sceneScale})` }}>{stage}</div>
      {/* zone sociale : phrases et réactions, panneau compact qui se referme */}
        {panel && view.phase !== "finished" && (
          <div className="gv2-pop" role="dialog" aria-label={panel === "phrases" ? "Phrases" : "Réactions"}>
            <div className="gv2-pop-head"><b>{panel === "phrases" ? "💬 Phrases" : "😂 Réactions"}</b><button onClick={() => setPanel(null)} aria-label="Fermer">✕</button></div>
            <div className={`gv2-pop-grid ${panel}`}>
              {(panel === "reactions" ? REACTIONS.filter((r) => owned("reaction", r.id, r.price)).map((r) => ({ id: r.id, label: r.label, icon: r.emoji }))
                : PHRASES.filter((x) => owned("phrase", x.id, x.price)).map((x) => ({ id: x.id, label: x.text, icon: "" }))).map((x) => (
                <button key={x.id} onClick={() => { unlockAudio(); send(panel === "reactions" ? "reaction" : "phrase", x.id); }}>
                  {x.icon && <span className="gv2-emo">{x.icon}</span>}<span>{panel === "phrases" ? `« ${x.label} »` : x.label}</span>
                </button>
              ))}
            </div>
            {panel === "phrases" && view.players.some((p) => p.id !== me.id && !p.isBot) && (
              <div className="g2-mute">
                {view.players.filter((p) => p.id !== me.id && !p.isBot).map((p) => {
                  const k = p.profileId ?? p.id; const off = settings.mutedPlayers.includes(k);
                  return <button key={p.id} className={off ? "off" : ""} onClick={() => setSettings({ mutedPlayers: off ? settings.mutedPlayers.filter((x) => x !== k) : [...settings.mutedPlayers, k] })}>{off ? "🔇" : "🔊"} {p.name}</button>;
                })}
              </div>
            )}
          </div>
        )}

      </section>

      {/* zone inférieure : commandes / révélation / salle d'attente */}
      <footer className="gv2-bottom">
        {view.phase === "bidding" && <Bar2 {...barProps} remain={<Countdown deadline={view.deadline} skew={skew.current} />} />}
        {view.phase === "reveal" && (
          <div className="gv2-strip">
            <span>Manche suivante dans <Countdown deadline={view.deadline} skew={skew.current} /></span>
            <b>{name(view.nextStarterId)} commence</b>
          </div>
        )}
      </footer>

      {view.phase === "lobby" && (
        <div className="gv2-lobby">
          <Lobby view={view} isHost={me.isHost} busy={busy} copied={copied} onShare={share} act={act} />
          {prog?.member && <InviteFriends code={code} />}
        </div>
      )}

      {goblin && !calm && <div key={goblin.key} className="goblin-comment"><Avatar name="Gobelin" avatar="gobelin" size={56} /><span className="bubble">{goblin.emo} {goblin.text}</span></div>}
      {pali && !calm && <div key={pali.key} className="palifico-fx"><b>PALIFICO !</b><span>{pali.name} n&apos;a plus qu&apos;un dé · la valeur sera verrouillée</span></div>}
      {callFx && !calm && <CallFx key={callFx.key} kind={callFx.kind} success={callFx.success} />}
      {introMap && <MapIntro name={introMap.name} icon={introMap.icon} />}

      {view.phase === "finished" && (
        <>
          {!view.abandoned && <Victory style={VICTORIES.find((v) => v.id === view.players.find((p) => p.id === view.winnerId)?.victory)?.style ?? "confetti"} />}
          <div className="victory">
            <div className="panel victory-card">
              <div className="trophy">{view.abandoned ? "🏳️" : "🏆"}</div>
              {view.winnerId && <div className="victory-avatar"><Avatar name={name(view.winnerId)} avatar={view.players.find((p) => p.id === view.winnerId)?.avatar} size={88} /></div>}
              <h2>{view.abandoned ? "Partie arrêtée" : view.winnerId === me.id ? "Tu as gagné !" : `${name(view.winnerId)} gagne la partie !`}</h2>
              {!view.abandoned && (prog?.member
                ? gain && (gain.doblons > 0 || gain.xp > 0)
                  ? <div className="gain-row"><span className="coin-pill">🪙 +{gain.doblons}</span><span className="xp-pill">✨ +{gain.xp} XP</span></div>
                  : gain && <p className="muted small">Pas de récompense pour cette partie (déjà versée, ou partie quittée avant la fin).</p>
                : prog && <p className="muted small">💡 Crée un compte (Mon profil) pour gagner des Doblons et de l&apos;XP à chaque partie.</p>)}
              <ul className="final-ranks">
                {[...view.players].sort((a, b) => (b.id === view.winnerId ? 1 : 0) - (a.id === view.winnerId ? 1 : 0) || b.diceCount - a.diceCount).map((p) => (
                  <li key={p.id}><Avatar name={p.name} avatar={p.avatar} size={26} /> {p.name}{p.left ? " (parti)" : ""}{p.id === view.winnerId ? " 🏆" : ""}</li>
                ))}
              </ul>
              <p className="muted small">{view.round} manches · {view.abandoned ? "partie non comptée" : "résultat enregistré dans les stats"}</p>
              <div className="row">
                {me.isHost && !view.abandoned && <button className="gbtn gbtn-gold" disabled={busy} onClick={() => act({ type: "restart" })}>🔁 Rejouer</button>}
                <button className="gbtn gbtn-dark" onClick={quit}>🏠 Accueil</button>
              </div>
              {!me.isHost && <p className="muted small">L&apos;hôte peut relancer une partie.</p>}
            </div>
          </div>
        </>
      )}

      {/* § 3 : téléphone tenu verticalement → inviter à tourner (affichage seulement, rien d'autre ne change) */}
      <RotatePrompt />

      {dialog === "quit" && (
        <Modal title="Quitter ?" onClose={() => setDialog(null)}>
          <p className="center-text">
            {view.phase === "lobby" ? "Tu vas quitter la salle d'attente."
              : view.phase === "finished" ? "Retour à l'accueil."
              : onlyBots ? "La partie contre les bots sera arrêtée : elle ne sera pas comptée."
              : "Tu quittes la table : les autres continuent sans toi. Si la partie compte, elle sera enregistrée comme une défaite."}
          </p>
          <div className="row">
            <button className="gbtn gbtn-dark" onClick={() => setDialog(null)}>Annuler</button>
            <button className="gbtn gbtn-red" onClick={quit}>Quitter</button>
          </div>
        </Modal>
      )}
      {dialog === "settings" && <SettingsModal onClose={() => setDialog(null)} />}

      {error && <p className="error toast">{error}</p>}
    </main>
  );
}

// ---------- rejoindre via le lien ----------
function JoinForm({ view, code, onJoined }: { view: PlayerView; code: string; onJoined: (s: Session) => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setName(lastName()), []);
  const canJoin = view.phase === "lobby";
  async function join() {
    setBusy(true); setError("");
    try {
      const r = await api.join(code, name);
      rememberName(name);
      onJoined({ playerId: r.playerId, token: r.token });
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  }
  return (
    <main className="center-screen">
      <Scene id={view.map ?? "beach"} />
      <div className="panel stack narrow">
        <div className="panel-title"><span>Partie {code}</span></div>
        {canJoin ? (
          <>
            <label className="field-icon">
              <span aria-hidden="true">👤</span>
              <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="Ton pseudo" />
            </label>
            <button className="gbtn gbtn-gold gbtn-xl" disabled={busy} onClick={join}>▶ Rejoindre la table</button>
          </>
        ) : (
          <p className="muted center-text">Cette partie a déjà commencé.</p>
        )}
        {error && <p className="error">{error}</p>}
        <Link href="/" className="plaque-btn">🏠 Accueil</Link>
      </div>
    </main>
  );
}
