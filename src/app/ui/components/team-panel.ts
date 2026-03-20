import { t, type Locale } from "../../i18n";
import type { Team } from "../../models/team.model";
import type { TeamService } from "../../services/team.service";
import { bindDelegatedClick } from "./dom";

const TEAM_MAX_MEMBERS = 3;

type TeamPanelOptions = {
  locale: Locale;
  container: HTMLElement;
  rosterRoot: HTMLElement;
  rosterCountNode: HTMLElement;
  teamTabButton: HTMLElement;
  teamService: TeamService;
  currentUserId: string;
};

function createBadge(label: string, modifier?: "leader"): HTMLSpanElement {
  const badge = document.createElement("span");
  badge.className = modifier === "leader"
    ? "dab-team-panel__badge dab-team-panel__badge--leader"
    : "dab-team-panel__badge";
  badge.textContent = label;
  return badge;
}

function createMemberRow(
  locale: Locale,
  team: Team,
  currentUserId: string,
  member: Team["members"][number]
): HTMLLIElement {
  const isLeader = member.userId === team.leaderUserId;
  const isSelf = member.userId === currentUserId;
  const canKick = team.leaderUserId === currentUserId && !isSelf;

  const row = document.createElement("li");
  row.className = "dab-team-panel__member";
  row.dataset.userId = member.userId;

  const copy = document.createElement("div");
  copy.className = "dab-team-panel__member-copy";

  const nickname = document.createElement("strong");
  nickname.textContent = member.nickname;

  const tags = document.createElement("span");
  tags.className = "dab-team-panel__member-tags";

  if (isLeader) {
    tags.appendChild(createBadge(t(locale, "team.panel.badge.leader"), "leader"));
  }

  if (isSelf) {
    tags.appendChild(createBadge(t(locale, "team.panel.badge.you")));
  }

  copy.append(nickname, tags);
  row.appendChild(copy);

  if (canKick) {
    const kickButton = document.createElement("button");
    kickButton.type = "button";
    kickButton.className = "dab-team-panel__kick";
    kickButton.dataset.teamAction = "kick";
    kickButton.dataset.userId = member.userId;
    kickButton.textContent = t(locale, "team.panel.kick");
    row.appendChild(kickButton);
  }

  return row;
}

function renderEmptyState(options: TeamPanelOptions): void {
  options.rosterCountNode.textContent = t(options.locale, "menu.roster.count", {
    current: 0,
    total: TEAM_MAX_MEMBERS
  });

  options.rosterRoot.classList.remove("is-team-active");
  options.teamTabButton.classList.remove("is-active-team");

  const section = document.createElement("section");
  section.className = "dab-team-panel dab-team-panel--empty";

  const text = document.createElement("p");
  text.textContent = t(options.locale, "team.panel.empty");

  section.appendChild(text);
  options.container.replaceChildren(section);
}

function renderFilledState(options: TeamPanelOptions, team: Team): void {
  const hasMembers = team.members.length > 0;

  options.rosterCountNode.textContent = t(options.locale, "menu.roster.count", {
    current: team.members.length,
    total: TEAM_MAX_MEMBERS
  });

  options.rosterRoot.classList.toggle("is-team-active", hasMembers);
  options.teamTabButton.classList.toggle("is-active-team", hasMembers);

  const section = document.createElement("section");
  section.className = "dab-team-panel";

  const header = document.createElement("div");
  header.className = "dab-team-panel__header";

  const size = document.createElement("strong");
  size.textContent = t(options.locale, "team.panel.size", {
    current: team.members.length,
    max: TEAM_MAX_MEMBERS
  });

  header.appendChild(size);

  const list = document.createElement("ul");
  list.className = "dab-team-panel__members";

  team.members.forEach((member) => {
    list.appendChild(createMemberRow(options.locale, team, options.currentUserId, member));
  });

  const leaveButton = document.createElement("button");
  leaveButton.type = "button";
  leaveButton.className = "dab-team-panel__leave";
  leaveButton.dataset.teamAction = "leave";
  leaveButton.textContent = t(options.locale, "team.panel.leave");

  section.append(header, list, leaveButton);
  options.container.replaceChildren(section);
}

function renderTeamPanel(options: TeamPanelOptions, team: Team | null): void {
  if (!team) {
    renderEmptyState(options);
    return;
  }

  renderFilledState(options, team);
}

export function mountTeamPanel(options: TeamPanelOptions): () => void {
  const cleanups: Array<() => void> = [];

  cleanups.push(
    bindDelegatedClick(options.container, "button[data-team-action]", (button) => {
      const action = button.dataset.teamAction;

      if (action === "leave") {
        options.teamService.leaveTeam();
        return;
      }

      if (action === "kick") {
        const userId = button.dataset.userId;
        if (!userId) {
          return;
        }

        options.teamService.kickPlayer(userId);
      }
    })
  );

  cleanups.push(
    options.teamService.onTeamUpdated((team) => {
      renderTeamPanel(options, team);
    })
  );

  renderTeamPanel(options, options.teamService.getCurrentTeam());

  return () => {
    cleanups.forEach((cleanup) => {
      cleanup();
    });

    options.rosterRoot.classList.remove("is-team-active");
    options.teamTabButton.classList.remove("is-active-team");
    options.container.replaceChildren();
  };
}
