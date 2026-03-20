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

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        blob: async () => new Blob(["uploaded-image"], { type: "image/jpeg" }),
      })),
    );
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
