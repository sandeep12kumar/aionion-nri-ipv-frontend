/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Live only. The API Gateway HTTP API address, e.g. https://abc123.execute-api.ap-south-1.amazonaws.com
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
