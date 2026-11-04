// Avatar par défaut : initiale sur une couleur tirée du pseudo.
// (Les photos de profil arriveront avec les profils, phase 5.)
const PALETTE = ["#e07a5f", "#3d9a8b", "#f2cc8f", "#81b29a", "#9c89b8", "#f28482", "#5fa8d3", "#e9c46a"];

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

export default function Avatar({ name, isBot, photo }: { name: string; isBot?: boolean; photo?: string | null }) {
  const bg = PALETTE[hash(name) % PALETTE.length];
  return (
    <span className="avatar" style={{ background: bg }}>
      {photo ? <img src={photo} alt="" /> : <span className="avatar-letter">{isBot ? "🤖" : name.trim().charAt(0).toUpperCase()}</span>}
    </span>
  );
}
