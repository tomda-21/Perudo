"use client";
// =============================================================
//  La partie : décor, table, commandes, soundboard, quitter.
//  Cette page ne décide jamais du jeu : elle affiche l'état envoyé
//  par le serveur et lui transmet les actions du joueur.
// =============================================================
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Die from "@/components/Die";
import Table from "@/components/Table";
import Scene from "@/components/Scene";
import Victory from "@/components/Victory";
import Avatar from "@/components/Avatar";
import { Modal } from "@/components/Panel";
import { SettingsModal } from "@/components/Menus";
import { ControlBar, Lobby } from "@/components/GameControls";
import { api, getSession, lastName, Progress, realtime, rememberName, saveSession, Session } from "@/lib/client";
import { sounds, unlockAudio } from "@/lib/sound";
import { useSettings } from "@/lib/settings";
import { useFx } from "@/lib/fx";
import { useContent } from "@/lib/content-client";
import type { PlayerView } from "@/lib/rules";

const faceLabel = (face: number) => (face === 1 ? "pax" : `${face}`);
const bidText = (b: { qty: number; face: number }) => `${b.qty} × ${faceLabel(b.face)}`;
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
  const [peek, setPeek] = useState(false);
  const [panel, setPanel] = useState<null | "sounds" | "phrases" | "reactions">(null);
  const [prog, setProg] = useState<Progress | null>(null);
  const [gain, setGain] = useState<{ doblons: number; xp: number } | null>(null);
  const [dialog, setDialog] = useState<null | "quit" | "settings">(null);
  const [settings, setSettings] = useSettings();
  const { maps: MAPS, sounds: SOUNDS, phrases: PHRASES, reactions: REACTIONS, victories: VICTORIES, settings: game } = useContent();
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

  const { fx, send, cooldownUntil } = useFx(code, myId, view?.players ?? []);

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
        setPeek(false);
        sounds.shake();
        setTimeout(() => setShaking(false), SHAKE_MS);
      } else if (view.phase === "bidding" && now.hist > p.hist) {
        sounds.bid();
      }
      if (view.phase === "bidding" && view.turnId === myId && p.turn !== myId) {
        setTimeout(() => sounds.yourTurn(), view.round !== p.round ? SHAKE_MS : 0);
        try { navigator.vibrate?.(80); } catch {}
      }
      if ((view.phase === "reveal" || view.phase === "finished") && p.phase === "bidding" && view.reveal) {
        const r = view.reveal;
        if (r.call === "liar") sounds.liar(); else sounds.exact();
        setTimeout(() => (r.gainerId ? sounds.gain() : sounds.lose()), 700);
        if (view.phase === "finished" && !view.abandoned) setTimeout(() => sounds.win(), 1500);
      }
    }
    prev.current = now;
  }, [view, myId]);

  // ---------- tours des bots ----------
  const botTurn = view?.phase === "bidding" && view.players.find((p) => p.id === view.turnId)?.isBot;
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
  const mapName = mapItem?.name;

  return (
    <main className={`game-screen phase-${view.phase} map-${mapItem?.scene ?? view.map ?? "beach"} ${myTurn ? "my-turn" : ""}`}
      style={mapItem?.felt ? ({ ["--felt" as string]: mapItem.felt } as CSSProperties) : undefined}>
      <Scene id={view.map ?? "beach"} />

      <header className="hud">
        <div className="hud-plaque">
          <span className="hud-dice">🎲</span>
          <div>
            <b>{view.phase === "lobby" ? "Salle d'attente" : view.phase === "finished" ? "Partie terminée" : "Partie en cours"}</b>
            <span>{view.phase === "lobby" ? mapName : `Manche ${view.round}`}{imOut && view.phase !== "finished" ? " · spectateur" : ""}</span>
          </div>
        </div>
        <div className="hud-right">
          {view.phase !== "finished" && game.fxEnabled && <>
            <button className="round-btn mobile-only" onClick={() => setPanel(panel === "sounds" ? null : "sounds")} aria-label="Sons">🎺</button>
            <button className="round-btn mobile-only" onClick={() => setPanel(panel === "phrases" ? null : "phrases")} aria-label="Phrases">💬</button>
            <button className="round-btn mobile-only" onClick={() => setPanel(panel === "reactions" ? null : "reactions")} aria-label="Réactions">😂</button>
          </>}
          <button className="round-btn desktop-only" onClick={() => setSettings({ gameSounds: !settings.gameSounds, soundboard: !settings.gameSounds })}
            aria-label={settings.gameSounds ? "Couper le son" : "Activer le son"} title={settings.gameSounds ? "Couper le son" : "Activer le son"}>
            {settings.gameSounds ? "🔊" : "🔇"}
          </button>
          <button className="round-btn" onClick={() => setDialog("settings")} aria-label="Paramètres" title="Paramètres">⚙️</button>
          <button className="gbtn gbtn-red gbtn-sm" onClick={() => setDialog("quit")} aria-label="Quitter">⏏<span className="desktop-only">&nbsp;Quitter</span></button>
        </div>
      </header>

      <Table view={view} myId={me.id} present={present} shaking={shaking} peek={peek} fx={fx}
        onCupClick={() => setPeek((x) => !x)} />

      {/* plateau de mes dés (quand je soulève mon gobelet) */}
      {view.phase === "bidding" && !imOut && (
        <div className={`dice-tray ${peek && !shaking ? "open" : ""}`} aria-hidden={!peek}>
          {(view.me?.hand ?? []).map((d, i) => <Die key={i} value={d} size="lg" />)}
        </div>
      )}

      {view.phase === "lobby" && (
        <Lobby view={view} isHost={me.isHost} busy={busy} copied={copied} onShare={share} act={act} />
      )}

      {view.phase === "bidding" && (
        <ControlBar view={view} myTurn={myTurn && !shaking} imOut={imOut} busy={busy} act={act}
          peek={peek} onPeek={() => setPeek((x) => !x)} shaking={shaking} waitingFor={name(view.turnId)} />
      )}

      {view.phase === "reveal" && (
        <div className="control-bar center-bar">
          <button className="gbtn gbtn-green gbtn-xl" disabled={busy} onClick={() => act({ type: "next" })}>
            ▶ Manche suivante · {name(view.nextStarterId)} commence
          </button>
        </div>
      )}

      {view.phase === "finished" && (
        <>
          {!view.abandoned && <Victory style={VICTORIES.find((v) => v.id === view.players.find((p) => p.id === view.winnerId)?.victory)?.style ?? "confetti"} />}
          <div className="victory">
            <div className="panel victory-card">
              <div className="trophy">{view.abandoned ? "🏳️" : "🏆"}</div>
              {view.winnerId && <div className="victory-avatar"><Avatar name={name(view.winnerId)} avatar={view.players.find((p) => p.id === view.winnerId)?.avatar} size={96} /></div>}
              <h2>{view.abandoned ? "Partie arrêtée" : view.winnerId === me.id ? "Tu as gagné !" : `${name(view.winnerId)} gagne la partie !`}</h2>
              {!view.abandoned && (prog?.member
                ? gain && (gain.doblons > 0 || gain.xp > 0)
                  ? <div className="gain-row"><span className="coin-pill">🪙 +{gain.doblons}</span><span className="xp-pill">✨ +{gain.xp} XP</span></div>
                  : gain && <p className="muted small">Partie non officielle : pas de Doblons (il faut au moins {prog.economy.official.minHumans} vrais joueurs, {prog.economy.official.minRounds} manches{prog.economy.official.allowBots ? "" : ", sans bot"}).</p>
                : prog && <p className="muted small">💡 Crée un compte (Mon profil) pour gagner des Doblons et de l&apos;XP à chaque partie.</p>)}
              <ul className="final-ranks">
                {[...view.players].sort((a, b) => (b.id === view.winnerId ? 1 : 0) - (a.id === view.winnerId ? 1 : 0) || b.diceCount - a.diceCount).map((p) => (
                  <li key={p.id}><Avatar name={p.name} avatar={p.avatar} size={26} /> {p.name}{p.left ? " (parti)" : ""}{p.id === view.winnerId ? " 🏆" : ""}</li>
                ))}
              </ul>
              <p className="muted small">{view.round} manches · {onlyBots ? "partie d'entraînement (non comptée)" : "résultat enregistré dans les stats"}</p>
              <div className="row">
                {me.isHost && !view.abandoned && <button className="gbtn gbtn-gold" disabled={busy} onClick={() => act({ type: "restart" })}>🔁 Rejouer</button>}
                <button className="gbtn gbtn-dark" onClick={quit}>🏠 Accueil</button>
              </div>
              {!me.isHost && <p className="muted small">L&apos;hôte peut relancer une partie.</p>}
            </div>
          </div>
        </>
      )}

      {/* soundboard : Sons / Phrases, utilisables à tout moment (même éliminé) */}
      {view.phase !== "finished" && game.fxEnabled && (
        <div className={`fx-dock ${panel ? "open" : ""}`}>
          {panel && (
            <div className="panel fx-panel">
              <button className="close-btn" onClick={() => setPanel(null)} aria-label="Fermer">✕</button>
              <div className="tabs">
                <button className={panel === "sounds" ? "on" : ""} onClick={() => setPanel("sounds")}>🔊 Sons</button>
                <button className={panel === "phrases" ? "on" : ""} onClick={() => setPanel("phrases")}>💬 Phrases</button>
                <button className={panel === "reactions" ? "on" : ""} onClick={() => setPanel("reactions")}>😂 Réactions</button>
              </div>
              <div className={`fx-grid ${panel === "phrases" ? "phrases" : ""}`}>
                {(panel === "sounds" ? SOUNDS.filter((s) => owned("sound", s.id, s.price)).map((s) => ({ id: s.id, label: s.label, icon: s.icon }))
                  : panel === "reactions" ? REACTIONS.filter((r) => owned("reaction", r.id, r.price)).map((r) => ({ id: r.id, label: r.label, icon: r.emoji }))
                  : PHRASES.filter((p) => owned("phrase", p.id, p.price)).map((p) => ({ id: p.id, label: p.text, icon: "💬" }))).map((x) => (
                  <button key={x.id} className="fx-btn" disabled={Date.now() < cooldownUntil}
                    onClick={() => { unlockAudio(); send(panel === "sounds" ? "sound" : panel === "reactions" ? "reaction" : "phrase", x.id); }}>
                    <span>{x.icon}</span> {x.label}
                  </button>
                ))}
              </div>
              <Cooldown until={cooldownUntil} />
            </div>
          )}
          <div className="fx-toggles">
            <button className={`gbtn gbtn-dark gbtn-sm ${panel === "sounds" ? "on" : ""}`} onClick={() => setPanel(panel === "sounds" ? null : "sounds")}>🔊 Sons</button>
            <button className={`gbtn gbtn-dark gbtn-sm ${panel === "phrases" ? "on" : ""}`} onClick={() => setPanel(panel === "phrases" ? null : "phrases")}>💬 Phrases</button>
            <button className={`gbtn gbtn-dark gbtn-sm ${panel === "reactions" ? "on" : ""}`} onClick={() => setPanel(panel === "reactions" ? null : "reactions")}>😂 Réactions</button>
          </div>
        </div>
      )}

      {view.phase === "bidding" && view.history.length > 0 && (
        <section className="history">
          {view.history.slice(-8).map((h, i) => (
            <span key={i} className="history-item">{name(h.playerId)} : {bidText(h.bid)}</span>
          ))}
        </section>
      )}

      {dialog === "quit" && (
        <Modal title="Quitter ?" onClose={() => setDialog(null)}>
          <p className="center-text">
            {view.phase === "lobby" ? "Tu vas quitter la salle d'attente."
              : view.phase === "finished" ? "Retour à l'accueil."
              : onlyBots ? "La partie contre les bots sera arrêtée. Elle ne compte pas dans tes stats."
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

function Cooldown({ until }: { until: number }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (Date.now() >= until) return;
    const t = setInterval(() => tick((x) => x + 1), 250);
    const s = setTimeout(() => clearInterval(t), until - Date.now() + 300);
    return () => { clearInterval(t); clearTimeout(s); };
  }, [until]);
  const left = Math.max(0, until - Date.now());
  return <div className="cooldown">{left > 0 ? `Patiente ${Math.ceil(left / 1000)} s…` : "Un clic = tout le monde l'entend"}</div>;
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
