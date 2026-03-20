/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_URL?: string;
  readonly VITE_DEBUG?: string;
  readonly VITE_SHOW_FPS?: string;
  readonly VITE_INSPECTOR?: string;
  readonly VITE_INSPECTOR_AUTO_OPEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.glb" {
  const value: string;
  export default value;
}

declare module "*.gltf" {
  const value: string;
  export default value;
}

declare module "*.hdr" {
  const value: string;
  export default value;
}

declare module "*.env" {
  const value: string;
  export default value;
}

declare module "*.ktx2" {
  const value: string;
  export default value;
}

declare module "*.mp3" {
  const value: string;
  export default value;
}

declare module "*.wav" {
  const value: string;
  export default value;
}

declare module "*.ogg" {
  const value: string;
  export default value;
}
