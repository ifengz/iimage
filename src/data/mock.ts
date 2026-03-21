export type AssetStatus = "未填写" | "就绪" | "处理中" | "成功" | "失败";
export type OcrStatus = "idle" | "loading" | "ready" | "failed";

export interface OcrBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OcrBlock {
  id: string;
  text: string;
  score?: number;
  box: OcrBox;
}

export interface ModificationRule {
  id: string;
  label: string;
  sourceText: string;
  targetText: string;
}

export interface AssetItem {
  id: string;
  name: string;
  status: AssetStatus;
  width: number;
  height: number;
  previewUrl: string;
  uploadPreviewUrl?: string;
  uploadFile?: File;
  resultUrl?: string;
  notes: string;
  rules: ModificationRule[];
  ocrStatus: OcrStatus;
  ocrVisible: boolean;
  ocrBlocks: OcrBlock[];
  ocrErrorMessage?: string;
  errorMessage?: string;
}

export const MAX_ASSET_SLOTS = 6;
export const DEFAULT_RULE_COUNT = 10;

export const createEmptyRule = (index: number): ModificationRule => ({
  id: `rule-${crypto.randomUUID()}`,
  label: `字段${index}`,
  sourceText: "",
  targetText: "",
});

export const createDefaultRules = (count = DEFAULT_RULE_COUNT): ModificationRule[] =>
  Array.from({ length: count }, (_, index) => createEmptyRule(index + 1));

export const getRuntimeSeedAssets = ({
  isDev: _isDev,
}: {
  isDev: boolean;
}): AssetItem[] => [];

export const createDevelopmentAssetFromFile = (
  file: File,
  previewUrl: string,
  dimensions: { width: number; height: number },
  uploadPreviewUrl?: string,
): AssetItem => ({
  id: `asset-${crypto.randomUUID()}`,
  name: file.name,
  status: "未填写",
  width: dimensions.width,
  height: dimensions.height,
  previewUrl,
  uploadPreviewUrl,
  uploadFile: file,
  notes: "",
  rules: createDefaultRules(),
  ocrStatus: "idle",
  ocrVisible: false,
  ocrBlocks: [],
});
