/**
 * 本地开发时，浏览器直连网关/图床会撞跨域。这里把跨域 fetch 改走同源 /_gw，
 * 由 Vite 中间件在服务端转发，省得每换一个网关就改代理配置。
 */
const PROXY_PATH = "/_gw";

const isHttpUrl = (value: string) => /^https?:\/\//i.test(value);

const toProxied = (url: string) =>
  `${window.location.origin}${PROXY_PATH}?url=${encodeURIComponent(url)}`;

const shouldProxy = (url: string) => {
  if (!isHttpUrl(url)) return false;
  try {
    return new URL(url).origin !== window.location.origin;
  } catch {
    return false;
  }
};

export const installDevFetchProxy = () => {
  if (!import.meta.env.DEV || typeof window === "undefined" || typeof window.fetch !== "function") {
    return;
  }
  const originalFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    try {
      if (typeof input === "string") {
        if (shouldProxy(input)) return originalFetch(toProxied(input), init);
      } else if (input instanceof URL) {
        if (shouldProxy(input.href)) return originalFetch(toProxied(input.href), init);
      } else if (typeof Request !== "undefined" && input instanceof Request && shouldProxy(input.url)) {
        return originalFetch(new Request(toProxied(input.url), input));
      }
    } catch {
      /* 交给原始 fetch 报错 */
    }
    return originalFetch(input as RequestInfo, init);
  }) as typeof window.fetch;
};
