"use client";
// =============================================================
//  La partie : table, gobelet du joueur, commandes, révélation.
//  Cette page ne décide jamais du jeu : elle affiche l'état envoyé
//  par le serveur et lui transmet les actions du joueur.
// =============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Die from "@/components/Die";
import Cup from "@/components/Cup";
import Table from "@/components/Table";
import Confetti from "@/components/Confetti";
import Avatar from "@/components/Avatar";
import { checkBid } from "@/lib/bids";
import { api, getSession, lastName, realtime, rememberName, saveSession, Session } from "@/lib/client";
import { isMuted, setMuted, sounds, unlockAudio } from "@/lib/sound";
import type { PlayerView } from "@/lib/rules";

const faceLabel = (face: number) => (face === 1 ? "pax" : `${face}`);
const bidText = (b: { qty: number; face: number }) => `${b.qty} × ${faceLabel(b.face)}`;
const SHAKE_MS = 1300;

export default function GamePage() {
  const code = String(useParams<{ code: string }>().code).toUpperCase();
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<PlayerView | null>(null);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [present, setPresent] = useState<Set<string> | null>(null);
  const [shaking, setShaking] = useState(false);
  const [peek, setPeek] = useState(false);
  const [mute, setMute] = useState(false);

  useEffect(() => setMute(isMuted()), []);
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

  async function act(body: Record<string, unknown>) {
    if (!session) return;
    setBusy(true);
    setError("");
    try {
      setView(await api.action(code, session.token, body));
    } catch (e) {
      setError((e as Error).message);
      setTimeout(() => setError(""), 3500);
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
        // nouvelle manche : on secoue les gobelets
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
        if (view.phase === "finished") setTimeout(() => sounds.win(), 1500);
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

  // ---------- écrans spéciaux ----------
  if (notFound)
    return (
      <main className="center">
        <div className="card stack">
          <h2>Partie introuvable</h2>
          <p className="muted">Vérifie le code « {code} ».</p>
          <Link className="btn btn-primary" href="/">Retour à l&apos;accueil</Link>
        </div>
      </main>
    );

  if (!view) return <main className="center"><p className="muted">Chargement…</p></main>;

  const me = view.players.find((p) => p.id === view.me?.id) ?? null;
  const name = (id: string | null) => view.players.find((p) => p.id === id)?.name ?? "?";

  if (!me)
    return (
      <JoinForm code={code} canJoin={view.phase === "lobby"} onJoined={(s) => { saveSession(code, s); refresh(); }} />
    );

  const share = async () => {
    const url = `${location.origin}/partie/${code}`;
    try {
      if (navigator.share) await navigator.share({ title: "Perudo", text: `Rejoins ma partie de Perudo (code ${code})`, url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch {}
  };

  const myTurn = view.phase === "bidding" && view.turnId === me.id;
  const imOut = view.phase !== "lobby" && me.diceCount === 0;

  return (
    <main className={`game-page phase-${view.phase} ${myTurn ? "my-turn" : ""}`}>
      <header className="topbar">
        <Link href="/" className="logo">Perudo</Link>
        <div className="topbar-right">
          <button
            className="icon-btn"
            onClick={() => { const m = !mute; setMute(m); setMuted(m); }}
            aria-label={mute ? "Activer le son" : "Couper le son"}
            title={mute ? "Activer le son" : "Couper le son"}
          >
            {mute ? "🔇" : "🔊"}
          </button>
          <button className="code-pill" onClick={share} title="Partager le lien">
            {copied ? "Lien copié !" : <>Code <b>{code}</b> ↗</>}
          </button>
        </div>
      </header>

      {myTurn && !shaking && <div className="turn-banner">À toi de jouer !</div>}

      <Table view={view} myId={me.id} present={present} shaking={shaking} />

      {view.phase === "lobby" && (
        <Lobby view={view} isHost={me.isHost} busy={busy} onStart={() => act({ type: "start" })} onShare={share}
          onAddBot={() => act({ type: "addBot" })} onRemoveBot={(id) => act({ type: "removeBot", botId: id })} />
      )}

      {view.phase === "bidding" && (
        <section className="dock">
          {!imOut ? (
            <MyCup hand={view.me?.hand ?? []} shaking={shaking} peek={peek} onToggle={() => setPeek((x) => !x)} />
          ) : (
            <p className="waiting">Tu es éliminé — tu regardes la fin de la partie.</p>
          )}
          {myTurn && !shaking ? (
            <Controls view={view} busy={busy} act={act} />
          ) : (
            !imOut && <p className="waiting">{shaking ? "Les gobelets se secouent…" : <>C&apos;est à <b>{name(view.turnId)}</b> de jouer…</>}</p>
          )}
        </section>
      )}

      {view.phase === "reveal" && (
        <section className="dock">
          <button className="btn btn-primary btn-big" disabled={busy} onClick={() => act({ type: "next" })}>
            Manche suivante · {name(view.nextStarterId)} commence
          </button>
        </section>
      )}

      {view.phase === "finished" && (
        <>
          <Confetti />
          <div className="victory">
            <div className="victory-card">
              <div className="trophy">🏆</div>
              <div className="victory-avatar"><Avatar name={name(view.winnerId)} isBot={view.players.find((p) => p.id === view.winnerId)?.isBot} /></div>
              <h2>{view.winnerId === me.id ? "Tu as gagné !" : `${name(view.winnerId)} gagne la partie !`}</h2>
              <p className="muted small">{view.round} manches jouées</p>
              {me.isHost ? (
                <button className="btn btn-primary btn-big" disabled={busy} onClick={() => act({ type: "restart" })}>Rejouer</button>
              ) : (
                <p className="muted">L&apos;hôte peut relancer une partie.</p>
              )}
            </div>
          </div>
        </>
      )}

      {view.phase === "bidding" && view.history.length > 0 && (
        <section className="history">
          {view.history.map((h, i) => (
            <span key={i} className="history-item">{name(h.playerId)} : {bidText(h.bid)}</span>
          ))}
        </section>
      )}

      {error && <p className="error toast">{error}</p>}
    </main>
  );
}

// ---------- mon gobelet : on le touche pour regarder ses dés ----------
function MyCup({ hand, shaking, peek, onToggle }: { hand: number[]; shaking: boolean; peek: boolean; onToggle: () => void }) {
  return (
    <div className="mycup">
      <div className={`mycup-dice ${peek && !shaking ? "visible" : ""}`}>
        {hand.map((d, i) => <Die key={i} value={d} size="lg" />)}
      </div>
      <Cup
        size="lg"
        state={shaking ? "shake" : peek ? "lifted" : "down"}
        onClick={shaking ? undefined : onToggle}
        label={peek ? "Reposer le gobelet" : "Soulever le gobelet pour voir mes dés"}
      />
      <div className="mycup-hint">
        {shaking ? "" : peek ? "Touche le gobelet pour cacher tes dés" : "Touche ton gobelet pour regarder tes dés"}
      </div>
    </div>
  );
}

// ---------- commandes d'annonce ----------
function Controls({ view, busy, act }: { view: PlayerView; busy: boolean; act: (b: Record<string, unknown>) => void }) {
  const [qty, setQty] = useState(1);
  const [face, setFace] = useState(2);

  // propose automatiquement la plus petite annonce valable (seulement quand l'annonce change)
  const bidKey = `${view.round}-${view.bid?.qty ?? 0}-${view.bid?.face ?? 0}`;
  useEffect(() => {
    if (!view.bid) { setQty(1); setFace(2); return; }
    const f = view.bid.face;
    if (checkBid(view.bid, { qty: view.bid.qty, face: f + 1 }, view.palifico, view.totalDice) === null) {
      setQty(view.bid.qty); setFace(f + 1);
    } else {
      setQty(Math.min(view.bid.qty + 1, view.totalDice)); setFace(f === 1 && !view.palifico ? 1 : f);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bidKey]);

  const err = useMemo(() => checkBid(view.bid, { qty, face }, view.palifico, view.totalDice), [view.bid, qty, face, view.palifico, view.totalDice]);

  return (
    <div className="controls">
      <div className="picker">
        <div className="stepper">
          <button className="btn btn-round" aria-label="Moins" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
          <span className="qty">{qty}</span>
          <button className="btn btn-round" aria-label="Plus" onClick={() => setQty((q) => Math.min(view.totalDice, q + 1))}>+</button>
        </div>
        <div className="faces">
          {[1, 2, 3, 4, 5, 6].map((f) => {
            const disabled = checkBid(view.bid, { qty, face: f }, view.palifico, view.totalDice) !== null;
            return (
              <button key={f} className={`face-btn ${face === f ? "face-on" : ""} ${disabled ? "face-off" : ""}`} onClick={() => setFace(f)} aria-label={f === 1 ? "Pax" : `Valeur ${f}`}>
                <Die value={f} size="sm" />
                {f === 1 && <span className="face-label">pax</span>}
              </button>
            );
          })}
        </div>
      </div>

      <button className="btn btn-primary btn-big" disabled={busy || !!err} onClick={() => act({ type: "bid", qty, face })}>
        Annoncer {qty} × {faceLabel(face)}
      </button>
      {err && <p className="hint">{err}</p>}

      {view.bid && (
        <div className="row">
          <button className="btn btn-danger btn-big" disabled={busy} onClick={() => act({ type: "liar" })}>Menteur !</button>
          <button className="btn btn-gold btn-big" disabled={busy} onClick={() => act({ type: "exact" })}>Exact !</button>
        </div>
      )}
    </div>
  );
}

// ---------- salle d'attente ----------
function Lobby({ view, isHost, busy, onStart, onShare, onAddBot, onRemoveBot }: {
  view: PlayerView; isHost: boolean; busy: boolean; onStart: () => void; onShare: () => void;
  onAddBot: () => void; onRemoveBot: (id: string) => void;
}) {
  const bots = view.players.filter((p) => p.isBot);
  const full = view.players.length >= 8;
  return (
    <div className="card stack lobby-card">
      <p className="muted small">Envoie le lien ou le code <b>{view.code}</b> à tes potes.</p>
      <div className="row">
        <button className="btn" onClick={onShare}>Partager le lien</button>
        {isHost && <button className="btn" disabled={busy || full} onClick={onAddBot}>+ Ajouter un bot</button>}
      </div>
      {isHost && bots.length > 0 && (
        <div className="bot-chips">
          {bots.map((b) => (
            <button key={b.id} className="bot-chip" disabled={busy} onClick={() => onRemoveBot(b.id)} title="Retirer ce bot">
              {b.name} ✕
            </button>
          ))}
        </div>
      )}
      {isHost ? (
        <button className="btn btn-primary btn-big" disabled={busy || view.players.length < 2} onClick={onStart}>
          {view.players.length < 2 ? "Ajoute un pote ou un bot…" : "Lancer la partie"}
        </button>
      ) : (
        <p className="muted">L&apos;hôte va lancer la partie…</p>
      )}
    </div>
  );
}

// ---------- rejoindre via le lien ----------
function JoinForm({ code, canJoin, onJoined }: { code: string; canJoin: boolean; onJoined: (s: Session) => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setName(lastName()), []);
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
    <main className="center">
      <div className="card stack">
        <h2>Partie {code}</h2>
        {canJoin ? (
          <>
            <label className="field">
              <span>Ton pseudo</span>
              <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="ex. Tom" />
            </label>
            <button className="btn btn-primary" disabled={busy} onClick={join}>Rejoindre la table</button>
          </>
        ) : (
          <p className="muted">Cette partie a déjà commencé.</p>
        )}
        {error && <p className="error">{error}</p>}
        <Link href="/" className="muted small">← Accueil</Link>
      </div>
    </main>
  );
}
