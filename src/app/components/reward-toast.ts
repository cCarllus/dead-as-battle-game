// Responsável por mostrar o popup de recompensa pendente e acionar o resgate manual.
import { t, type Locale } from "../i18n";
import { COIN_REWARD_AMOUNT } from "@/shared/rewards/reward.model";
import { bind } from "./dom";

export type RewardToastOptions = {
  menu: HTMLElement;
  locale: Locale;
  onClaim: () => void;
};

export type RewardToastHandle = {
  setPendingRewards: (pendingRewards: number) => void;
  dispose: () => void;
};

export function mountRewardToast(options: RewardToastOptions): RewardToastHandle {
  const root = document.createElement("aside");
  root.className = "dab-reward-toast";
  root.hidden = true;
  root.innerHTML = `
    <p class="dab-reward-toast__message"></p>
    <button type="button" class="dab-reward-toast__claim"></button>
  `;

  options.menu.appendChild(root);

  const message = root.querySelector<HTMLElement>(".dab-reward-toast__message");
  const claimButton = root.querySelector<HTMLButtonElement>(".dab-reward-toast__claim");
  if (!message || !claimButton) {
    throw new Error("Estrutura do reward toast inválida.");
  }

  let pendingRewards = 0;

  const render = (): void => {
    if (pendingRewards <= 0) {
      root.hidden = true;
      root.classList.remove("is-visible");
      message.textContent = "";
      return;
    }

    root.hidden = false;
    root.classList.add("is-visible");

    if (pendingRewards === 1) {
      message.textContent = t(options.locale, "reward.toast.message.single");
    } else {
      message.textContent = t(options.locale, "reward.toast.message.multiple", {
        count: pendingRewards
      });
    }

    claimButton.textContent = t(options.locale, "reward.toast.claim", {
      amount: COIN_REWARD_AMOUNT
    });
  };

  const disposeClick = bind(claimButton, "click", () => {
    if (pendingRewards <= 0) {
      return;
    }

    options.onClaim();
  });

  return {
    setPendingRewards: (nextPendingRewards) => {
      pendingRewards = Math.max(0, Math.floor(nextPendingRewards));
      render();
    },
    dispose: () => {
      disposeClick();
      root.remove();
    }
  };
}
