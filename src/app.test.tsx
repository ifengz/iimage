import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { act } from "preact/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const googleAiMocks = vi.hoisted(() => {
  const generateContentMock = vi.fn();
  const getGenerativeModelMock = vi.fn(() => ({
    generateContent: generateContentMock,
  }));
  const GoogleGenerativeAIMock = vi.fn(() => ({
    getGenerativeModel: getGenerativeModelMock,
  }));

  return {
    generateContentMock,
    getGenerativeModelMock,
    GoogleGenerativeAIMock,
  };
});

const {
  generateContentMock,
  getGenerativeModelMock,
  GoogleGenerativeAIMock,
} = googleAiMocks;

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: googleAiMocks.GoogleGenerativeAIMock,
}));

import { type AssetItem, getRuntimeSeedAssets } from "./data/mock";
import App from "./App";
import { EditPanel } from "./components/EditPanel";
import { PromptPanel } from "./components/PromptPanel";
import { useAssets } from "./hooks/useAssets";
import { PreviewPanel } from "./components/PreviewPanel";
import { StatusFooter } from "./components/StatusFooter";

const stylesSource = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

type AssetsApi = ReturnType<typeof useAssets>;

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

const deferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

const createFileList = (files: File[]) => files as unknown as FileList;

const makeFileInputValueMutable = (
  input: HTMLInputElement,
  initialValue = "",
) => {
  let currentValue = initialValue;

  Object.defineProperty(input, "value", {
    configurable: true,
    get: () => currentValue,
    set: (nextValue: string) => {
      currentValue = nextValue;
    },
  });

  input.value = initialValue;
};

const createAssetFixture = (overrides: Partial<AssetItem> = {}): AssetItem => ({
  id: overrides.id ?? "fixture-asset",
  name: overrides.name ?? "fixture.png",
  status: overrides.status ?? "未填写",
  width: overrides.width ?? 1600,
  height: overrides.height ?? 900,
  previewUrl: overrides.previewUrl ?? "blob:fixture-preview.png",
  uploadPreviewUrl: overrides.uploadPreviewUrl,
  resultUrl: overrides.resultUrl,
  notes: overrides.notes ?? "",
  rules: overrides.rules ?? [
    {
      id: "fixture-rule-1",
      label: "字段1",
      sourceText: "Night Offer",
      targetText: "",
    },
  ],
  ocrStatus: (overrides as any).ocrStatus ?? "idle",
  ocrVisible: (overrides as any).ocrVisible ?? false,
  ocrBlocks: (overrides as any).ocrBlocks ?? [],
  ocrErrorMessage: (overrides as any).ocrErrorMessage,
  errorMessage: overrides.errorMessage,
});

let latestApi: AssetsApi;

function HookHarness() {
  latestApi = useAssets();
  return null;
}

describe("useAssets batch behavior", () => {
  beforeEach(() => {
    latestApi = undefined as never;
    generateContentMock.mockReset();
    getGenerativeModelMock.mockClear();
    GoogleGenerativeAIMock.mockClear();

    vi.restoreAllMocks();

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn((file: File) => `blob:${file.name}`),
    });

    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });

    class MockImage {
      width = 1200;
      height = 800;
      naturalWidth = 1200;
      naturalHeight = 800;
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;

      set src(_value: string) {
        queueMicrotask(() => {
          this.onload?.();
        });
      }
    }

    vi.stubGlobal("Image", MockImage as unknown as typeof Image);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;

        if (url.includes("/api/ocr")) {
          return {
            ok: true,
            json: async () => ({
              blocks: [
                {
                  id: "ocr-block-1",
                  text: "Summer Sale",
                  score: 0.99,
                  box: { x: 120, y: 48, width: 240, height: 60 },
                },
              ],
            }),
          };
        }

        return {
          blob: async () => new Blob(["uploaded-image"], { type: "image/jpeg" }),
        };
      }),
    );
  });

  it("waits for the manual OCR action before requesting local OCR and keeps OCR hidden by default", async () => {
    render(<HookHarness />);

    const upload = new File(["binary"], "poster.jpg", { type: "image/jpeg" });

    await act(async () => {
      await latestApi.handleUpload(createFileList([upload]));
    });

    expect(fetch).not.toHaveBeenCalledWith(
      "/api/ocr",
      expect.objectContaining({
        method: "POST",
      }),
    );

    expect(typeof (latestApi as any).runCurrentOcr).toBe("function");

    await act(async () => {
      await (latestApi as any).runCurrentOcr();
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/ocr",
        expect.objectContaining({
          method: "POST",
          body: expect.any(FormData),
        }),
      );
    });

    await waitFor(() => {
      expect((latestApi.currentAsset as any)?.ocrStatus).toBe("ready");
      expect((latestApi.currentAsset as any)?.ocrBlocks?.[0]?.text).toBe("Summer Sale");
      expect((latestApi.currentAsset as any)?.ocrVisible).toBe(false);
    });
  });

  it("creates 10 empty replacement rules for a newly uploaded image by default", async () => {
    render(<HookHarness />);

    const upload = new File(["binary"], "poster.jpg", { type: "image/jpeg" });

    await act(async () => {
      await latestApi.handleUpload(createFileList([upload]));
    });

    await waitFor(() => {
      expect(latestApi.currentAsset?.rules).toHaveLength(10);
    });

    expect(
      latestApi.currentAsset?.rules.every(
        (rule) => rule.sourceText === "" && rule.targetText === "",
      ),
    ).toBe(true);
  });

  it("keeps top batch uploads within the visible 6 slots and reports overflow", async () => {
    render(<HookHarness />);

    const uploads = Array.from({ length: 7 }, (_, index) =>
      new File(["binary"], `poster-${index + 1}.jpg`, { type: "image/jpeg" }),
    );

    await act(async () => {
      await latestApi.handleUpload(createFileList(uploads));
    });

    expect(latestApi.assets).toHaveLength(6);
    expect(latestApi.assets.map((asset) => asset.name)).toEqual(
      uploads.slice(0, 6).map((file) => file.name),
    );
    expect(latestApi.batchMessage).toContain("B区最多只能放 6 张图片");
    expect(latestApi.batchMessage).toContain("已忽略 1 张");
  });

  it("restores 10 empty replacement rules when clearing the current image", async () => {
    render(<HookHarness />);

    const asset = createAssetFixture({
      id: "reset-rules-asset",
      rules: [
        {
          id: "reset-rule-1",
          label: "字段1",
          sourceText: "Old 1",
          targetText: "New 1",
        },
        {
          id: "reset-rule-2",
          label: "字段2",
          sourceText: "Old 2",
          targetText: "New 2",
        },
      ],
    });

    await act(async () => {
      latestApi.setAssets([asset]);
      latestApi.setSelectedId(asset.id);
    });

    await act(async () => {
      latestApi.clearCurrent();
    });

    await waitFor(() => {
      expect(latestApi.currentAsset?.rules).toHaveLength(10);
    });

    expect(
      latestApi.currentAsset?.rules.every(
        (rule) => rule.sourceText === "" && rule.targetText === "",
      ),
    ).toBe(true);
  });

  it("writes a clicked OCR text block into the active before field", async () => {
    render(<HookHarness />);

    const asset = createAssetFixture({
      id: "ocr-fill-asset",
      rules: [
        {
          id: "ocr-fill-rule",
          label: "字段1",
          sourceText: "",
          targetText: "",
        },
      ],
    });

    await act(async () => {
      latestApi.setAssets([asset]);
      latestApi.setSelectedId(asset.id);
    });

    expect(typeof (latestApi as any).setOcrTargetRule).toBe("function");

    await act(async () => {
      (latestApi as any).setOcrTargetRule("ocr-fill-rule");
      (latestApi as any).applyOcrTextToTarget("Summer Sale");
    });

    expect(latestApi.assets[0]?.rules[0]?.sourceText).toBe("Summer Sale");
  });

  it("moves the OCR receive target down to the next before field after each fill", async () => {
    render(<HookHarness />);

    const asset = createAssetFixture({
      id: "ocr-sequence-asset",
      rules: [
        {
          id: "ocr-sequence-rule-1",
          label: "字段1",
          sourceText: "",
          targetText: "",
        },
        {
          id: "ocr-sequence-rule-2",
          label: "字段2",
          sourceText: "",
          targetText: "",
        },
        {
          id: "ocr-sequence-rule-3",
          label: "字段3",
          sourceText: "",
          targetText: "",
        },
      ],
    });

    await act(async () => {
      latestApi.setAssets([asset]);
      latestApi.setSelectedId(asset.id);
      (latestApi as any).setOcrTargetRule("ocr-sequence-rule-1");
    });

    await act(async () => {
      (latestApi as any).applyOcrTextToTarget("Line 1");
      (latestApi as any).applyOcrTextToTarget("Line 2");
      (latestApi as any).applyOcrTextToTarget("Line 3");
    });

    expect(latestApi.assets[0]?.rules.map((rule) => rule.sourceText)).toEqual([
      "Line 1",
      "Line 2",
      "Line 3",
    ]);
    expect((latestApi as any).ocrTargetRuleId).toBe("ocr-sequence-rule-3");
  });

  it("treats B zone edits as ready and still lets C zone save override the outgoing prompt", async () => {
    generateContentMock.mockResolvedValue({
      response: {
        candidates: [
          {
            index: 0,
            content: {
              role: "model",
              parts: [
                {
                  inlineData: {
                    mimeType: "image/png",
                    data: "R0lGODlhAQABAAAAACw=",
                  },
                },
              ],
            },
          },
        ],
      },
    });

    render(<HookHarness />);

    const upload = new File(["binary"], "cover.jpg", { type: "image/jpeg" });

    await act(async () => {
      latestApi.handleUpload(createFileList([upload]));
    });

    await waitFor(() => {
      expect(latestApi.currentAsset?.rules[0]?.id).toBeTruthy();
    });

    const uploadedRuleId = latestApi.currentAsset?.rules[0]?.id;
    expect(uploadedRuleId).toBeTruthy();

    await act(async () => {
      latestApi.updateRule(uploadedRuleId!, "targetText", "Launch Week");
    });

    await waitFor(() => {
      expect(latestApi.currentAsset?.rules[0]?.targetText).toBe("Launch Week");
    });

    await waitFor(() => {
      expect(latestApi.promptDraft).toContain("Launch Week");
      expect(latestApi.stats.ready).toBe(1);
    });

    await act(async () => {
      latestApi.updateSettings({ apiKeys: "demo-key", parallelLimit: 1 } as never);
      latestApi.setSelectedIds([latestApi.currentAsset!.id]);
    });

    await waitFor(() => {
      expect(latestApi.settings.apiKeys).toBe("demo-key");
    });

    await act(async () => {
      await latestApi.startBatch();
    });

    expect(generateContentMock).toHaveBeenCalledTimes(1);

    const [firstRequest] = generateContentMock.mock.calls[0] ?? [];
    expect(firstRequest[0]).toContain('Replace "(empty)" with "Launch Week"');
    expect(firstRequest[0]).toContain("Do not create a side-by-side comparison");

    await act(async () => {
      latestApi.setPromptDraft("Use this exact custom prompt.");
    });

    await waitFor(() => {
      expect(latestApi.promptDraft).toBe("Use this exact custom prompt.");
      expect(latestApi.stats.ready).toBe(0);
    });

    await act(async () => {
      await latestApi.startBatch();
    });

    expect(generateContentMock).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(latestApi.batchMessage).toBe("C区内容改了但还没保存，请先点保存。");
    });

    await act(async () => {
      latestApi.savePrompt();
    });

    await waitFor(() => {
      expect(latestApi.stats.ready).toBe(1);
    });

    await act(async () => {
      await latestApi.startBatch();
    });

    expect(generateContentMock).toHaveBeenCalledTimes(2);

    const [request] = generateContentMock.mock.calls[1] ?? [];
    expect(request[0]).toBe("Use this exact custom prompt.");
    expect(request[1]).toMatchObject({
      inlineData: {
        mimeType: "image/jpeg",
      },
    });

    const processedAsset = latestApi.assets.find((asset) => asset.name === "cover.jpg");
    expect(processedAsset?.resultUrl).toBe(
      "data:image/png;base64,R0lGODlhAQABAAAAACw=",
    );
    expect(processedAsset?.resultUrl).not.toBe(processedAsset?.previewUrl);
    expect(processedAsset?.status).toBe("成功");
  });

  it("marks a finished asset ready again and clears the previous result after saving a new full prompt", async () => {
    render(<HookHarness />);

    const finishedAsset = createAssetFixture({
      id: "finished-asset",
      resultUrl: "data:image/png;base64,b2xkLXJlc3VsdA==",
      status: "成功",
    });

    await act(async () => {
      latestApi.setAssets([finishedAsset]);
      latestApi.setSelectedId(finishedAsset.id);
    });

    await act(async () => {
      latestApi.setPromptDraft("Use this new saved prompt.");
    });

    await waitFor(() => {
      expect(latestApi.promptDraft).toBe("Use this new saved prompt.");
    });

    await act(async () => {
      latestApi.savePrompt();
    });

    await waitFor(() => {
      expect(latestApi.assets[0]?.status).toBe("就绪");
      expect(latestApi.assets[0]?.resultUrl).toBeUndefined();
    });
  });

  it("requires checked images before starting a batch", async () => {
    generateContentMock.mockResolvedValue({
      response: {
        candidates: [
          {
            index: 0,
            content: {
              role: "model",
              parts: [
                {
                  inlineData: {
                    mimeType: "image/png",
                    data: "R0lGODlhAQABAAAAACw=",
                  },
                },
              ],
            },
          },
        ],
      },
    });

    render(<HookHarness />);

    const readyAsset = createAssetFixture({
      id: "checked-only",
      name: "checked-only.png",
      status: "就绪",
      resultUrl: undefined,
      errorMessage: undefined,
      rules: [
        {
          id: "checked-rule",
          label: "字段1",
          sourceText: "Night Offer",
          targetText: "Checked only",
        },
      ],
    });

    await act(async () => {
      latestApi.setAssets([readyAsset]);
      latestApi.setSelectedId(readyAsset.id);
      latestApi.setSelectedIds([]);
      latestApi.updateSettings({ apiKeys: "demo-key", parallelLimit: 1 } as never);
    });

    await act(async () => {
      await latestApi.startBatch();
    });

    expect(generateContentMock).toHaveBeenCalledTimes(0);
    await waitFor(() => {
      expect(latestApi.batchMessage).toBe("请先勾选要生成的图片。");
    });

    await act(async () => {
      latestApi.setSelectedIds([readyAsset.id]);
    });

    await waitFor(() => {
      expect(latestApi.selectedIds).toEqual([readyAsset.id]);
    });

    await act(async () => {
      await latestApi.startBatch();
    });

    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });

  it("keeps unselected ready images out of the processing state when a batch starts", async () => {
    const pendingJob = deferred<{ response: object }>();

    generateContentMock.mockImplementation(() => pendingJob.promise);

    render(<HookHarness />);

    const selectedAsset = createAssetFixture({
      id: "selected-processing-only",
      name: "selected-processing-only.png",
      status: "就绪",
      resultUrl: undefined,
      errorMessage: undefined,
      rules: [
        {
          id: "selected-processing-rule",
          label: "字段1",
          sourceText: "Night Offer",
          targetText: "Selected only",
        },
      ],
    });

    const untouchedAsset = createAssetFixture({
      id: "untouched-ready-asset",
      name: "untouched-ready-asset.png",
      status: "就绪",
      resultUrl: undefined,
      errorMessage: undefined,
      rules: [
        {
          id: "untouched-ready-rule",
          label: "字段1",
          sourceText: "Night Offer",
          targetText: "Do not start",
        },
      ],
    });

    await act(async () => {
      latestApi.setAssets([selectedAsset, untouchedAsset]);
      latestApi.setSelectedId(selectedAsset.id);
      latestApi.setSelectedIds([selectedAsset.id]);
      latestApi.updateSettings({ apiKeys: "demo-key", parallelLimit: 1 } as never);
    });

    await act(async () => {
      void latestApi.startBatch();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(generateContentMock).toHaveBeenCalledTimes(1);
    });

    expect(
      latestApi.assets.find((asset) => asset.id === selectedAsset.id)?.status,
    ).toBe("处理中");
    expect(
      latestApi.assets.find((asset) => asset.id === untouchedAsset.id)?.status,
    ).toBe("就绪");

    pendingJob.reject(new Error("stop pending work"));
  });

  it("starts multiple Gemini requests in parallel up to the configured limit", async () => {
    const pendingCalls: Array<Deferred<{ response: object }>> = [];

    generateContentMock.mockImplementation(() => {
      const job = deferred<{ response: object }>();
      pendingCalls.push(job);
      return job.promise;
    });

    render(<HookHarness />);

    const readyAssets = [0, 1, 2].map((index) =>
      createAssetFixture({
        id: `ready-${index + 1}`,
        name: `ready-${index + 1}.png`,
        status: "就绪",
        resultUrl: undefined,
        errorMessage: undefined,
        uploadPreviewUrl: `blob:ready-${index + 1}.png`,
        rules: [
          {
            id: `rule-${index + 1}`,
            label: "字段1",
            sourceText: "Night Offer",
            targetText: `Launch ${index + 1}`,
          },
        ],
      }),
    );

    await act(async () => {
      latestApi.setAssets(readyAssets);
      latestApi.setSelectedId(readyAssets[0].id);
      latestApi.setSelectedIds(readyAssets.map((asset) => asset.id));
      latestApi.updateSettings({ apiKeys: "key-a", parallelLimit: 2 } as never);
    });

    await waitFor(() => {
      expect(latestApi.settings.apiKeys).toBe("key-a");
    });

    for (const asset of readyAssets) {
      await act(async () => {
        latestApi.setSelectedId(asset.id);
      });

      await act(async () => {
        latestApi.restoreGeneratedPrompt();
      });
    }

    await waitFor(() => {
      expect(latestApi.stats.ready).toBe(3);
    });

    await act(async () => {
      void latestApi.startBatch();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(generateContentMock).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      pendingCalls[0].resolve({
        response: {
          candidates: [
            {
              index: 0,
              content: {
                role: "model",
                parts: [{ inlineData: { mimeType: "image/png", data: "Zmlyc3Q=" } }],
              },
            },
          ],
        },
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(generateContentMock).toHaveBeenCalledTimes(3);
    });
  });

  it("stops receiving results and stops launching queued work after cancel", async () => {
    const pendingCalls: Array<Deferred<{ response: object }>> = [];

    generateContentMock.mockImplementation(() => {
      const job = deferred<{ response: object }>();
      pendingCalls.push(job);
      return job.promise;
    });

    render(<HookHarness />);

    const readyAssets = [0, 1, 2].map((index) =>
      createAssetFixture({
        id: `cancel-${index + 1}`,
        name: `cancel-${index + 1}.png`,
        status: "就绪",
        resultUrl: undefined,
        errorMessage: undefined,
        uploadPreviewUrl: `blob:cancel-${index + 1}.png`,
        rules: [
          {
            id: `cancel-rule-${index + 1}`,
            label: "字段1",
            sourceText: "Night Offer",
            targetText: `Abort ${index + 1}`,
          },
        ],
      }),
    );

    await act(async () => {
      latestApi.setAssets(readyAssets);
      latestApi.setSelectedId(readyAssets[0].id);
      latestApi.setSelectedIds(readyAssets.map((asset) => asset.id));
      latestApi.updateSettings({ apiKeys: "key-a", parallelLimit: 2 } as never);
    });

    await waitFor(() => {
      expect(latestApi.settings.apiKeys).toBe("key-a");
    });

    await act(async () => {
      void latestApi.startBatch();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(generateContentMock).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      latestApi.pauseBatch();
    });

    await act(async () => {
      pendingCalls[0].resolve({
        response: {
          candidates: [
            {
              index: 0,
              content: {
                role: "model",
                parts: [{ inlineData: { mimeType: "image/png", data: "b25l" } }],
              },
            },
          ],
        },
      });
      pendingCalls[1].resolve({
        response: {
          candidates: [
            {
              index: 0,
              content: {
                role: "model",
                parts: [{ inlineData: { mimeType: "image/png", data: "dHdv" } }],
              },
            },
          ],
        },
      });
      await Promise.resolve();
    });

    expect(generateContentMock).toHaveBeenCalledTimes(2);
    expect(latestApi.stats.running).toBe(0);
    expect(latestApi.stats.success).toBe(0);
  });

  it("aborts in-flight requests when clearing all images", async () => {
    const requestSignals: AbortSignal[] = [];
    const pendingCalls: Array<Deferred<{ response: object }>> = [];

    generateContentMock.mockImplementation((_request, requestOptions?: { signal?: AbortSignal }) => {
      const job = deferred<{ response: object }>();
      pendingCalls.push(job);
      requestSignals.push(requestOptions?.signal as AbortSignal);
      return job.promise;
    });

    render(<HookHarness />);

    const readyAssets = [0, 1].map((index) =>
      createAssetFixture({
        id: `clear-${index + 1}`,
        name: `clear-${index + 1}.png`,
        status: "就绪",
        resultUrl: undefined,
        errorMessage: undefined,
      }),
    );

    await act(async () => {
      latestApi.setAssets(readyAssets);
      latestApi.setSelectedId(readyAssets[0].id);
      latestApi.setSelectedIds(readyAssets.map((asset) => asset.id));
      latestApi.updateSettings({ apiKeys: "key-a", parallelLimit: 2 } as never);
    });

    await act(async () => {
      void latestApi.startBatch();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(generateContentMock).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      latestApi.clearAllImages();
    });

    expect(requestSignals).toHaveLength(2);
    expect(requestSignals.every((signal) => signal.aborted)).toBe(true);
    expect(latestApi.assets).toEqual([]);
  });

  it("calculates progress from the current batch instead of historical successes", async () => {
    const pendingJob = deferred<{ response: object }>();

    generateContentMock.mockImplementation(() => pendingJob.promise);

    render(<HookHarness />);

    const previousSuccess = createAssetFixture({
      id: "previous-success",
      name: "previous-success.png",
      status: "成功",
      resultUrl: "data:image/png;base64,cHJldg==",
    });

    const readyAsset = createAssetFixture({
      id: "ready-progress",
      name: "ready-progress.png",
      status: "就绪",
      resultUrl: undefined,
      errorMessage: undefined,
      rules: [
        {
          id: "ready-progress-rule",
          label: "字段1",
          sourceText: "Night Offer",
          targetText: "Progress Run",
        },
      ],
    });

    await act(async () => {
      latestApi.setAssets([previousSuccess, readyAsset]);
      latestApi.setSelectedId(readyAsset.id);
      latestApi.setSelectedIds([readyAsset.id]);
      latestApi.updateSettings({ apiKeys: "key-a", parallelLimit: 1 } as never);
    });

    await act(async () => {
      void latestApi.startBatch();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(generateContentMock).toHaveBeenCalledTimes(1);
    });

    expect(latestApi.stats.progress).toBe(0);
  });

  it("caps parallel work at ten requests and uses the selected model", async () => {
    const pendingCalls: Array<Deferred<{ response: object }>> = [];

    generateContentMock.mockImplementation(() => {
      const job = deferred<{ response: object }>();
      pendingCalls.push(job);
      return job.promise;
    });

    render(<HookHarness />);

    const readyAssets = Array.from({ length: 11 }, (_, index) =>
      createAssetFixture({
        id: `cap-${index + 1}`,
        name: `cap-${index + 1}.png`,
        status: "就绪",
        resultUrl: undefined,
        errorMessage: undefined,
        rules: [
          {
            id: `cap-rule-${index + 1}`,
            label: "字段1",
            sourceText: "Night Offer",
            targetText: `Cap ${index + 1}`,
          },
        ],
      }),
    );

    await act(async () => {
      latestApi.setAssets(readyAssets);
      latestApi.setSelectedId(readyAssets[0].id);
      latestApi.setSelectedIds(readyAssets.map((asset) => asset.id));
      latestApi.updateSettings({
        apiKeys: "key-a\nkey-b",
        parallelLimit: 99,
        model: "models/gemini-2.5-flash-image",
      } as never);
    });

    await act(async () => {
      void latestApi.startBatch();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(generateContentMock).toHaveBeenCalledTimes(10);
    });

    expect(getGenerativeModelMock).toHaveBeenCalledTimes(10);
    const modelConfigs = getGenerativeModelMock.mock.calls as unknown as Array<
      [{ model: string }]
    >;
    expect(
      modelConfigs.every(
        ([config]) => config?.model === "models/gemini-2.5-flash-image",
      ),
    ).toBe(true);

    pendingCalls.forEach((job) => job.reject(new Error("stop pending work")));
  });

  it("exposes the live batch phase while a selected image is still running", async () => {
    const pendingJob = deferred<{ response: object }>();

    generateContentMock.mockImplementation(() => pendingJob.promise);

    render(<HookHarness />);

    const readyAsset = createAssetFixture({
      id: "phase-asset",
      name: "phase-asset.png",
      status: "就绪",
      resultUrl: undefined,
      errorMessage: undefined,
      rules: [
        {
          id: "phase-rule",
          label: "字段1",
          sourceText: "Night Offer",
          targetText: "Phase shift",
        },
      ],
    });

    await act(async () => {
      latestApi.setAssets([readyAsset]);
      latestApi.setSelectedId(readyAsset.id);
      latestApi.setSelectedIds([readyAsset.id]);
      latestApi.updateSettings({ apiKeys: "phase-key", parallelLimit: 1 } as never);
    });

    await act(async () => {
      void latestApi.startBatch();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect((latestApi as any).batchPhase).toBe("requesting");
    });

    await act(async () => {
      pendingJob.resolve({
        response: {
          candidates: [
            {
              index: 0,
              content: {
                role: "model",
                parts: [{ inlineData: { mimeType: "image/png", data: "cGhhc2U=" } }],
              },
            },
          ],
        },
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect((latestApi as any).batchPhase).toBe("idle");
    });
  });

  it("does not ship built-in mock data in development runtime", () => {
    expect(getRuntimeSeedAssets({ isDev: false })).toEqual([]);
    expect(getRuntimeSeedAssets({ isDev: true })).toEqual([]);
  });
});

describe("UI safeguards", () => {
  const stubImageLoad = (mode: "load" | "error") => {
    class MockImage {
      width = 1200;
      height = 800;
      naturalWidth = 1200;
      naturalHeight = 800;
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;

      set src(_value: string) {
        queueMicrotask(() => {
          if (mode === "error") {
            this.onerror?.();
            return;
          }

          this.onload?.();
        });
      }
    }

    vi.stubGlobal("Image", MockImage as unknown as typeof Image);
  };

  it("starts empty before any real upload", () => {
    render(<App />);

    expect(screen.getByText("请上传或选择一张图片")).toBeInTheDocument();
    expect(screen.getByText("0 / 6 张图片")).toBeInTheDocument();
    expect(screen.queryByText(/hero_section_dark\.jpg/)).not.toBeInTheDocument();
  });

  it("does not pretend the original image is the after image when no result exists", () => {
    const assetWithoutResult = createAssetFixture({ resultUrl: undefined });

    render(<PreviewPanel currentAsset={assetWithoutResult} previewMode="after" />);

    expect(screen.getByText("还没有生成结果")).toBeInTheDocument();
    expect(screen.queryByAltText(assetWithoutResult.name)).not.toBeInTheDocument();
  });

  it("scales small before previews to the card frame without changing the real size label", () => {
    const smallAsset = createAssetFixture({
      name: "small-preview.svg",
      width: 120,
      height: 80,
    });

    render(<PreviewPanel currentAsset={smallAsset} previewMode="before" />);

    expect(screen.getByText("small-preview.svg (120 × 80)")).toBeInTheDocument();

    const image = screen.getByAltText("small-preview.svg") as HTMLImageElement;

    expect(image.style.width).toBe("100%");
    expect(image.style.height).toBe("100%");
  });

  it("shows a download button on the after preview and lets the user download only that image", () => {
    const handleDownload = vi.fn();
    const assetWithResult = createAssetFixture({
      resultUrl: "data:image/png;base64,YWZ0ZXI=",
    });

    render(
      <PreviewPanel
        currentAsset={assetWithResult}
        previewMode="after"
        onDownloadResult={handleDownload}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "下载当前结果图" }));

    expect(handleDownload).toHaveBeenCalledTimes(1);
  });

  it("keeps the after preview download button as an overlay instead of letting it join the layout", () => {
    const assetWithResult = createAssetFixture({
      resultUrl: "data:image/png;base64,YWZ0ZXI=",
    });

    render(
      <PreviewPanel
        currentAsset={assetWithResult}
        previewMode="after"
        onDownloadResult={() => {}}
      />,
    );

    const stage = document.querySelector(".preview-stage") as HTMLDivElement;
    const button = screen.getByRole("button", { name: "下载当前结果图" });

    expect(stage.style.width).toBe("100%");
    expect(stage.style.height).toBe("100%");
    expect(button.className).toContain("preview-download-button");
    expect(stylesSource).toMatch(/\.button\.preview-download-button\s*\{[\s\S]*?position:\s*absolute;/);
  });

  it("lets keyboard users focus the after preview before revealing the download button", () => {
    const assetWithResult = createAssetFixture({
      resultUrl: "data:image/png;base64,YWZ0ZXI=",
    });

    render(
      <PreviewPanel
        currentAsset={assetWithResult}
        previewMode="after"
        onDownloadResult={() => {}}
      />,
    );

    const stage = document.querySelector(".preview-stage") as HTMLDivElement;

    expect(stage.tabIndex).toBe(0);
    expect(stylesSource).toMatch(/visibility:\s*hidden;/);
    expect(stylesSource).toMatch(/\.preview-stage:hover\s+\.preview-download-button,\s*\.preview-stage:focus-within\s+\.preview-download-button/);
  });

  it("renders clickable OCR hotzones on the before preview", () => {
    const handleSelect = vi.fn();
    const assetWithOcr = {
      ...createAssetFixture({
        width: 1200,
        height: 800,
      }),
      ocrStatus: "ready",
      ocrVisible: true,
      ocrBlocks: [
        {
          id: "ocr-hotzone-1",
          text: "Summer Sale",
          score: 0.99,
          box: { x: 120, y: 48, width: 240, height: 60 },
        },
      ],
    };

    const PreviewPanelAny = PreviewPanel as any;

    render(
      <PreviewPanelAny
        currentAsset={assetWithOcr}
        previewMode="before"
        onSelectOcrText={handleSelect}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "OCR Summer Sale" }));

    expect(handleSelect).toHaveBeenCalledWith("Summer Sale");
  });

  it("keeps OCR hotzones hidden until the user explicitly turns them on", () => {
    const handleSelect = vi.fn();
    const PreviewPanelAny = PreviewPanel as any;
    const assetWithOcr = {
      ...createAssetFixture({
        width: 1200,
        height: 800,
      }),
      ocrStatus: "ready",
      ocrVisible: false,
      ocrBlocks: [
        {
          id: "ocr-hotzone-1",
          text: "Summer Sale",
          score: 0.99,
          box: { x: 120, y: 48, width: 240, height: 60 },
        },
      ],
    };

    const { rerender } = render(
      <PreviewPanelAny
        currentAsset={assetWithOcr}
        previewMode="before"
        onSelectOcrText={handleSelect}
        onRunOcr={() => {}}
        onToggleOcrVisibility={() => {}}
      />,
    );

    expect(screen.queryByRole("button", { name: "OCR Summer Sale" })).not.toBeInTheDocument();

    rerender(
      <PreviewPanelAny
        currentAsset={{ ...assetWithOcr, ocrVisible: true }}
        previewMode="before"
        onSelectOcrText={handleSelect}
        onRunOcr={() => {}}
        onToggleOcrVisibility={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: "OCR Summer Sale" })).toBeInTheDocument();
  });

  it("renders the OCR hint on the left side of the shared A preview bottom action bar", () => {
    const PreviewPanelAny = PreviewPanel as any;
    const assetWithOcr = {
      ...createAssetFixture(),
      ocrStatus: "ready",
      ocrVisible: false,
      ocrBlocks: [
        {
          id: "ocr-hotzone-1",
          text: "Summer Sale",
          score: 0.99,
          box: { x: 120, y: 48, width: 240, height: 60 },
        },
      ],
    };

    render(
      <PreviewPanelAny
        currentAsset={assetWithOcr}
        previewMode="before"
        onRunOcr={() => {}}
        onToggleOcrVisibility={() => {}}
      />,
    );

    const runButton = screen.getByRole("button", { name: "开始 OCR" });
    const toggleButton = screen.getByRole("button", { name: "显示 OCR" });
    const hint = screen.getByText('OCR 已完成，点“显示 OCR”后再选字。');
    const actionBar = document.querySelector(".panel-actions-bar") as HTMLDivElement | null;
    const panelBody = document.querySelector(".panel-body") as HTMLDivElement | null;

    expect(actionBar).not.toBeNull();
    expect(panelBody?.style.padding).toBe("0px");
    expect(actionBar).toContainElement(hint);
    expect(actionBar).toContainElement(runButton);
    expect(actionBar).toContainElement(toggleButton);
    expect(runButton.className).toContain("button-primary");
    expect(toggleButton.className).toContain("button-ghost");
    expect(runButton.style.height).toBe("28px");
    expect(runButton.style.fontSize).toBe("0.75rem");
    expect(toggleButton.style.height).toBe("28px");
    expect(toggleButton.style.fontSize).toBe("0.75rem");
    expect(actionBar?.className).toContain("panel-actions-bar-between");
    expect(actionBar?.className).not.toContain("preview-actions-bar");
    expect(stylesSource).toMatch(/\.panel-actions-bar-between\s*\{[\s\S]*?justify-content:\s*space-between;/);
    expect(stylesSource).toMatch(/\.panel-actions-bar\s*\{[\s\S]*?border-top:\s*1px solid var\(--border-color\);/);
  });

  it("uses the same shared bottom action bar structure across A, B, and C", () => {
    const PreviewPanelAny = PreviewPanel as any;
    const EditPanelAny = EditPanel as any;
    const asset = createAssetFixture({
      ocrStatus: "ready",
      ocrVisible: false,
      ocrBlocks: [
        {
          id: "ocr-hotzone-1",
          text: "Summer Sale",
          score: 0.99,
          box: { x: 120, y: 48, width: 240, height: 60 },
        },
      ],
    });

    render(
      <div>
        <PreviewPanelAny
          currentAsset={asset}
          previewMode="before"
          onRunOcr={() => {}}
          onToggleOcrVisibility={() => {}}
        />
        <EditPanelAny
          assets={[asset]}
          currentAsset={asset}
          selectedIds={[]}
          toggleSelection={() => {}}
          selectAsset={() => {}}
          previewMode="before"
          setPreviewMode={() => {}}
          updateRule={() => {}}
          updateNotes={() => {}}
          insertRuleAfter={() => {}}
          removeRule={() => {}}
          clearCurrent={() => {}}
          clearAllImages={() => {}}
          handleSlotUpload={() => {}}
          deleteAsset={() => {}}
          ocrTargetRuleId={asset.rules[0].id}
          setOcrTargetRule={() => {}}
        />
        <PromptPanel
          promptDraft="Draft"
          setPromptDraft={() => {}}
          savePrompt={() => {}}
          restoreGeneratedPrompt={() => {}}
        />
      </div>,
    );

    const actionBars = Array.from(document.querySelectorAll(".panel-actions-bar"));
    const panelBodies = Array.from(document.querySelectorAll(".panel-body")) as HTMLDivElement[];
    const runButton = screen.getByRole("button", { name: "开始 OCR" });
    const toggleButton = screen.getByRole("button", { name: "显示 OCR" });
    const clearButton = screen.getByRole("button", { name: "清空" });
    const resetButtons = screen.getAllByRole("button", { name: "重置" });
    const saveButton = screen.getByRole("button", { name: "保存" });

    expect(actionBars).toHaveLength(3);
    panelBodies.forEach((body) => {
      expect(body.style.padding).toBe("0px");
      expect(body.style.minHeight).toBe("0px");
      expect(body.style.overflow).toBe("hidden");
    });

    expect(runButton.className).not.toContain("preview-actions-bar");
    expect(runButton.className).not.toContain("preview-ocr-action");
    expect(toggleButton.className).not.toContain("preview-ocr-action");

    expect(runButton.style.height).toBe("28px");
    expect(clearButton.style.height).toBe("28px");
    expect(saveButton.style.height).toBe("28px");
    expect(runButton.style.fontSize).toBe(saveButton.style.fontSize);
    expect(runButton.style.minWidth).toBe(saveButton.style.minWidth);
    expect(runButton.style.transition).toBe(saveButton.style.transition);
    expect(toggleButton.style.height).toBe(resetButtons[0]?.style.height);
    expect(toggleButton.style.fontSize).toBe(resetButtons[0]?.style.fontSize);
  });

  it("marks the focused before input as the OCR receive target", () => {
    const setOcrTargetRule = vi.fn();
    const EditPanelAny = EditPanel as any;

    const asset = createAssetFixture({
      rules: [
        {
          id: "source-rule-1",
          label: "字段1",
          sourceText: "Old 1",
          targetText: "New 1",
        },
        {
          id: "source-rule-2",
          label: "字段2",
          sourceText: "Old 2",
          targetText: "New 2",
        },
      ],
    });

    render(
      <EditPanelAny
        assets={[asset]}
        currentAsset={asset}
        selectedIds={[]}
        toggleSelection={() => {}}
        selectAsset={() => {}}
        previewMode="before"
        setPreviewMode={() => {}}
        updateRule={() => {}}
        updateNotes={() => {}}
        insertRuleAfter={() => {}}
        removeRule={() => {}}
        clearCurrent={() => {}}
        clearAllImages={() => {}}
        handleSlotUpload={() => {}}
        deleteAsset={() => {}}
        ocrTargetRuleId="source-rule-1"
        setOcrTargetRule={setOcrTargetRule}
      />,
    );

    fireEvent.focus(screen.getByDisplayValue("Old 2"));

    expect(setOcrTargetRule).toHaveBeenCalledWith("source-rule-2");
  });

  it("exposes thumbnail preview switches as real buttons for keyboard users", () => {
    const setPreviewMode = vi.fn();
    const selectAsset = vi.fn();
    const EditPanelAny = EditPanel as any;
    const asset = createAssetFixture({
      id: "thumb-switch-asset",
      name: "switchable.png",
    });

    render(
      <EditPanelAny
        assets={[asset]}
        currentAsset={null}
        selectedIds={[]}
        toggleSelection={() => {}}
        selectAsset={selectAsset}
        previewMode="before"
        setPreviewMode={setPreviewMode}
        updateRule={() => {}}
        updateNotes={() => {}}
        insertRuleAfter={() => {}}
        removeRule={() => {}}
        clearCurrent={() => {}}
        clearAllImages={() => {}}
        handleSlotUpload={() => {}}
        deleteAsset={() => {}}
        ocrTargetRuleId={asset.rules[0].id}
        setOcrTargetRule={() => {}}
      />,
    );

    const beforeButton = screen.getByRole("button", {
      name: "切换 switchable.png 为前图预览",
    });
    const afterButton = screen.getByRole("button", {
      name: "切换 switchable.png 为后图预览",
    });

    afterButton.focus();

    expect(afterButton).toHaveFocus();
    expect(beforeButton).toHaveAttribute("type", "button");
    expect(afterButton).toHaveAttribute("type", "button");

    fireEvent.click(afterButton);

    expect(selectAsset).toHaveBeenCalledWith(asset.id);
    expect(setPreviewMode).toHaveBeenCalledWith("after");
  });

  it("stores a page-visible error message when an uploaded file cannot be read as an image", async () => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn((file: File) => `blob:${file.name}`),
    });

    stubImageLoad("error");

    render(<HookHarness />);

    const brokenUpload = new File(["not an image"], "broken.png", {
      type: "image/png",
    });

    await expect(
      latestApi.handleUpload(createFileList([brokenUpload])),
    ).resolves.toBeUndefined();

    await waitFor(() => {
      expect(latestApi.batchMessage).toBe("无法读取图片尺寸。");
    });
  });

  it("clears the top upload input after a failed image read so the same file can be retried", async () => {
    stubImageLoad("error");

    render(<App />);

    const brokenUpload = new File(["not an image"], "broken-top.png", {
      type: "image/png",
    });
    const uploadInput = document.querySelector(
      'input[type="file"][multiple]',
    ) as HTMLInputElement | null;

    expect(uploadInput).not.toBeNull();
    makeFileInputValueMutable(uploadInput!, "C:\\fakepath\\broken-top.png");

    fireEvent.change(uploadInput!, {
      target: {
        files: createFileList([brokenUpload]),
      },
    });

    await waitFor(() => {
      expect(screen.getByText("无法读取图片尺寸。")).toBeInTheDocument();
    });

    expect(uploadInput!.value).toBe("");
  });

  it("clears the empty-slot upload input after a failed image read so the same file can be retried", async () => {
    stubImageLoad("error");

    render(<App />);

    const brokenUpload = new File(["not an image"], "broken-slot.png", {
      type: "image/png",
    });
    const slotInput = document.querySelector(
      'input[type="file"]:not([multiple])',
    ) as HTMLInputElement | null;

    expect(slotInput).not.toBeNull();
    makeFileInputValueMutable(slotInput!, "C:\\fakepath\\broken-slot.png");

    fireEvent.change(slotInput!, {
      target: {
        files: createFileList([brokenUpload]),
      },
    });

    await waitFor(() => {
      expect(screen.getByText("无法读取图片尺寸。")).toBeInTheDocument();
    });

    expect(slotInput!.value).toBe("");
  });

  it("maps thumbnail status dots to the real asset states instead of painting ready work as failed", () => {
    const EditPanelAny = EditPanel as any;
    const readyAsset = createAssetFixture({
      id: "thumb-ready",
      status: "就绪",
    });
    const processingAsset = createAssetFixture({
      id: "thumb-processing",
      status: "处理中",
    });
    const successAsset = createAssetFixture({
      id: "thumb-success",
      status: "成功",
    });
    const failedAsset = createAssetFixture({
      id: "thumb-failed",
      status: "失败",
    });

    render(
      <EditPanelAny
        assets={[readyAsset, processingAsset, successAsset, failedAsset]}
        currentAsset={readyAsset}
        selectedIds={[]}
        toggleSelection={() => {}}
        selectAsset={() => {}}
        previewMode="before"
        setPreviewMode={() => {}}
        updateRule={() => {}}
        updateNotes={() => {}}
        insertRuleAfter={() => {}}
        removeRule={() => {}}
        clearCurrent={() => {}}
        clearAllImages={() => {}}
        handleSlotUpload={() => {}}
        deleteAsset={() => {}}
        ocrTargetRuleId={readyAsset.rules[0].id}
        setOcrTargetRule={() => {}}
      />,
    );

    expect(
      document.querySelector('[data-thumb-status="就绪"]') as HTMLDivElement | null,
    )?.toHaveStyle({ backgroundColor: "var(--accent-hover)" });
    expect(
      document.querySelector('[data-thumb-status="处理中"]') as HTMLDivElement | null,
    )?.toHaveStyle({ backgroundColor: "var(--accent)" });
    expect(
      document.querySelector('[data-thumb-status="成功"]') as HTMLDivElement | null,
    )?.toHaveStyle({ backgroundColor: "var(--success)" });
    expect(
      document.querySelector('[data-thumb-status="失败"]') as HTMLDivElement | null,
    )?.toHaveStyle({ backgroundColor: "var(--error)" });
  });

  it("keeps OCR manual after upload and guides the user to click the start button first", async () => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn((file: File) => `blob:${file.name}`),
    });

    stubImageLoad("load");

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;

        if (url.includes("/api/ocr")) {
          return {
            ok: true,
            json: async () => ({ blocks: [] }),
          };
        }

        return {
          blob: async () => new Blob(["uploaded-image"], { type: "image/jpeg" }),
        };
      }),
    );

    render(<App />);

    const upload = new File(["binary"], "poster.jpg", { type: "image/jpeg" });
    const uploadInput = document.querySelector(
      'input[type="file"][multiple]',
    ) as HTMLInputElement | null;

    expect(uploadInput).not.toBeNull();

    fireEvent.change(uploadInput!, {
      target: { files: createFileList([upload]) },
    });

    await waitFor(() => {
      expect(screen.getByText("poster.jpg (1200 × 800)")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "开始 OCR" })).toBeInTheDocument();
    expect(screen.getByText('先点“开始 OCR”')).toBeInTheDocument();
    expect(screen.getByText('先点 A 区底部“开始 OCR”')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalledWith(
      "/api/ocr",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("exposes accessible settings controls", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "打开系统设置" }));

    expect(screen.getByLabelText("Gemini Model")).toBeInTheDocument();
    expect(screen.getByLabelText("并行数")).toBeInTheDocument();
  });

  it("keeps only one save button after removing B zone save", () => {
    render(<App />);

    expect(screen.getAllByRole("button", { name: "保存" })).toHaveLength(1);
  });

  it("changes the generating indicator color as progress moves forward", () => {
    const { rerender } = render(
      <StatusFooter
        stats={{ total: 1, ready: 0, running: 1, success: 0, failed: 0, progress: 10 }}
        model="models/gemini-3.1-flash-image-preview"
      />,
    );

    const indicator = screen.getByTestId("status-indicator");
    expect(indicator.getAttribute("data-phase")).toBe("starting");

    rerender(
      <StatusFooter
        stats={{ total: 1, ready: 0, running: 1, success: 0, failed: 0, progress: 60 }}
        model="models/gemini-3.1-flash-image-preview"
      />,
    );
    expect(screen.getByTestId("status-indicator").getAttribute("data-phase")).toBe("middle");

    rerender(
      <StatusFooter
        stats={{ total: 1, ready: 0, running: 1, success: 0, failed: 0, progress: 95 }}
        model="models/gemini-3.1-flash-image-preview"
      />,
    );
    expect(screen.getByTestId("status-indicator").getAttribute("data-phase")).toBe("ending");
  });

  it("uses a breathe animation that changes the dot color while it is running", () => {
    render(
      <StatusFooter
        stats={{ total: 1, ready: 0, running: 1, success: 0, failed: 0, progress: 60 }}
        model="models/gemini-3.1-flash-image-preview"
        phase="requesting"
      />,
    );

    const indicator = screen.getByTestId("status-indicator") as HTMLDivElement;

    expect(indicator.style.animation).toContain("status-indicator-breathe");
    expect(indicator.style.getPropertyValue("--status-indicator-base")).not.toBe("");
    expect(indicator.style.getPropertyValue("--status-indicator-pulse")).not.toBe("");
  });

  it("removes the footer percentage row and keeps the hint next to the model label", () => {
    const hint = "B区改完就能直接生成";

    render(
      <StatusFooter
        stats={{ total: 3, ready: 2, running: 0, success: 1, failed: 0, progress: 100 }}
        model="models/gemini-2.5-flash-image"
        message={hint}
      />,
    );

    const status = screen.getByRole("status");
    const modelValue = screen.getByText("GEMINI-2.5-FLASH-IMAGE");
    const hintText = screen.getByText(hint);

    expect(screen.queryByText("100%")).not.toBeInTheDocument();
    expect(status.childElementCount).toBe(1);
    expect(modelValue.parentElement).toContainElement(hintText);
  });
});
