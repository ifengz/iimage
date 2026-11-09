/**
 * 部分网关只开放 `/v1/chat/completions` 出图（new-api 代理的 gemini 图片模型即是如此），
 * 此时 Images API 会直接返回 404 "Images API is not supported for this platform"。
 * 这里用聊天接口出图，把结果里的图片地址交回原有下载链路（支持 data: 与 http 两种）。
 */

export interface ChatImageRequest {
  baseUrl: string;
  key: string;
  model: string;
  prompt: string;
  images?: string[];
  signal?: AbortSignal;
}

const asRecord = (value: unknown): Record<string, any> | null =>
  value && typeof value === "object" ? (value as Record<string, any>) : null;

const MARKDOWN_IMAGE_RE = /!\[[^\]]*\]\(\s*(data:image\/[^)\s]+|https?:\/\/[^)\s]+)\s*\)/i;
const BARE_DATA_URI_RE = /data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+/i;

const extractFromText = (text: string): string | null => {
  const markdown = MARKDOWN_IMAGE_RE.exec(text);
  if (markdown) return markdown[1];
  const bare = BARE_DATA_URI_RE.exec(text);
  return bare ? bare[0] : null;
};

const extractImageUrl = (payload: unknown): string | null => {
  const choices = asRecord(payload)?.choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;

  const message = asRecord(asRecord(choices[0])?.message);
  if (!message) return null;

  const images = message.images;
  if (Array.isArray(images)) {
    for (const item of images) {
      const record = asRecord(item);
      const url = record?.url;
      if (typeof url === "string" && url) return url;
      const b64 = record?.b64_json;
      if (typeof b64 === "string" && b64) return `data:image/png;base64,${b64}`;
    }
  }

  const content = message.content;
  if (typeof content === "string") return extractFromText(content);

  if (Array.isArray(content)) {
    for (const part of content) {
      const record = asRecord(part);
      const imageUrl = asRecord(record?.image_url)?.url;
      if (typeof imageUrl === "string" && imageUrl) return imageUrl;
      if (typeof record?.text === "string") {
        const found = extractFromText(record.text);
        if (found) return found;
      }
    }
  }

  return null;
};

/** 用聊天接口出图，返回图片地址（data: 或 http）。 */
export const generateImageWithChatCompletions = async ({
  baseUrl,
  key,
  model,
  prompt,
  images = [],
  signal,
}: ChatImageRequest): Promise<string> => {
  const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
  for (const image of images) {
    content.push({ type: "image_url", image_url: { url: image } });
  }

  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/v1/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [{ role: "user", content }],
    }),
    signal,
  });

  const rawText = await response.text();
  let payload: unknown = null;
  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = asRecord(asRecord(payload)?.error)?.message;
    const bodyText = typeof message === "string" && message ? message : rawText.slice(0, 200).trim();
    throw new Error(
      bodyText
        ? `网关请求失败 HTTP ${response.status}：${bodyText}`
        : `网关请求失败 HTTP ${response.status}`,
    );
  }

  const imageUrl = extractImageUrl(payload);
  if (!imageUrl) {
    throw new Error("聊天接口没有返回图片，请确认该模型支持出图。");
  }
  return imageUrl;
};
