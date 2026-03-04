import {
  ArcRotateCamera,
  Color4,
  Engine,
  HemisphericLight,
  Scene,
  SceneLoader,
  TransformNode,
  Vector3
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";

export type ChampionPreviewOptions = {
  modelUrl: string;
};

function splitModelPath(modelUrl: string): { rootUrl: string; fileName: string } {
  const lastSlash = modelUrl.lastIndexOf("/");
  if (lastSlash < 0) {
    return { rootUrl: "/", fileName: modelUrl };
  }

  return {
    rootUrl: modelUrl.slice(0, lastSlash + 1),
    fileName: modelUrl.slice(lastSlash + 1)
  };
}

function playAnimationGroups(groups: readonly { start: (loop?: boolean, speedRatio?: number) => unknown; reset: () => unknown }[]): void {
  groups.forEach((group) => {
    group.reset();
    group.start(true, 1);
  });
}

export function mountChampionPreview(container: HTMLElement, options: ChampionPreviewOptions): () => void {
  const fallbackIcon = container.querySelector<SVGElement>(".dab-champion-preview__icon");
  const canvas = document.createElement("canvas");
  canvas.className = "dab-champion-preview__canvas";
  container.appendChild(canvas);

  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    antialias: true,
    alpha: true
  });

  const scene = new Scene(engine);
  scene.clearColor = new Color4(0, 0, 0, 0);

  const camera = new ArcRotateCamera(
    "championPreviewCamera",
    -Math.PI / 2,
    Math.PI / 2.2,
    2.95,
    new Vector3(0, 1, 100),
    scene
  );
  camera.lowerRadiusLimit = camera.radius;
  camera.upperRadiusLimit = camera.radius;

  const light = new HemisphericLight("championLight", new Vector3(0.3, 1, -0.2), scene);
  light.intensity = 1.15;

  const modelRoot = new TransformNode("championModelRoot", scene);
  let isDisposed = false;

  const { rootUrl, fileName } = splitModelPath(options.modelUrl);
  void SceneLoader.ImportMeshAsync("", rootUrl, fileName, scene)
    .then((result) => {
      result.meshes.forEach((mesh) => {
        if (!mesh.parent) {
          mesh.parent = modelRoot;
        }
      });

      const bounds = modelRoot.getHierarchyBoundingVectors(true);
      const size = bounds.max.subtract(bounds.min);
      const height = Math.max(size.y, 0.001);
      const scale = 2.9 / height;
      modelRoot.scaling.scaleInPlace(scale);

      const scaledBounds = modelRoot.getHierarchyBoundingVectors(true);
      const center = scaledBounds.min.add(scaledBounds.max).scale(0.5);
      modelRoot.position = modelRoot.position.subtract(center);
      modelRoot.position.y -= scaledBounds.min.y;
      modelRoot.rotation = new Vector3(0, 0, 0);
      camera.setTarget(new Vector3(0, 1.15, 0));
      playAnimationGroups(result.animationGroups);

      if (fallbackIcon && !isDisposed) {
        fallbackIcon.style.display = "none";
      }
    })
    .catch(() => {
      // Keep fallback icon if GLB load fails.
    });

  const updateSize = (): void => {
    if (isDisposed) {
      return;
    }

    engine.resize();
  };

  const resizeObserver = new ResizeObserver(updateSize);
  resizeObserver.observe(container);

  updateSize();
  engine.runRenderLoop(() => {
    if (!isDisposed) {
      scene.render();
    }
  });

  return () => {
    isDisposed = true;
    resizeObserver.disconnect();
    scene.dispose();
    engine.stopRenderLoop();
    engine.dispose();
    canvas.remove();
  };
}
