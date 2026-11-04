"use client";
// Outils communs de l'espace admin : appels API, import de fichiers, petits composants.
import { ReactNode, useRef, useState } from "react";
import { Modal } from "../Panel";
import { assetUrl } from "@/lib/content";

export async function adminApi<T = unknown>(op: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch("/api/admin", {
    method: "POST", headers: { "content-type": "application/json" }, cache: "no-store",
    body: JSON.stringify({ op, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? "Erreur"), { status: res.status });
  return data as T;
}

export async function uploadFile(file: File, kind: "image" | "audio"): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("kind", kind);
  const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Import impossible");
  return data.id as string;
}

/** Champ d'import (image ou son) avec aperçu. */
export function FileField({ label, kind, value, onChange, hint }: {
  label: string; kind: "image" | "audio"; value?: string | null; onChange: (id: string | null) => void; hint?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const url = assetUrl(value);
  return (
    <div className="a-field">
      <span className="a-label">{label}</span>
      <div className="a-file">
        {url && kind === "image" && <img src={url} alt="" className="a-thumb" />}
        {url && kind === "audio" && <audio src={url} controls className="a-audio" />}
        <button type="button" className="gbtn gbtn-dark gbtn-sm" disabled={busy} onClick={() => ref.current?.click()}>
          {busy ? "Import…" : url ? "Remplacer" : "Importer"}
        </button>
        {url && <button type="button" className="a-link" onClick={() => onChange(null)}>Retirer</button>}
        <input ref={ref} type="file" hidden accept={kind === "image" ? "image/png,image/jpeg,image/webp" : "audio/mpeg,audio/ogg,audio/wav,audio/mp4,.mp3,.ogg,.wav,.m4a"}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setBusy(true); setErr("");
            try { onChange(await uploadFile(f, kind)); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
          }} />
      </div>
      {hint && <span className="a-hint">{hint}</span>}
      {err && <span className="error small">{err}</span>}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="a-field">
      <span className="a-label">{label}</span>
      {children}
      {hint && <span className="a-hint">{hint}</span>}
    </label>
  );
}

export function StatusBadge({ s }: { s: string }) {
  const t = { published: "Publié", draft: "Brouillon", disabled: "Désactivé" }[s] ?? s;
  return <span className={`a-badge a-badge-${s}`}>{t}</span>;
}

/** Fenêtre de confirmation pour les actions qui suppriment ou bloquent. */
export function Confirm({ title, text, danger = "Confirmer", onYes, onNo }: { title: string; text: ReactNode; danger?: string; onYes: () => void; onNo: () => void }) {
  return (
    <Modal title={title} onClose={onNo}>
      <div className="center-text">{text}</div>
      <div className="row">
        <button className="gbtn gbtn-dark" onClick={onNo}>Annuler</button>
        <button className="gbtn gbtn-red" onClick={onYes}>{danger}</button>
      </div>
    </Modal>
  );
}

export const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

export const EMOJIS = ["💨", "🌪️", "🤢", "👎", "👏", "😂", "😱", "😭", "🔥", "😈", "🤡", "💩", "🎺", "🥁", "📢", "🐐", "🦆", "🐔", "💀", "👻", "🍅", "🎉", "🤌", "🫠"];
