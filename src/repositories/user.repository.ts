// Responsável por persistir o perfil de usuário no localStorage com parse seguro.
import type { UserProfile } from "../models/user.model";

export type UserStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type UserRepository = {
  load: () => unknown | null;
  save: (user: UserProfile) => void;
  clear: () => void;
};

const USER_STORAGE_KEY = "dab:user";

function parseStoredUser(rawValue: string): unknown | null {
  try {
    return JSON.parse(rawValue) as unknown;
  } catch {
    return null;
  }
}

export function createUserRepository(
  storage: UserStorage = localStorage,
  storageKey: string = USER_STORAGE_KEY
): UserRepository {
  return {
    load: () => {
      const rawValue = storage.getItem(storageKey);
      if (!rawValue) {
        return null;
      }

      return parseStoredUser(rawValue);
    },
    save: (user) => {
      storage.setItem(storageKey, JSON.stringify(user));
    },
    clear: () => {
      storage.removeItem(storageKey);
    }
  };
}
