/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DESKTOP_SHELL?: string;
  readonly VITE_ENABLE_OUTLOOK?: string;
  readonly VITE_APP_API_BASE_URL?: string;
  readonly VITE_MICROSOFT_CLIENT_ID?: string;
  readonly VITE_MICROSOFT_TENANT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
