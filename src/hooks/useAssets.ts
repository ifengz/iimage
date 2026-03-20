import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  type AssetItem,
  type AssetStatus,
  createDevelopmentAssetFromFile,
  getRuntimeSeedAssets,
} from "../data/mock";
import {
  GoogleGenerativeAI,
  type GenerateContentResponse,
} from "@google/generative-ai";

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

const createEmptyRule = (index: number) => ({
  id: `rule-${Date.now()}-${index}`,
  label: `Field ${index}`,
  sourceText: "",
  targetText: "",
});

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

const inferMimeType = (assetName: string, blobType?: string) => {
  if (blobType) return blobType;

  const extension = assetName.split(".").pop()?.toLowerCase();
  const mimeByExtension: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
  };

  return mimeByExtension[extension ?? ""] ?? "image/png";
};

const extractResultImageUrl = (response: GenerateContentResponse) => {
  const imagePart = response.candidates
    ?.flatMap((candidate) => candidate.content.parts)
    .find((part) => "inlineData" in part && part.inlineData?.data);

  if (!imagePart || !("inlineData" in imagePart)) {
    return null;
  }

  const inlineData = imagePart.inlineData;
  if (!inlineData?.data) {
    return null;
  }

  const mimeType = inlineData.mimeType || "image/png";
  return `data:${mimeType};base64,${inlineData.data}`;
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

export const useAssets = () => {
  const initialAssets = getRuntimeSeedAssets({ isDev: import.meta.env.DEV });
  const [batchName, setBatchName] = useState("Untitled Batch");
  const [assets, setAssets] = useState<AssetItem[]>(() => initialAssets);
  const [selectedId, setSelectedId] = useState<string>(initialAssets[0]?.id ?? "");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewMode, setPreviewMode] = useState<"before" | "after">("before");
  const [savedPrompts, setSavedPrompts] = useState<Record<string, string>>(
    () => buildInitialPrompts(initialAssets),
  );
  const [promptDraft, setPromptDraft] = useState("");
  const [batchMessage, setBatchMessage] = useState<string | null>(null);
  const [settings, setSettings] = useState({
    apiKeys: "",
    model: "models/gemini-3.1-flash-image-preview",
    parallelLimit: 3,
  });
  const [batchPhase, setBatchPhase] = useState<
    "idle" | "preparing" | "requesting" | "finishing"
  >("idle");
  const [batchProgress, setBatchProgress] = useState({
    total: 0,
    remaining: 0,
  });

  const updateSettings = (newSettings: {
    apiKeys?: string;
    model?: string;
    parallelLimit?: number;
  }) => {
    setSettings((prev) => ({
      ...prev,
      ...newSettings,
      parallelLimit:
        newSettings.parallelLimit === undefined
          ? prev.parallelLimit
          : clampParallelLimit(newSettings.parallelLimit),
    }));
  };

  const assetsRef = useRef<AssetItem[]>(assets);
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
    savedPromptsRef.current = savedPrompts;
  }, [savedPrompts]);

  useEffect(() => {
    return () => {
      batchRunIdRef.current += 1;
      abortAllTrackedRequests();
      resetBatchPhases();
      assetsRef.current.forEach((asset) => {
        if (asset.uploadPreviewUrl) {
          URL.revokeObjectURL(asset.uploadPreviewUrl);
        }
      });
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

  const selectAsset = (id: string) => {
    setSelectedId(id);
    setPreviewMode("before");
    setBatchMessage(null);
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

  const updateNotes = (value: string) => {
    setAssets((prev) =>
      prev.map((asset) => {
        if (asset.id !== selectedId) return asset;
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
    setAssets((prev) =>
      prev.map((asset) => {
        if (asset.id !== selectedId) return asset;
        return {
          ...asset,
          status: "未填写",
          notes: "",
          errorMessage: undefined,
          resultUrl: undefined,
          rules: asset.rules.map((rule) => ({ ...rule, targetText: "", sourceText: "" })),
        };
      }),
    );
    setSavedPrompts((prev) => {
      const next = { ...prev };
      delete next[selectedId];
      return next;
    });
    setBatchMessage(null);
  };

  const urlToBase64 = async (
    asset: AssetItem,
    signal?: AbortSignal,
  ): Promise<{ data: string; mimeType: string }> => {
    const url = asset.uploadPreviewUrl || asset.previewUrl;
    const response = await fetch(url, { signal });
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve({
          data: base64String,
          mimeType: inferMimeType(asset.name, blob.type),
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
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

  const startBatch = async () => {
    if (currentAsset && isCurrentPromptDirty) {
      setBatchMessage("C区内容改了但还没保存，请先点保存。");
      return;
    }

    if (selectedIds.length === 0) {
      setBatchMessage("请先勾选要生成的图片。");
      return;
    }

    const keys = settings.apiKeys.split("\n").map(k => k.trim()).filter(Boolean);
    if (keys.length === 0) {
      setBatchMessage("Please enter at least one Gemini API Key in Settings.");
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
    batchRunIdRef.current += 1;
    const runId = batchRunIdRef.current;
    const parallelLimit = Math.min(
      clampParallelLimit(settings.parallelLimit),
      readyItems.length,
    );
    beginBatchTracking(readyItems.map((asset) => asset.id));

    setAssets((prev) =>
      prev.map((asset) =>
        deriveStatus(asset, savedPromptsRef.current[asset.id]) !== "就绪"
          ? asset
          : { ...asset, status: "处理中", errorMessage: undefined },
      ),
    );

    let cursor = 0;

    const runNext = async (): Promise<void> => {
      const assetIndex = cursor;
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

      const apiKey = keys[assetIndex % keys.length];
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: settings.model });
      const controller = new AbortController();
      let leavePhase = enterBatchPhase("preparing");

      batchAbortControllersRef.current.set(asset.id, controller);

      try {
        const image = await urlToBase64(liveAsset, controller.signal);
        leavePhase();
        leavePhase = enterBatchPhase("requesting");
        const prompt = savedPromptsRef.current[asset.id] ?? buildPrompt(liveAsset);

        const result = await model.generateContent(
          [
            prompt,
            {
              inlineData: {
                data: image.data,
                mimeType: image.mimeType,
              },
            },
          ],
          { signal: controller.signal },
        );

        const response = await result.response;
        const resultUrl = extractResultImageUrl(response);

        if (batchRunIdRef.current !== runId || controller.signal.aborted) {
          return;
        }

        if (!resultUrl) {
          throw new Error("Gemini did not return an edited image.");
        }
        leavePhase();
        leavePhase = enterBatchPhase("finishing");
        
        setAssets((prev) =>
          prev.map((item) =>
            item.id !== asset.id
              ? item
              : {
                  ...item,
                  status: "成功",
                  resultUrl,
                  errorMessage: undefined,
                },
          ),
        );
        settleBatchAsset(asset.id);
      } catch (error: any) {
        if (controller.signal.aborted || batchRunIdRef.current !== runId) {
          return;
        }

        setAssets((prev) =>
          prev.map((item) =>
            item.id !== asset.id
              ? item
              : {
                  ...item,
                  status: "失败",
                  errorMessage: error.message || "API Request Failed.",
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
      setBatchMessage("Batch processing finished.");
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

  const handleUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newAssets = Array.from(files).map((file) => {
      const previewUrl = URL.createObjectURL(file);
      return createDevelopmentAssetFromFile(file.name, previewUrl, previewUrl);
    });
    setAssets((prev) => [...prev, ...newAssets]);
    if (newAssets[0]) {
      setSelectedId(newAssets[0].id);
      setPreviewMode("before");
    }
    setBatchMessage(null);
  };

  const handleSlotUpload = (files: FileList | null, index: number) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const previewUrl = URL.createObjectURL(file);
    const newAsset = createDevelopmentAssetFromFile(file.name, previewUrl, previewUrl);
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
        if (next[index]?.uploadPreviewUrl) {
          URL.revokeObjectURL(next[index].uploadPreviewUrl!);
        }
        next[index] = newAsset;
      } else {
        next.push(newAsset);
      }
      return next;
    });
    setSelectedId(newAsset.id);
  };

  const deleteAsset = (id: string) => {
    abortTrackedRequest(id);
    settleBatchAsset(id, "removed");
    setAssets(prev => {
      const asset = prev.find(a => a.id === id);
      if (asset?.uploadPreviewUrl) URL.revokeObjectURL(asset.uploadPreviewUrl);
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
    assetsRef.current.forEach((asset) => {
      if (asset.uploadPreviewUrl) URL.revokeObjectURL(asset.uploadPreviewUrl);
    });
    setAssets([]);
    setSelectedId("");
    setSelectedIds([]);
    setSavedPrompts({});
    resetBatchTracking();
    setBatchMessage(null);
  };

  const downloadSelected = () => {
    if (selectedIds.length === 0) {
      setBatchMessage("Please select images to download.");
      return;
    }
    selectedIds.forEach((id) => {
        const asset = assets.find(a => a.id === id);
        if (asset?.resultUrl) {
            const link = document.createElement('a');
            link.href = asset.resultUrl;
            link.download = `edited_${asset.name}`;
            link.click();
        }
    });
  };

  const downloadCurrentResult = () => {
    const asset = assetsRef.current.find((item) => item.id === selectedId);
    if (!asset?.resultUrl) return;

    const link = document.createElement("a");
    link.href = asset.resultUrl;
    link.download = `edited_${asset.name}`;
    link.click();
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
    selectAsset,
    toggleSelection,
    updateRule,
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
  };
};
