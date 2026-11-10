/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Live only. The API Gateway HTTP API address, e.g. https://abc123.execute-api.ap-south-1.amazonaws.com
  readonly VITE_API_URL?: string;
  // Live only. The API Gateway WebSocket address, e.g. wss://xyz789.execute-api.ap-south-1.amazonaws.com/production
  readonly VITE_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
