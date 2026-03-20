export type AssetStatus = "未填写" | "就绪" | "处理中" | "成功" | "失败";

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
  resultUrl?: string;
  notes: string;
  rules: ModificationRule[];
  errorMessage?: string;
}

export const getRuntimeSeedAssets = ({
  isDev: _isDev,
}: {
  isDev: boolean;
}): AssetItem[] => [];

export const createDevelopmentAssetFromFile = (
  fileName: string,
  previewUrl: string,
  uploadPreviewUrl?: string,
): AssetItem => ({
  id: `asset-${crypto.randomUUID()}`,
  name: fileName,
  status: "未填写",
  width: 1600,
  height: 900,
  previewUrl,
  uploadPreviewUrl,
  notes: "",
  rules: [
    {
      id: `rule-${crypto.randomUUID()}`,
      label: "字段1",
      sourceText: "",
      targetText: "",
    },
  ],
});
