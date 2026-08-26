import React, { useState } from 'react';
import { YoctoBuildConfig } from '../types';
import { Logo } from './Logo';
import {
  FolderOpen, Calculator, Maximize2, Download, FileCode, Layers, 
  ChevronDown, AlertTriangle, Network, Search, Sparkles, Sun, Moon
} from 'lucide-react';

interface HeaderBarProps {
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  config: YoctoBuildConfig | null;
  activeTab: string;
  onTabChange: (tab: 'graph' | 'conflicts' | 'package-tracer' | 'bbappends' | 'estimator') => void;
  conflictCount: number;
  criticalCount: number;
  traceCount: number;
  bbappendCount: number;
  orphanCount: number;
  layoutMode: 'tree' | 'force';
  onLayoutModeChange: (mode: 'tree' | 'force') => void;
  onOpenFolder: () => void;
  onFitGraph: () => void;
  onExportPng: () => void;
  onDownloadHtml: () => void;
  onLoadDemo: () => void;
  isScanning: boolean;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  theme, setTheme,
  config,
  activeTab,
  onTabChange,
  conflictCount,
  criticalCount,
  traceCount,
  bbappendCount,
  orphanCount,
  layoutMode,
  onLayoutModeChange,
  onOpenFolder,
  onFitGraph,
  onExportPng,
  onDownloadHtml,
  onLoadDemo,
  isScanning
}) => {
  const [showDistroFeaturesModal, setShowDistroFeaturesModal] = useState(false);

  return (
    <header className="h-[48px] bg-[var(--bg-secondary)] border-b border-[var(--border)] flex items-center justify-between px-4 shrink-0 transition-colors">
      
      {/* Left: Logo, Title, Divider, Tabs */}
      <div className="flex items-center h-full">
        <Logo size={28} />
        <span className="ml-2 text-[14px] font-medium text-[var(--text-primary)] whitespace-nowrap">
          YoctoVisualizer
        </span>
        
        <div className="h-6 w-[1px] bg-[var(--border)] mx-4 shrink-0" />
        
        {/* Tabs inside header */}
        {config && (
          <div className="flex items-center h-full">
            <button
              onClick={() => onTabChange('graph')}
              className={`h-full flex items-center px-3 text-[13px] transition ${activeTab === 'graph' ? 'text-[var(--text-primary)] border-b-[2px] border-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
            >
              Layer Graph
            </button>
            <button
              onClick={() => onTabChange('conflicts')}
              className={`h-full flex items-center gap-1.5 px-3 text-[13px] transition ${activeTab === 'conflicts' ? 'text-[var(--text-primary)] border-b-[2px] border-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
            >
              Conflict Detector
              {conflictCount > 0 && (
                <span className={`ml-0.5 px-[4px] rounded-full text-[11px] font-medium ${criticalCount > 0 ? 'bg-[var(--danger-bg)] text-[var(--danger)]' : 'bg-[var(--accent-bg)] text-[var(--accent-text)]'}`}>
                  {conflictCount}
                </span>
              )}
            </button>
            <button
              onClick={() => onTabChange('package-tracer')}
              className={`h-full flex items-center gap-1.5 px-3 text-[13px] transition ${activeTab === 'package-tracer' ? 'text-[var(--text-primary)] border-b-[2px] border-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
            >
              Package Tracer
              {traceCount > 0 && (
                <span className="ml-0.5 px-[4px] rounded-full bg-[var(--accent-bg)] text-[var(--accent-text)] text-[11px] font-medium">
                  {traceCount}
                </span>
              )}
            </button>
            <button
              onClick={() => onTabChange('bbappends')}
              className={`h-full flex items-center gap-1.5 px-3 text-[13px] transition ${activeTab === 'bbappends' ? 'text-[var(--text-primary)] border-b-[2px] border-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
            >
              BBAppend Viewer
              {bbappendCount > 0 && (
                <span className={`ml-0.5 px-[4px] rounded-full text-[11px] font-medium ${orphanCount > 0 ? 'bg-[var(--danger-bg)] text-[var(--danger)]' : 'bg-[var(--accent-bg)] text-[var(--accent-text)]'}`}>
                  {bbappendCount}
                </span>
              )}
            </button>
            <button
              onClick={() => onTabChange('estimator')}
              className={`h-full flex items-center px-3 text-[13px] transition ${activeTab === 'estimator' ? 'text-[var(--text-primary)] border-b-[2px] border-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
            >
              Build Estimator
            </button>
          </div>
        )}
      </div>

      {/* Center: Machine and Distro Pills */}
      <div className="hidden xl:flex items-center justify-center flex-1 mx-4">
        {config && (
          <div className="flex items-center gap-2">
            {config.machine && (
              <span className="px-[6px] py-[3px] bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-full text-[12px] truncate max-w-[200px]" title={`Target Machine: ${config.machine}`}>
                <span className="text-[var(--text-secondary)] mr-1">MACHINE:</span>
                <span className="text-[var(--accent-text)]">{config.machine}</span>
              </span>
            )}
            {config.distro && (
              <button 
                onClick={() => setShowDistroFeaturesModal(true)}
                className="flex items-center px-[6px] py-[3px] bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-full text-[12px] truncate max-w-[200px] hover:border-[var(--border-strong)] transition" 
                title={`Distribution: ${config.distro}`}
              >
                <span className="text-[var(--text-secondary)] mr-1">DISTRO:</span>
                <span className="text-[var(--accent-text)]">{config.distro}</span>
                <ChevronDown className="w-3 h-3 ml-1 text-[var(--text-muted)]" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex items-center justify-center w-[36px] h-[36px] rounded bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--accent)] hover:border-[var(--border-strong)] transition"
          title="Toggle Theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          onClick={onLoadDemo}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-[6px] text-[12px] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition"
          title="Switch to STM32MP1 sample project"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Demo Data</span>
        </button>
        
        {config && activeTab === 'graph' && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onLayoutModeChange('tree')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-[6px] text-[12px] transition ${layoutMode === 'tree' ? 'bg-[var(--bg-secondary)] border border-[var(--border-strong)] text-[var(--text-primary)]' : 'bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'}`}
            >
              Tree
            </button>
            <button
              onClick={() => onLayoutModeChange('force')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-[6px] text-[12px] transition ${layoutMode === 'force' ? 'bg-[var(--bg-secondary)] border border-[var(--border-strong)] text-[var(--text-primary)]' : 'bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'}`}
            >
              Force
            </button>
          </div>
        )}

        {config && activeTab === 'graph' && (
          <button
            onClick={onFitGraph}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-[6px] text-[12px] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Fit Graph</span>
          </button>
        )}

        {config && activeTab === 'graph' && (
          <button
            onClick={onExportPng}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-[6px] text-[12px] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export PNG</span>
          </button>
        )}

        <button
          onClick={onDownloadHtml}
          className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-[6px] text-[12px] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition"
        >
          <FileCode className="w-3.5 h-3.5" />
          <span>Standalone HTML</span>
        </button>

        <button
          onClick={onOpenFolder}
          disabled={isScanning}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[var(--accent)] border border-[var(--accent)] rounded-[6px] text-[12px] text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 transition font-medium"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>{isScanning ? 'Scanning...' : 'Open Folder'}</span>
        </button>
      </div>

      {/* Modal for DISTRO_FEATURES */}
      {showDistroFeaturesModal && config && config.distroFeatures && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-[8px] p-4 max-w-lg w-full">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3 mb-3">
              <h3 className="text-[14px] font-medium text-[var(--text-primary)] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[var(--accent)]" />
                DISTRO_FEATURES ({config.distroFeatures.length})
              </h3>
              <button
                onClick={() => setShowDistroFeaturesModal(false)}
                className="text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Close
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-60 overflow-y-auto custom-scrollbar">
              {config.distroFeatures.map(feat => (
                <span
                  key={feat}
                  className="px-2 py-0.5 rounded-[4px] bg-[var(--bg-tertiary)] border border-[var(--border)] text-[11px] font-mono text-[var(--text-primary)]"
                >
                  {feat}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
