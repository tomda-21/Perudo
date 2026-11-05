"use client";
// =============================================================
//  « Tourne ton téléphone ! » — affiché seulement sur un téléphone tenu
//  verticalement (salle d'attente, partie, révélation, victoire).
//  Pur affichage, piloté par CSS (orientation + écran tactile) :
//  aucune incidence sur la partie, le chrono, les dés ou la connexion.
//  Ne dépend d'aucune API de verrouillage d'orientation.
// =============================================================
export default function RotatePrompt() {
  return (
    <div className="rotate-prompt" role="alert" aria-live="polite">
      <div className="rp-card">
        <span className="rp-die d1" aria-hidden="true">⚄</span>
        <span className="rp-die d2" aria-hidden="true">⚂</span>
        <div className="rp-phone" aria-hidden="true"><span className="rp-screen"><span>🎲</span></span></div>
        <h2>Tourne ton téléphone ! 🎲</h2>
        <p>Pour profiter pleinement de PERUDO, passe ton téléphone en mode paysage.</p>
        <div className="rp-goblin"><img src="/art/home/goblin.webp" alt="" /><span>Allez, hop, on pivote !</span></div>
      </div>
    </div>
  );
}
