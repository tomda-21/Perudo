// Avatar d'un joueur : photo de profil, portrait par défaut, ou initiale.
import { isAvatarId } from "@/lib/catalog";

const PALETTE = ["#e07a5f", "#3d9a8b", "#f2cc8f", "#81b29a", "#9c89b8", "#f28482", "#5fa8d3", "#e9c46a"];
function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** Adresse de l'image d'un avatar (ou null si on affiche l'initiale). */
export function avatarSrc(avatar?: string | null) {
  if (!avatar) return null;
  if (avatar.startsWith("photo:")) {
    const [, id, v] = avatar.split(":");
    return `/api/avatar/${id}?v=${v}`;
  }
  return isAvatarId(avatar) ? `/art/avatars/${avatar}.webp` : null;
}

export default function Avatar({ name, avatar, size }: { name: string; avatar?: string | null; isBot?: boolean; size?: number }) {
  const src = avatarSrc(avatar);
  return (
    <span className="avatar" style={{ background: PALETTE[hash(name) % PALETTE.length], ...(size ? { width: size, height: size } : {}) }}>
      {src ? <img src={src} alt="" draggable={false} /> : <span className="avatar-letter">{name.trim().charAt(0).toUpperCase()}</span>}
    </span>
  );
}
