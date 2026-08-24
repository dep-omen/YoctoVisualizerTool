import React, { useState } from 'react';
import { YoctoBuildConfig } from '../types';
import {
  FolderOpen,
  Maximize2,
  Download,
  FileCode,
  Layers,
  ChevronDown,
  Sparkles,
  ShieldAlert,
  Network,
  CheckCircle2
} from 'lucide-react';

interface HeaderBarProps {
  config: YoctoBuildConfig | null;
  activeTab: 'graph' | 'conflicts' | 'package-tracer';
  onTabChange: (tab: 'graph' | 'conflicts' | 'package-tracer') => void;
  conflictCount: number;
  criticalCount: number;
  traceCount: number;
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
  config,
  activeTab,
  onTabChange,
  conflictCount,
  criticalCount,
  traceCount,
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
    <header
      id="yocto-header-bar"
      className="h-14 border-b border-gray-800 flex items-center px-4 justify-between bg-[#161b22] shrink-0 z-30 select-none gap-2"
    >
      {/* Left: Brand + BitBake Config Specs */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center shadow-sm shadow-blue-500/30">
            <span className="text-[10px] font-black text-white font-mono tracking-tighter">YO</span>
          </div>
          <h1 className="font-semibold text-sm tracking-tight text-white truncate hidden sm:block">
            Yocto Layer Visualizer
          </h1>
        </div>

        {/* Tab Switcher */}
        {config && (
          <div className="flex items-center bg-[#0d1117] p-0.5 rounded-lg border border-gray-800 ml-1">
            <button
              id="tab-layer-graph-btn"
              onClick={() => onTabChange('graph')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition ${
                activeTab === 'graph'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span>Layer Graph</span>
            </button>

            <button
              id="tab-conflict-detector-btn"
              onClick={() => onTabChange('conflicts')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition ${
                activeTab === 'conflicts'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
              }`}
            >
              <ShieldAlert className={`w-3.5 h-3.5 ${criticalCount > 0 ? 'text-red-400' : conflictCount > 0 ? 'text-amber-400' : 'text-green-400'}`} />
              <span>Conflict Detector</span>
              {conflictCount > 0 ? (
                <span
                  className={`ml-0.5 px-1.5 py-0.2 rounded-full font-mono text-[10px] font-bold ${
                    criticalCount > 0
                      ? 'bg-red-500 text-white animate-pulse'
                      : activeTab === 'conflicts'
                      ? 'bg-white text-blue-900'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  {conflictCount}
                </span>
              ) : (
                <CheckCircle2 className="w-3 h-3 text-green-400 ml-0.5" />
              )}
            </button>

            <button
              id="tab-package-tracer-btn"
              onClick={() => onTabChange('package-tracer')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition ${
                activeTab === 'package-tracer'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Package Tracer</span>
              {traceCount > 0 && activeTab === 'package-tracer' && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full font-mono text-[10px] font-bold bg-white text-blue-900">
                  {traceCount} deps
                </span>
              )}
            </button>
          </div>
        )}

        {config && (
          <>
            <div className="h-4 w-[1px] bg-gray-700 mx-1 hidden lg:block shrink-0" />
            <div className="hidden xl:flex items-center gap-2 text-[10px] overflow-hidden">
              {config.machine && (
                <span
                  className="px-2 py-1 bg-gray-800 rounded text-blue-400 font-mono truncate"
                  title={`Target Machine: ${config.machine}`}
                >
                  MACHINE: {config.machine}
                </span>
              )}
              {config.distro && (
                <span
                  className="px-2 py-1 bg-gray-800 rounded text-teal-400 font-mono truncate"
                  title={`Distribution: ${config.distro}`}
                >
                  DISTRO: {config.distro}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Load Demo Switcher */}
        <button
          id="load-demo-btn"
          onClick={onLoadDemo}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#21262d] border border-gray-700 rounded text-xs text-gray-200 hover:bg-[#30363d] transition font-medium"
          title="Switch to STM32MP1 sample project"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Demo Data</span>
        </button>

        {/* Layout Toggle (Tree / Force) */}
        {config && activeTab === 'graph' && (
          <div className="flex items-center bg-[#0d1117] border border-gray-700 rounded p-0.5" id="layout-toggle-group">
            <button
              id="layout-tree-btn"
              onClick={() => onLayoutModeChange('tree')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition ${
                layoutMode === 'tree'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title="Hierarchical Top-Down Tree Layout"
            >
              <span>⊞ Tree</span>
            </button>
            <button
              id="layout-force-btn"
              onClick={() => onLayoutModeChange('force')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition ${
                layoutMode === 'force'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title="Force-Directed Physical Layout"
            >
              <span>⊙ Force</span>
            </button>
          </div>
        )}

        {/* Fit Graph (only on graph tab) */}
        {config && activeTab === 'graph' && (
          <button
            id="fit-graph-btn"
            onClick={onFitGraph}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#21262d] border border-gray-700 rounded text-xs text-gray-200 hover:bg-[#30363d] transition font-medium"
            title="Fit Graph to Viewport"
          >
            <Maximize2 className="w-3 h-3 text-gray-300" />
            <span className="hidden sm:inline">Fit Graph</span>
          </button>
        )}

        {/* Export PNG (only on graph tab) */}
        {config && activeTab === 'graph' && (
          <button
            id="export-png-btn"
            onClick={onExportPng}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#21262d] border border-gray-700 rounded text-xs text-gray-200 hover:bg-[#30363d] transition font-medium"
            title="Export High-Res Graph as PNG"
          >
            <Download className="w-3 h-3 text-gray-300" />
            <span className="hidden sm:inline">Export PNG</span>
          </button>
        )}

        {/* Standalone HTML Export */}
        <button
          id="export-standalone-html-btn"
          onClick={onDownloadHtml}
          className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-[#21262d] border border-gray-700 rounded text-xs text-gray-200 hover:bg-[#30363d] transition font-medium"
          title="Download single self-contained HTML file"
        >
          <FileCode className="w-3.5 h-3.5 text-purple-400" />
          <span>Standalone HTML</span>
        </button>

        {/* Open Folder Primary Button */}
        <button
          id="open-folder-header-btn"
          onClick={onOpenFolder}
          disabled={isScanning}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 border border-blue-500 rounded text-xs text-white hover:bg-blue-500 disabled:opacity-50 transition font-semibold shadow-sm"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>{isScanning ? 'Scanning...' : 'Open Folder'}</span>
        </button>
      </div>

      {/* Modal for DISTRO_FEATURES */}
      {showDistroFeaturesModal && config && config.distroFeatures && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#161b22] border border-gray-800 rounded-xl p-5 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                DISTRO_FEATURES ({config.distroFeatures.length})
              </h3>
              <button
                onClick={() => setShowDistroFeaturesModal(false)}
                className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded bg-[#21262d] border border-gray-700"
              >
                Close
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-60 overflow-y-auto custom-scrollbar p-1">
              {config.distroFeatures.map(feat => (
                <span
                  key={feat}
                  className="px-2.5 py-1 rounded bg-[#0d1117] border border-gray-800 text-xs font-mono text-gray-300"
                >
                  {feat}
                </span>
              ))}
            </div>
            {config.imageFeatures && config.imageFeatures.length > 0 && (
              <div className="pt-3 border-t border-gray-800">
                <div className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">IMAGE_FEATURES:</div>
                <div className="flex flex-wrap gap-1.5">
                  {config.imageFeatures.map(feat => (
                    <span
                      key={feat}
                      className="px-2 py-0.5 rounded bg-[#0d1117] border border-gray-800 text-[11px] font-mono text-teal-300"
                    >
                      {feat}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

