import bagFillSvg from "bootstrap-icons/icons/bag-fill.svg?raw";
import bellFillSvg from "bootstrap-icons/icons/bell-fill.svg?raw";
import boxArrowLeftSvg from "bootstrap-icons/icons/box-arrow-left.svg?raw";
import chatSquareTextFillSvg from "bootstrap-icons/icons/chat-square-text-fill.svg?raw";
import checkCircleFillSvg from "bootstrap-icons/icons/check-circle-fill.svg?raw";
import chevronDownSvg from "bootstrap-icons/icons/chevron-down.svg?raw";
import coinSvg from "bootstrap-icons/icons/coin.svg?raw";
import discordSvg from "bootstrap-icons/icons/discord.svg?raw";
import gearFillSvg from "bootstrap-icons/icons/gear-fill.svg?raw";
import gridFillSvg from "bootstrap-icons/icons/grid-fill.svg?raw";
import houseDoorFillSvg from "bootstrap-icons/icons/house-door-fill.svg?raw";
import journalTextSvg from "bootstrap-icons/icons/journal-text.svg?raw";
import lightningChargeFillSvg from "bootstrap-icons/icons/lightning-charge-fill.svg?raw";
import lockFillSvg from "bootstrap-icons/icons/lock-fill.svg?raw";
import peopleFillSvg from "bootstrap-icons/icons/people-fill.svg?raw";
import personPlusFillSvg from "bootstrap-icons/icons/person-plus-fill.svg?raw";
import playFillSvg from "bootstrap-icons/icons/play-fill.svg?raw";
import trophyFillSvg from "bootstrap-icons/icons/trophy-fill.svg?raw";
import twitterXSvg from "bootstrap-icons/icons/twitter-x.svg?raw";
import xOctagonFillSvg from "bootstrap-icons/icons/x-octagon-fill.svg?raw";

export type MenuIconId =
  | "back"
  | "bell"
  | "champions"
  | "chat"
  | "chevron"
  | "check"
  | "coin"
  | "community"
  | "deaths"
  | "filter"
  | "home"
  | "kills"
  | "lock"
  | "notes"
  | "play"
  | "settings"
  | "socialX"
  | "store"
  | "team"
  | "teamInvite"
  | "wordmarkAccent";

const ICON_MARKUP_BY_ID: Record<MenuIconId, string> = {
  back: boxArrowLeftSvg,
  bell: bellFillSvg,
  champions: lightningChargeFillSvg,
  chat: chatSquareTextFillSvg,
  chevron: chevronDownSvg,
  check: checkCircleFillSvg,
  coin: coinSvg,
  community: discordSvg,
  deaths: xOctagonFillSvg,
  filter: gridFillSvg,
  home: houseDoorFillSvg,
  kills: trophyFillSvg,
  lock: lockFillSvg,
  notes: journalTextSvg,
  play: playFillSvg,
  settings: gearFillSvg,
  socialX: twitterXSvg,
  store: bagFillSvg,
  team: peopleFillSvg,
  teamInvite: personPlusFillSvg,
  wordmarkAccent: lightningChargeFillSvg
};

type MenuIconOptions = {
  className?: string;
  label?: string;
};

function createSvgNode(markup: string, label?: string): SVGElement {
  const template = document.createElement("template");
  template.innerHTML = markup.trim();
  const svg = template.content.firstElementChild;

  if (!(svg instanceof SVGElement)) {
    throw new Error("Menu icon markup did not resolve to an SVG element.");
  }

  svg.classList.add("dab-menu-icon__svg");
  svg.setAttribute("focusable", "false");

  if (label) {
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", label);
  } else {
    svg.setAttribute("aria-hidden", "true");
  }

  return svg;
}

export function createMenuIcon(iconId: MenuIconId, options: MenuIconOptions = {}): HTMLSpanElement {
  const root = document.createElement("span");
  root.className = "dab-menu-icon";
  root.dataset.icon = iconId;

  if (options.className) {
    root.classList.add(...options.className.split(" ").filter(Boolean));
  }

  root.appendChild(createSvgNode(ICON_MARKUP_BY_ID[iconId], options.label));
  return root;
}

export function setMenuIconContent(
  container: HTMLElement,
  iconId: MenuIconId,
  options: MenuIconOptions = {}
): void {
  container.replaceChildren();
  const icon = createMenuIcon(iconId, options);
  container.classList.add("dab-menu-icon-slot");

  if (options.className) {
    container.classList.add(...options.className.split(" ").filter(Boolean));
  }

  container.appendChild(icon.firstElementChild as SVGElement);
}
