import preact from "@preact/preset-vite";
import { defineConfig } from "vitest/config";
import { GATEWAY_PROXY_TARGET } from "./src/gateway-target";

export default defineConfig({
  plugins: [preact()],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
      "/health": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
      "/gateway": {
        target: GATEWAY_PROXY_TARGET,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gateway/, ""),
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
