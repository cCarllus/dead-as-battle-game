import enUS from "./locales/en-US.json";
import ptBR from "./locales/pt-BR.json";

export type Locale = "pt-BR" | "en-US";
export type TranslationKey = keyof typeof ptBR;
export type TranslationParams = Record<string, number | string>;

type Dictionary = Record<TranslationKey, string>;

const dictionaries: Record<Locale, Dictionary> = {
  "pt-BR": ptBR,
  "en-US": enUS as Dictionary
};

export function resolveLocale(locale: string | undefined): Locale {
  if (locale === "en-US") {
    return "en-US";
  }

  return "pt-BR";
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries["pt-BR"];
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, token: string) => {
    if (Object.prototype.hasOwnProperty.call(params, token)) {
      return String(params[token]);
    }

    return `{${token}}`;
  });
}

export function t(locale: Locale, key: TranslationKey, params?: TranslationParams): string {
  const dictionary = getDictionary(locale);
  const fallback = dictionaries["pt-BR"][key];
  return interpolate(dictionary[key] ?? fallback, params);
}
