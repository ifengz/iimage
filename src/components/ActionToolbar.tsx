interface ActionToolbarProps {
  handleUpload: (files: FileList | null) => void;
  startBatch: () => void;
  pauseBatch: () => void;
  downloadSelected: () => void;
  isRunning: boolean;
  canStartBatch: boolean;
  settings: { apiKeys: string; model: string; parallelLimit: number };
  updateSettings: (newSettings: {
    apiKeys?: string;
    model?: string;
    parallelLimit?: number;
  }) => void;
}

import { useState, useEffect } from "preact/hooks";

const modelOptions = [
  { label: 'Gemini 3.1 Flash Image Preview', value: 'models/gemini-3.1-flash-image-preview' },
  { label: 'Gemini 3 Pro Image Preview', value: 'models/gemini-3-pro-image-preview' },
  { label: 'Gemini 2.5 Flash Image', value: 'models/gemini-2.5-flash-image' },
  { label: 'Imagen 4.0 Generate-001', value: 'models/imagen-4.0-generate-001' },
];

export const ActionToolbar = ({
  handleUpload,
  startBatch,
  pauseBatch,
  downloadSelected,
  isRunning,
  canStartBatch,
  settings,
  updateSettings,
}: ActionToolbarProps) => {
  const [activeBtn, setActiveBtn] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const trigger = (name: string, fn: () => void) => {
    setActiveBtn(name);
    fn();
    setTimeout(() => setActiveBtn(null), 300);
  };

  // Handle Esc key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsModalOpen(false);
      }
    };
    if (isModalOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isModalOpen]);

  return (
    <div style={{ 
      display: 'flex', 
      gap: 'var(--spacing-md)', 
      justifyContent: 'center', 
      alignItems: 'center',
      padding: 'var(--spacing-sm) 0',
      position: 'relative'
    }}>
      {/* Settings Icon Button */}
      <button 
        class="button" 
        type="button"
        aria-label="打开系统设置"
        aria-haspopup="dialog"
        style={{ 
          width: '32px', 
          padding: 0, 
          borderRadius: '50%',
          backgroundColor: 'transparent',
          border: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onClick={() => setIsModalOpen(true)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>

      <label class={`button ${activeBtn === 'upload' ? 'button-active' : ''}`} style={{ 
        height: '32px', 
        padding: '0 var(--spacing-lg)', 
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center'
      }}>
        <span>批量上传</span>
        <input 
          type="file" 
          multiple 
          accept="image/*" 
          onChange={(e) => handleUpload((e.target as HTMLInputElement).files)} 
          style={{ display: 'none' }} 
        />
      </label>

      <button 
        class={`button ${isRunning ? 'button-secondary' : 'button-primary'} ${activeBtn === 'process' ? 'button-active' : ''}`}
        style={{ height: '32px', padding: '0 var(--spacing-lg)' }}
        type="button"
        disabled={isRunning || !canStartBatch}
        onClick={() => trigger('process', startBatch)}
      >
        {isRunning ? "生成中" : "开始生成"}
      </button>

      {/* Cancel Button (取消) - Red Outline Styled */}
      <button 
        class={`button button-danger-outline ${activeBtn === 'cancel' ? 'button-active' : ''}`}
        style={{ 
          height: '32px', 
          padding: '0 var(--spacing-lg)',
          opacity: isRunning ? 1 : 0.5,
          cursor: isRunning ? 'pointer' : 'not-allowed'
        }}
        type="button"
        onClick={() => isRunning && trigger('cancel', pauseBatch)}
      >
        停止生成
      </button>

      <button 
        class={`button ${activeBtn === 'download' ? 'button-active' : ''}`}
        style={{ height: '32px', padding: '0 var(--spacing-lg)' }}
        type="button"
        onClick={() => trigger('download', downloadSelected)}
      >
        下载图片
      </button>

      {/* Settings Modal */}
      {isModalOpen && (
        <div class="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div
            class="modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div class="panel-header">
              <span class="panel-title" id="settings-dialog-title">系统设置</span>
              <button 
                class="button button-ghost" 
                type="button"
                aria-label="关闭系统设置"
                style={{ width: '24px', height: '24px', padding: 0 }}
                onClick={() => setIsModalOpen(false)}
              >✕</button>
            </div>
            <div class="panel-body" style={{ padding: 'var(--spacing-md)', overflow: 'visible' }}>
              <div class="setting-row">
                <label class="setting-label" htmlFor="settings-api-keys">API Keys (每行一个)</label>
                <textarea 
                  id="settings-api-keys"
                  class="setting-input" 
                  style={{ minHeight: '100px', resize: 'vertical' }}
                  value={settings.apiKeys}
                  onInput={(e) => updateSettings({ apiKeys: (e.target as HTMLTextAreaElement).value })}
                  placeholder="Paste your API keys here..."
                />
              </div>

              <div class="setting-row">
                <label class="setting-label" htmlFor="settings-model">Gemini Model</label>
                <select
                  id="settings-model"
                  class="setting-input"
                  aria-label="Gemini Model"
                  value={settings.model}
                  onInput={(e) =>
                    updateSettings({ model: (e.target as HTMLSelectElement).value })
                  }
                >
                  {modelOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div class="setting-row">
                <label class="setting-label" htmlFor="settings-parallel-limit">并行数</label>
                <input
                  id="settings-parallel-limit"
                  class="setting-input"
                  type="number"
                  min={1}
                  max={10}
                  aria-label="并行数"
                  value={settings.parallelLimit}
                  onInput={(e) =>
                    updateSettings({
                      parallelLimit: Math.min(
                        10,
                        Math.max(1, Number((e.target as HTMLInputElement).value) || 1),
                      ),
                    })
                  }
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--spacing-md)' }}>
                <button 
                  class="button button-primary" 
                  type="button"
                  style={{ height: '36px', padding: '0 var(--spacing-xl)' }}
                  onClick={() => setIsModalOpen(false)}
                >
                  完成
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
