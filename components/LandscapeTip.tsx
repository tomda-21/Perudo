"use client";
// =============================================================
//  Accueil : simple conseil « passe en paysage » (jamais obligatoire).
//  - visible seulement sur téléphone tenu verticalement (CSS : portrait + écran tactile)
//  - disparaît tout seul en paysage (CSS), se ferme avec la croix, « Compris ! » ou un tap à côté
//  - une fois fermé, il ne revient plus pendant la visite (sessionStorage)
//  Indépendant du « Tourne ton téléphone ! » obligatoire des parties.
// =============================================================
import { useEffect, useState } from "react";

const KEY = "perudo:landscape-tip";

export default function LandscapeTip() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { setOpen(sessionStorage.getItem(KEY) !== "1"); } catch { setOpen(true); }
  }, []);
  if (!open) return null;
  const close = () => { setOpen(false); try { sessionStorage.setItem(KEY, "1"); } catch { /* navigation privée */ } };
  return (
    <div className="ltip" onClick={close}>
      <div className="rp-card ltip-card" role="dialog" aria-label="Conseil : mode paysage" onClick={(e) => e.stopPropagation()}>
        <button className="ltip-x" aria-label="Fermer" onClick={close}>✕</button>
        <span className="rp-die d1" aria-hidden="true">⚄</span>
        <span className="rp-die d2" aria-hidden="true">⚂</span>
        <div className="rp-phone" aria-hidden="true"><span className="rp-screen"><span>🎲</span></span></div>
        <h2>🎲 Profite pleinement de PERUDO !</h2>
        <p>Pour une meilleure expérience de jeu et une interface plus agréable, nous te conseillons de tourner ton téléphone en mode paysage.</p>
        <button className="gbtn gbtn-gold ltip-ok" onClick={close}>Compris !</button>
      </div>
    </div>
  );
}
