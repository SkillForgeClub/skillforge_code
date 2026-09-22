/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend origin for a split deployment (e.g. https://api.yourdomain.com). Unset = relative /api calls. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
