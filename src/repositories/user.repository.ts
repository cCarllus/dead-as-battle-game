// Responsável por persistir e recuperar dados de usuário no armazenamento local do navegador.
import { isUserModel, type UserModel } from "../models/user";

export type UserStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type UserRepository = {
  load: () => UserModel | null;
  save: (user: UserModel) => void;
  clear: () => void;
};

const USER_STORAGE_KEY = "dab.user.v1";

function parseUser(rawValue: string): UserModel | null {
  try {
    const parsed = JSON.parse(rawValue) as unknown;
    return isUserModel(parsed) ? parsed : null;
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

      return parseUser(rawValue);
    },
    save: (user) => {
      storage.setItem(storageKey, JSON.stringify(user));
    },
    clear: () => {
      storage.removeItem(storageKey);
    }
  };
}

const defaultUserRepository = createUserRepository();

export function loadUser(): UserModel | null {
  return defaultUserRepository.load();
}

export function saveUser(user: UserModel): void {
  defaultUserRepository.save(user);
}

export function clearUser(): void {
  defaultUserRepository.clear();
}
