import { CUPS } from "@/lib/catalog";

// Un gobelet de Perudo. Chaque modèle (« skin ») a son propre style.
// Si une vraie illustration existe dans /public/art/cups/<skin>.webp,
// elle s'affiche par-dessus le dessin.
type Props = {
  state: "down" | "shake" | "lifted" | "show";
  size?: "sm" | "md" | "lg" | "xl";
  skin?: string;
  onClick?: () => void;
  label?: string;
};

export default function Cup({ state, size = "sm", skin = "classic", onClick, label }: Props) {
  const cls = `cup cup-${size} cup-${state} skin-${skin}`;
  const inner = (
    <>
      <span className="cup-body" />
      <span className="cup-rim" />
      <span className="cup-band" />
      <span className="cup-deco" />
      {CUPS.find((c) => c.id === skin)?.art && <span className="cup-art" style={{ backgroundImage: `url(/art/cups/${skin}.webp)` }} />}
    </>
  );
  return onClick ? (
    <button type="button" className={cls} onClick={onClick} aria-label={label ?? "Gobelet"}>{inner}</button>
  ) : (
    <span className={cls} aria-hidden="true">{inner}</span>
  );
}
