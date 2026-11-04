// Panneaux et fenêtres façon jeu vidéo : bois sombre, cadre doré, titre sur plaque.
import { ReactNode, useEffect } from "react";

export function Panel({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      {title && <div className="panel-title"><span>{title}</span></div>}
      {children}
    </section>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className={`modal ${wide ? "modal-wide" : ""}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <Panel title={title}>
          <button className="close-btn" onClick={onClose} aria-label="Fermer">✕</button>
          <div className="modal-body">{children}</div>
        </Panel>
      </div>
    </div>
  );
}
