import { isUserModel, type UserModel } from "../models/user";

const USER_STORAGE_KEY = "dab.user.v1";

export function loadUser(): UserModel | null {
  const raw = localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return isUserModel(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveUser(user: UserModel): void {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearUser(): void {
  localStorage.removeItem(USER_STORAGE_KEY);
}
