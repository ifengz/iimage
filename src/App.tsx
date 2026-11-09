import { ActionToolbar } from "./components/ActionToolbar";
import { EditPanel } from "./components/EditPanel";
import { PreviewPanel } from "./components/PreviewPanel";
import { PromptPanel } from "./components/PromptPanel";
import { StatusFooter } from "./components/StatusFooter";
import { useAssets } from "./hooks/useAssets";

export default function App() {
  const {
    assets,
    currentAsset,
    previewMode,
    setPreviewMode,
    selectedIds,
    toggleSelection,
    stats,
    promptDraft,
    setPromptDraft,
    ocrTargetRuleId,
    selectAsset,
    updateRule,
    setOcrTargetRule,
    applyOcrTextToTarget,
    runCurrentOcr,
    toggleCurrentOcrVisibility,
    updateNotes,
    insertRuleAfter,
    removeRule,
    clearCurrent,
    startBatch,
    pauseBatch,
    handleUpload,
    handleSlotUpload,
    deleteAsset,
    clearAllImages,
    downloadSelected,
    downloadCurrentResult,
    savePrompt,
    restoreGeneratedPrompt,
    settings,
    updateSettings,
    batchMessage,
    batchPhase,
    canStartBatch,
    logs,
    clearLogs,
  } = useAssets();

  const isRunning = stats.running > 0;

  return (
    <main class="workbench">
      <div class="top-row">
        <PreviewPanel 
          currentAsset={currentAsset} 
          previewMode={previewMode}
          onDownloadResult={downloadCurrentResult}
          onRunOcr={runCurrentOcr}
          onToggleOcrVisibility={toggleCurrentOcrVisibility}
          onSelectOcrText={applyOcrTextToTarget}
        />
        <EditPanel
          assets={assets}
          currentAsset={currentAsset}
          selectedIds={selectedIds}
          toggleSelection={toggleSelection}
          selectAsset={selectAsset}
          previewMode={previewMode}
          setPreviewMode={setPreviewMode}
          ocrTargetRuleId={ocrTargetRuleId}
          setOcrTargetRule={setOcrTargetRule}
          updateRule={updateRule}
          updateNotes={updateNotes}
          insertRuleAfter={insertRuleAfter}
          removeRule={removeRule}
          clearCurrent={clearCurrent}
          clearAllImages={clearAllImages}
          handleSlotUpload={handleSlotUpload}
          deleteAsset={deleteAsset}
        />
        <PromptPanel
          promptDraft={promptDraft}
          setPromptDraft={setPromptDraft}
          savePrompt={savePrompt}
          restoreGeneratedPrompt={restoreGeneratedPrompt}
        />
      </div>

      <div class="bottom-rail">
        <ActionToolbar
          handleUpload={handleUpload}
          startBatch={startBatch}
          pauseBatch={pauseBatch}
          downloadSelected={downloadSelected}
          isRunning={isRunning}
          canStartBatch={canStartBatch}
          settings={settings}
          updateSettings={updateSettings}
        />

        <details class="log-panel">
          <summary class="log-summary">
            <span>运行日志（{logs.length}）</span>
            <button
              type="button"
              class="button button-ghost log-clear"
              onClick={(event) => {
                event.preventDefault();
                clearLogs();
              }}
              disabled={logs.length === 0}
            >
              清空日志
            </button>
          </summary>
          <pre class="log-body">{logs.length === 0 ? "还没有日志，上传、OCR、生成都会记在这里。" : logs.join("\n")}</pre>
        </details>

        <StatusFooter
          stats={stats}
          model={settings.imageModel}
          message={batchMessage}
          phase={batchPhase}
        />
      </div>
    </main>
  );
}
