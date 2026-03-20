// Responsável por inicializar Physics V2 com Havok e expor integração opcional de Recast desacoplada da fundação de locomoção.
import { Vector3, type Scene } from "@babylonjs/core";
import "@babylonjs/core/Physics/v2/physicsEngineComponent";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import type { RecastJSPlugin } from "@babylonjs/core/Navigation/Plugins/recastJSPlugin";

const DEFAULT_GRAVITY = new Vector3(0, -25, 0);

export type HavokBootstrapOptions = {
  gravity?: Vector3;
  loggerPrefix?: string;
  enableRecast?: boolean;
};

export type HavokBootstrapResult = {
  enabled: boolean;
  usingHavok: boolean;
  pluginName: string | null;
  recastPlugin: RecastJSPlugin | null;
};

function resolvePhysicsPluginName(scene: Scene): string | null {
  return scene.getPhysicsEngine()?.getPhysicsPluginName?.() ?? null;
}

function isHavokPluginName(pluginName: string | null): boolean {
  if (!pluginName) {
    return false;
  }

  return pluginName.toLowerCase().includes("havok");
}

async function loadOptionalRecastPlugin(loggerPrefix?: string): Promise<RecastJSPlugin | null> {
  try {
    const [recastFactoryModule, recastPluginModule] = await Promise.all([
      import("recast-detour"),
      import("@babylonjs/core/Navigation/Plugins/recastJSPlugin")
    ]);
    const recastFactory = recastFactoryModule.default;
    const recastInstance = await recastFactory();
    const plugin = new recastPluginModule.RecastJSPlugin(recastInstance);
    return plugin;
  } catch (error) {
    const prefix = loggerPrefix ? `${loggerPrefix} ` : "";
    console.warn(`${prefix}Failed to initialize optional RecastJSPlugin.`, error);
    return null;
  }
}

export async function bootstrapHavokPhysics(
  scene: Scene,
  options: HavokBootstrapOptions = {}
): Promise<HavokBootstrapResult> {
  const prefix = options.loggerPrefix ? `${options.loggerPrefix} ` : "";
  const existingPluginName = resolvePhysicsPluginName(scene);

  if (scene.getPhysicsEngine()) {
    const recastPlugin = options.enableRecast ? await loadOptionalRecastPlugin(options.loggerPrefix) : null;
    return {
      enabled: true,
      usingHavok: isHavokPluginName(existingPluginName),
      pluginName: existingPluginName,
      recastPlugin
    };
  }

  try {
    const havokFactory = (await import("@babylonjs/havok")).default;
    const havokInstance = await havokFactory();
    const gravity = options.gravity?.clone() ?? DEFAULT_GRAVITY.clone();
    const havokPlugin = new HavokPlugin(true, havokInstance);
    const enabled = scene.enablePhysics(gravity, havokPlugin);

    if (!enabled) {
      console.warn(`${prefix}Scene.enablePhysics returned false. Falling back to legacy collision path.`);
      return {
        enabled: false,
        usingHavok: false,
        pluginName: null,
        recastPlugin: null
      };
    }
  } catch (error) {
    console.warn(`${prefix}Failed to initialize Havok physics plugin. Falling back to legacy collision path.`, error);
    return {
      enabled: false,
      usingHavok: false,
      pluginName: null,
      recastPlugin: null
    };
  }

  const pluginName = resolvePhysicsPluginName(scene);
  const recastPlugin = options.enableRecast ? await loadOptionalRecastPlugin(options.loggerPrefix) : null;

  return {
    enabled: true,
    usingHavok: isHavokPluginName(pluginName),
    pluginName,
    recastPlugin
  };
}
