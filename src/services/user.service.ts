// Responsável por orquestrar casos de uso de usuário com regras de domínio e persistência.
import {
  applyMatchResult,
  createUserModel,
  type MatchResult,
  type UserModel
} from "../models/user";
import { createUserRepository, type UserRepository } from "../repositories/user.repository";

export type UserService = {
  getCurrentUser: () => UserModel | null;
  registerUser: (nickname: string) => UserModel;
  clearCurrentUser: () => void;
  recordUserMatch: (matchResult: MatchResult) => UserModel | null;
};

export type UserServiceDependencies = {
  repository: UserRepository;
};

export function createUserService({ repository }: UserServiceDependencies): UserService {
  return {
    getCurrentUser: () => repository.load(),
    registerUser: (nickname) => {
      const user = createUserModel(nickname);
      repository.save(user);
      return user;
    },
    clearCurrentUser: () => {
      repository.clear();
    },
    recordUserMatch: (matchResult) => {
      const user = repository.load();
      if (!user) {
        return null;
      }

      const updatedUser = applyMatchResult(user, matchResult);
      repository.save(updatedUser);
      return updatedUser;
    }
  };
}

const defaultUserService = createUserService({ repository: createUserRepository() });

export function getCurrentUser(): UserModel | null {
  return defaultUserService.getCurrentUser();
}

export function registerUser(nickname: string): UserModel {
  return defaultUserService.registerUser(nickname);
}

export function clearCurrentUser(): void {
  defaultUserService.clearCurrentUser();
}

export function recordUserMatch(matchResult: MatchResult): UserModel | null {
  return defaultUserService.recordUserMatch(matchResult);
}
