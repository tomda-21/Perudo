// Un gobelet de Perudo dessiné en CSS.
// Le modèle (« skin ») est prévu pour la future collection de gobelets.
type Props = {
  state: "down" | "shake" | "lifted";
  size?: "sm" | "lg";
  skin?: string; // "classic" pour l'instant
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
    </>
  );
  return onClick ? (
    <button type="button" className={cls} onClick={onClick} aria-label={label ?? "Gobelet"}>
      {inner}
    </button>
  ) : (
    <span className={cls} aria-hidden="true">{inner}</span>
  );
}
