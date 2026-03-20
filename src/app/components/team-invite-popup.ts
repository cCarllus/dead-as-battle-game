import { t, type Locale } from "../i18n";
import type { TeamInvite } from "@/shared/team/team-invite.model";
import type { TeamService } from "@/services/team.service";
import { bind, qs } from "./dom";

type TeamInvitePopupOptions = {
  locale: Locale;
  menu: HTMLElement;
  teamService: TeamService;
};

export function mountTeamInvitePopup(options: TeamInvitePopupOptions): () => void {
  const popup = document.createElement("div");
  popup.className = "dab-team-invite-popup";
  popup.hidden = true;
  popup.innerHTML = `
    <section class="dab-team-invite-popup__panel" role="dialog" aria-modal="false">
      <p class="dab-team-invite-popup__text" data-slot="invite-text"></p>
      <div class="dab-team-invite-popup__actions">
        <button type="button" class="dab-team-invite-popup__accept" data-team-invite-action="accept">${t(options.locale, "team.invite.accept")}</button>
        <button type="button" class="dab-team-invite-popup__decline" data-team-invite-action="decline">${t(options.locale, "team.invite.decline")}</button>
      </div>
    </section>
  `;

  options.menu.appendChild(popup);

  const textNode = qs<HTMLElement>(popup, '[data-slot="invite-text"]');
  const acceptButton = qs<HTMLButtonElement>(popup, 'button[data-team-invite-action="accept"]');
  const declineButton = qs<HTMLButtonElement>(popup, 'button[data-team-invite-action="decline"]');

  const cleanups: Array<() => void> = [];

  let activeInvite: TeamInvite | null = null;

  const setActiveInvite = (invite: TeamInvite | null): void => {
    activeInvite = invite;

    if (!activeInvite) {
      popup.hidden = true;
      textNode.textContent = "";
      return;
    }

    popup.hidden = false;
    textNode.textContent = t(options.locale, "team.invite.message", {
      nickname: activeInvite.fromNickname
    });
  };

  cleanups.push(
    options.teamService.onPendingInvitesUpdated((invites) => {
      const nextInvite = invites.length > 0 ? invites[0] : null;
      setActiveInvite(nextInvite ? { ...nextInvite } : null);
    })
  );

  cleanups.push(
    bind(acceptButton, "click", () => {
      if (!activeInvite) {
        return;
      }

      options.teamService.acceptInvite(activeInvite.id);
    })
  );

  cleanups.push(
    bind(declineButton, "click", () => {
      if (!activeInvite) {
        return;
      }

      const inviteId = activeInvite.id;
      setActiveInvite(null);
      options.teamService.declineInvite(inviteId);
    })
  );

  setActiveInvite(options.teamService.getPendingInvites()[0] ?? null);

  return () => {
    cleanups.forEach((cleanup) => {
      cleanup();
    });

    popup.remove();
  };
}
