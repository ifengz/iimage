import type { MediaModel } from "newapi-media-client/config";
import type { EndpointHints } from "./gateway-endpoints";

export type GatewayProfile = {
  baseUrl: string;
  label: string;
  imageModel: string;
  models: MediaModel[];
  hints: EndpointHints;
  updatedAt: number;
};

const PROFILES_KEY = "iimage-gateway-profiles";
const TOKENS_KEY = "iimage-gateway-tokens";

const readJson = <T>(storage: Storage, key: string, fallback: T): T => {
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const writeJson = (storage: Storage, key: string, value: unknown) => {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    /* 存储不可用时静默跳过 */
  }
};

export const profileLabel = (baseUrl: string) => {
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
};

/** 网关配置（地址+模型目录）存本地，方便一键切换来源。 */
export const loadProfiles = (): GatewayProfile[] => {
  const list = readJson<unknown>(localStorage, PROFILES_KEY, []);
  if (!Array.isArray(list)) return [];
  return list.filter(
    (item): item is GatewayProfile =>
      typeof (item as GatewayProfile)?.baseUrl === "string" &&
      Array.isArray((item as GatewayProfile)?.models),
  );
};

export const saveProfiles = (profiles: GatewayProfile[]) => {
  writeJson(localStorage, PROFILES_KEY, profiles);
};

export const upsertProfile = (profile: GatewayProfile): GatewayProfile[] => {
  const rest = loadProfiles().filter((item) => item.baseUrl !== profile.baseUrl);
  const next = [profile, ...rest].sort((a, b) => b.updatedAt - a.updatedAt);
  saveProfiles(next);
  return next;
};

export const removeProfile = (baseUrl: string): GatewayProfile[] => {
  const next = loadProfiles().filter((item) => item.baseUrl !== baseUrl);
  saveProfiles(next);
  return next;
};

/** 令牌只放 sessionStorage，按网关地址分开存，关掉标签页即失效。 */
export const loadToken = (baseUrl: string): string => {
  const map = readJson<Record<string, string>>(sessionStorage, TOKENS_KEY, {});
  return typeof map[baseUrl] === "string" ? map[baseUrl] : "";
};

export const saveToken = (baseUrl: string, token: string) => {
  if (!baseUrl) return;
  const map = readJson<Record<string, string>>(sessionStorage, TOKENS_KEY, {});
  if (token) map[baseUrl] = token;
  else delete map[baseUrl];
  writeJson(sessionStorage, TOKENS_KEY, map);
};
