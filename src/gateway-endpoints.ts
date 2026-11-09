/**
 * new-api 的 /api/pricing 是公开接口，会顺带给出每个模型声明支持的端点类型
 * （images=图片接口，openai/gemini=聊天/原生接口）。查询免费，不需要令牌。
 */
export type EndpointHints = Record<string, string[]>;

const trimBase = (baseUrl: string) => baseUrl.trim().replace(/\/+$/, "");

export const fetchEndpointHints = async (baseUrl: string): Promise<EndpointHints> => {
  const base = trimBase(baseUrl);
  if (!base) return {};
  const response = await fetch(`${base}/api/pricing`);
  if (!response.ok) return {};
  const payload: unknown = await response.json();
  const rows = (payload as { data?: unknown })?.data;
  if (!Array.isArray(rows)) return {};

  const hints: EndpointHints = {};
  for (const row of rows) {
    const record = row as { model_name?: unknown; supported_endpoint_types?: unknown };
    const name = typeof record.model_name === "string" ? record.model_name : "";
    const types = record.supported_endpoint_types;
    if (!name || !Array.isArray(types)) continue;
    const cleaned = types.filter((item): item is string => typeof item === "string");
    if (cleaned.length > 0) hints[name] = cleaned;
  }
  return hints;
};
