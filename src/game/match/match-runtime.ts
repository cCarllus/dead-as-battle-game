import type { MatchPlayerState } from "@/shared/match/match-player.model";
import type { ChatService } from "@/services/chat.service";
import type { MatchService } from "@/services/match.service";
import { createGlobalMatchScene, type GlobalMatchSceneHandle } from "@/game/scenes/global-match.scene";

type MatchRuntimeViewSettings = {
  cameraFovPercent: number;
  renderDistanceViewPercent: number;
};

export type MatchRuntimeOptions = {
  canvas: HTMLCanvasElement;
  matchService: MatchService;
  chatService: ChatService;
  initialTeamMemberUserIds: string[];
  messages: {
    connecting: string;
    loadingMap: string;
    invalidSession: string;
    startFailed: string;
  };
  resolveViewSettings: () => MatchRuntimeViewSettings;
  onLoading: (message: string) => void;
  onReady: (payload: {
    localSessionId: string;
    sceneHandle: GlobalMatchSceneHandle;
    players: MatchPlayerState[];
  }) => void;
  onPointerLockChanged: (isPointerLocked: boolean) => void;
  onError: (message: string) => void;
};

export type MatchRuntime = {
  start: () => Promise<void>;
  dispose: () => void;
};

export function createMatchRuntime(options: MatchRuntimeOptions): MatchRuntime {
  let sceneHandle: GlobalMatchSceneHandle | null = null;
  let disposeScenePointerLockChanged: (() => void) | null = null;
  let disposed = false;

  return {
    start: async () => {
      options.onLoading(options.messages.connecting);

      try {
        await Promise.all([
          options.matchService.connect(),
          options.chatService.connect().catch(() => {
            // Match HUD chat is optional. Keep the match flow alive if chat is unavailable.
          })
        ]);

        const localSessionId = options.matchService.getLocalSessionId();
        if (!localSessionId) {
          throw new Error(options.messages.invalidSession);
        }

        options.onLoading(options.messages.loadingMap);

        const nextSceneHandle = await createGlobalMatchScene({
          canvas: options.canvas,
          localSessionId,
          initialPlayers: options.matchService.getPlayers(),
          onLocalPlayerMoved: (position) => {
            options.matchService.sendLocalMovement(position);
          },
          onLocalSprintIntentChanged: (intent) => {
            options.matchService.sendSprintIntent(intent);
          },
          onLocalAttackRequested: () => {
            options.matchService.sendAttackStart();
          },
          onLocalSkillRequested: (slot) => {
            options.matchService.sendSkillCast(slot);
          },
          onLocalBlockStartRequested: () => {
            options.matchService.sendBlockStart();
          },
          onLocalBlockEndRequested: () => {
            options.matchService.sendBlockEnd();
          }
        });

        if (disposed) {
          nextSceneHandle.dispose();
          return;
        }

        sceneHandle = nextSceneHandle;
        sceneHandle.setTeamMemberUserIds(options.initialTeamMemberUserIds);
        sceneHandle.setPlayers(options.matchService.getPlayers());
        sceneHandle.applyViewSettings(options.resolveViewSettings());
        disposeScenePointerLockChanged = sceneHandle.onPointerLockChanged(options.onPointerLockChanged);

        options.onReady({
          localSessionId,
          sceneHandle,
          players: options.matchService.getPlayers()
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : options.messages.startFailed;
        options.onError(message);
        options.matchService.disconnect();
      }
    },
    dispose: () => {
      disposed = true;
      disposeScenePointerLockChanged?.();
      disposeScenePointerLockChanged = null;
      sceneHandle?.dispose();
      sceneHandle = null;
      options.matchService.disconnect();
    }
  };
}
