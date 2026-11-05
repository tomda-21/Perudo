// Règles des annonces — fichier sans dépendance serveur,
// utilisé à la fois par le serveur et par l'interface.

export type Bid = { qty: number; face: number };


/**
 * Vérifie qu'une annonce est permise après la précédente.
 * Renvoie null si c'est bon, sinon le message d'erreur.
 */
export function checkBid(
  prev: Bid | null,
  next: Bid,
  palifico: boolean,
  diceInPlay: number
): string | null {
  const { qty, face } = next;
  if (!Number.isInteger(qty) || !Number.isInteger(face)) return "Annonce invalide";
  if (face < 1 || face > 6) return "La valeur doit être entre 1 et 6";
  if (qty < 1) return "Il faut annoncer au moins un dé";
  if (qty > diceInPlay) return `Il n'y a que ${diceInPlay} dés en jeu`;

  if (!prev) {
    if (face === 1) return "Interdit d'ouvrir sur les pax";
    return null;
  }

  // Palifico : les 1 ne sont pas jokers → valeur normale (la plus faible)
  if (palifico) {
    if (qty > prev.qty) return null;
    if (qty === prev.qty && face > prev.face) return null;
    return "Il faut monter la quantité, ou garder la quantité et monter la valeur";
  }

  const prevPax = prev.face === 1;
  const nextPax = face === 1;

  if (!prevPax && !nextPax) {
    if (qty > prev.qty) return null;
    if (qty === prev.qty && face > prev.face) return null;
    return "Il faut monter la quantité, ou garder la quantité et monter la valeur";
  }
  if (!prevPax && nextPax) {
    const min = Math.ceil(prev.qty / 2);
    return qty >= min ? null : `Pour passer aux pax il faut au moins ${min} pax`;
  }
  if (prevPax && nextPax) {
    return qty > prev.qty ? null : "Il faut monter le nombre de pax";
  }
  // pax → valeur normale
  const min = prev.qty * 2 + 1;
  return qty >= min ? null : `Pour quitter les pax il faut au moins ${min} dés`;
}

/**
 * Plus petite quantité permise pour annoncer `face` après `prev`
 * (null si cette valeur est interdite, ex. ouvrir sur les pax).
 * Utilisée par l'interface pour proposer directement une annonce valable.
 */
export function minQtyFor(prev: Bid | null, face: number, palifico: boolean): number | null {
  if (!prev) return face === 1 ? null : 1;
  if (palifico) return face > prev.face ? prev.qty : prev.qty + 1;
  const prevPax = prev.face === 1, nextPax = face === 1;
  if (!prevPax && !nextPax) return face > prev.face ? prev.qty : prev.qty + 1;
  if (!prevPax && nextPax) return Math.ceil(prev.qty / 2);
  if (prevPax && nextPax) return prev.qty + 1;
  return prev.qty * 2 + 1; // pax → valeur normale (n'importe laquelle de 2 à 6)
}

/** Nombre de dés qui correspondent à l'annonce (1 jokers sauf palifico). */
export function countMatching(hands: number[][], face: number, palifico: boolean) {
  let n = 0;
  for (const h of hands)
    for (const d of h) if (d === face || (!palifico && face !== 1 && d === 1)) n++;
  return n;
}

