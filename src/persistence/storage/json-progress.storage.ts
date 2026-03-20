import type { PlayerProgressDocument } from "../types/player-progress.types";

export type ProgressStorageAdapter = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type JsonProgressStorage = {
  loadStateRecord: () => unknown | null;
  saveStateRecord: (record: unknown) => void;
  clearStateRecord: () => void;
  readImportFile: (file: File) => Promise<unknown>;
  serializeDocument: (document: PlayerProgressDocument) => string;
};

const DEFAULT_STORAGE_KEY = "dab:player-progress";

function safeParseJson(rawValue: string): unknown | null {
  try {
    return JSON.parse(rawValue) as unknown;
  } catch {
    return null;
  }
}

export function createJsonProgressStorage(
  storage: ProgressStorageAdapter = localStorage,
  storageKey: string = DEFAULT_STORAGE_KEY
): JsonProgressStorage {
  return {
    loadStateRecord: () => {
      const rawValue = storage.getItem(storageKey);
      if (!rawValue) {
        return null;
      }

      return safeParseJson(rawValue);
    },
    saveStateRecord: (record) => {
      storage.setItem(storageKey, JSON.stringify(record, null, 2));
    },
    clearStateRecord: () => {
      storage.removeItem(storageKey);
    },
    readImportFile: async (file) => {
      const rawContent = await file.text();
      const parsed = safeParseJson(rawContent);
      if (parsed === null) {
        throw new Error("The selected file does not contain valid JSON.");
      }

      return parsed;
    },
    serializeDocument: (document) => {
      return JSON.stringify(document, null, 2);
    }
  };
}
