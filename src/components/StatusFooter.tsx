interface StatusFooterProps {
  stats: {
    total: number;
    ready: number;
    running: number;
    success: number;
    failed: number;
    progress: number;
  };
  model: string;
  message?: string | null;
  phase?: string;
}

const getStatusPhase = ({
  failed,
  progress,
  running,
}: {
  failed: number;
  progress: number;
  running: number;
}) => {
  if (failed > 0 && running === 0) return "failed";
  if (running === 0) return "idle";
  if (progress >= 90) return "ending";
  if (progress >= 45) return "middle";
  return "starting";
};

const phaseColor: Record<string, string> = {
  idle: "var(--text-muted)",
  starting: "var(--accent)",
  middle: "#f59e0b",
  ending: "var(--success)",
  preparing: "var(--accent)",
  requesting: "#f59e0b",
  finishing: "var(--success)",
  failed: "var(--error)",
};

const phasePulseColor: Record<string, string> = {
  idle: "var(--text-secondary)",
  starting: "#8cc3ff",
  middle: "#fbbf24",
  ending: "#86efac",
  preparing: "#8cc3ff",
  requesting: "#fbbf24",
  finishing: "#86efac",
  failed: "#fb7185",
};

const phaseGlowColor: Record<string, string> = {
  idle: "rgba(148, 163, 184, 0.18)",
  starting: "rgba(96, 165, 250, 0.22)",
  middle: "rgba(245, 158, 11, 0.22)",
  ending: "rgba(34, 197, 94, 0.22)",
  preparing: "rgba(96, 165, 250, 0.22)",
  requesting: "rgba(245, 158, 11, 0.22)",
  finishing: "rgba(34, 197, 94, 0.22)",
  failed: "rgba(239, 68, 68, 0.22)",
};

export const StatusFooter = ({ stats, model, message, phase: activePhase }: StatusFooterProps) => {
  const isRunning = stats.running > 0;
  const phase =
    activePhase && activePhase !== "idle" ? activePhase : getStatusPhase(stats);
  const indicatorColor = phaseColor[phase];
  const indicatorPulseColor = phasePulseColor[phase];
  const indicatorGlowColor = phaseGlowColor[phase];
  const modelLabel = model.split("/").pop()?.toUpperCase();

  return (
    <div
      role="status"
      aria-live="polite"
      style={{ 
      display: 'flex', 
      padding: '8px var(--spacing-xl)', 
      backgroundColor: 'var(--surface-color)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-color)',
      maxWidth: '1200px',
      width: '100%',
      margin: '0 auto',
      boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        width: '100%',
        fontSize: '0.7rem',
        color: 'var(--text-secondary)',
        fontWeight: 600,
        letterSpacing: '0.03em'
      }}>
        <div style={{ display: 'flex', gap: 'var(--spacing-lg)', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div
              data-testid="status-indicator"
              data-phase={phase}
              style={{ 
                width: '6px', 
                height: '6px', 
                borderRadius: '50%', 
                backgroundColor: indicatorColor,
                animation: isRunning ? 'status-indicator-breathe 1.5s infinite ease-in-out' : 'none',
                ['--status-indicator-base' as string]: indicatorColor,
                ['--status-indicator-pulse' as string]: indicatorPulseColor,
                ['--status-indicator-glow' as string]: indicatorGlowColor,
              }}
            />
            <span style={{ color: isRunning ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {isRunning ? 'GENERATING...' : 'IDLE'}
            </span>
          </div>

          <div style={{ width: '1px', height: '12px', backgroundColor: 'var(--border-color)' }} />
          
          <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
            <span>TOTAL: {stats.total}</span>
            <span style={{ color: 'var(--accent)' }}>READY: {stats.ready}</span>
            <span style={{ color: 'var(--success)' }}>SUCCESS: {stats.success}</span>
            <span style={{ color: 'var(--error)' }}>FAILED: {stats.failed}</span>
          </div>

          <div style={{ width: '1px', height: '12px', backgroundColor: 'var(--border-color)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>MODEL:</span>
            <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{modelLabel}</span>
            {message ? (
              <>
                <span style={{ color: 'var(--border-color)' }}>/</span>
                <span
                  style={{
                    color: 'var(--text-secondary)',
                    fontWeight: 400,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {message}
                </span>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
