// Responsável por centralizar dados e filtros usados na tela de campeões.
import type { TranslationKey } from "../../i18n";

export type ChampionUniverseId =
  | "all"
  | "jujutsu-kaisen"
  | "kaiju_no_8";

export type ChampionFilterItem = {
  id: ChampionUniverseId;
  labelKey: TranslationKey;
};

export type ChampionRosterItem = {
  id: string;
  name: string;
  level: number;
  universeId: Exclude<ChampionUniverseId, "all">;
  imageUrl: string;
  accent?: "gold";
};

export const CHAMPION_FILTER_ITEMS: readonly ChampionFilterItem[] = [
  { id: "all", labelKey: "champions.filter.allUniverses" },
  { id: "jujutsu-kaisen", labelKey: "champions.universe.jujutsuKaisen" },
  { id: "kaiju_no_8", labelKey: "champions.universe.kaijuNo8" },
];

export const CHAMPION_ROSTER: readonly ChampionRosterItem[] = [
  {
    id: "sukuna",
    name: "Ryomen Sukuna",
    level: 42,
    universeId: "jujutsu-kaisen",
    imageUrl: "https://imgs.search.brave.com/SDSPMRtmRdELaIRLIbSkrPAC9wRhFQ7BodEf-93KEIg/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly93YWxs/cGFwZXJjYXZlLmNv/bS93cC93cDkwNzg3/MTIuanBn",
    accent: "gold"
  },
  {
    id: "hibino_kafka",
    name: "Hibino Kafka",
    level: 15,
    universeId: "kaiju_no_8",
    imageUrl: "https://imgs.search.brave.com/DqGG85r2no3aQUCEDlwL4NeHAzcqujcGyRDSlT1xZI4/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9pLnBp/bmltZy5jb20vdmlk/ZW9zL3RodW1ibmFp/bHMvb3JpZ2luYWxz/LzIzLzNmLzlhLzIz/M2Y5YTVjNDJhZWJk/OGE4NmRiYzdlZTNh/YWIwNjA4LjAwMDAw/MDAuanBn"
  },
];

export const LOCKED_SLOT_COUNT = 3;

const CHAMPION_UNIVERSE_SET = new Set<ChampionUniverseId>(CHAMPION_FILTER_ITEMS.map((item) => item.id));

export function isChampionUniverseId(value: string | undefined): value is ChampionUniverseId {
  return value !== undefined && CHAMPION_UNIVERSE_SET.has(value as ChampionUniverseId);
}
