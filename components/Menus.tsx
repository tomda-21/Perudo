"use client";
// Fenêtres : Mon profil, Mes gobelets, Paramètres, Nos règles.
import { useEffect, useRef, useState } from "react";
import { Modal } from "./Panel";
import Avatar from "./Avatar";
import Cup from "./Cup";
import { api, MyProfile, rememberName } from "@/lib/client";
import { AVATARS, CUPS, condLabel, condProgress } from "@/lib/catalog";
import { useSettings } from "@/lib/settings";
import { playSound } from "@/lib/sfx";
import { unlockAudio } from "@/lib/sound";

/** Charge (ou crée) le profil de cet appareil. */
export function useMyProfile() {
  const [data, setData] = useState<MyProfile | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api.myProfile().then(setData).catch((e) => setError((e as Error).message));
  }, []);
  return { data, setData, error };
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `il y a ${Math.max(1, m)} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "hier" : `il y a ${d} jours`;
}

/** Réduit une photo à 160×160 (JPEG léger) avant l'envoi. */
async function shrinkPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const S = 160, c = document.createElement("canvas");
    c.width = S; c.height = S;
    const side = Math.min(img.width, img.height);
    c.getContext("2d")!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, S, S);
    return c.toDataURL("image/jpeg", 0.82);
  } finally { URL.revokeObjectURL(url); }
}

// ---------- MON PROFIL ----------
export function ProfileModal({ onClose, profile }: { onClose: () => void; profile: ReturnType<typeof useMyProfile> }) {
  const { data, setData, error } = profile;
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [picking, setPicking] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { if (data) setName(data.profile.name); }, [data]);

  async function save(patch: Record<string, unknown>, ok?: string) {
    setBusy(true); setMsg("");
    try {
      const r = await api.updateProfile(patch);
      setData(r);
      if ("name" in patch) rememberName(r.profile.name);
      if (ok) setMsg(ok);
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <Modal title="Mon profil" onClose={onClose}>
      {!data ? <p className="muted">{error || "Chargement…"}</p> : (
        <div className="profile">
          <div className="profile-head">
            <div className="profile-avatar">
              <Avatar name={data.profile.name} avatar={data.profile.publicAvatar} size={112} />
              <button className="avatar-cam" onClick={() => file.current?.click()} aria-label="Changer la photo" title="Ajouter / changer la photo">📷</button>
              <input ref={file} type="file" accept="image/*" hidden onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) save({ photo: await shrinkPhoto(f) }, "Photo enregistrée");
                e.target.value = "";
              }} />
            </div>
            <div className="profile-id">
              <div className="name-edit">
                <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} aria-label="Pseudo" />
                <button className="btn-icon" disabled={busy || name.trim() === data.profile.name} onClick={() => save({ name }, "Pseudo enregistré")} title="Enregistrer">✏️</button>
              </div>
              <div className="muted small">Joueur depuis le {fmtDate(data.profile.since)}</div>
              <div className="row-wrap">
                <button className="gbtn gbtn-dark gbtn-sm" onClick={() => setPicking((p) => !p)}>Choisir un avatar</button>
                {data.profile.hasPhoto && <button className="gbtn gbtn-dark gbtn-sm" disabled={busy} onClick={() => save({ photo: null }, "Photo supprimée")}>Supprimer la photo</button>}
              </div>
            </div>
          </div>

          {picking && (
            <div className="avatar-grid">
              {AVATARS.map((a) => (
                <button key={a} className={`avatar-pick ${!data.profile.hasPhoto && data.profile.avatar === a ? "on" : ""}`}
                  onClick={() => { save({ avatar: a, ...(data.profile.hasPhoto ? { photo: null } : {}) }, "Avatar choisi"); setPicking(false); }}>
                  <Avatar name={a} avatar={a} size={64} />
                </button>
              ))}
            </div>
          )}
          {msg && <p className="hint">{msg}</p>}

          <div className="section-title">Statistiques</div>
          <div className="stat-grid">
            <Stat icon="🎲" value={data.stats.played} label="Parties jouées" />
            <Stat icon="🏆" value={data.stats.wins} label="Victoires" />
            <Stat icon="💀" value={data.stats.losses} label="Défaites" />
            <Stat icon="📊" value={`${data.stats.rate}%`} label="Taux de victoire" />
          </div>
          <div className="stat-grid stat-grid-sm">
            <Stat icon="🤥" value={data.stats.liarWins} label="« Menteur ! » réussis" />
            <Stat icon="🎯" value={data.stats.exactWins} label="« Exact ! » réussis" />
            <Stat icon="🔥" value={data.stats.bestWinStreak} label="Meilleure série" />
          </div>

          <div className="section-title">Dernières parties</div>
          {data.recent.length === 0 ? (
            <p className="muted small">Aucune partie comptée pour l&apos;instant. Seules les parties avec au moins 2 vrais joueurs comptent (les parties seul contre des bots sont de l&apos;entraînement).</p>
          ) : (
            <ul className="recent">
              {data.recent.map((r, i) => (
                <li key={i} className={r.won ? "win" : "loss"}>
                  <span>{r.won ? "🏆 Victoire" : "💀 Défaite"}</span>
                  <span className="muted small">{r.humans} joueurs · {r.rounds} manches</span>
                  <span className="muted small">{ago(r.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}

function Stat({ icon, value, label }: { icon: string; value: number | string; label: string }) {
  return (
    <div className="stat">
      <div className="stat-value"><span>{icon}</span> {value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

// ---------- MES GOBELETS ----------
export function CupsModal({ onClose, profile }: { onClose: () => void; profile: ReturnType<typeof useMyProfile> }) {
  const { data, setData, error } = profile;
  const [msg, setMsg] = useState("");
  async function equip(id: string) {
    setMsg("");
    try { setData(await api.updateProfile({ cup: id })); } catch (e) { setMsg((e as Error).message); }
  }
  return (
    <Modal title="Mes gobelets" onClose={onClose} wide>
      {!data ? <p className="muted">{error || "Chargement…"}</p> : (
        <>
          <div className="cup-grid">
            {CUPS.map((c) => {
              const unlocked = data.unlocked.includes(c.id);
              const equipped = data.profile.cup === c.id;
              const p = condProgress(c.cond, data.stats);
              return (
                <div key={c.id} className={`cup-card ${equipped ? "equipped" : ""} ${unlocked ? "" : "locked"}`}>
                  <div className="cup-stage"><Cup state="show" size="xl" skin={c.id} /></div>
                  {!unlocked && <span className="lock" aria-label="Verrouillé">🔒</span>}
                  {equipped && <span className="check" aria-label="Équipé">✓</span>}
                  <div className="cup-name">{c.name}</div>
                  {equipped ? <div className="pill pill-green">Équipé</div>
                    : unlocked ? <button className="pill pill-btn" onClick={() => equip(c.id)}>Équiper</button>
                    : <div className="pill">{condLabel(c.cond)}</div>}
                  {!unlocked && (
                    <div className="progress" title={`${p.have} / ${p.need}`}>
                      <span style={{ width: `${(p.have / p.need) * 100}%` }} />
                      <em>{p.have}/{p.need}</em>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {msg && <p className="hint">{msg}</p>}
          <p className="muted small center-text">Les gobelets sont purement décoratifs : ils ne changent jamais les dés. Seules les parties avec au moins 2 vrais joueurs font progresser.</p>
        </>
      )}
    </Modal>
  );
}

// ---------- PARAMÈTRES ----------
export function SettingsModal({ onClose }: { onClose: () => void }) {
  const [s, set] = useSettings();
  const Toggle = ({ k, label }: { k: "gameSounds" | "soundboard" | "voices" | "bubbles" | "reduceMotion"; label: string }) => (
    <label className="toggle-row">
      <span>{label}</span>
      <input type="checkbox" checked={s[k]} onChange={(e) => set({ [k]: e.target.checked })} />
      <span className="switch" />
    </label>
  );
  return (
    <Modal title="Paramètres" onClose={onClose}>
      <div className="settings">
        <label className="slider-row">
          <span>Volume</span>
          <input type="range" min={0} max={1} step={0.05} value={s.volume}
            onChange={(e) => set({ volume: Number(e.target.value) })}
            onPointerUp={() => { unlockAudio(); playSound("applaudissements"); }} />
          <b>{Math.round(s.volume * 100)}%</b>
        </label>
        <Toggle k="gameSounds" label="Sons du jeu (dés, menteur…)" />
        <Toggle k="soundboard" label="Bruitages des joueurs" />
        <Toggle k="voices" label="Voix des phrases" />
        <Toggle k="bubbles" label="Bulles et réactions" />
        <Toggle k="reduceMotion" label="Réduire les animations" />
        <p className="muted small">Réglages gardés sur cet appareil.</p>
      </div>
    </Modal>
  );
}

// ---------- RÈGLES ----------
export function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Nos règles" onClose={onClose}>
      <ul className="rules-list">
        <li><b>Le but</b> : être le dernier à avoir des dés. Chacun commence avec 5 dés cachés sous son gobelet.</li>
        <li><b>Annoncer</b> : « il y a au moins X dés de telle valeur sur toute la table ». Chaque annonce doit monter.</li>
        <li><b>Pax</b> = les 1. Ils sont jokers, mais on ne peut jamais ouvrir une manche sur les pax.</li>
        <li>Passer aux pax : la moitié de la quantité (arrondie au-dessus). En revenir : le double + 1.</li>
        <li><b>Menteur !</b> — tu penses que l&apos;annonce est fausse. On compte : le perdant lâche un dé.</li>
        <li><b>Exact !</b> — tu penses qu&apos;il y a pile le bon nombre. Juste : +1 dé (max 5). Faux : −1 dé.</li>
        <li><b>Palifico</b> : la première manche où un joueur tombe à 1 dé, les pax ne sont plus jokers. Une seule fois par joueur.</li>
      </ul>
    </Modal>
  );
}
