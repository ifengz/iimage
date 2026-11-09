import { GATEWAY_PROXY_TARGET } from "./gateway-target";

const PROXY_PATH = "/gateway";

const targetOrigin = (() => {
  try {
    return new URL(GATEWAY_PROXY_TARGET).origin;
  } catch {
    return "";
  }
})();

/**
 * dev 模式下把指向代理目标的绝对地址改写成同源 /gateway 地址。
 * `keepPath` 为 false 时只取源站（适配器会自己拼 /v1/models 等路径）。
 * 非 dev、同源、或不属于代理目标的地址原样返回。
 */
export const proxyGatewayUrl = (rawUrl: string, keepPath: boolean): string => {
  if (!import.meta.env.DEV || !targetOrigin) return rawUrl;
  try {
    const url = new URL(rawUrl);
    if (url.origin === window.location.origin || url.origin !== targetOrigin) return rawUrl;
    return keepPath
      ? `${window.location.origin}${PROXY_PATH}${url.pathname}${url.search}`
      : `${window.location.origin}${PROXY_PATH}`;
  } catch {
    /* 非法地址交给适配器给出报错 */
    return rawUrl;
  }
};
