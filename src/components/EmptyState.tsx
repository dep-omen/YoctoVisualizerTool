import React from 'react';
import { FolderOpen, Sparkles, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';

interface EmptyStateProps {
  onOpenFolder: () => void;
  onLoadDemo: () => void;
  isScanning: boolean;
  scanStatus?: { phase: string; message: string; processed?: number; total?: number } | null;
  errorMessage?: string | null;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  onOpenFolder,
  onLoadDemo,
  isScanning,
  scanStatus,
  errorMessage
}) => {
  return (
    <div className="w-full h-full flex items-center justify-center p-6 bg-[var(--bg-primary)] select-none">
      {/* Centered Landing Area Card */}
      <div className="max-w-xl w-full text-center space-y-6">
        {/* Glowing Folder Icon */}
        <div className="relative inline-flex items-center justify-center">
          <div className="absolute inset-0 rounded-3xl bg-blue-500/10 blur-2xl animate-pulse" />
          <div className="relative w-20 h-20 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border)]  flex items-center justify-center text-blue-400 group">
            <FolderOpen className="w-10 h-10 text-blue-400 transition-transform duration-300 group-hover:scale-105" />
          </div>
        </div>

        {/* Title & Subtitle */}
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Drop your Yocto build folder
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-md mx-auto leading-relaxed">
            Parses <code className="text-blue-400 bg-[var(--bg-panel)] px-1.5 py-0.5 rounded border border-[var(--border)] font-mono text-xs">bblayers.conf</code>, <code className="text-blue-400 bg-[var(--bg-panel)] px-1.5 py-0.5 rounded border border-[var(--border)] font-mono text-xs">local.conf</code>, and every <code className="text-blue-400 bg-[var(--bg-panel)] px-1.5 py-0.5 rounded border border-[var(--border)] font-mono text-xs">layer.conf</code> automatically.
          </p>
        </div>

        {/* Error Alert Box (if parsing or file lookup failed) */}
        {errorMessage && (
          <div
            id="error-message-alert"
            className="p-4 rounded-lg bg-red-950/70 border border-red-800 text-red-200 text-xs text-left flex items-start gap-3  animate-in fade-in zoom-in-95 duration-200"
          >
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-red-300">Project Directory Error</div>
              <div className="text-red-200/90 leading-normal">{errorMessage}</div>
            </div>
          </div>
        )}

        {/* Scanning Progress Indicator */}
        {isScanning && (
          <div className="p-5 rounded-lg bg-[var(--bg-panel)] border border-[var(--border)]  text-left space-y-3">
            <div className="flex items-center justify-between text-xs text-[var(--text-primary)]">
              <span className="font-semibold flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping" />
                {scanStatus?.message || 'Reading BitBake configuration files...'}
              </span>
              {scanStatus?.total && scanStatus?.processed && (
                <span className="font-mono text-[var(--text-muted)]">
                  {scanStatus.processed} / {scanStatus.total}
                </span>
              )}
            </div>
            {scanStatus?.total && scanStatus?.processed && (
              <div className="w-full bg-[#090c10] h-2 rounded-full overflow-hidden border border-[var(--border)]">
                <div
                  className="bg-blue-500 h-full transition-all duration-200 rounded-full"
                  style={{ width: `${(scanStatus.processed / scanStatus.total) * 100}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {!isScanning && (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              id="open-folder-landing-btn"
              onClick={onOpenFolder}
              className="w-full sm:w-auto px-5 py-2.5 rounded-[6px] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold text-[12px] flex items-center justify-center gap-2 transition"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Open Yocto Project Folder</span>
            </button>
            <button
              id="try-demo-landing-btn"
              onClick={onLoadDemo}
              className="w-full sm:w-auto px-4 py-2.5 rounded-[6px] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-semibold text-[12px] border border-[var(--border)] hover:border-[var(--border-strong)] flex items-center justify-center gap-2 transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Explore Sample STM32MP1 Demo</span>
            </button>
          </div>
        )}

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 text-left">
          <div className="p-3.5 rounded-lg bg-[var(--bg-panel)] border border-[var(--border)] space-y-1">
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Real BitBake Parser
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">
              Extracts dependencies, priorities, compatibility, and variable flags.
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-[var(--bg-panel)] border border-[var(--border)] space-y-1">
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Recipe & Override Index
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">
              Scans all <code className="text-blue-400">.bb</code> and <code className="text-amber-400">.bbappend</code> files grouped by category.
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-[var(--bg-panel)] border border-[var(--border)] space-y-1">
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              D3 Dependency Graph
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">
              Force-directed visualization with zoom, drag, and deep inspection.
            </div>
          </div>
        </div>

        {/* Privacy & Browser API note */}
        <div className="pt-2 flex items-center justify-center gap-2 text-xs text-[var(--text-muted)]">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Works entirely in your browser — nothing is uploaded anywhere</span>
        </div>
      </div>
    </div>
  );
};

