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

/** Nombre de dés qui correspondent à l'annonce (1 jokers sauf palifico). */
export function countMatching(hands: number[][], face: number, palifico: boolean) {
  let n = 0;
  for (const h of hands)
    for (const d of h) if (d === face || (!palifico && face !== 1 && d === 1)) n++;
  return n;
}

