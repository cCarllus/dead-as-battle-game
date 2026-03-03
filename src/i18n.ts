export type Locale = "pt-BR" | "en-US";

const ptBR = {
  "menu.logo": "DAB.",
  "menu.aria.main": "Menu principal",
  "menu.aria.nav": "Navegação principal",
  "menu.aria.playModes": "Modos de jogo",

  "menu.nav.home": "INÍCIO",
  "menu.nav.play": "JOGAR",
  "menu.nav.notes": "NOTAS",
  "menu.nav.heroes": "HERÓIS",
  "menu.nav.store": "LOJA",

  "menu.tools.settingsAria": "Abrir configurações",

  "menu.currency.coin": "MOEDAS {value}",
  "menu.currency.gem": "GEMAS {value}",

  "menu.watermark.title": "Dead as Battle",
  "menu.watermark.subtitle": "MULTIVERSO",

  "menu.roster.title": "EQUIPE",
  "menu.roster.count": "{current}/{total}",
  "menu.roster.level": "Nível {value}",
  "menu.roster.inLobby": "No lobby",
  "menu.roster.inviteAria": "Convidar jogador",

  "menu.play.practice": "TREINO >",
  "menu.play.trophy": "TROFÉU",
  "menu.play.tryCompetitive": "EXPERIMENTE O COMPETITIVO",
  "menu.play.changeMode": "MUDAR MODO >",
  "menu.play.quickMatch": "PARTIDA RÁPIDA",
  "menu.play.start": "INICIAR",
  "menu.play.ping": "{value}ms",

  "menu.footer.chat": "Pressione Enter para falar no chat",
  "menu.footer.settings": "CONFIGURAÇÕES",
  "menu.footer.back": "ESC VOLTAR",

  "menu.team.player1": "GamerTagX",
  "menu.team.player2": "FrostBite"
} as const;

export type TranslationKey = keyof typeof ptBR;
export type TranslationParams = Record<string, number | string>;

const enUS: Record<TranslationKey, string> = {
  "menu.logo": "DAB.",
  "menu.aria.main": "Main menu",
  "menu.aria.nav": "Primary navigation",
  "menu.aria.playModes": "Play modes",
  "menu.nav.home": "HOME",
  "menu.nav.play": "PLAY",
  "menu.nav.notes": "NOTES",
  "menu.nav.heroes": "HEROES",
  "menu.nav.store": "STORE",
  "menu.tools.settingsAria": "Open settings",
  "menu.currency.coin": "COIN {value}",
  "menu.currency.gem": "GEM {value}",
  "menu.watermark.title": "Dead as Battle",
  "menu.watermark.subtitle": "MULTIVERSE",
  "menu.roster.title": "TEAM",
  "menu.roster.count": "{current}/{total}",
  "menu.roster.level": "Level {value}",
  "menu.roster.inLobby": "In Lobby",
  "menu.roster.inviteAria": "Invite player",
  "menu.play.practice": "PRACTICE >",
  "menu.play.trophy": "TROPHY",
  "menu.play.tryCompetitive": "TRY COMPETITIVE",
  "menu.play.changeMode": "CHANGE MODE >",
  "menu.play.quickMatch": "QUICK MATCH",
  "menu.play.start": "START",
  "menu.play.ping": "{value}ms",
  "menu.footer.chat": "Press Enter to Chat",
  "menu.footer.settings": "SETTINGS",
  "menu.footer.back": "ESC BACK",
  "menu.team.player1": "GamerTagX",
  "menu.team.player2": "FrostBite"
};

const dictionaries: Record<Locale, Record<TranslationKey, string>> = {
  "pt-BR": ptBR,
  "en-US": enUS
};

export function resolveLocale(locale: string | undefined): Locale {
  if (locale === "en-US") {
    return locale;
  }

  return "pt-BR";
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
  const dictionary = dictionaries[locale] ?? dictionaries["pt-BR"];
  const fallback = dictionaries["pt-BR"][key];
  return interpolate(dictionary[key] ?? fallback, params);
}
