import React, { useState } from 'react';
import { YoctoBuildConfig } from '../types';
import {
  FolderOpen,
  Maximize2,
  Download,
  FileCode,
  Layers,
  ChevronDown,
  Sparkles
} from 'lucide-react';

interface HeaderBarProps {
  config: YoctoBuildConfig | null;
  onOpenFolder: () => void;
  onFitGraph: () => void;
  onExportPng: () => void;
  onDownloadHtml: () => void;
  onLoadDemo: () => void;
  isScanning: boolean;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  config,
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
      className="h-14 border-b border-gray-800 flex items-center px-4 justify-between bg-[#161b22] shrink-0 z-30 select-none"
    >
      {/* Left: Brand + BitBake Config Specs */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center shadow-sm shadow-blue-500/30">
            <span className="text-[10px] font-black text-white font-mono tracking-tighter">YO</span>
          </div>
          <h1 className="font-semibold text-sm tracking-tight text-white truncate">
            Yocto Layer Visualizer
          </h1>
        </div>

        {config && (
          <>
            <div className="h-4 w-[1px] bg-gray-700 mx-1 hidden sm:block shrink-0" />
            <div className="hidden md:flex items-center gap-2 text-[10px] overflow-hidden">
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
              {config.distroFeatures && config.distroFeatures.length > 0 && (
                <button
                  onClick={() => setShowDistroFeaturesModal(true)}
                  className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-gray-300 font-mono truncate transition flex items-center gap-1"
                  title="Click to view all DISTRO_FEATURES"
                >
                  <span>DISTRO_FEATURES: [{config.distroFeatures.slice(0, 3).join(', ')}{config.distroFeatures.length > 3 ? '...' : ''}]</span>
                  <ChevronDown className="w-2.5 h-2.5 text-gray-400" />
                </button>
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

        {/* Fit Graph */}
        {config && (
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

        {/* Export PNG */}
        {config && (
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
          className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 bg-[#21262d] border border-gray-700 rounded text-xs text-gray-200 hover:bg-[#30363d] transition font-medium"
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

