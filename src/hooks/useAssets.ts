import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  createDefaultRules,
  createEmptyRule,
  type AssetItem,
  type AssetStatus,
  MAX_ASSET_SLOTS,
  type OcrBlock,
  createDevelopmentAssetFromFile,
  getRuntimeSeedAssets,
} from "../data/mock";
import { createMediaClient } from "newapi-media-client";
import { proxyGatewayUrl } from "../dev-gateway-proxy";
import { generateImageWithChatCompletions } from "../chat-image-generator";
import { resizeBlobToSize } from "../image-size";
import {
  loadMediaSettings,
  saveMediaSettings,
} from "newapi-media-client/config";

const statusLabels: Record<AssetStatus, string> = {
  未填写: "Pending",
  就绪: "Ready",
  处理中: "Processing",
  成功: "Success",
  失败: "Failed",
};

const statusClasses: Record<AssetStatus, string> = {
  未填写: "badge badge-neutral",
  就绪: "badge badge-ready",
  处理中: "badge badge-running",
  成功: "badge badge-success",
  失败: "badge badge-failed",
};

const hasDraftInstructions = (asset: Pick<AssetItem, "notes" | "rules">) =>
  Boolean(
    asset.notes.trim() || asset.rules.some((rule) => rule.targetText.trim()),
  );

const hasSavedPrompt = (prompt?: string) => Boolean(prompt?.trim());

const normalizePrompt = (prompt?: string) => prompt?.trim() ?? "";

const draftStatus = (
  asset: Pick<AssetItem, "notes" | "rules">,
  savedPrompt?: string,
): AssetStatus =>
  hasSavedPrompt(savedPrompt) || hasDraftInstructions(asset) ? "就绪" : "未填写";

const clampParallelLimit = (value: number) => {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(10, Math.floor(value)));
};

const MAX_REFERENCE_BYTES = 2 * 1024 * 1024;
const MAX_REFERENCE_EDGE = 2048;

const blobToDataUri = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("参考图编码失败。"));
    reader.readAsDataURL(blob);
  });

const loadImageForResize = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("参考图读取失败。"));
    image.src = url;
  });

// 先按长边/质量压缩；最终编码大小由 buildReferenceDataUri 统一校验。
const compressBlobToDataUri = async (blob: Blob): Promise<string> => {
  const objectUrl = URL.createObjectURL(blob);
  let image: HTMLImageElement;

  try {
    image = await loadImageForResize(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    // 无 canvas 环境（测试/极端降级）：不压缩，但守住 2MB 上限
    if (blob.size > MAX_REFERENCE_BYTES) {
      throw new Error("参考图超过 2MB 且当前环境无法压缩。");
    }
    return blobToDataUri(blob);
  }

  const scale = Math.min(
    1,
    MAX_REFERENCE_EDGE / Math.max(image.naturalWidth || 1, image.naturalHeight || 1),
  );
  canvas.width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
  canvas.height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let quality = 0.9;
  let dataUri = canvas.toDataURL("image/jpeg", quality);
  while (dataUri.length > MAX_REFERENCE_BYTES && quality > 0.5) {
    quality -= 0.1;
    dataUri = canvas.toDataURL("image/jpeg", quality);
  }
  return dataUri;
};

const buildPrompt = (asset: AssetItem) => {
  const rules = asset.rules.filter(
    (rule) => rule.sourceText.trim() || rule.targetText.trim(),
  );
  
  const modificationList = rules.length
    ? rules
        .map((rule, index) => {
          const from = rule.sourceText.trim() || "(empty)";
          const to = rule.targetText.trim() || "(clear)";
          return `  ${index + 1}. Replace "${from}" with "${to}"`;
        })
        .join("\n")
    : "  - No structured text replacements provided. Follow common sense based on notes.";
    
  const notes = (asset.notes || "").trim() || "No additional notes.";

  return [
    "### Instruction",
    "Modify the image content based on the following rules. Maintain original style, lighting, and composition.",
    "CRITICAL: Keep the original image dimensions and aspect ratio identical. This is a local edit; ensure the rest of the image remains unchanged and seamless.",
    "Return exactly one edited image.",
    "Do not create a side-by-side comparison, before/after layout, collage, or split screen.",
    "Do not include the original image in the output.",
    "",
    "### Target File",
    asset.name,
    "",
    "### Modification List",
    modificationList,
    "",
    "### Additional Notes",
    notes,
    "",
    "### Output Format",
    "Provide the high-fidelty modified image. The result should be suitable for structured downstream JSON processing."
  ].join("\n");
};

const deriveStatus = (asset: AssetItem, savedPrompt?: string): AssetStatus => {
  if (asset.status === "处理中") return "处理中";
  if (asset.status === "失败" && asset.errorMessage) return "失败";
  if (asset.status === "成功" && asset.resultUrl) return "成功";
  if (asset.status === "就绪") return "就绪";
  return draftStatus(asset, savedPrompt);
};

const isImagesEndpointMissing = (error: unknown) => {
  const status = (error as { status?: unknown } | null)?.status;
  if (status === 404) return true;
  return /HTTP 404/.test(String((error as { message?: unknown } | null)?.message ?? ""));
};

const buildInitialPrompts = (assets: AssetItem[]) =>
  Object.fromEntries(
    assets
      .filter(
        (asset) =>
          (asset.rules && asset.rules.some((rule) => rule.targetText.trim())) ||
          (asset.notes && asset.notes.trim()),
      )
      .map((asset) => [asset.id, buildPrompt(asset)]),
  );

const readImageDimensions = async (previewUrl: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
      });
    };
    image.onerror = () => {
      reject(new Error("无法读取图片尺寸。"));
    };
    image.src = previewUrl;
  });

const resolveMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message.trim() ? error.message : fallback;

const createUploadAsset = async (file: File) => {
  const previewUrl = URL.createObjectURL(file);

  try {
    const dimensions = await readImageDimensions(previewUrl);
    return createDevelopmentAssetFromFile(file, previewUrl, dimensions, previewUrl);
  } catch (error) {
    URL.revokeObjectURL(previewUrl);
    throw error;
  }
};

const buildUploadFailureMessage = (
  failedFiles: Array<{ fileName: string; message: string }>,
  successCount: number,
) => {
  if (failedFiles.length === 0) {
    return null;
  }

  if (failedFiles.length === 1 && successCount === 0) {
    return failedFiles[0].message;
  }

  const detail = failedFiles
    .map(({ fileName, message }) => `${fileName}：${message}`)
    .join("；");

  if (successCount > 0) {
    return `已导入 ${successCount} 张，${failedFiles.length} 张失败：${detail}`;
  }

  return `${failedFiles.length} 张图片上传失败：${detail}`;
};

const buildUploadCapacityMessage = (ignoredCount: number) => {
  if (ignoredCount <= 0) return null;
  return `B区最多只能放 ${MAX_ASSET_SLOTS} 张图片，已忽略 ${ignoredCount} 张。`;
};

const joinMessages = (...messages: Array<string | null>) => {
  const visibleMessages = messages
    .map((message) => message?.trim())
    .filter((message): message is string => Boolean(message));

  if (visibleMessages.length === 0) {
    return null;
  }

  return visibleMessages.join(" ");
};

const requestLocalOcr = async (file: File): Promise<{ blocks: OcrBlock[] }> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/ocr", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let message = `OCR request failed (${response.status}).`;

    try {
      const payload = await response.json();
      if (typeof payload?.detail === "string" && payload.detail.trim()) {
        message = payload.detail;
      }
    } catch {
      // Keep the HTTP fallback message.
    }

    throw new Error(message);
  }

  const payload = await response.json();
  return {
    blocks: Array.isArray(payload?.blocks) ? payload.blocks : [],
  };
};

// 标准尺寸映射留在业务侧（adapter 包不导出 snapSize）：按宽高比对数距离取最近档位
const STANDARD_SIZES: Array<[number, number]> = [
  [1024, 1024],
  [1536, 1024],
  [1024, 1536],
];

const snapSize = (width: number, height: number): string => {
  const ratio = Math.log(width / height);
  let best = STANDARD_SIZES[0];
  let bestDistance = Infinity;
  for (const size of STANDARD_SIZES) {
    const distance = Math.abs(ratio - Math.log(size[0] / size[1]));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = size;
    }
  }
  return `${best[0]}x${best[1]}`;
};

export interface MediaGatewaySettings {
  baseUrl: string;
  /** 仅内存保存（仅本地开发模式），刷新即失效，永不写入 localStorage */
  token: string;
  imageModel: string;
  imageSize: string;
  parallelLimit: number;
}

export const useAssets = () => {
  const initialAssets = getRuntimeSeedAssets({ isDev: import.meta.env.DEV });
  const [batchName, setBatchName] = useState("Untitled Batch");
  const [assets, setAssets] = useState<AssetItem[]>(() => initialAssets);
  const [selectedId, setSelectedId] = useState<string>(initialAssets[0]?.id ?? "");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [ocrTargetRuleId, setOcrTargetRuleId] = useState<string>(
    initialAssets[0]?.rules[0]?.id ?? "",
  );
  const [previewMode, setPreviewMode] = useState<"before" | "after">("before");
  const [savedPrompts, setSavedPrompts] = useState<Record<string, string>>(
    () => buildInitialPrompts(initialAssets),
  );
  const [promptDraft, setPromptDraft] = useState("");
  const [batchMessage, setBatchMessage] = useState<string | null>(null);
  const [settings, setSettings] = useState<MediaGatewaySettings>(() => {
    // 旧版本把网关令牌持久化在 iimage-gateway 键里，按凭证红线清除
    localStorage.removeItem("iimage-gateway");
    const persisted = loadMediaSettings();
    return {
      baseUrl: persisted.baseUrl,
      token: "",
      imageModel: persisted.imageModel,
      imageSize: persisted.imageSize,
      parallelLimit: 3,
    };
  });
  const [batchPhase, setBatchPhase] = useState<
    "idle" | "preparing" | "requesting" | "finishing"
  >("idle");
  const [batchProgress, setBatchProgress] = useState({
    total: 0,
    remaining: 0,
  });

  const updateSettings = (newSettings: Partial<MediaGatewaySettings>) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        ...newSettings,
        parallelLimit:
          newSettings.parallelLimit === undefined
            ? prev.parallelLimit
            : clampParallelLimit(newSettings.parallelLimit),
      };
      // 只持久化非敏感配置；令牌永不落盘。URL 非法时跳过持久化，
      // 由连接测试和生图请求把真实错误暴露给用户
      try {
        saveMediaSettings({
          baseUrl: next.baseUrl,
          analysisModel: "",
          imageModel: next.imageModel,
          imageSize: next.imageSize,
        });
      } catch {
        /* baseUrl 未通过 adapter 校验时不持久化 */
      }
      return next;
    });
  };

  const selectedIdRef = useRef(selectedId);
  const logsRef = useRef<string[]>([]);

  const appendLog = (line: string) => {
    const stamp = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    const entry = `[${stamp}] ${line}`;
    logsRef.current = [...logsRef.current.slice(-199), entry];
    setLogs(logsRef.current);
  };

  const clearLogs = () => {
    logsRef.current = [];
    setLogs([]);
  };

  const assetsRef = useRef<AssetItem[]>(assets);
  const ocrTargetRuleIdRef = useRef(ocrTargetRuleId);
  const savedPromptsRef = useRef<Record<string, string>>(savedPrompts);
  const batchRunIdRef = useRef(0);
  const batchAbortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const activeBatchPendingIdsRef = useRef<Set<string>>(new Set());
  const batchPhaseCountsRef = useRef({
    preparing: 0,
    requesting: 0,
    finishing: 0,
  });

  const syncBatchPhase = () => {
    const phases = batchPhaseCountsRef.current;
    if (phases.requesting > 0) {
      setBatchPhase("requesting");
      return;
    }
    if (phases.preparing > 0) {
      setBatchPhase("preparing");
      return;
    }
    if (phases.finishing > 0) {
      setBatchPhase("finishing");
      return;
    }
    setBatchPhase("idle");
  };

  const resetBatchPhases = () => {
    batchPhaseCountsRef.current = {
      preparing: 0,
      requesting: 0,
      finishing: 0,
    };
    setBatchPhase("idle");
  };

  const enterBatchPhase = (phase: "preparing" | "requesting" | "finishing") => {
    batchPhaseCountsRef.current[phase] += 1;
    syncBatchPhase();
    return () => {
      batchPhaseCountsRef.current[phase] = Math.max(
        0,
        batchPhaseCountsRef.current[phase] - 1,
      );
      syncBatchPhase();
    };
  };

  const resetBatchTracking = () => {
    activeBatchPendingIdsRef.current.clear();
    setBatchProgress({
      total: 0,
      remaining: 0,
    });
    resetBatchPhases();
  };

  const beginBatchTracking = (assetIds: string[]) => {
    activeBatchPendingIdsRef.current = new Set(assetIds);
    setBatchProgress({
      total: assetIds.length,
      remaining: assetIds.length,
    });
  };

  const settleBatchAsset = (id: string, mode: "done" | "removed" = "done") => {
    if (!activeBatchPendingIdsRef.current.has(id)) return;
    activeBatchPendingIdsRef.current.delete(id);

    setBatchProgress((prev) => {
      if (mode === "done") {
        return {
          total: prev.total,
          remaining: Math.max(0, prev.remaining - 1),
        };
      }

      return {
        total: Math.max(0, prev.total - 1),
        remaining: Math.max(0, prev.remaining - 1),
      };
    });
  };

  const abortTrackedRequest = (id: string) => {
    const controller = batchAbortControllersRef.current.get(id);
    if (!controller) return;
    controller.abort();
    batchAbortControllersRef.current.delete(id);
  };

  const abortAllTrackedRequests = () => {
    batchAbortControllersRef.current.forEach((controller) => controller.abort());
    batchAbortControllersRef.current.clear();
  };

  const currentAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedId) || null,
    [assets, selectedId],
  );

  const currentPrompt = currentAsset
    ? savedPrompts[currentAsset.id] ??
      (hasDraftInstructions(currentAsset) ? buildPrompt(currentAsset) : "")
    : undefined;

  const isCurrentPromptDirty = Boolean(currentAsset) &&
    normalizePrompt(promptDraft) !== normalizePrompt(currentPrompt);

  const canStartBatch = useMemo(
    () =>
      selectedIds.some((id) => {
        const asset = assets.find((item) => item.id === id);
        if (!asset) return false;
        return (
          deriveStatus(asset, savedPrompts[asset.id]) === "就绪" &&
          !(asset.id === selectedId && isCurrentPromptDirty)
        );
      }),
    [assets, isCurrentPromptDirty, savedPrompts, selectedId, selectedIds],
  );

  const stats = useMemo(() => {
    const total = assets.length;
    const ready = assets.filter(
      (asset) =>
        deriveStatus(asset, savedPrompts[asset.id]) === "就绪" &&
        !(asset.id === selectedId && isCurrentPromptDirty),
    ).length;
    const running = assets.filter((asset) => asset.status === "处理中").length;
    const success = assets.filter((asset) => asset.status === "成功").length;
    const failed = assets.filter((asset) => asset.status === "失败").length;
    const done = success + failed;

    const progress =
      batchProgress.total === 0
        ? 0
        : Math.round(
            ((batchProgress.total - batchProgress.remaining) / batchProgress.total) *
              100,
          );

    return { total, ready, running, success, failed, done, progress };
  }, [assets, batchProgress, isCurrentPromptDirty, savedPrompts, selectedId]);

  useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    ocrTargetRuleIdRef.current = ocrTargetRuleId;
  }, [ocrTargetRuleId]);

  useEffect(() => {
    savedPromptsRef.current = savedPrompts;
  }, [savedPrompts]);

  // 长时间挂后台后 blob: 地址可能失效；用原文件/结果 Blob 重建地址即可恢复显示
  const restoreAssetObjectUrl = (assetId: string, mode: "before" | "after") => {
    setAssets((prev) =>
      prev.map((item) => {
        if (item.id !== assetId) return item;
        if (mode === "after") {
          if (!item.resultBlob) return item;
          revokeResultUrl(item);
          return { ...item, resultUrl: URL.createObjectURL(item.resultBlob) };
        }
        if (!item.uploadFile) return item;
        if (item.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(item.previewUrl);
        return { ...item, previewUrl: URL.createObjectURL(item.uploadFile) };
      }),
    );
  };

  const revokeResultUrl = (asset: AssetItem) => {
    if (asset.resultUrl?.startsWith("blob:")) URL.revokeObjectURL(asset.resultUrl);
  };

  const revokeAssetUrls = (asset: AssetItem) => {
    if (asset.uploadPreviewUrl) URL.revokeObjectURL(asset.uploadPreviewUrl);
    revokeResultUrl(asset);
  };

  useEffect(() => {
    return () => {
      batchRunIdRef.current += 1;
      abortAllTrackedRequests();
      resetBatchPhases();
      // 这里不再统一 revoke：开发态热更新会重挂组件，assets 里的 blob URL 还在用，
      // 撤销后预览就变破图。删除/替换时已各自 revoke。
      activeBatchPendingIdsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!assets.some((asset) => asset.id === selectedId)) {
       if (assets.length > 0) {
          setSelectedId(assets[0].id);
       } else {
          setSelectedId("");
       }
    }
  }, [assets, selectedId]);

  useEffect(() => {
    setPromptDraft(currentPrompt ?? "");
  }, [currentAsset, currentPrompt]);

  useEffect(() => {
    const fallbackRuleId = currentAsset?.rules[0]?.id ?? "";
    const targetStillExists = currentAsset?.rules.some(
      (rule) => rule.id === ocrTargetRuleId,
    );

    if (!targetStillExists && ocrTargetRuleId !== fallbackRuleId) {
      ocrTargetRuleIdRef.current = fallbackRuleId;
      setOcrTargetRuleId(fallbackRuleId);
    }
  }, [currentAsset, ocrTargetRuleId]);

  const selectAsset = (id: string) => {
    setSelectedId(id);
    setPreviewMode("before");
    setBatchMessage(null);
    const targetAsset = assetsRef.current.find((asset) => asset.id === id);
    const nextRuleId = targetAsset?.rules[0]?.id ?? "";
    ocrTargetRuleIdRef.current = nextRuleId;
    setOcrTargetRuleId(nextRuleId);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const updateRule = (ruleId: string, key: "sourceText" | "targetText", value: string) => {
    setAssets((prev) =>
      prev.map((asset) => {
        if (asset.id !== selectedId) return asset;
        revokeResultUrl(asset);
        const nextRules = asset.rules.map((rule) =>
          rule.id === ruleId ? { ...rule, [key]: value } : rule,
        );
        const next = {
          ...asset,
          rules: nextRules,
          resultUrl: undefined,
          errorMessage: undefined,
        };
        return {
          ...next,
          status: draftStatus(next),
        };
      }),
    );
    setSavedPrompts((prev) => {
      if (!(selectedId in prev)) return prev;
      const next = { ...prev };
      delete next[selectedId];
      return next;
    });
  };

  const setOcrTargetRule = (ruleId: string) => {
    ocrTargetRuleIdRef.current = ruleId;
    setOcrTargetRuleId(ruleId);
  };

  const applyOcrTextToTarget = (text: string) => {
    const nextText = text.trim();
    if (!selectedId || !nextText) return;
    const activeAsset = assetsRef.current.find((asset) => asset.id === selectedId);
    if (!activeAsset) return;

    const fallbackRuleId = activeAsset.rules[0]?.id ?? "";
    const activeTargetRuleId = activeAsset.rules.some(
      (rule) => rule.id === ocrTargetRuleIdRef.current,
    )
      ? ocrTargetRuleIdRef.current
      : fallbackRuleId;
    const activeTargetIndex = activeAsset.rules.findIndex(
      (rule) => rule.id === activeTargetRuleId,
    );
    const resolvedTargetIndex = activeTargetIndex >= 0 ? activeTargetIndex : 0;
    const targetRuleId = activeAsset.rules[resolvedTargetIndex]?.id ?? fallbackRuleId;
    const nextTargetRuleId =
      activeAsset.rules[
        Math.min(resolvedTargetIndex + 1, Math.max(0, activeAsset.rules.length - 1))
      ]?.id ?? targetRuleId;

    setAssets((prev) =>
      prev.map((asset) => {
        if (asset.id !== selectedId) return asset;
        revokeResultUrl(asset);

        const nextRules = asset.rules.map((rule) =>
          rule.id === targetRuleId ? { ...rule, sourceText: nextText } : rule,
        );

        const next = {
          ...asset,
          rules: nextRules,
          resultUrl: undefined,
          errorMessage: undefined,
        };

        return {
          ...next,
          status: draftStatus(next),
        };
      }),
    );

    ocrTargetRuleIdRef.current = nextTargetRuleId;
    setOcrTargetRuleId(nextTargetRuleId);

    setSavedPrompts((prev) => {
      if (!(selectedId in prev)) return prev;
      const next = { ...prev };
      delete next[selectedId];
      return next;
    });
  };

  const updateNotes = (value: string) => {
    setAssets((prev) =>
      prev.map((asset) => {
        if (asset.id !== selectedId) return asset;
        revokeResultUrl(asset);
        const next = {
          ...asset,
          notes: value,
          resultUrl: undefined,
          errorMessage: undefined,
        };
        return { ...next, status: draftStatus(next) };
      }),
    );
    setSavedPrompts((prev) => {
      if (!(selectedId in prev)) return prev;
      const next = { ...prev };
      delete next[selectedId];
      return next;
    });
  };

  const insertRuleAfter = (ruleId: string) => {
    setAssets((prev) =>
      prev.map((asset) => {
        if (asset.id !== selectedId) return asset;
        revokeResultUrl(asset);
        const insertIndex = asset.rules.findIndex((rule) => rule.id === ruleId);
        const nextRule = createEmptyRule(asset.rules.length + 1);
        const nextRules = [...asset.rules];
        if (insertIndex === -1) {
          nextRules.push(nextRule);
        } else {
          nextRules.splice(insertIndex + 1, 0, nextRule);
        }
        return {
          ...asset,
          rules: nextRules,
          resultUrl: undefined,
          errorMessage: undefined,
          status: draftStatus({ ...asset, rules: nextRules }),
        };
      }),
    );
    setSavedPrompts((prev) => {
      if (!(selectedId in prev)) return prev;
      const next = { ...prev };
      delete next[selectedId];
      return next;
    });
  };

  const removeRule = (ruleId: string) => {
    setAssets((prev) =>
      prev.map((asset) => {
        if (asset.id !== selectedId) return asset;
        revokeResultUrl(asset);
        const nextRules = asset.rules.length > 1
          ? asset.rules.filter((rule) => rule.id !== ruleId)
          : asset.rules.map((rule) => rule.id === ruleId ? { ...rule, sourceText: "", targetText: "" } : rule);
        const next = {
          ...asset,
          rules: nextRules,
          resultUrl: undefined,
          errorMessage: undefined,
        };
        return { ...next, status: draftStatus(next) };
      }),
    );
    setSavedPrompts((prev) => {
      if (!(selectedId in prev)) return prev;
      const next = { ...prev };
      delete next[selectedId];
      return next;
    });
  };

  const clearCurrent = () => {
    const nextRules = createDefaultRules();

    setAssets((prev) =>
      prev.map((asset) => {
        if (asset.id !== selectedId) return asset;
        revokeResultUrl(asset);
        return {
          ...asset,
          status: "未填写",
          notes: "",
          errorMessage: undefined,
          resultUrl: undefined,
          rules: nextRules,
        };
      }),
    );
    const nextRuleId = nextRules[0]?.id ?? "";
    ocrTargetRuleIdRef.current = nextRuleId;
    setOcrTargetRuleId(nextRuleId);
    setSavedPrompts((prev) => {
      const next = { ...prev };
      delete next[selectedId];
      return next;
    });
    setBatchMessage(null);
  };

  // 参考图 → data:URI；包含 base64 开销后的大小也必须 ≤2MB。
  const buildReferenceDataUri = async (
    asset: AssetItem,
    signal?: AbortSignal,
  ): Promise<string> => {
    const blob = asset.uploadFile ?? await (
      await fetch(asset.uploadPreviewUrl || asset.previewUrl, { signal })
    ).blob();
    const dataUri = await compressBlobToDataUri(blob);
    if (dataUri.length > MAX_REFERENCE_BYTES) {
      throw new Error("参考图编码后仍超过 2MB，请缩小图片后重试。");
    }
    return dataUri;
  };

  const resetRunningAssetsToDraft = () => {
    setAssets((prev) =>
      prev.map((asset) =>
        asset.status === "处理中"
          ? {
              ...asset,
              status: draftStatus(asset, savedPromptsRef.current[asset.id]),
              errorMessage: undefined,
            }
          : asset,
      ),
    );
  };

  const runOcrForAsset = async (assetId: string, file: File) => {
    setAssets((prev) =>
      prev.map((asset) =>
        asset.id !== assetId
          ? asset
          : {
              ...asset,
              ocrStatus: "loading",
              ocrVisible: false,
              ocrBlocks: [],
              ocrErrorMessage: undefined,
            },
      ),
    );

    try {
      const payload = await requestLocalOcr(file);

      setAssets((prev) =>
        prev.map((asset) =>
          asset.id !== assetId
            ? asset
            : {
                ...asset,
                ocrStatus: "ready",
                ocrVisible: false,
                ocrBlocks: payload.blocks,
                ocrErrorMessage: undefined,
              },
        ),
      );
      appendLog(`OCR 完成：识别到 ${payload.blocks.length} 段文字`);
    } catch (error: any) {
      appendLog(`OCR 失败：${error?.message || "OCR request failed."}`);
      setAssets((prev) =>
        prev.map((asset) =>
          asset.id !== assetId
            ? asset
            : {
                ...asset,
                ocrStatus: "failed",
                ocrVisible: false,
                ocrBlocks: [],
                ocrErrorMessage: error?.message || "OCR request failed.",
              },
        ),
      );
    }
  };

  const runCurrentOcr = async () => {
    const asset = assetsRef.current.find((item) => item.id === selectedId);
    if (!asset?.uploadFile) {
      setBatchMessage("当前图片没有可识别的原始文件。");
      return;
    }

    setBatchMessage(null);
    await runOcrForAsset(asset.id, asset.uploadFile);
  };

  const toggleCurrentOcrVisibility = () => {
    if (!selectedId) return;

    setAssets((prev) =>
      prev.map((asset) =>
        asset.id !== selectedId || asset.ocrStatus !== "ready" || asset.ocrBlocks.length === 0
          ? asset
          : {
              ...asset,
              ocrVisible: !asset.ocrVisible,
            },
      ),
    );
  };

  const startBatch = async () => {
    if (currentAsset && isCurrentPromptDirty) {
      setBatchMessage("C区内容改了但还没保存，请先点保存。");
      return;
    }

    if (selectedIds.length === 0) {
      setBatchMessage("请先勾选要生成的图片。");
      return;
    }

    if (!settings.token.trim()) {
      setBatchMessage("请先在系统设置里填写网关令牌。");
      return;
    }

    if (!settings.baseUrl.trim() || !settings.imageModel.trim()) {
      setBatchMessage("请先在系统设置里完成网关连接并选择生图模型。");
      return;
    }

    // adapter 是传输协议、鉴权与响应校验的唯一 source of truth；
    // 配置非法（Base URL/令牌）时其同步抛错直接进入失败提示
    let client: ReturnType<typeof createMediaClient>;
    try {
      client = createMediaClient({
        baseUrl: proxyGatewayUrl(settings.baseUrl, false),
        key: settings.token,
        imageModel: settings.imageModel,
        imageSize: settings.imageSize,
      });
    } catch (error) {
      setBatchMessage(resolveMessage(error, "网关配置无效，请检查系统设置。"));
      return;
    }

    const readyItems = assetsRef.current.filter(
      (asset) =>
        selectedIds.includes(asset.id) &&
        deriveStatus(asset, savedPromptsRef.current[asset.id]) === "就绪",
    );
    if (readyItems.length === 0) {
      setBatchMessage("勾选的图片里没有可生成项。");
      return;
    }

    setBatchMessage(null);
    appendLog(`开始生成：${readyItems.length} 张，模型 ${settings.imageModel}`);
    batchRunIdRef.current += 1;
    const runId = batchRunIdRef.current;
    const parallelLimit = Math.min(
      clampParallelLimit(settings.parallelLimit),
      readyItems.length,
    );
    beginBatchTracking(readyItems.map((asset) => asset.id));
    const readyItemIds = new Set(readyItems.map((asset) => asset.id));

    setAssets((prev) =>
      prev.map((asset) =>
        !readyItemIds.has(asset.id)
          ? asset
          : { ...asset, status: "处理中", errorMessage: undefined },
      ),
    );

    let cursor = 0;
    const batchFailures: string[] = [];

    const runNext = async (): Promise<void> => {
      const asset = readyItems[cursor++];

      if (!asset || batchRunIdRef.current !== runId) {
        return;
      }

      const liveAsset = assetsRef.current.find((item) => item.id === asset.id);

      if (!liveAsset) {
        settleBatchAsset(asset.id, "removed");
        await runNext();
        return;
      }

      const controller = new AbortController();
      let leavePhase = enterBatchPhase("preparing");

      batchAbortControllersRef.current.set(asset.id, controller);

      try {
        const referenceImage = await buildReferenceDataUri(liveAsset, controller.signal);
        leavePhase();
        leavePhase = enterBatchPhase("requesting");
        const prompt = savedPromptsRef.current[asset.id] ?? buildPrompt(liveAsset);

        // 有些网关只开放聊天接口出图（Images API 直接 404），这时回退到聊天接口
        let imageUrl: string;
        try {
          const image = await client.generateImage(prompt, {
            model: settings.imageModel,
            images: [referenceImage],
            size: snapSize(liveAsset.width, liveAsset.height),
            signal: controller.signal,
          });
          imageUrl = image.url;
        } catch (error) {
          if (!isImagesEndpointMissing(error)) throw error;
          imageUrl = await generateImageWithChatCompletions({
            baseUrl: proxyGatewayUrl(settings.baseUrl, false),
            key: settings.token,
            model: settings.imageModel,
            prompt: `${prompt}\n\n保持与原截图相同的版式、构图与画面比例，只在原位置修改文字，不要重新排版。`,
            images: [referenceImage],
            signal: controller.signal,
          });
        }

        // G5：渠道链接普遍 24h 过期，拿到即下载转存为本地 blob URL；取消信号贯穿下载
        const bytes = await client.download(proxyGatewayUrl(imageUrl, true), {
          signal: controller.signal,
        });
        if (bytes.byteLength === 0) {
          throw new Error("网关返回的结果为空，请检查网关响应。");
        }
        // 出图保持模型原始像素，不拉伸；尺寸差异只在导出时处理
        const resultBlob = new Blob([bytes as unknown as BlobPart], { type: "image/png" });
        const resultUrl = URL.createObjectURL(resultBlob);

        if (batchRunIdRef.current !== runId || controller.signal.aborted) {
          URL.revokeObjectURL(resultUrl);
          return;
        }

        try {
          const dimensions = await readImageDimensions(resultUrl);
          if (dimensions.width <= 0 || dimensions.height <= 0) {
            throw new Error("图片尺寸无效。");
          }
        } catch {
          URL.revokeObjectURL(resultUrl);
          throw new Error("网关返回的结果无法读取为图片，请检查网关响应。");
        }

        // 解码期间也可能停止/清空；无效或取消的结果不能回填，也不能泄漏 Blob。
        if (batchRunIdRef.current !== runId || controller.signal.aborted) {
          URL.revokeObjectURL(resultUrl);
          return;
        }

        leavePhase();
        leavePhase = enterBatchPhase("finishing");

        setAssets((prev) =>
          prev.map((item) => {
            if (item.id !== asset.id) return item;
            revokeResultUrl(item);
            return {
              ...item,
              status: "成功",
              resultUrl,
              resultBlob,
              errorMessage: undefined,
            };
          }),
        );
        appendLog(`成功：${asset.name}`);
        if (asset.id === selectedIdRef.current) {
          setPreviewMode("after");
        }
        settleBatchAsset(asset.id);
      } catch (error: any) {
        if (controller.signal.aborted || batchRunIdRef.current !== runId) {
          return;
        }

        const failureMessage = error.message || "生成请求失败。";
        batchFailures.push(failureMessage);
        appendLog(`失败：${asset.name} → ${failureMessage}`);
        setAssets((prev) =>
          prev.map((item) =>
            item.id !== asset.id
              ? item
              : {
                  ...item,
                  status: "失败",
                  errorMessage: failureMessage,
                },
          ),
        );
        settleBatchAsset(asset.id);
      } finally {
        leavePhase();
        batchAbortControllersRef.current.delete(asset.id);
      }

      if (batchRunIdRef.current === runId) {
        await runNext();
      }
    };

    await Promise.all(Array.from({ length: parallelLimit }, () => runNext()));

    if (batchRunIdRef.current === runId) {
      setBatchMessage(
        batchFailures.length === 0
          ? "Batch processing finished."
          : `Batch processing finished. ${batchFailures.length} 张失败：${batchFailures[0]}`,
      );
      resetBatchPhases();
    }
  };

  const pauseBatch = () => {
    batchRunIdRef.current += 1;
    abortAllTrackedRequests();
    resetRunningAssetsToDraft();
    resetBatchTracking();
    setBatchMessage("Batch processing cancelled.");
  };

  const rerunFailed = () => {
    setAssets((prev) =>
      prev.map((asset) =>
        asset.status === "失败" ? { ...asset, status: "就绪", errorMessage: undefined } : asset,
      ),
    );
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const availableSlots = Math.max(0, MAX_ASSET_SLOTS - assetsRef.current.length);

    if (availableSlots === 0) {
      setBatchMessage(`B区最多只能放 ${MAX_ASSET_SLOTS} 张图片。`);
      return;
    }

    const acceptedFiles = Array.from(files).slice(0, availableSlots);
    const ignoredCount = Math.max(0, files.length - acceptedFiles.length);

    const uploadResults = await Promise.all(
      acceptedFiles.map(async (file) => {
        try {
          const asset = await createUploadAsset(file);
          return { ok: true as const, asset };
        } catch (error) {
          return {
            ok: false as const,
            fileName: file.name,
            message: resolveMessage(error, "上传图片失败。"),
          };
        }
      }),
    );

    const newAssets = uploadResults.flatMap((result) =>
      result.ok ? [result.asset] : [],
    );
    const failedFiles = uploadResults.flatMap((result) =>
      result.ok ? [] : [{ fileName: result.fileName, message: result.message }],
    );

    for (const failed of failedFiles) {
      appendLog(`上传失败：${failed.fileName} → ${failed.message}`);
    }

    if (newAssets[0]) {
      setAssets((prev) => [...prev, ...newAssets]);
      setSelectedId(newAssets[0].id);
      setPreviewMode("before");
      const nextRuleId = newAssets[0].rules[0]?.id ?? "";
      ocrTargetRuleIdRef.current = nextRuleId;
      setOcrTargetRuleId(nextRuleId);
    }

    setBatchMessage(
      joinMessages(
        buildUploadFailureMessage(failedFiles, newAssets.length),
        buildUploadCapacityMessage(ignoredCount),
      ),
    );
  };

  const handleSlotUpload = async (files: FileList | null, index: number) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    let newAsset: AssetItem;

    try {
      newAsset = await createUploadAsset(file);
    } catch (error) {
      setBatchMessage(resolveMessage(error, "上传图片失败。"));
      return;
    }

    const replacedAsset = assetsRef.current[index];

    if (replacedAsset) {
      abortTrackedRequest(replacedAsset.id);
      settleBatchAsset(replacedAsset.id, "removed");
      setSavedPrompts((prev) => {
        if (!(replacedAsset.id in prev)) return prev;
        const next = { ...prev };
        delete next[replacedAsset.id];
        return next;
      });
      setSelectedIds((prev) => prev.filter((id) => id !== replacedAsset.id));
    }

    setAssets(prev => {
      const next = [...prev];
      if (index < next.length) {
        if (next[index]) revokeAssetUrls(next[index]);
        next[index] = newAsset;
      } else {
        next.push(newAsset);
      }
      return next;
    });
    setSelectedId(newAsset.id);
    setPreviewMode("before");
    const nextRuleId = newAsset.rules[0]?.id ?? "";
    ocrTargetRuleIdRef.current = nextRuleId;
    setOcrTargetRuleId(nextRuleId);
    setBatchMessage(null);
  };

  const deleteAsset = (id: string) => {
    abortTrackedRequest(id);
    settleBatchAsset(id, "removed");
    setAssets(prev => {
      const asset = prev.find(a => a.id === id);
      if (asset) revokeAssetUrls(asset);
      return prev.filter(a => a.id !== id);
    });
    setSavedPrompts(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setSelectedIds(prev => prev.filter(i => i !== id));
  };

  const clearAllImages = () => {
    batchRunIdRef.current += 1;
    abortAllTrackedRequests();
    assetsRef.current.forEach(revokeAssetUrls);
    setAssets([]);
    setSelectedId("");
    setSelectedIds([]);
    ocrTargetRuleIdRef.current = "";
    setOcrTargetRuleId("");
    setSavedPrompts({});
    resetBatchTracking();
    setBatchMessage(null);
  };

  // 导出时若结果尺寸与原图不同，按原图尺寸等比缩放留白，避免画面被拉伸
  const triggerAssetDownload = async (asset: AssetItem) => {
    if (!asset.resultUrl) return;

    let href = asset.resultUrl;
    let temporary = false;

    if (asset.resultBlob) {
      try {
        const fitted = await resizeBlobToSize(asset.resultBlob, asset.width, asset.height);
        if (fitted) {
          href = URL.createObjectURL(fitted.blob);
          temporary = true;
        }
      } catch {
        href = asset.resultUrl;
      }
    }

    const link = document.createElement("a");
    link.href = href;
    link.download = `edited_${asset.name}`;
    link.click();

    if (temporary) {
      setTimeout(() => URL.revokeObjectURL(href), 5000);
    }
  };

  const downloadSelected = () => {
    if (selectedIds.length === 0) {
      setBatchMessage("Please select images to download.");
      return;
    }
    selectedIds.forEach((id) => {
      const asset = assets.find((a) => a.id === id);
      if (asset) void triggerAssetDownload(asset);
    });
  };

  const downloadCurrentResult = () => {
    const asset = assetsRef.current.find((item) => item.id === selectedId);
    if (!asset) return;
    void triggerAssetDownload(asset);
  };

  const savePrompt = () => {
    const assetToSave = assetsRef.current.find((asset) => asset.id === selectedId);
    if (!assetToSave) return;
    const nextPrompt = promptDraft.trim();
    setSavedPrompts((prev) => {
      if (!nextPrompt) {
        if (!(assetToSave.id in prev)) return prev;
        const next = { ...prev };
        delete next[assetToSave.id];
        return next;
      }
      return { ...prev, [assetToSave.id]: promptDraft };
    });
    setAssets((prev) =>
      prev.map((asset) => {
        if (asset.id !== assetToSave.id) return asset;
        revokeResultUrl(asset);
        const next = {
          ...asset,
          resultUrl: undefined,
          errorMessage: undefined,
        };
        return { ...next, status: draftStatus(next, nextPrompt) };
      }),
    );
    setBatchMessage("Full Prompt saved to current image.");
  };

  const restoreGeneratedPrompt = () => {
    const assetToSave = assetsRef.current.find((asset) => asset.id === selectedId);
    if (!assetToSave) return;
    const nextPrompt = buildPrompt(assetToSave);
    setSavedPrompts((prev) => ({ ...prev, [assetToSave.id]: nextPrompt }));
    setPromptDraft(nextPrompt);
    setAssets((prev) =>
      prev.map((asset) => {
        if (asset.id !== assetToSave.id) return asset;
        revokeResultUrl(asset);
        const next = {
          ...asset,
          resultUrl: undefined,
          errorMessage: undefined,
        };
        return { ...next, status: draftStatus(next, nextPrompt) };
      }),
    );
    setBatchMessage(null);
  };

  return {
    batchName,
    setBatchName,
    assets,
    setAssets,
    selectedId,
    setSelectedId,
    selectedIds,
    setSelectedIds,
    previewMode,
    setPreviewMode,
    currentAsset,
    stats,
    currentPrompt,
    promptDraft,
    setPromptDraft,
    batchMessage,
    ocrTargetRuleId,
    runCurrentOcr,
    toggleCurrentOcrVisibility,
    selectAsset,
    toggleSelection,
    updateRule,
    setOcrTargetRule,
    applyOcrTextToTarget,
    restoreAssetObjectUrl,
    updateNotes,
    insertRuleAfter,
    removeRule,
    clearCurrent,
    startBatch,
    pauseBatch,
    rerunFailed,
    handleUpload,
    handleSlotUpload,
    deleteAsset,
    clearAllImages,
    downloadSelected,
    downloadCurrentResult,
    savePrompt,
    restoreGeneratedPrompt,
    statusLabels,
    statusClasses,
    settings,
    updateSettings,
    batchPhase,
    canStartBatch,
    logs,
    clearLogs,
  };
};
