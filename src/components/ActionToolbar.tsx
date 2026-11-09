import { fetchEndpointHints } from "../gateway-endpoints";
import { useState, useEffect } from "preact/hooks";
import {
  getModelChoices,
  reconcileMediaSettings,
  testConnection,
  type MediaModel,
} from "newapi-media-client/config";
import type { MediaGatewaySettings } from "../hooks/useAssets";
import { proxyGatewayUrl } from "../dev-gateway-proxy";

interface ActionToolbarProps {
  handleUpload: (files: FileList | null) => Promise<void> | void;
  startBatch: () => void;
  pauseBatch: () => void;
  downloadSelected: () => void;
  isRunning: boolean;
  canStartBatch: boolean;
  settings: MediaGatewaySettings;
  updateSettings: (newSettings: Partial<MediaGatewaySettings>) => void;
  logs: string[];
  clearLogs: () => void;
}

export const ActionToolbar = ({
  handleUpload,
  startBatch,
  pauseBatch,
  downloadSelected,
  isRunning,
  canStartBatch,
  settings,
  updateSettings,
  logs,
  clearLogs,
}: ActionToolbarProps) => {
  const [activeBtn, setActiveBtn] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [imageModels, setImageModels] = useState<MediaModel[]>([]);
  const [endpointHints, setEndpointHints] = useState<Record<string, string[]>>({});
  const [unclassifiedModels, setUnclassifiedModels] = useState<MediaModel[]>([]);
  const isChatOnly = (id: string) =>
    (endpointHints[id] ?? []).some((typeName) => typeName === "openai" || typeName === "gemini");
  const chatOnlyModels = unclassifiedModels.filter((model) => isChatOnly(model.id));
  const unknownModels = unclassifiedModels.filter((model) => !isChatOnly(model.id));


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
          onChange={(e) => {
            const input = e.target as HTMLInputElement;
            void Promise.resolve(handleUpload(input.files)).finally(() => {
              input.value = "";
            });
          }}
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

      <button
        class="button"
        type="button"
        aria-haspopup="dialog"
        aria-label="打开运行日志"
        style={{ height: '32px', padding: '0 var(--spacing-lg)' }}
        onClick={() => setIsLogOpen(true)}
      >
        日志{logs.length > 0 ? `（${logs.length}）` : ""}
      </button>

      {/* Logs Modal */}
      {isLogOpen && (
        <div class="modal-backdrop" onClick={() => setIsLogOpen(false)}>
          <div
            class="modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logs-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div class="panel-header">
              <span class="panel-title" id="logs-dialog-title">运行日志</span>
              <button
                class="button button-ghost"
                type="button"
                aria-label="关闭运行日志"
                style={{ width: '24px', height: '24px', padding: 0 }}
                onClick={() => setIsLogOpen(false)}
              >✕</button>
            </div>
            <div class="panel-body" style={{ padding: 'var(--spacing-md)' }}>
              <pre class="log-modal-body">
                {logs.length === 0
                  ? "还没有日志，上传、OCR、生成都会记在这里。"
                  : logs.join("\n")}
              </pre>
            </div>
            <div class="panel-actions-bar panel-actions-bar-between">
              <span class="panel-action-hint">{logs.length} 条记录</span>
              <div class="panel-actions-group">
                <button
                  class="button button-ghost"
                  type="button"
                  disabled={logs.length === 0}
                  onClick={clearLogs}
                >
                  清空日志
                </button>
                <button
                  class="button button-primary"
                  type="button"
                  onClick={() => setIsLogOpen(false)}
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
              <div
                role="note"
                style={{
                  marginBottom: 'var(--spacing-md)',
                  padding: 'var(--spacing-sm)',
                  fontSize: '0.78rem',
                  color: 'var(--warning, #f59e0b)',
                  border: '1px solid var(--warning, #f59e0b)',
                  borderRadius: 'var(--radius-md, 6px)',
                }}
              >
                ⚠️ 仅本地开发使用：网关令牌只保存在本次页面内存中，刷新后需重新填写，禁止用于生产环境。
              </div>

              <div class="setting-row">
                <label class="setting-label" htmlFor="settings-gateway-url">网关地址</label>
                <input
                  id="settings-gateway-url"
                  class="setting-input"
                  type="text"
                  value={settings.baseUrl}
                  onInput={(e) => updateSettings({ baseUrl: (e.target as HTMLInputElement).value })}
                  placeholder={`${window.location.origin}/gateway`}
                />
                <div
                  style={{
                    marginTop: "4px",
                    fontSize: "0.72rem",
                    color: "var(--text-secondary, #6b7280)",
                  }}
                >
                  本地开发会把该网关的请求经 Vite 同源代理转发，绕开网关未开放跨域的限制。
                </div>
              </div>

              <div class="setting-row">
                <label class="setting-label" htmlFor="settings-token">网关令牌</label>
                <input
                  id="settings-token"
                  class="setting-input"
                  type="password"
                  value={settings.token}
                  onInput={(e) => updateSettings({ token: (e.target as HTMLInputElement).value })}
                  placeholder="sk-..."
                />
              </div>

              <div class="setting-row">
                <label class="setting-label" htmlFor="settings-image-model">生图模型</label>
                <select
                  id="settings-image-model"
                  class="setting-input"
                  value={settings.imageModel}
                  onChange={(e) => updateSettings({ imageModel: (e.target as HTMLSelectElement).value })}
                >
                  <option value="">（点“同步模型”拉取目录）</option>
                  {imageModels.length > 0 && (
                    <optgroup label="已声明生图能力">
                      {imageModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.id}
                          {endpointHints[model.id] ? ` · ${endpointHints[model.id].join("/")}` : ""}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {chatOnlyModels.length > 0 && (
                    <optgroup label="仅聊天接口（出图会重画版面）">
                      {chatOnlyModels.map((model) => (
                        <option key={model.id} value={model.id}>{model.id}</option>
                      ))}
                    </optgroup>
                  )}
                  {unknownModels.length > 0 && (
                    <optgroup label="⚠ 未声明生图能力（网关未发布元数据，需自行确认）">
                      {unknownModels.map((model) => (
                        <option key={model.id} value={model.id}>{model.id}</option>
                      ))}
                    </optgroup>
                  )}
                  {settings.imageModel &&
                    !imageModels.some((model) => model.id === settings.imageModel) &&
                    !unclassifiedModels.some((model) => model.id === settings.imageModel) && (
                      <option value={settings.imageModel}>{settings.imageModel}</option>
                    )}
                </select>
                {settings.imageModel && endpointHints[settings.imageModel] && (
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                    网关声明接口：{endpointHints[settings.imageModel].join("、")}（images 走改图，openai/gemini 走聊天重画）
                  </div>
                )}
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
                  class="button"
                  type="button"
                  style={{ height: '36px', padding: '0 var(--spacing-xl)', marginRight: 'var(--spacing-sm)' }}
                  disabled={isTesting}
                  onClick={() => {
                    setIsTesting(true);
                    setTestResult(null);
                    void testConnection({
                        baseUrl: proxyGatewayUrl(settings.baseUrl, false),
                        apiKey: settings.token,
                      })
                      .then(async (result) => {
                        if (!result.ok || !result.models) {
                          setTestResult(result);
                          setImageModels([]);
                          setUnclassifiedModels([]);
                          setEndpointHints({});
                          return;
                        }
                        // /v1/models 常常不带能力字段，再用免费的 /api/pricing 补一遍
                        const hints = await fetchEndpointHints(settings.baseUrl).catch(
                          () => ({}) as Record<string, string[]>,
                        );
                        const enriched = result.models.map((model) =>
                          model.supported_endpoint_types?.length || !hints[model.id]
                            ? model
                            : { ...model, supported_endpoint_types: hints[model.id] },
                        );
                        const choices = getModelChoices(enriched);
                        // 结果与模型列表一起提交，避免“已获取”先出现、下拉还空一瞬
                        setTestResult(result);
                        setEndpointHints(hints);
                        setImageModels(choices.image);
                        setUnclassifiedModels(choices.unclassified);
                        const reconciled = reconcileMediaSettings(
                          {
                            baseUrl: settings.baseUrl,
                            analysisModel: "",
                            imageModel: settings.imageModel,
                            imageSize: settings.imageSize,
                          },
                          choices,
                        );
                        if (reconciled.imageModel !== settings.imageModel) {
                          updateSettings({ imageModel: reconciled.imageModel });
                        }
                      })
                      .finally(() => setIsTesting(false));
                  }}
                >
                  {isTesting ? '同步中…' : '同步模型'}
                </button>
                <button
                  class="button button-primary"
                  type="button"
                  style={{ height: '36px', padding: '0 var(--spacing-xl)' }}
                  onClick={() => setIsModalOpen(false)}
                >
                  完成
                </button>
              </div>

              {testResult && (
                <div
                  role="status"
                  style={{
                    marginTop: 'var(--spacing-sm)',
                    fontSize: '0.8rem',
                    color: testResult.ok ? 'var(--success)' : 'var(--error)',
                  }}
                >
                  {testResult.ok ? '✓ ' : '✗ '}{testResult.message}
                </div>
              )}

              {testResult?.ok && imageModels.length === 0 && unclassifiedModels.length === 0 && (
                <div
                  role="alert"
                  style={{ marginTop: 'var(--spacing-sm)', fontSize: '0.8rem', color: 'var(--error)' }}
                >
                  模型目录为空或没有可用模型。
                </div>
              )}

              {settings.imageModel && chatOnlyModels.some((model) => model.id === settings.imageModel) && (
                <div
                  role="note"
                  style={{ marginTop: 'var(--spacing-sm)', fontSize: '0.8rem', color: 'var(--text-secondary, #6b7280)' }}
                >
                  该模型未声明图片接口，会走聊天接口出图：版式可能被重画、尺寸按模型自己决定。
                </div>
              )}

              {settings.imageModel && unknownModels.some((model) => model.id === settings.imageModel) && (
                <div
                  role="note"
                  style={{ marginTop: 'var(--spacing-sm)', fontSize: '0.8rem', color: 'var(--warning, #f59e0b)' }}
                >
                  当前模型未声明生图能力（网关未发布能力元数据）。若生图失败，请到网关后台确认该模型的可用端点。
                </div>
              )}

              {unknownModels.length > 0 && (
                <div
                  role="status"
                  style={{ marginTop: 'var(--spacing-sm)', fontSize: '0.8rem', color: 'var(--warning, #f59e0b)' }}
                >
                  {unknownModels.length} 个模型未声明生图能力，已放入下拉的警示分组，是否可用请自行确认。
                </div>
              )}

              {chatOnlyModels.length > 0 && (
                <div
                  role="status"
                  style={{ marginTop: 'var(--spacing-sm)', fontSize: '0.8rem', color: 'var(--text-secondary, #6b7280)' }}
                >
                  {chatOnlyModels.length} 个模型只开放聊天接口：能出图，但会重新画整张版面。
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
