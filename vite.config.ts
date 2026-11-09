import preact from "@preact/preset-vite";
import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";

import { GATEWAY_PROXY_TARGET } from "./src/gateway-target";

const SKIP_REQUEST_HEADERS = new Set([
  "host",
  "origin",
  "referer",
  "connection",
  "content-length",
  "accept-encoding",
]);

const SKIP_RESPONSE_HEADERS = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
]);

/** dev 通用转发：/_gw?url=... 由服务端代取，绕开任意网关/图床的跨域限制 */
const devFetchProxy = (): Plugin => ({
  name: "dev-fetch-proxy",
  configureServer(server) {
    server.middlewares.use("/_gw", (req, res) => {
      void (async () => {
        const incoming = new URL(req.url ?? "/", "http://localhost");
        const raw = incoming.searchParams.get("url") ?? "";
        let target: URL;
        try {
          target = new URL(raw);
        } catch {
          res.statusCode = 400;
          res.end("invalid url");
          return;
        }
        if (!/^https?:$/.test(target.protocol)) {
          res.statusCode = 400;
          res.end("unsupported protocol");
          return;
        }

        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) {
          if (!value || SKIP_REQUEST_HEADERS.has(key.toLowerCase())) continue;
          headers.set(key, Array.isArray(value) ? value.join(",") : value);
        }

        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const body = chunks.length ? Buffer.concat(chunks) : undefined;

        try {
          const upstream = await fetch(target, {
            method: req.method,
            headers,
            body,
            redirect: "follow",
          });
          upstream.headers.forEach((value, key) => {
            if (SKIP_RESPONSE_HEADERS.has(key.toLowerCase())) return;
            res.setHeader(key, value);
          });
          const payload = Buffer.from(await upstream.arrayBuffer());
          res.setHeader("access-control-allow-origin", "*");
          res.setHeader("content-length", String(payload.length));
          res.statusCode = upstream.status;
          res.end(payload);
        } catch (error) {
          res.statusCode = 502;
          res.end(`proxy failed: ${(error as Error).message}`);
        }
      })();
    });
  },
});

export default defineConfig({
  plugins: [preact(), devFetchProxy()],
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
