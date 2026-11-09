import { useState } from "preact/hooks";

interface EditPanelProps {
  assets: AssetItem[];
  currentAsset: AssetItem | null;
  selectAsset: (id: string) => void;
  selectedIds: string[];
  toggleSelection: (id: string) => void;
  previewMode: "before" | "after";
  setPreviewMode: (mode: "before" | "after") => void;
  ocrTargetRuleId: string;
  setOcrTargetRule: (ruleId: string) => void;
  updateRule: (id: string, key: "sourceText" | "targetText", value: string) => void;
  updateNotes: (value: string) => void;
  insertRuleAfter: (id: string) => void;
  removeRule: (id: string) => void;
  clearCurrent: () => void;
  clearAllImages: () => void;
  handleSlotUpload: (files: FileList | null, index: number) => Promise<void> | void;
  deleteAsset: (id: string) => void;
}

import { AssetItem, MAX_ASSET_SLOTS } from "../data/mock";
import {
  compactGhostActionButtonStyle,
  sharedPanelBodyStyle,
} from "./panelActionStyles";

const thumbHalfButtonResetStyle = {
  appearance: "none",
  border: "none",
  padding: 0,
  margin: 0,
} as const;

export const EditPanel = ({
  assets,
  currentAsset,
  selectedIds,
  toggleSelection,
  selectAsset,
  previewMode,
  setPreviewMode,
  ocrTargetRuleId,
  setOcrTargetRule,
  updateRule,
  updateNotes,
  insertRuleAfter,
  removeRule,
  clearCurrent,
  clearAllImages,
  handleSlotUpload,
  deleteAsset,
}: EditPanelProps) => {
  const slots = Array.from({ length: MAX_ASSET_SLOTS }).map((_, i) => assets[i] || null);
  const [focusedSplitId, setFocusedSplitId] = useState<string | null>(null);

  return (
    <div class="panel">
      <div class="panel-header">
        <span class="panel-title">B区 · 编辑与列表</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{assets.length} / {MAX_ASSET_SLOTS} 张图片</span>
      </div>
      <div class="panel-body" style={sharedPanelBodyStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', position: 'relative', flex: 1, minHeight: 0, overflowY: 'auto', padding: 'var(--spacing-md)' }}>

        {/* Thumbnails Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
          <h4 style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>图片序列</h4>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${MAX_ASSET_SLOTS}, 1fr)`,
            gap: 'var(--spacing-xs)',
          }}>
            {slots.map((asset, index) => {
              if (!asset) {
                return (
                  <label
                    key={`slot-${index}`}
                    style={{
                      aspectRatio: '1',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px dashed var(--border-color)',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-muted)',
                      fontSize: '1.2rem',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
                  >
                    +
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => {
                        const input = e.target as HTMLInputElement;
                        void Promise.resolve(handleSlotUpload(input.files, index)).finally(() => {
                          input.value = "";
                        });
                      }}
                      style={{ display: 'none' }}
                    />
                  </label>
                );
              }

                  const isActive = asset.id === currentAsset?.id;
                  const statusDotColor =
                    asset.status === "成功"
                      ? "var(--success)"
                      : asset.status === "失败"
                        ? "var(--error)"
                        : asset.status === "处理中"
                          ? "var(--accent)"
                          : "var(--accent-hover)";

                  return (
                <div key={asset.id} class="thumb-container" style={{ position: 'relative' }}>
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      borderRadius: 'var(--radius-sm)',
                      border: isActive ? '2px solid var(--accent)' : '1px solid var(--border-color)',
                      overflow: 'hidden',
                      position: 'relative',
                      backgroundColor: 'var(--surface-lighter)',
                      cursor: 'pointer'
                    }}
                    onClick={() => selectAsset(asset.id)}
                  >
                    <img src={asset.previewUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    
                    {/* Split Interactive Overlay */}
                    <div
                      class="thumb-overlay"
                      style={focusedSplitId === asset.id ? { opacity: 1 } : undefined}
                      onFocus={() => setFocusedSplitId(asset.id)}
                      onBlur={(e) => {
                        const nextTarget = e.relatedTarget as Node | null;
                        if (!e.currentTarget.contains(nextTarget)) {
                          setFocusedSplitId((current) =>
                            current === asset.id ? null : current,
                          );
                        }
                      }}
                    >
                      <button
                        type="button"
                        class={`thumb-half ${isActive && previewMode === 'before' ? 'thumb-half-active' : ''}`}
                        aria-label={`切换 ${asset.name} 为前图预览`}
                        aria-pressed={isActive && previewMode === "before"}
                        style={thumbHalfButtonResetStyle}
                        onClick={(e) => {
                          e.stopPropagation();
                          if(!isActive) selectAsset(asset.id);
                          setPreviewMode('before');
                        }}
                      >
                        前
                      </button>
                      <button
                        type="button"
                        class={`thumb-half ${isActive && previewMode === 'after' ? 'thumb-half-active' : ''}`}
                        aria-label={`切换 ${asset.name} 为后图预览`}
                        aria-pressed={isActive && previewMode === "after"}
                        style={thumbHalfButtonResetStyle}
                        onClick={(e) => {
                          e.stopPropagation();
                          if(!isActive) selectAsset(asset.id);
                          setPreviewMode('after');
                        }}
                      >
                        后
                      </button>
                    </div>

                    {/* Status Indicator */}
                    {asset.status !== "未填写" && (
                      <div
                        data-thumb-status={asset.status}
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          right: 0,
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          backgroundColor: statusDotColor,
                          margin: '2px',
                          border: '1px solid white',
                          zIndex: 6,
                        }}
                      />
                    )}
                  </div>

                  {/* Red Delete Badge Icon ✕ (Triggered by thumb-container hover in CSS) */}
                  <button 
                    class="thumb-delete-badge"
                    onClick={(e) => { e.stopPropagation(); deleteAsset(asset.id); }}
                  >
                    ✕
                  </button>

                  {/* Checkbox Overlay */}
                  <input 
                    type="checkbox" 
                    checked={selectedIds.includes(asset.id)}
                    onChange={(e) => { e.stopPropagation(); toggleSelection(asset.id); }}
                    style={{
                      position: 'absolute',
                      bottom: '2px',
                      left: '2px',
                      width: '10px',
                      height: '10px',
                      zIndex: 30,
                      cursor: 'pointer'
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Rules Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--spacing-sm)' }}>
            <h4 style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>替换规则</h4>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              {currentAsset
                ? currentAsset.ocrStatus === "loading"
                  ? "OCR 识别中..."
                  : currentAsset.ocrStatus === "failed"
                    ? "OCR 失败"
                    : currentAsset.ocrStatus === "ready" && !currentAsset.ocrVisible
                      ? "先点 A 区底部“显示 OCR”"
                      : currentAsset.ocrStatus === "ready"
                        ? "先点 before 框，再点 A 区框"
                        : "先点 A 区底部“开始 OCR”"
                : "请先选图"}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            {(currentAsset?.rules || []).map((rule, idx) => (
              <div key={rule.id} style={{ display: 'flex', gap: 'var(--spacing-xs)', alignItems: 'center' }}>
                <input 
                  value={rule.sourceText}
                  onInput={(e) => updateRule(rule.id, "sourceText", (e.target as HTMLInputElement).value)}
                  onFocus={() => setOcrTargetRule(rule.id)}
                  onClick={() => setOcrTargetRule(rule.id)}
                  placeholder={`Source ${idx + 1}`}
                  aria-label={`Before ${idx + 1}`}
                  style={{
                    flex: 1,
                    height: '28px',
                    padding: '0 8px',
                    borderRadius: 'var(--radius-sm)',
                    border: rule.id === ocrTargetRuleId ? '1px solid var(--accent)' : '1px solid var(--border-color)',
                    backgroundColor: 'var(--surface-lighter)',
                    color: 'var(--text-primary)',
                    fontSize: '0.75rem',
                    boxShadow: rule.id === ocrTargetRuleId ? '0 0 0 2px var(--accent-muted)' : 'none'
                  }}
                />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>→</span>
                <input 
                  value={rule.targetText}
                  onInput={(e) => updateRule(rule.id, "targetText", (e.target as HTMLInputElement).value)}
                  placeholder={`Target ${idx + 1}`}
                  aria-label={`After ${idx + 1}`}
                  style={{
                    flex: 1,
                    height: '28px',
                    padding: '0 8px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--surface-lighter)',
                    color: 'var(--text-primary)',
                    fontSize: '0.75rem'
                  }}
                />
                <button 
                  onClick={() => removeRule(rule.id)}
                  style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', fontSize: '0.7rem' }}
                >✕</button>
              </div>
            ))}
            <button 
              onClick={() => {
                const lastRule = (currentAsset?.rules || [])[(currentAsset?.rules.length || 0) - 1];
                if (lastRule) insertRuleAfter(lastRule.id);
                else insertRuleAfter(""); // Fallback for empty rules
              }}
              style={{
                marginTop: '2px',
                height: '24px',
                border: '1px dashed var(--border-color)',
                backgroundColor: 'transparent',
                color: 'var(--text-muted)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.7rem',
                cursor: 'pointer'
              }}
              disabled={!currentAsset}
            >+ 添加新规则</button>
          </div>
        </div>

        {/* Notes Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
          <h4 style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>额外说明</h4>
          <textarea 
            value={currentAsset?.notes || ""}
            onInput={(e) => updateNotes((e.target as HTMLTextAreaElement).value)}
            placeholder={currentAsset ? "补充说明（可选）..." : "请先选择一张图片"}
            disabled={!currentAsset}
            style={{
              width: '100%',
              minHeight: '60px',
              padding: '8px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--surface-lighter)',
              color: 'var(--text-primary)',
              fontSize: '0.75rem',
              resize: 'none'
            }}
          />
        </div>

        </div>

        {/* Action Buttons at Bottom of B zone */}
        <div class="panel-actions-bar panel-actions-bar-end">
          <div class="panel-actions-group">
            <button
              class="button button-ghost"
              style={{
                ...compactGhostActionButtonStyle,
                color: 'var(--error)',
                borderColor: 'oklch(0.6 0.18 20 / 0.2)',
                transition: 'all 0.3s ease',
              }}
              onClick={clearAllImages}
            >
              清空
            </button>
            <button class="button button-ghost" style={compactGhostActionButtonStyle} onClick={clearCurrent}>
              重置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
