// Responsável por centralizar catálogo base de campeões e utilitários de resolução.
import type { ChampionCatalogItem, ChampionId } from "../models/champion.model";

export const CHAMPION_IDS: readonly ChampionId[] = ["user", "sukuna", "kaiju_no_8"];

const DEFAULT_USER_CHAMPION_THEME = "#FFD54A" as const;

export const DEFAULT_CHAMPION_ID: ChampionId = "user";

export const USER_CHAMPION_TEMPLATE: ChampionCatalogItem = {
  id: "user",
  displayName: "Player",
  universeName: "Dead as Battle",
  modelUrl: null,
  cardImageUrl: "/assets/images/champions/user/card.png",
  splashImageUrl: "/assets/images/ui/loading_1.png",
  selectAudioUrl: "/assets/audio/ui/select_user.mp3",
  themeColor: DEFAULT_USER_CHAMPION_THEME
};

export const UNIVERSE_CHAMPION_CATALOG: readonly ChampionCatalogItem[] = [
  {
    id: "sukuna",
    displayName: "Ryomen Sukuna",
    universeName: "Jujutsu Kaisen",
    modelUrl: "/assets/models/champions/sukuna/sukuna.glb",
    cardImageUrl: "https://imgs.search.brave.com/4xKnueO8sbGhJzX-a3xpjeXEV_9S-XH6Aa2iVyP_83Q/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9jZG4u/d2FsbHBhcGVyc2Fm/YXJpLmNvbS84NC84/L1ptdXM1Ny5qcGc",
    splashImageUrl: "https://wallpapercave.com/wp/wp9146052.jpg",
    selectAudioUrl: "/assets/sounds/champions/sukuna/sukuna_audio_lobby.mp3",
    themeColor: "#fa1515"
  },
  {
    id: "kaiju_no_8",
    displayName: "Kaiju No. 8",
    universeName: "Kaiju No. 8",
    modelUrl: "/assets/models/champions/kaiju_no_8/kaiju_no_8.glb",
    cardImageUrl: "https://imgs.search.brave.com/DqGG85r2no3aQUCEDlwL4NeHAzcqujcGyRDSlT1xZI4/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9pLnBp/bmltZy5jb20vdmlk/ZW9zL3RodW1ibmFp/bHMvb3JpZ2luYWxz/LzIzLzNmLzlhLzIz/M2Y5YTVjNDJhZWJk/OGE4NmRiYzdlZTNh/YWIwNjA4LjAwMDAw/MDAuanBn",
    splashImageUrl: "https://imgs.search.brave.com/pFl7v2bGLXWoylvyxLS44rNt1vvB1UG8o3rU1eD1VZ8/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly93YWxs/cGFwZXJzLmNvbS9p/bWFnZXMvZmVhdHVy/ZWQva2FpanUtbm8t/OC1tcHZ3d2F0NG5z/dGEwNGtsLmpwZw",
    selectAudioUrl: "/assets/sounds/champions/kaiju_no_8/kaiju_no_8_audio_lobby.mp3",
    themeColor: "#012bfb"
  },
] as const;

function normalizeNickname(nickname: string): string {
  const normalized = nickname.trim();
  return normalized.length > 0 ? normalized : "Player";
}

function hashNicknameColor(nickname: string): `#${string}` {
  const normalized = normalizeNickname(nickname);
  let hash = 0;

  for (let index = 0; index < normalized.length; index += 1) {
    hash = normalized.charCodeAt(index) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360;
  const saturation = 72;
  const lightness = 60;

  const c = ((100 - Math.abs(2 * lightness - 100)) * saturation) / 10000;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lightness / 100 - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (hue < 60) {
    r = c;
    g = x;
  } else if (hue < 120) {
    r = x;
    g = c;
  } else if (hue < 180) {
    g = c;
    b = x;
  } else if (hue < 240) {
    g = x;
    b = c;
  } else if (hue < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const toHex = (channel: number): string => {
    const value = Math.round((channel + m) * 255);
    return value.toString(16).padStart(2, "0");
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function createUserChampionEntry(nickname: string): ChampionCatalogItem {
  return {
    ...USER_CHAMPION_TEMPLATE,
    displayName: normalizeNickname(nickname),
    themeColor: hashNicknameColor(nickname)
  };
}

export function getChampionCatalogForUser(nickname: string): readonly ChampionCatalogItem[] {
  return [createUserChampionEntry(nickname), ...UNIVERSE_CHAMPION_CATALOG];
}

export function isChampionId(value: string | undefined): value is ChampionId {
  return value !== undefined && CHAMPION_IDS.some((championId) => championId === value);
}

export function getBaseChampionById(championId: ChampionId): ChampionCatalogItem {
  if (championId === "user") {
    return USER_CHAMPION_TEMPLATE;
  }

  const resolvedChampion = UNIVERSE_CHAMPION_CATALOG.find((champion) => champion.id === championId);
  return resolvedChampion ?? USER_CHAMPION_TEMPLATE;
}
