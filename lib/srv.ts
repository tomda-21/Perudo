// Appel du point d'entrée serveur de la base (protégé par APP_SECRET).
import "server-only";
import { createClient } from "@supabase/supabase-js";

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_KEY!, { auth: { persistSession: false } });

export async function srv<T = unknown>(op: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db().rpc("srv", { p_secret: process.env.APP_SECRET!, p_op: op, p_args: args });
  if (error) throw new Error(`srv ${op}: ${error.message}`);
  return data as T;
}

/** Progression : comptes, portefeuille, roue, boutique, défis. */
export async function srv2<T = unknown>(op: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db().rpc("srv2", { p_secret: process.env.APP_SECRET!, p_op: op, p_args: args });
  if (error) throw new Error(`srv2 ${op}: ${error.message}`);
  return data as T;
}

/** Petites opérations admin (réinitialisation de mot de passe, journal). */
export async function srv3<T = unknown>(op: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db().rpc("srv3", { p_secret: process.env.APP_SECRET!, p_op: op, p_args: args });
  if (error) throw new Error(`srv3 ${op}: ${error.message}`);
  return data as T;
}

/** Comptes e-mail (Supabase Auth) : liens compte ↔ profil, pseudos, suppression, admin. */
export async function srv4<T = unknown>(op: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db().rpc("srv4", { p_secret: process.env.APP_SECRET!, p_op: op, p_args: args });
  if (error) throw new Error(`srv4 ${op}: ${error.message}`);
  return data as T;
}

/** Progression : objets gagnés (paliers), statistiques pour les classements. */
export async function srv5<T = unknown>(op: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db().rpc("srv5", { p_secret: process.env.APP_SECRET!, p_op: op, p_args: args });
  if (error) throw new Error(`srv5 ${op}: ${error.message}`);
  return data as T;
}

/** Social : amis, présence, blocages, signalements, notifications internes. */
export async function srv6<T = unknown>(op: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db().rpc("srv6", { p_secret: process.env.APP_SECRET!, p_op: op, p_args: args });
  if (error) throw new Error(`srv6 ${op}: ${error.message}`);
  return data as T;
}

/** Indicateurs par compte (ex. tutoriel d'installation iPhone déjà présenté). */
export async function srv7<T = unknown>(op: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db().rpc("srv7", { p_secret: process.env.APP_SECRET!, p_op: op, p_args: args });
  if (error) throw new Error(`srv7 ${op}: ${error.message}`);
  return data as T;
}
