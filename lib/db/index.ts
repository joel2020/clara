import { DexieRepository } from "./dexie-repository";
import type { DataRepository } from "./repository";

/**
 * The single place the app gets its data layer. Today it's local-first Dexie.
 * To enable cross-device sync, build a `SupabaseRepository` (implementing
 * `DataRepository`) and swap the line below — nothing else changes.
 *
 *   export const repo: DataRepository = new SupabaseRepository(client);
 */
export const repo: DataRepository = new DexieRepository();

export type { DataRepository };
export * from "./types";
