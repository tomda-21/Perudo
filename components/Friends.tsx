"use client";
// =============================================================
//  AMIS (§ 13, § 44) : demandes, liste et présence, invitations,
//  notifications internes, classements entre amis (permanent / mois),
//  vitrine de 3 gobelets, blocage et signalement. Comptes uniquement.
// =============================================================
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Modal } from "./Panel";
import Avatar from "./Avatar";
import Cup from "./Cup";
import { api, Friend, Social } from "@/lib/client";

const PRES: Record<Friend["presence"], [string, string]> = { online: ["🟢", "En ligne"], game: ["🎲", "En partie"], offline: ["⚪", "Hors ligne"] };

/** Données « amis » + rafraîchissement régulier (présence, notifications). */
export function useSocial(enabled: boolean, game?: string) {
  const [data, setData] = useState<Social | null>(null);
  const load = useCallback(() => { if (enabled) api.social(game).then(setData).catch(() => {}); }, [enabled, game]);
  useEffect(() => {
    load();
    if (!enabled) return;
    const t = setInterval(load, 45_000);
    return () => clearInterval(t);
  }, [load, enabled]);
  const unread = data?.notifications.filter((n) => !n.read).length ?? 0;
  return { data, load, unread };
}

export function FriendsModal({ onClose, social, myPublicId, usableCups }: {
  onClose: () => void; social: ReturnType<typeof useSocial>; myPublicId: string | null; usableCups: { id: string; name: string }[];
}) {
  const { data, load } = social;
  const [tab, setTab] = useState<"friends" | "rank" | "notifs" | "me">("friends");
  const [pub, setPub] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [month, setMonth] = useState(false);
  const [report, setReport] = useState<Friend | null>(null);
  const [reason, setReason] = useState("");

  // ouvrir les notifications = les marquer comme lues
  useEffect(() => { if (tab === "notifs" && social.unread) api.socialAction({ op: "read" }).then(load).catch(() => {}); }, [tab, social.unread, load]);

  async function run(body: Record<string, unknown>, ok?: string) {
    setBusy(true); setMsg("");
    try { const r = await api.socialAction(body); setMsg(r.message ?? ok ?? ""); load(); }
    catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }

  const friends = data?.friends.filter((f) => f.status === "accepted") ?? [];
  const incoming = data?.friends.filter((f) => f.status === "pending" && f.incoming) ?? [];
  const outgoing = data?.friends.filter((f) => f.status === "pending" && !f.incoming) ?? [];
  const order = { game: 0, online: 1, offline: 2 } as const;

  return (
    <Modal title="Amis" onClose={onClose} wide>
      {!data ? <p className="muted">Chargement…</p> : (
        <>
          <div className="tabs">
            <button className={tab === "friends" ? "on" : ""} onClick={() => setTab("friends")}>👥 Amis{incoming.length ? ` (${incoming.length})` : ""}</button>
            <button className={tab === "rank" ? "on" : ""} onClick={() => setTab("rank")}>🏆 Classements</button>
            <button className={tab === "notifs" ? "on" : ""} onClick={() => setTab("notifs")}>🔔 Notifications{social.unread ? ` (${social.unread})` : ""}</button>
            <button className={tab === "me" ? "on" : ""} onClick={() => setTab("me")}>⚙️ Moi</button>
          </div>

          {tab === "friends" && (
            <div className="fr-wrap">
              <form className="fr-add" onSubmit={(e) => { e.preventDefault(); run({ op: "request", publicId: pub }); setPub(""); }}>
                <input value={pub} onChange={(e) => setPub(e.target.value.toUpperCase())} placeholder="Identifiant public, ex. #24E5E2" maxLength={7} />
                <button className="gbtn gbtn-gold gbtn-sm" disabled={busy || pub.replace("#", "").length < 6}>Ajouter</button>
              </form>
              {myPublicId && <p className="muted small">Ton identifiant à donner à tes amis : <b>#{myPublicId}</b></p>}
              {incoming.length > 0 && <>
                <div className="section-title">Demandes reçues</div>
                {incoming.map((f) => (
                  <div key={f.id} className="fr-row">
                    <Avatar name={f.name} avatar={f.avatar} size={40} /><b>{f.name}</b><span className="muted small">#{f.public_id}</span>
                    <span className="fr-act">
                      <button className="pill pill-btn" disabled={busy} onClick={() => run({ op: "respond", id: f.id, accept: true }, `${f.name} est ton ami !`)}>✓ Accepter</button>
                      <button className="pill pill-btn" disabled={busy} onClick={() => run({ op: "respond", id: f.id, accept: false }, "Demande refusée")}>✕</button>
                    </span>
                  </div>
                ))}
              </>}
              <div className="section-title">Mes amis ({friends.length})</div>
              {friends.length === 0 && <p className="muted small">Ajoute tes potes avec leur identifiant public (dans leur profil).</p>}
              {[...friends].sort((a, b) => order[a.presence] - order[b.presence] || a.name.localeCompare(b.name, "fr")).map((f) => (
                <div key={f.id} className="fr-row">
                  <Avatar name={f.name} avatar={f.avatar} size={40} />
                  <div className="fr-main">
                    <b>{f.name}</b>
                    <span className="muted small">{PRES[f.presence][0]} {f.hidden ? "Statut masqué" : PRES[f.presence][1]}{f.presence === "game" && f.game ? ` · salon ${f.game}` : ""}</span>
                    {f.showcase?.length > 0 && <span className="fr-showcase">{f.showcase.map((c) => <Cup key={c} size="sm" state="show" skin={c} />)}</span>}
                  </div>
                  <span className="fr-act">
                    {f.presence === "game" && f.game && <Link className="pill pill-btn" href={`/partie/${f.game}`}>Rejoindre</Link>}
                    <details className="fr-more"><summary>⋯</summary>
                      <button onClick={() => confirm(`Retirer ${f.name} de tes amis ?`) && run({ op: "remove", id: f.id }, "Ami retiré")}>Retirer</button>
                      <button onClick={() => confirm(`Bloquer ${f.name} ? Il ne pourra plus t'ajouter ni t'inviter.`) && run({ op: "block", id: f.id }, `${f.name} est bloqué`)}>Bloquer</button>
                      <button onClick={() => { setReport(f); setReason(""); }}>Signaler</button>
                    </details>
                  </span>
                </div>
              ))}
              {outgoing.length > 0 && <p className="muted small">En attente : {outgoing.map((f) => f.name).join(", ")}</p>}
              {data.blocked.length > 0 && <>
                <div className="section-title">Bloqués</div>
                {data.blocked.map((b) => <div key={b.id} className="fr-row"><b>{b.name}</b><span className="fr-act"><button className="pill pill-btn" onClick={() => run({ op: "unblock", id: b.id }, "Débloqué")}>Débloquer</button></span></div>)}
              </>}
            </div>
          )}

          {tab === "rank" && (
            <div className="fr-wrap">
              <div className="tabs small">
                <button className={!month ? "on" : ""} onClick={() => setMonth(false)}>Permanent</button>
                <button className={month ? "on" : ""} onClick={() => setMonth(true)}>Ce mois-ci</button>
              </div>
              <table className="fr-rank">
                <thead><tr><th>#</th><th>Joueur</th><th>Victoires</th><th>Taux</th><th>Parties</th></tr></thead>
                <tbody>
                  {(month ? data.ranking.monthly : data.ranking.permanent).map((r) => (
                    <tr key={r.id} className={r.id === data.meId ? "me" : ""}>
                      <td>{r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : r.rank}</td>
                      <td>{r.name}{r.id === data.meId ? " (moi)" : ""}</td><td>{r.wins}</td><td>{Math.round(r.rate * 100)} %</td><td>{r.played}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted small">Classement : victoires, puis taux de victoire, puis parties terminées. Les parties avec des bots comptent. Le mensuel repart le 1er du mois (Paris) sans toucher aux stats permanentes.</p>
            </div>
          )}

          {tab === "notifs" && (
            <div className="fr-wrap">
              {data.notifications.length === 0 && <p className="muted small">Aucune notification.</p>}
              {data.notifications.map((n) => (
                <div key={n.id} className={`fr-row ${n.read ? "" : "unread"}`}>
                  <span>{n.kind === "invite" ? "🎲" : n.kind === "friend_request" ? "👋" : "🤝"}</span>
                  <div className="fr-main">
                    <b>{n.kind === "invite" ? `${n.from_name ?? "Un ami"} t'invite à jouer` : n.kind === "friend_request" ? `${n.from_name ?? "Quelqu'un"} veut être ton ami` : `${n.from_name ?? "Un joueur"} a accepté ta demande`}</b>
                    <span className="muted small">{new Date(n.at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span>
                  </div>
                  {n.kind === "invite" && n.code && <span className="fr-act"><Link className="gbtn gbtn-gold gbtn-sm" href={`/partie/${n.code}`}>Rejoindre</Link></span>}
                  {n.kind === "friend_request" && <span className="fr-act"><button className="pill pill-btn" onClick={() => setTab("friends")}>Voir</button></span>}
                </div>
              ))}
            </div>
          )}

          {tab === "me" && (
            <div className="fr-wrap">
              <label className="toggle-row">
                <span>Masquer mon statut (en ligne / en partie)</span>
                <input type="checkbox" checked={!!data.me?.hidden} onChange={(e) => run({ op: "settings", hidden: e.target.checked }, e.target.checked ? "Statut masqué" : "Statut visible")} />
                <span className="switch" />
              </label>
              <div className="section-title">Ma vitrine (3 gobelets visibles par mes amis)</div>
              <div className="fr-pick">
                {usableCups.map((c) => {
                  const sel = data.me?.showcase?.includes(c.id);
                  const cur = data.me?.showcase ?? [];
                  return (
                    <button key={c.id} className={sel ? "on" : ""} disabled={busy || (!sel && cur.length >= 3)}
                      onClick={() => run({ op: "settings", showcase: sel ? cur.filter((x) => x !== c.id) : [...cur, c.id] })}>
                      <Cup size="sm" state="show" skin={c.id} /><span>{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {msg && <p className="hint center-text">{msg}</p>}
          {report && (
            <div className="p3d-back" onClick={() => setReport(null)}>
              <form className="p3d" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); run({ op: "report", id: report.id, reason }); setReport(null); }}>
                <b>Signaler {report.name}</b>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={3} placeholder="Que s'est-il passé ?" />
                <div className="row"><button type="button" className="gbtn gbtn-dark gbtn-sm" onClick={() => setReport(null)}>Annuler</button><button className="gbtn gbtn-red gbtn-sm" disabled={reason.trim().length < 3}>Envoyer</button></div>
              </form>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

/** Dans la salle d'attente : inviter un ami (notification interne). */
export function InviteFriends({ code }: { code: string }) {
  const s = useSocial(true, code);
  const [sent, setSent] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const friends = (s.data?.friends ?? []).filter((f) => f.status === "accepted");
  if (!s.data || !friends.length) return null;
  return (
    <div className="fr-invite">
      <div className="section-title">Inviter des amis</div>
      <div className="row-wrap">
        {friends.map((f) => (
          <button key={f.id} className="pill pill-btn" disabled={sent.includes(f.id)}
            onClick={async () => { try { await api.socialAction({ op: "invite", id: f.id, code }); setSent((x) => [...x, f.id]); setMsg(`Invitation envoyée à ${f.name}`); } catch (e) { setMsg((e as Error).message); } }}>
            {PRES[f.presence][0]} {f.name}{sent.includes(f.id) ? " ✓" : ""}
          </button>
        ))}
      </div>
      {msg && <p className="muted small">{msg}</p>}
    </div>
  );
}
