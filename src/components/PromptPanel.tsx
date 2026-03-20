interface PromptPanelProps {
  promptDraft: string;
  setPromptDraft: (value: string) => void;
  savePrompt: () => void;
  restoreGeneratedPrompt: () => void;
}

import { useState } from "preact/hooks";

export const PromptPanel = ({
  promptDraft,
  setPromptDraft,
  savePrompt,
  restoreGeneratedPrompt,
}: PromptPanelProps) => {
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const handleSave = () => {
    setSaveStatus("saving");
    savePrompt();
    setTimeout(() => {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }, 600);
  };

  return (
    <div class="panel">
      <div class="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <span class="panel-title">C区 · Gemini Prompt</span>
        </div>
      </div>
      <div class="panel-body" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
        <textarea
          value={promptDraft}
          onInput={(e) => setPromptDraft((e.target as HTMLTextAreaElement).value)}
          placeholder="Gemini prompt will appear here..."
          style={{
            width: '100%',
            flex: 1,
            backgroundColor: 'transparent',
            border: 'none',
            color: 'oklch(0.3 0.1 260)',
            fontFamily: "'Geist Mono', monospace",
            fontSize: '0.8rem',
            padding: 'var(--spacing-md)',
            resize: 'none',
            outline: 'none',
            lineHeight: '1.6',
            overflowX: 'hidden',
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap'
          }}
        />

        {/* Action Buttons at Bottom (Symmetric with B-zone) */}
        <div style={{ 
          display: 'flex', 
          gap: 'var(--spacing-sm)', 
          justifyContent: 'flex-end',
          padding: 'var(--spacing-sm)',
          borderTop: '1px solid var(--border-color)'
        }}>
          <button class="button button-ghost" style={{ height: '28px', fontSize: '0.75rem' }} onClick={restoreGeneratedPrompt}>
            重置
          </button>
          <button 
            class={`button ${saveStatus === 'saved' ? 'button-success' : 'button-primary'}`} 
            style={{ 
              height: '28px', 
              minWidth: '60px',
              transition: 'all 0.3s ease',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }} 
            onClick={handleSave}
            disabled={saveStatus !== 'idle'}
          >
            {saveStatus === 'idle' && "保存"}
            {saveStatus === 'saving' && "..."}
            {saveStatus === 'saved' && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
