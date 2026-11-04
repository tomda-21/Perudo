"use client";
// Contenu publié par l'admin, chargé une fois par page (repli : contenu d'origine).
import { useEffect, useState } from "react";
import { DEFAULT_CONTENT, PublicContent } from "./content";

let current: PublicContent = DEFAULT_CONTENT;
let loading: Promise<void> | null = null;
const listeners = new Set<(c: PublicContent) => void>();

export const getContent = () => current;

export function loadContent(force = false) {
  if (loading && !force) return loading;
  loading = fetch("/api/content", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((c: PublicContent | null) => {
      if (c && Array.isArray(c.phrases)) { current = c; listeners.forEach((l) => l(c)); }
    })
    .catch(() => {});
  return loading;
}

export function useContent(): PublicContent {
  const [c, setC] = useState(current);
  useEffect(() => {
    listeners.add(setC);
    loadContent();
    setC(current);
    return () => { listeners.delete(setC); };
  }, []);
  return c;
}
