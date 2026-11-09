/**
 * 本地开发用的网关代理目标。
 *
 * 该网关没有向浏览器开放跨域（预检 OPTIONS 直接 403），浏览器直连会被拦，
 * 所以 dev 模式下由 Vite 把 /gateway/* 转发到这里，页面里指向该网关的请求
 * 也会自动改走 /gateway，用户不需要手工改写网关地址。
 */
export const GATEWAY_PROXY_TARGET = "https://api.schyler.top";
