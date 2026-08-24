import React, { useState, useRef, useMemo } from 'react';
import { YoctoBuildConfig, YoctoLayer } from './types';
import { scanYoctoDirectory, ScanProgressCallback } from './utils/fileSystemScanner';
import { DEMO_YOCTO_PROJECT } from './data/demoProject';
import { generateStandaloneHtml } from './utils/standaloneHtmlGenerator';
import { detectYoctoConflicts } from './utils/conflictDetector';
import { HeaderBar } from './components/HeaderBar';
import { StatsBar } from './components/StatsBar';
import { LayerGraph, LayerGraphRef } from './components/LayerGraph';
import { LayerDetailPanel } from './components/LayerDetailPanel';
import { ConflictDetector } from './components/ConflictDetector';
import { PackageTracer } from './components/PackageTracer';
import { EmptyState } from './components/EmptyState';

export default function App() {
  const [config, setConfig] = useState<YoctoBuildConfig | null>(null);
  const [activeTab, setActiveTab] = useState<'graph' | 'conflicts' | 'package-tracer'>('graph');
  const [layoutMode, setLayoutMode] = useState<'tree' | 'force'>('tree');
  const [selectedLayer, setSelectedLayer] = useState<YoctoLayer | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanStatus, setScanStatus] = useState<{
    phase: string;
    message: string;
    processed?: number;
    total?: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [rootHandle, setRootHandle] = useState<any>(null);
  const [traceCount, setTraceCount] = useState<number>(0);

  const graphRef = useRef<LayerGraphRef>(null);

  // Compute conflict stats for tab badge
  const conflictResult = useMemo(() => {
    if (!config) return null;
    return detectYoctoConflicts(config);
  }, [config]);

  const conflictCount = conflictResult ? conflictResult.stats.totalConflicts : 0;
  const criticalCount = conflictResult ? conflictResult.stats.criticalConflicts : 0;

  // File System Access API: Pick Yocto Project Folder
  const handleOpenFolder = async () => {
    setErrorMessage(null);

    // Check File System Access API availability
    if (!('showDirectoryPicker' in window)) {
      setErrorMessage(
        'The File System Access API is not supported in this browser. Please use Google Chrome or Microsoft Edge (desktop) for direct folder access.'
      );
      return;
    }

    try {
      // Prompt user to pick directory
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dirHandle = await (window as any).showDirectoryPicker({
        mode: 'read'
      });

      setIsScanning(true);
      setScanStatus({
        phase: 'finding_conf',
        message: 'Initializing parser and locating build configuration...'
      });

      const onProgress: ScanProgressCallback = (status) => {
        setScanStatus(status);
      };

      const parsedConfig = await scanYoctoDirectory(dirHandle, onProgress);
      setConfig(parsedConfig);
      setRootHandle(dirHandle);
      setIsScanning(false);
      setScanStatus(null);
      setSelectedLayer(null);
      setErrorMessage(null);
    } catch (err: any) {
      setIsScanning(false);
      setScanStatus(null);

      // User canceled the picker
      if (err.name === 'AbortError') {
        return;
      }

      console.error('Folder scan error:', err);

      // Check for common iframe restriction or missing bblayers
      if (err.name === 'SecurityError' || err.message?.includes('Cross-origin') || err.message?.includes('iframe')) {
        setErrorMessage(
          'Security constraint: File System Picker is restricted inside embedded previews. Click the button below to load the STM32MP1 / OpenSTLinux sample demo workspace, or open this application in a dedicated browser tab to select local folders.'
        );
      } else {
        setErrorMessage(
          err.message ||
          "Couldn't find build/conf/bblayers.conf — make sure you selected the root of your Yocto project (containing the 'build' or 'conf' directory)."
        );
      }
    }
  };

  const handleLoadDemo = () => {
    setErrorMessage(null);
    setConfig(DEMO_YOCTO_PROJECT);
    setRootHandle(null);
    setSelectedLayer(null);
  };

  const handleFitGraph = () => {
    graphRef.current?.zoomToFit();
  };

  const handleExportPng = async () => {
    if (!graphRef.current) return;
    const pngDataUrl = await graphRef.current.exportPng();
    if (!pngDataUrl) return;

    const link = document.createElement('a');
    link.download = `yocto-layer-graph-${config?.folderName || 'project'}.png`;
    link.href = pngDataUrl;
    link.click();
  };

  const handleDownloadStandaloneHtml = () => {
    const htmlContent = generateStandaloneHtml();
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'yocto-layer-visualizer.html';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSelectLayer = (layer: YoctoLayer) => {
    setSelectedLayer(layer);
  };

  const handleSelectLayerById = (layerId: string) => {
    if (!config) return;
    const target = config.layers.find(
      l => l.id === layerId || l.collectionName === layerId || l.name === layerId
    );
    if (target) {
      setSelectedLayer(target);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0d1117] text-[#c9d1d9] font-sans antialiased overflow-hidden select-none">
      {/* Header Bar */}
      <HeaderBar
        config={config}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        conflictCount={conflictCount}
        criticalCount={criticalCount}
        traceCount={traceCount}
        layoutMode={layoutMode}
        onLayoutModeChange={setLayoutMode}
        onOpenFolder={handleOpenFolder}
        onFitGraph={handleFitGraph}
        onExportPng={handleExportPng}
        onDownloadHtml={handleDownloadStandaloneHtml}
        onLoadDemo={handleLoadDemo}
        isScanning={isScanning}
      />

      {/* Stats Bar (Shown on Graph Tab when config is loaded) */}
      {config && activeTab === 'graph' && (
        <StatsBar
          config={config}
          searchFilter={searchFilter}
          onSearchChange={setSearchFilter}
        />
      )}

      {/* Main Workspace Area */}
      <main className="flex-1 relative flex overflow-hidden">
        {config ? (
          activeTab === 'graph' ? (
            <>
              {/* Graph Visualizer Canvas */}
              <div className="flex-1 h-full relative">
                <LayerGraph
                  ref={graphRef}
                  config={config}
                  selectedLayer={selectedLayer}
                  onSelectLayer={handleSelectLayer}
                  searchFilter={searchFilter}
                  layoutMode={layoutMode}
                  onLayoutModeChange={setLayoutMode}
                />
              </div>

              {/* Right-Side Detail Panel */}
              {selectedLayer && (
                <LayerDetailPanel
                  layer={selectedLayer}
                  allConfig={config}
                  onClose={() => setSelectedLayer(null)}
                  onSelectLayer={handleSelectLayerById}
                />
              )}
            </>
          ) : activeTab === 'package-tracer' ? (
            <PackageTracer config={config} rootHandle={rootHandle} onTraceCountChange={setTraceCount} />
          ) : (
            /* Conflict Detector View */
            <ConflictDetector config={config} />
          )
        ) : (
          /* Empty Landing State */
          <EmptyState
            onOpenFolder={handleOpenFolder}
            onLoadDemo={handleLoadDemo}
            isScanning={isScanning}
            scanStatus={scanStatus}
            errorMessage={errorMessage}
          />
        )}
      </main>
    </div>
  );
}

