import {
  createUserModel,
  withMatchResult,
  type MatchResult,
  type UserModel
} from "../models/user";
import { clearUser, loadUser, saveUser } from "../repositories/user.repository";

export function getCurrentUser(): UserModel | null {
  return loadUser();
}

export function registerUser(nickname: string): UserModel {
  const user = createUserModel(nickname);
  saveUser(user);
  return user;
}

export function clearCurrentUser(): void {
  clearUser();
}

export function recordUserMatch(matchResult: MatchResult): UserModel | null {
  const user = getCurrentUser();
  if (!user) {
    return null;
  }

  const updatedUser = withMatchResult(user, matchResult);
  saveUser(updatedUser);
  return updatedUser;
}
