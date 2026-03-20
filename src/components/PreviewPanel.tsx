import { AssetItem } from "../data/mock";

interface PreviewPanelProps {
  currentAsset: AssetItem | null;
  previewMode: "before" | "after";
  onDownloadResult?: () => void;
}

export const PreviewPanel = ({
  currentAsset,
  previewMode,
  onDownloadResult,
}: PreviewPanelProps) => {
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
  const displayUrl = previewMode === "after" ? currentAsset.resultUrl : currentAsset.previewUrl;
  const canDownloadResult = previewMode === "after" && Boolean(currentAsset.resultUrl) && Boolean(onDownloadResult);

  return (
    <div class="panel">
      <div class="panel-header">
        <span class="panel-title">A区 · 预览 ({previewMode === 'before' ? 'Before' : 'After'})</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {currentAsset.name} ({currentAsset.width} × {currentAsset.height})
        </span>
      </div>
      <div class="panel-body" style={{ 
        flex: 1,
        backgroundColor: 'var(--surface-lighter)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--spacing-md)',
        minHeight: 0
      }}>
        {showAfterPlaceholder ? (
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
            <span style={{ fontSize: '0.8rem' }}>开始生成后，这里才会显示 Gemini 返回的图片。</span>
          </div>
        ) : (
          <div
            class="preview-stage"
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
            <img
              src={displayUrl}
              alt={currentAsset.name}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                borderRadius: '4px',
                display: 'block'
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
