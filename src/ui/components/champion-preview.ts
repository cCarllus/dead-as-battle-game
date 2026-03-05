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

type ChampionPreviewFrame = {
  size: Vector3;
  focusY: number;
};

// Default framing profile for all character models. This keeps a stable visual
// regardless of source scale/proportions.
const PREVIEW_PROFILE = {
  targetHeight: 4.6,
  maxWidth: 3.2,
  focusYRatio: 0.6,
  pedestalLift: 0,
  framingMargin: 1,
  visibleHeightRatio: 0.82,
  visibleWidthRatio: 1.24,
  cameraAlpha: -Math.PI / 2,
  cameraBeta: Math.PI / 2.36,
  minRadius: 3.3,
  maxRadius: 5.4
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

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

function normalizeModel(root: TransformNode): ChampionPreviewFrame {
  root.scaling = new Vector3(1, 1, 1);
  root.position = new Vector3(0, 0, 0);
  root.rotation = new Vector3(0, 0, 0);
  root.rotationQuaternion = null;

  const initialBounds = root.getHierarchyBoundingVectors(true);
  const initialSize = initialBounds.max.subtract(initialBounds.min);
  const rawHeight = Math.max(initialSize.y, 0.001);
  const rawWidth = Math.max(initialSize.x, initialSize.z, 0.001);

  const heightScale = PREVIEW_PROFILE.targetHeight / rawHeight;
  const widthScale = PREVIEW_PROFILE.maxWidth / rawWidth;
  const uniformScale = Math.min(heightScale, widthScale);
  root.scaling = new Vector3(uniformScale, uniformScale, uniformScale);

  const scaledBounds = root.getHierarchyBoundingVectors(true);
  const center = scaledBounds.min.add(scaledBounds.max).scale(0.5);
  root.position = new Vector3(-center.x, -scaledBounds.min.y + PREVIEW_PROFILE.pedestalLift, -center.z);

  const normalizedBounds = root.getHierarchyBoundingVectors(true);
  const normalizedSize = normalizedBounds.max.subtract(normalizedBounds.min);
  const focusY = normalizedBounds.min.y + normalizedSize.y * PREVIEW_PROFILE.focusYRatio;

  return { size: normalizedSize, focusY };
}

function frameCamera(camera: ArcRotateCamera, engine: Engine, frame: ChampionPreviewFrame): void {
  const renderWidth = Math.max(engine.getRenderWidth(), 1);
  const renderHeight = Math.max(engine.getRenderHeight(), 1);
  const aspectRatio = Math.max(renderWidth / renderHeight, 0.58);
  const tanHalfFov = Math.max(Math.tan(camera.fov * 0.5), 0.01);

  const halfHeight =
    frame.size.y * PREVIEW_PROFILE.visibleHeightRatio * 0.5 * PREVIEW_PROFILE.framingMargin;
  const halfWidth =
    Math.max(frame.size.x, frame.size.z) *
    PREVIEW_PROFILE.visibleWidthRatio *
    0.5 *
    (PREVIEW_PROFILE.framingMargin + 0.06);

  const radiusForHeight = halfHeight / tanHalfFov;
  const radiusForWidth = halfWidth / (tanHalfFov * aspectRatio);
  const radius = clamp(
    Math.max(radiusForHeight, radiusForWidth),
    PREVIEW_PROFILE.minRadius,
    PREVIEW_PROFILE.maxRadius
  );

  camera.alpha = PREVIEW_PROFILE.cameraAlpha;
  camera.beta = PREVIEW_PROFILE.cameraBeta;
  camera.lowerBetaLimit = camera.beta;
  camera.upperBetaLimit = camera.beta;
  camera.radius = radius;
  camera.lowerRadiusLimit = radius;
  camera.upperRadiusLimit = radius;
  camera.setTarget(new Vector3(0, frame.focusY, 0));
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
    PREVIEW_PROFILE.cameraAlpha,
    PREVIEW_PROFILE.cameraBeta,
    3.2,
    new Vector3(0, 1, 100),
    scene
  );
  camera.minZ = 0.01;
  camera.maxZ = 100;

  const keyLight = new HemisphericLight("championKeyLight", new Vector3(0.25, 1, -0.18), scene);
  keyLight.intensity = 1.18;

  const fillLight = new HemisphericLight("championFillLight", new Vector3(-0.18, -0.45, 0.28), scene);
  fillLight.intensity = 0.32;

  const modelRoot = new TransformNode("championModelRoot", scene);
  let modelFrame: ChampionPreviewFrame | null = null;
  let isDisposed = false;

  const { rootUrl, fileName } = splitModelPath(options.modelUrl);
  void SceneLoader.ImportMeshAsync("", rootUrl, fileName, scene)
    .then((result) => {
      result.meshes.forEach((mesh) => {
        if (!mesh.parent) {
          mesh.parent = modelRoot;
        }
      });

      modelFrame = normalizeModel(modelRoot);
      frameCamera(camera, engine, modelFrame);
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
    if (modelFrame) {
      frameCamera(camera, engine, modelFrame);
    }
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
