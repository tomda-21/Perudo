"use client";
// =============================================================
//  Accueil : deux messages d'information successifs (jamais en même temps, jamais bloquants)
//
//  1) Conseil « passe en paysage » (facultatif)
//     - téléphone tenu en portrait uniquement ; jamais sur ordinateur
//     - terminé quand on le ferme OU qu'on tourne le téléphone ; ne revient plus pendant la visite
//
//  2) Tutoriel « Installe PERUDO sur ton iPhone » — seulement dans Safari sur iPhone, hors app installée
//     - invité : une fois par visite (sessionStorage)
//     - compte : une seule fois pour le compte, mémorisé côté serveur (lié au compte, pas au pseudo)
//     - jamais en mode application autonome (display-mode: standalone / navigator.standalone)
//
//  Indépendant du « Tourne ton téléphone ! » obligatoire des parties (non modifié).
// =============================================================
import { useEffect, useState } from "react";
import { api } from "@/lib/client";

const LANDSCAPE_KEY = "perudo:landscape-tip";
const INSTALL_KEY = "perudo:install-tip";
const INSTALL_FLAG = "ios_install_tip";
const PORTRAIT_PHONE = "(orientation: portrait) and (pointer: coarse) and (max-width: 1024px)";

const ss = {
  get: (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k: string) => { try { sessionStorage.setItem(k, "1"); } catch { /* navigation privée */ } },
};

/** Safari sur iPhone, ouvert dans le navigateur (pas l'app installée, pas un navigateur intégré à une autre app). */
export function isIphoneSafariBrowser() {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  if (!/iPhone|iPod/.test(ua)) return false;                                 // pas d'iPad, pas d'Android, pas d'ordinateur
  if (/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|DuckDuckGo|YaBrowser|Brave/i.test(ua)) return false; // autres navigateurs iOS
  if (/FBAN|FBAV|Instagram|Line\/|Snapchat|musical_ly|BytedanceWebview|Twitter|LinkedInApp|Pinterest|WhatsApp|MicroMessenger|GoogleApp/i.test(ua)) return false; // navigateurs intégrés
  const nav = navigator as Navigator & { standalone?: boolean };
  if (typeof nav.standalone !== "boolean") return false;                    // propriété propre à Safari iOS (absente des vues intégrées)
  if (nav.standalone) return false;                                         // lancé depuis l'icône de l'écran d'accueil
  if (window.matchMedia?.("(display-mode: standalone)").matches || window.matchMedia?.("(display-mode: fullscreen)").matches) return false;
  return true;
}

export default function HomeTips({ ready }: { ready: boolean }) {
  // --- 1) conseil paysage
  const [portrait, setPortrait] = useState(false);
  const [landscapeDone, setLandscapeDone] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia(PORTRAIT_PHONE);
    const already = ss.get(LANDSCAPE_KEY) === "1";
    setLandscapeDone(already || !mq.matches);       // ouvert directement en paysage (ou ordinateur) : pas de conseil
    if (!already && !mq.matches) ss.set(LANDSCAPE_KEY);
    setPortrait(mq.matches);
    const on = () => {
      setPortrait(mq.matches);
      if (!mq.matches) { setLandscapeDone(true); ss.set(LANDSCAPE_KEY); } // téléphone tourné : étape 1 terminée
    };
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  const landscapeVisible = !landscapeDone && portrait;
  const closeLandscape = () => { setLandscapeDone(true); ss.set(LANDSCAPE_KEY); };

  // --- 2) tutoriel d'installation iPhone
  const [install, setInstall] = useState(false);
  useEffect(() => {
    if (!ready || !isIphoneSafariBrowser() || ss.get(INSTALL_KEY) === "1") return;
    let gone = false;
    api.flag(INSTALL_FLAG)
      .then((r) => { if (!gone && !(r.account && r.seen)) setInstall(true); })
      .catch(() => { if (!gone) setInstall(true); }); // réseau indisponible : comportement invité
    return () => { gone = true; };
  }, [ready]);
  const installVisible = install && !landscapeVisible;
  useEffect(() => {
    if (!installVisible) return;
    ss.set(INSTALL_KEY);                              // présenté : plus pendant cette visite
    api.setFlag(INSTALL_FLAG).catch(() => {});        // compte : mémorisé côté serveur (ignoré pour un invité)
  }, [installVisible]);
  const closeInstall = () => setInstall(false);

  if (landscapeVisible) return (
    <div className="ltip" onClick={closeLandscape}>
      <div className="rp-card ltip-card" role="dialog" aria-label="Conseil : mode paysage" onClick={(e) => e.stopPropagation()}>
        <button className="ltip-x" aria-label="Fermer" onClick={closeLandscape}>✕</button>
        <span className="rp-die d1" aria-hidden="true">⚄</span>
        <span className="rp-die d2" aria-hidden="true">⚂</span>
        <div className="rp-phone" aria-hidden="true"><span className="rp-screen"><span>🎲</span></span></div>
        <h2>🎲 Profite pleinement de PERUDO !</h2>
        <p>Pour une meilleure expérience de jeu et une interface plus agréable, nous te conseillons de tourner ton téléphone en mode paysage.</p>
        <button className="gbtn gbtn-gold ltip-ok" onClick={closeLandscape}>Compris !</button>
      </div>
    </div>
  );

  if (installVisible) return (
    <div className="itip" onClick={closeInstall}>
      <div className="rp-card itip-card" role="dialog" aria-label="Installer PERUDO sur l'iPhone" onClick={(e) => e.stopPropagation()}>
        <button className="ltip-x" aria-label="Fermer" onClick={closeInstall}>✕</button>
        <img className="itip-icon" src="/apple-touch-icon.png" alt="" width={64} height={64} />
        <h2>Installe PERUDO sur ton iPhone ! 🎲</h2>
        <p>Ajoute PERUDO à ton écran d&apos;accueil pour profiter du jeu comme d&apos;une véritable application, sans passer par l&apos;App Store.</p>
        <ol className="itip-steps">
          <li>
            <span className="itip-n">1</span>
            <span className="itip-ico" aria-hidden="true"><ShareIcon /></span>
            <span>Appuie sur le bouton <b>Partager</b> dans Safari.<small>Selon ta version de Safari, il est en bas ou en haut de l&apos;écran, parfois dans le menu <b>•••</b>.</small></span>
          </li>
          <li>
            <span className="itip-n">2</span>
            <span className="itip-ico" aria-hidden="true"><AddIcon /></span>
            <span>Sélectionne <b>Sur l&apos;écran d&apos;accueil</b>.<small>Fais défiler la liste vers le bas si tu ne le vois pas.</small></span>
          </li>
          <li>
            <span className="itip-n">3</span>
            <span className="itip-ico itip-ico-txt" aria-hidden="true">Ajouter</span>
            <span>Active <b>Ouvrir comme app web</b> si cette option apparaît, puis appuie sur <b>Ajouter</b>.</span>
          </li>
        </ol>
        <button className="gbtn gbtn-gold ltip-ok" onClick={closeInstall}>Compris !</button>
      </div>
    </div>
  );
  return null;
}

/** Icône « Partager » de Safari (carré + flèche vers le haut). */
function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" /><path d="M7.5 7.5 12 3l4.5 4.5" /><path d="M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2" />
    </svg>
  );
}
/** Icône « Sur l'écran d'accueil » (carré arrondi + plus). */
function AddIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8.5v7M8.5 12h7" />
    </svg>
  );
}
