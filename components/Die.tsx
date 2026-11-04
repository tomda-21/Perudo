// Un dé dessiné en CSS. Les points se placent sur une grille 3×3.
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

type Props = {
  value: number | null; // null = dé caché
  size?: "xs" | "sm" | "md" | "lg";
  highlight?: boolean;
  dim?: boolean;
};

export default function Die({ value, size = "md", highlight, dim }: Props) {
  const cls = ["die", `die-${size}`, highlight && "die-hl", dim && "die-dim", value === null && "die-hidden", value === 1 && "die-pax"]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={cls} aria-label={value ? `Dé ${value}` : "Dé caché"}>
      {value === null ? (
        <span className="die-q">?</span>
      ) : (
        Array.from({ length: 9 }, (_, i) => (
          <span key={i} className={PIPS[value].includes(i) ? "pip" : "pip pip-off"} />
        ))
      )}
    </span>
  );
}
