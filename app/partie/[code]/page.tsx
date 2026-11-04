"use client";
// La table de jeu : salle d'attente, annonces, révélation, fin de partie.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Die from "@/components/Die";
import { checkBid } from "@/lib/bids";
import { api, getSession, lastName, realtime, rememberName, saveSession, Session } from "@/lib/client";
import type { PlayerView } from "@/lib/rules";

const faceLabel = (face: number) => (face === 1 ? "pax" : `${face}`);
const bidText = (b: { qty: number; face: number }) => `${b.qty} × ${faceLabel(b.face)}`;

export default function GamePage() {
  const code = String(useParams<{ code: string }>().code).toUpperCase();
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<PlayerView | null>(null);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

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

  async function act(body: Record<string, unknown>) {
    if (!session) return;
    setBusy(true);
    setError("");
    try {
      setView(await api.action(code, session.token, body));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

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

  // Pas encore assis à la table → formulaire pour rejoindre
  if (!me)
    return (
      <JoinForm
        code={code}
        canJoin={view.phase === "lobby"}
        onJoined={(s) => { saveSession(code, s); refresh(); }}
      />
    );

  const share = async () => {
    const url = `${location.origin}/partie/${code}`;
    try {
      if (navigator.share) await navigator.share({ title: "Perudo", text: `Rejoins ma partie de Perudo (code ${code})`, url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch {}
  };

  return (
    <main className="table-page">
      <header className="topbar">
        <Link href="/" className="logo">Perudo</Link>
        <button className="code-pill" onClick={share} title="Partager le lien">
          {copied ? "Lien copié !" : <>Code <b>{code}</b> ↗</>}
        </button>
      </header>

      {view.phase !== "lobby" && (
        <div className="status-bar">
          <span>Manche {view.round}</span>
          <span>{view.totalDice} dés en jeu</span>
          {view.palifico && view.phase === "bidding" && <span className="badge-palifico">PALIFICO — les pax ne sont pas jokers</span>}
        </div>
      )}

      {/* Joueurs autour de la table */}
      <section className="players">
        {view.players.map((p) => {
          const out = view.phase !== "lobby" && p.diceCount === 0;
          const turn = view.turnId === p.id;
          const lastBid = [...view.history].reverse().find((h) => h.playerId === p.id);
          return (
            <div key={p.id} className={`player ${turn ? "player-turn" : ""} ${out ? "player-out" : ""} ${p.id === me.id ? "player-me" : ""}`}>
              <div className="player-name">
                {p.name}{p.isHost && <span className="crown" title="Hôte">♛</span>}
              </div>
              {view.phase === "lobby" ? (
                <div className="muted small">prêt</div>
              ) : (
                <>
                  <div className="mini-dice">
                    {Array.from({ length: p.diceCount }, (_, i) => <span key={i} className="mini-die" />)}
                    {out && <span className="small muted">éliminé</span>}
                  </div>
                  {view.phase === "bidding" && lastBid && <div className="player-bid">{bidText(lastBid.bid)}</div>}
                </>
              )}
            </div>
          );
        })}
      </section>

      {view.phase === "lobby" && (
        <Lobby view={view} isHost={me.isHost} busy={busy} onStart={() => act({ type: "start" })} onShare={share} />
      )}

      {view.phase === "bidding" && (
        <Bidding view={view} myId={me.id} busy={busy} name={name} act={act} />
      )}

      {(view.phase === "reveal" || view.phase === "finished") && view.reveal && (
        <RevealPanel view={view} name={name} />
      )}

      {view.phase === "reveal" && (
        <div className="actions">
          <button className="btn btn-primary btn-big" disabled={busy} onClick={() => act({ type: "next" })}>
            Manche suivante · {name(view.nextStarterId)} commence
          </button>
        </div>
      )}

      {view.phase === "finished" && (
        <div className="card stack winner">
          <div className="trophy">🏆</div>
          <h2>{name(view.winnerId)} gagne la partie !</h2>
          {me.isHost ? (
            <button className="btn btn-primary btn-big" disabled={busy} onClick={() => act({ type: "restart" })}>Rejouer</button>
          ) : (
            <p className="muted">L&apos;hôte peut relancer une partie.</p>
          )}
        </div>
      )}

      {error && <p className="error toast">{error}</p>}
    </main>
  );
}

// ---------- salle d'attente ----------
function Lobby({ view, isHost, busy, onStart, onShare }: {
  view: PlayerView; isHost: boolean; busy: boolean; onStart: () => void; onShare: () => void;
}) {
  return (
    <div className="card stack">
      <h2>Salle d&apos;attente</h2>
      <p className="muted">Envoie le lien ou le code <b>{view.code}</b> à tes potes. ({view.players.length}/8)</p>
      <button className="btn" onClick={onShare}>Partager le lien</button>
      {isHost ? (
        <button className="btn btn-primary btn-big" disabled={busy || view.players.length < 2} onClick={onStart}>
          {view.players.length < 2 ? "En attente d'un 2ᵉ joueur…" : "Lancer la partie"}
        </button>
      ) : (
        <p className="muted">L&apos;hôte va lancer la partie…</p>
      )}
    </div>
  );
}

// ---------- annonces ----------
function Bidding({ view, myId, busy, name, act }: {
  view: PlayerView; myId: string; busy: boolean; name: (id: string | null) => string;
  act: (b: Record<string, unknown>) => void;
}) {
  const myTurn = view.turnId === myId;
  const hand = view.me?.hand ?? [];
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
    <>
      <div className="current-bid card">
        {view.bid ? (
          <>
            <div className="muted small">Annonce de {name(view.bidderId)}</div>
            <div className="bid-big">
              <span>{view.bid.qty} ×</span> <Die value={view.bid.face} size="md" />
            </div>
          </>
        ) : (
          <div className="muted">{name(view.turnId)} ouvre la manche</div>
        )}
      </div>

      <section className="my-hand">
        <div className="muted small">Tes dés</div>
        <div className="hand">
          {hand.map((d, i) => <Die key={i} value={d} size="lg" />)}
        </div>
      </section>

      {myTurn ? (
        <section className="card stack controls">
          <div className="turn-banner">À toi de jouer !</div>

          <div className="picker">
            <div className="stepper">
              <button className="btn btn-round" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
              <span className="qty">{qty}</span>
              <button className="btn btn-round" onClick={() => setQty((q) => Math.min(view.totalDice, q + 1))}>+</button>
            </div>
            <div className="faces">
              {[1, 2, 3, 4, 5, 6].map((f) => (
                <button key={f} className={`face-btn ${face === f ? "face-on" : ""}`} onClick={() => setFace(f)}>
                  <Die value={f} size="sm" />
                  {f === 1 && <span className="face-label">pax</span>}
                </button>
              ))}
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
        </section>
      ) : (
        <p className="waiting">C&apos;est à <b>{name(view.turnId)}</b> de jouer…</p>
      )}

      {view.history.length > 0 && (
        <section className="history">
          {view.history.map((h, i) => (
            <span key={i} className="history-item">{name(h.playerId)} : {bidText(h.bid)}</span>
          ))}
        </section>
      )}
    </>
  );
}

// ---------- révélation ----------
function RevealPanel({ view, name }: { view: PlayerView; name: (id: string | null) => string }) {
  const r = view.reveal!;
  const counts = (d: number) => d === r.bid.face || (!r.palifico && r.bid.face !== 1 && d === 1);
  let verdict = "";
  if (r.call === "liar") {
    verdict = r.loserId === r.callerId
      ? `L'annonce était juste : ${name(r.callerId)} perd un dé.`
      : `C'était du bluff : ${name(r.bidderId)} perd un dé.`;
  } else {
    verdict = r.gainerId
      ? `Pile ! ${name(r.callerId)} récupère un dé.`
      : `Raté : ${name(r.callerId)} perd un dé.`;
  }
  return (
    <section className="card stack reveal">
      <div className="reveal-title">
        {name(r.callerId)} crie <b>{r.call === "liar" ? "« Menteur ! »" : "« Exact ! »"}</b> sur {bidText(r.bid)}
      </div>
      <div className="reveal-count">
        Il y avait <b>{r.count}</b> × <Die value={r.bid.face} size="sm" />
        {r.palifico && <span className="small muted"> (palifico, pax non jokers)</span>}
      </div>
      <div className="reveal-hands">
        {Object.entries(r.hands).map(([pid, dice]) => (
          <div key={pid} className="reveal-row">
            <span className="reveal-name">{name(pid)}</span>
            <span className="hand">
              {dice.map((d, i) => <Die key={i} value={d} size="sm" highlight={counts(d)} dim={!counts(d)} />)}
            </span>
          </div>
        ))}
      </div>
      <div className={`verdict ${r.gainerId ? "verdict-good" : ""}`}>{verdict}</div>
      {r.eliminatedId && <div className="verdict">💀 {name(r.eliminatedId)} est éliminé.</div>}
    </section>
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
