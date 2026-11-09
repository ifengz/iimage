import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { AssetItem } from "../data/mock";
import {
  compactGhostActionButtonStyle,
  compactPrimaryActionButtonStyle,
  sharedPanelBodyStyle,
} from "./panelActionStyles";

interface PreviewPanelProps {
  currentAsset: AssetItem | null;
  previewMode: "before" | "after";
  onDownloadResult?: () => void;
  onRunOcr?: () => void;
  onToggleOcrVisibility?: () => void;
  onSelectOcrText?: (text: string) => void;
}

const fitPreviewFrame = (
  containerWidth: number,
  containerHeight: number,
  assetWidth: number,
  assetHeight: number,
) => {
  if (
    containerWidth <= 0 ||
    containerHeight <= 0 ||
    assetWidth <= 0 ||
    assetHeight <= 0
  ) {
    return null;
  }

  const widthRatio = containerWidth / assetWidth;
  const heightRatio = containerHeight / assetHeight;
  const scale = Math.min(widthRatio, heightRatio);

  return {
    width: assetWidth * scale,
    height: assetHeight * scale,
  };
};

export const PreviewPanel = ({
  currentAsset,
  previewMode,
  onDownloadResult,
  onRunOcr,
  onToggleOcrVisibility,
  onSelectOcrText,
}: PreviewPanelProps) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const syncSize = (width: number, height: number) => {
      setStageSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height },
      );
    };

    const updateFromStage = () => {
      const rect = stage.getBoundingClientRect();
      syncSize(rect.width, rect.height);
    };

    updateFromStage();

    if (typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        updateFromStage();
        return;
      }

      syncSize(entry.contentRect.width, entry.contentRect.height);
    });

    observer.observe(stage);
    return () => observer.disconnect();
  }, [currentAsset?.id, previewMode]);

  if (!currentAsset) return (
    <div class="panel">
      <div class="panel-header">
        <span class="panel-title">A区 · 预览</span>
      </div>
      <div class="panel-body" style={{ display: 'grid', placeItems: 'center', height: '100%', overflow: 'hidden' }}>
        <p style={{ color: 'var(--text-muted)' }}>请上传或选择一张图片</p>
      </div>
    </div>
  );

  const showAfterPlaceholder = previewMode === "after" && !currentAsset.resultUrl;
  const showAfterFailure =
    showAfterPlaceholder &&
    currentAsset.status === "失败" &&
    Boolean(currentAsset.errorMessage);
  const failureIsMissingEndpoint = Boolean(currentAsset.errorMessage?.includes("404"));
  const displayUrl = previewMode === "after" ? currentAsset.resultUrl : currentAsset.previewUrl;
  const canDownloadResult = previewMode === "after" && Boolean(currentAsset.resultUrl) && Boolean(onDownloadResult);
  const canRunOcr = previewMode === "before" && Boolean(currentAsset.uploadFile) && Boolean(onRunOcr);
  const canToggleOcr =
    previewMode === "before" &&
    currentAsset.ocrStatus === "ready" &&
    currentAsset.ocrBlocks.length > 0 &&
    Boolean(onToggleOcrVisibility);
  const shouldShowOcrOverlay =
    previewMode === "before" &&
    currentAsset.ocrVisible &&
    currentAsset.ocrStatus === "ready" &&
    currentAsset.ocrBlocks.length > 0 &&
    currentAsset.width > 0 &&
    currentAsset.height > 0 &&
    Boolean(onSelectOcrText);

  const shouldShowOcrLoading =
    previewMode === "before" && currentAsset.ocrStatus === "loading";

  const shouldShowOcrError =
    previewMode === "before" &&
    currentAsset.ocrStatus === "failed" &&
    Boolean(currentAsset.ocrErrorMessage);

  const shouldShowOcrEmpty =
    previewMode === "before" &&
    currentAsset.ocrStatus === "ready" &&
    currentAsset.ocrBlocks.length === 0;

  const shouldShowOcrReadyHint =
    previewMode === "before" &&
    currentAsset.ocrStatus === "ready" &&
    currentAsset.ocrBlocks.length > 0 &&
    !currentAsset.ocrVisible;

  const shouldShowOcrSelectionHint =
    previewMode === "before" &&
    currentAsset.ocrStatus === "ready" &&
    currentAsset.ocrBlocks.length > 0 &&
    currentAsset.ocrVisible;

  const ocrActionHint =
    previewMode !== "before"
      ? null
      : shouldShowOcrLoading
        ? "OCR 识别中..."
        : shouldShowOcrError
          ? currentAsset.ocrErrorMessage ?? "OCR 失败"
          : shouldShowOcrEmpty
            ? "没识别到可点击文字。"
            : shouldShowOcrReadyHint
              ? 'OCR 已完成，点“显示 OCR”后再选字。'
              : shouldShowOcrSelectionHint
                ? "先点 before 框，再点图上的 OCR 框。"
                : "先点“开始 OCR”";

  const previewFrame = useMemo(
    () =>
      fitPreviewFrame(
        stageSize.width,
        stageSize.height,
        currentAsset.width,
        currentAsset.height,
      ),
    [currentAsset.height, currentAsset.width, stageSize.height, stageSize.width],
  );

  const previewShellStyle = previewFrame
    ? {
        width: `${previewFrame.width}px`,
        height: `${previewFrame.height}px`,
      }
    : {
        width: "100%",
        height: "100%",
      };

  return (
    <div class="panel">
      <div class="panel-header">
        <span class="panel-title">A区 · 预览 ({previewMode === 'before' ? 'Before' : 'After'})</span>
        <div class="preview-header-meta">
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            {currentAsset.name} ({currentAsset.width} × {currentAsset.height})
          </span>
        </div>
      </div>
      <div class="panel-body" style={{ 
        ...sharedPanelBodyStyle,
        flex: 1,
        backgroundColor: 'var(--surface-lighter)',
      }}>
        <div
          class="preview-content"
          style={{
            flex: 1,
            minHeight: 0,
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--spacing-md)",
          }}
        >
          {showAfterFailure ? (
            <div
              style={{
                display: 'grid',
                placeItems: 'center',
                gap: '8px',
                textAlign: 'center',
                maxWidth: '520px',
                padding: '0 24px',
              }}
            >
              <strong style={{ color: 'var(--error)' }}>生成失败</strong>
              <span
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.85rem',
                  wordBreak: 'break-word',
                }}
              >
                {currentAsset.errorMessage}
              </span>
              {failureIsMissingEndpoint ? (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  网关没有为该模型开放生图接口，换一个支持生图的模型或联系网关管理员。
                </span>
              ) : null}
            </div>
          ) : showAfterPlaceholder ? (
            <div
              style={{
                display: 'grid',
                placeItems: 'center',
                gap: '8px',
                textAlign: 'center',
                color: 'var(--text-muted)',
              }}
            >
              <strong style={{ color: 'var(--text-secondary)' }}>还没有生成结果</strong>
              <span style={{ fontSize: '0.8rem' }}>开始生成后，这里才会显示模型返回的图片。</span>
            </div>
          ) : (
            <div
              class="preview-stage"
              ref={stageRef}
              style={{
                width: "100%",
                height: "100%",
                minWidth: 0,
                minHeight: 0,
              }}
              tabIndex={canDownloadResult ? 0 : -1}
            >
              {canDownloadResult ? (
                <button
                  type="button"
                  class="button preview-download-button"
                  aria-label="下载当前结果图"
                  onClick={onDownloadResult}
                >
                  下载
                </button>
              ) : null}
              <div class="preview-image-shell" style={previewShellStyle}>
                <img
                  src={displayUrl}
                  alt={currentAsset.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    borderRadius: '4px',
                    display: 'block'
                  }}
                />
                {shouldShowOcrOverlay ? (
                  <div class="ocr-overlay" aria-label="OCR overlay">
                    {currentAsset.ocrBlocks.map((block) => (
                      <button
                        key={block.id}
                        type="button"
                        class="ocr-hotzone"
                        aria-label={`OCR ${block.text}`}
                        style={{
                          left: `${(block.box.x / currentAsset.width) * 100}%`,
                          top: `${(block.box.y / currentAsset.height) * 100}%`,
                          width: `${(block.box.width / currentAsset.width) * 100}%`,
                          height: `${(block.box.height / currentAsset.height) * 100}%`,
                        }}
                        title={block.text}
                        onClick={() => onSelectOcrText?.(block.text)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
        {previewMode === "before" ? (
          <div class="panel-actions-bar panel-actions-bar-between" aria-label="OCR controls">
            <div class="panel-action-hint">{ocrActionHint}</div>
            <div class="panel-actions-group">
              <button
                type="button"
                class="button button-primary"
                style={compactPrimaryActionButtonStyle}
                onClick={onRunOcr}
                disabled={!canRunOcr || currentAsset.ocrStatus === "loading"}
              >
                开始 OCR
              </button>
              <button
                type="button"
                class="button button-ghost preview-ocr-toggle"
                style={compactGhostActionButtonStyle}
                aria-pressed={currentAsset.ocrVisible}
                onClick={onToggleOcrVisibility}
                disabled={!canToggleOcr}
              >
                {currentAsset.ocrVisible ? "隐藏 OCR" : "显示 OCR"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
