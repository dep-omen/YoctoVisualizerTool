import React, { useState, useRef, useMemo, useEffect } from 'react';
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
import { BBAppendViewer } from './components/BBAppendViewer';
import { BuildEstimator } from './components/BuildEstimator';
import { EmptyState } from './components/EmptyState';
import { createVirtualFileSystem } from './utils/virtualFileSystem';

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return localStorage.getItem('yocto-theme') as 'dark' | 'light' || 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('yocto-theme', theme);
  }, [theme]);

  const [config, setConfig] = useState<YoctoBuildConfig | null>(null);
  const [activeTab, setActiveTab] = useState<'graph' | 'conflicts' | 'package-tracer' | 'bbappends' | 'estimator'>('graph');
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
  const [bbappendCount, setBbappendCount] = useState<number>(0);
  const [orphanCount, setOrphanCount] = useState<number>(0);
  const [bbappendFilterLayer, setBbappendFilterLayer] = useState<string | null>(null);

  const graphRef = useRef<LayerGraphRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute conflict stats for tab badge
  const conflictResult = useMemo(() => {
    if (!config) return null;
    return detectYoctoConflicts(config);
  }, [config]);

  const conflictCount = conflictResult ? conflictResult.stats.totalConflicts : 0;
  const criticalCount = conflictResult ? conflictResult.stats.criticalConflicts : 0;

  // Scan Yocto project using Electron native IPC
  const scanElectronProject = async (dirPath: string) => {
    if (!window.electronAPI) return;
    setErrorMessage(null);
    setIsScanning(true);
    setScanStatus({
      phase: 'finding_conf',
      message: `Analyzing Yocto project at ${dirPath}...`
    });

    try {
      const parsedConfig = await window.electronAPI.scanYoctoProject(dirPath);
      setConfig(parsedConfig);
      setRootHandle(null);
      setIsScanning(false);
      setScanStatus(null);
      setSelectedLayer(null);
      setErrorMessage(null);
    } catch (err: any) {
      setIsScanning(false);
      setScanStatus(null);
      console.error('Electron folder scan error:', err);
      setErrorMessage(
        err.message ||
        "Couldn't find build/conf/bblayers.conf — make sure you selected the root of your Yocto project (containing the 'build' or 'conf' directory)."
      );
    }
  };

  // Wire up Electron Menu and IPC events
  useEffect(() => {
    if (!window.electronAPI) return;

    const removeProgress = window.electronAPI.onScanProgress?.((status) => {
      setScanStatus(status);
    });

    const removeMenuOpen = window.electronAPI.onMenuOpenDirectory?.(async (dirPath) => {
      if (dirPath) {
        await scanElectronProject(dirPath);
      }
    });

    const removeCliOpen = window.electronAPI.onCliOpenDirectory?.(async (dirPath) => {
      if (dirPath) {
        await scanElectronProject(dirPath);
      }
    });

    const removeLoadDemo = window.electronAPI.onMenuLoadDemo?.(() => {
      handleLoadDemo();
    });

    return () => {
      removeProgress?.();
      removeMenuOpen?.();
      removeCliOpen?.();
      removeLoadDemo?.();
    };
  }, []);

  // Pick Yocto Project Folder (Electron Native or Web API)
  const handleOpenFolder = async () => {
    setErrorMessage(null);

    // 1. Electron Native folder dialog
    if (window.electronAPI) {
      try {
        const selectedDir = await window.electronAPI.openDirectoryDialog();
        if (selectedDir) {
          await scanElectronProject(selectedDir);
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to open directory');
      }
      return;
    }

    // 2. Web Browser: File System Access API
    if ('showDirectoryPicker' in window) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dirHandle = await (window as any).showDirectoryPicker({ mode: 'read' });
        await processDirectoryHandle(dirHandle);
      } catch (err: any) {
        setIsScanning(false);
        setScanStatus(null);
        if (err.name === 'AbortError') return;
        console.error('Folder scan error:', err);
        if (err.name === 'SecurityError' || err.message?.includes('Cross-origin') || err.message?.includes('iframe') || err.message?.includes('Permissions-Policy')) {
          // Fallback for iframe restrictions
          if (fileInputRef.current) {
            fileInputRef.current.click();
          }
        } else {
          setErrorMessage(err.message || "Couldn't find build/conf/bblayers.conf");
        }
      }
    } else {
      // Fallback for Firefox, Safari, etc.
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  };

  const processDirectoryHandle = async (dirHandle: any) => {
    setIsScanning(true);
    setScanStatus({
      phase: 'finding_conf',
      message: 'Initializing parser and locating build configuration...'
    });

    const onProgress: ScanProgressCallback = (status) => {
      setScanStatus(status);
    };

    try {
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
      console.error('Folder scan error:', err);
      setErrorMessage(err.message || "Couldn't find build/conf/bblayers.conf");
    }
  };

  const handleFallbackFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    try {
      if (files.length > 0 && files.length < 50) {
        setErrorMessage(`Warning: The browser only loaded ${files.length} files. Embedded iframes often silently truncate large folder uploads. Please open this app in a dedicated new tab for full Yocto parsing.`);
      }
      const virtualDirHandle = createVirtualFileSystem(files);
      await processDirectoryHandle(virtualDirHandle);
    } catch (err: any) {
      console.error('Fallback scan error:', err);
      setErrorMessage(err.message || 'Failed to parse folder contents.');
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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

    if (window.electronAPI?.showSaveDialog && window.electronAPI?.writeFile) {
      const savePath = await window.electronAPI.showSaveDialog({
        title: 'Save Layer Graph PNG',
        defaultPath: `yocto-graph-${config?.folderName || 'project'}.png`,
        filters: [{ name: 'PNG Image', extensions: ['png'] }]
      });
      if (savePath) {
        const base64Data = pngDataUrl.replace(/^data:image\/png;base64,/, '');
        await window.electronAPI.writeFile(savePath, base64Data);
      }
      return;
    }

    const link = document.createElement('a');
    link.download = `yocto-graph-${config?.folderName || 'project'}.png`;
    link.href = pngDataUrl;
    link.click();
  };

  const handleDownloadStandaloneHtml = async () => {
    const htmlContent = generateStandaloneHtml();

    if (window.electronAPI?.showSaveDialog && window.electronAPI?.writeFile) {
      const savePath = await window.electronAPI.showSaveDialog({
        title: 'Save Standalone Yocto Visualizer HTML',
        defaultPath: 'yocto-visualizer.html',
        filters: [{ name: 'HTML Document', extensions: ['html'] }]
      });
      if (savePath) {
        await window.electronAPI.writeFile(savePath, htmlContent);
      }
      return;
    }

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'yocto-visualizer.html';
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
    <>
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleFallbackFileChange}
        // @ts-ignore
        webkitdirectory="true"
        directory="true"
        multiple
        className="hidden" 
      />
      <div className="flex flex-col h-screen w-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans antialiased overflow-hidden select-none">
      {/* Header Bar */}
      <HeaderBar
        theme={theme}
        setTheme={setTheme}
        config={config}
        activeTab={activeTab}
        onTabChange={(t) => { setActiveTab(t); if(t === 'bbappends') setBbappendFilterLayer(null); }}
        conflictCount={conflictCount}
        criticalCount={criticalCount}
        traceCount={traceCount}
        bbappendCount={bbappendCount}
        orphanCount={orphanCount}
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
                  onViewBbappends={() => {
                     setBbappendFilterLayer(selectedLayer.name);
                     setActiveTab('bbappends');
                  }}
                />
              )}
            </>
          ) : activeTab === 'package-tracer' ? (
            <PackageTracer config={config} rootHandle={rootHandle} onTraceCountChange={setTraceCount} />
          ) : activeTab === 'bbappends' ? (
            <BBAppendViewer 
              config={config} 
              rootHandle={rootHandle} 
              onBbappendCountChange={(c, o) => { setBbappendCount(c); setOrphanCount(o); }} 
              initialFilterLayer={bbappendFilterLayer} 
            />
          ) : activeTab === 'estimator' ? (
            <BuildEstimator config={config} conflictCount={conflictCount} orphanCount={orphanCount} />
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
    </>
  );
}

