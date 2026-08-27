import React, { useState, useMemo, useEffect } from 'react';
import { YoctoBuildConfig, YoctoLayer, YoctoRecipe } from '../types';
import { 
  Calculator, Cpu, HardDrive, Network, Layers, AlertCircle, Info, Zap, Download, Database, CheckCircle2, Copy,
  Server, MonitorPlay, Hammer, PackageSearch, PackageOpen
} from 'lucide-react';

interface BuildEstimatorProps {
  config: YoctoBuildConfig | null;
  conflictCount: number;
  orphanCount: number;
}

interface RecipeWeight {
  name: string;
  layer: string;
  category: string;
  compileTime: number;
  parallelizable: boolean;
}

export const BuildEstimator: React.FC<BuildEstimatorProps> = ({ config, conflictCount, orphanCount }) => {
  const [hasCalculated, setHasCalculated] = useState(false);
  
  const [cores, setCores] = useState<number>(4);
  const [ram, setRam] = useState<number>(8);
  const [storage, setStorage] = useState<'HDD'|'SSD'|'NVMe'>('SSD');
  const [sstate, setSstate] = useState<'Yes'|'No'>('No');
  useEffect(() => {
    if (config?.variables?.SSTATE_DIR || config?.variables?.SSTATE_MIRRORS) {
      setSstate('Yes');
    }
  }, [config]);
  const [network, setNetwork] = useState<'Slow'|'Normal'|'Fast'>('Normal');
  const [incremental, setIncremental] = useState<'Yes'|'No'>('No');

  const handleDetect = () => {
    if (navigator.hardwareConcurrency) {
      setCores(navigator.hardwareConcurrency);
    }
    if ((navigator as any).deviceMemory) {
      setRam((navigator as any).deviceMemory);
    }
  };

  const est = useMemo(() => {
    if (!config) return null;
    
    let recipeCount = 0;
    let bbappendCount = 0;
    const weights: RecipeWeight[] = [];
    
    config.layers.forEach(l => {
      if (l.isMissing) return;
      recipeCount += l.recipes.length;
      bbappendCount += l.bbappends.length;
      
      l.recipes.forEach(r => {
        let baseTime = 2; // standard
        let parallelizable = true;
        const name = r.name.toLowerCase();
        const cat = r.relativePath.split('/')[0];
        
        if (cat === 'recipes-kernel' || name.includes('linux') || name.includes('kernel')) {
          baseTime = 15;
        } else if (name.includes('gcc') || name.includes('binutils') || name.includes('toolchain')) {
          baseTime = 45;
          parallelizable = false;
        } else if (name.includes('glibc')) {
          baseTime = 30;
        } else if (name.includes('qt') || name.includes('wayland') || name.includes('weston')) {
          baseTime = 20;
        } else if (name.includes('gstreamer') || name.includes('ffmpeg')) {
          baseTime = 10;
        } else if (name.endsWith('-native')) {
          baseTime = 1;
        }
        
        weights.push({
          name: r.name,
          layer: l.name,
          category: cat,
          compileTime: baseTime,
          parallelizable
        });
      });
    });
    
    weights.sort((a, b) => b.compileTime - a.compileTime);
    
    // Fetch phase
    const fetchGb = (recipeCount * 5) / 1024;
    let speedMbps = 30;
    if (network === 'Slow') speedMbps = 5;
    if (network === 'Fast') speedMbps = 200;
    const fetchMin = (fetchGb * 1024 * 8) / speedMbps / 60;
    
    // Parse phase
    const parseMin = Math.max(1, (recipeCount / 100) * (4 / cores));
    
    // Compile phase
    let totalBaseCompile = 0;
    weights.forEach(w => totalBaseCompile += w.compileTime);
    const compileMin = totalBaseCompile / Math.min(cores, 8);
    
    // Image creation phase
    let imageMin = recipeCount * 0.01;
    if (storage === 'HDD') imageMin *= 2;
    if (storage === 'NVMe') imageMin *= 0.7;
    
    const coldTotal = fetchMin + parseMin + compileMin + imageMin;
    const warmTotal = parseMin + (imageMin * 0.5) + (recipeCount * 0.005);
    
    // Layer contributions
    const layerTimes = new Map<string, number>();
    weights.forEach(w => {
      layerTimes.set(w.layer, (layerTimes.get(w.layer) || 0) + w.compileTime);
    });
    const layerContributions = Array.from(layerTimes.entries())
      .map(([name, time]) => ({ name, time, percent: (time / totalBaseCompile) * 100 }))
      .sort((a, b) => b.percent - a.percent);
      
    // Categorize layers for chart coloring
    const layerColors: Record<string, string> = {};
    config.layers.forEach(l => {
      if (l.categoryType === 'core') layerColors[l.name] = 'bg-blue-500';
      else if (l.categoryType === 'openembedded') layerColors[l.name] = 'bg-teal-500';
      else layerColors[l.name] = 'bg-amber-500';
    });

    return {
      recipeCount, bbappendCount, weights: weights.slice(0, 20),
      fetchGb, fetchMin, parseMin, compileMin, imageMin,
      coldTotal, warmTotal, layerContributions, layerColors
    };
  }, [config, cores, storage, network]);

  const recommendations = useMemo(() => {
    if (!est) return [];
    const recs = [];
    if (cores < 4) {
      recs.push({
        type: 'warning', title: 'Low CPU Cores',
        desc: 'Consider building on a machine with more cores — Yocto build times scale almost linearly up to 8 cores.',
        fix: 'Upgrade to a machine with 8+ CPU cores.'
      });
    }
    if (storage === 'HDD') {
      recs.push({
        type: 'warning', title: 'Slow Storage (HDD)',
        desc: 'Building on HDD significantly increases I/O wait time — an SSD would reduce build time by approximately 40-50%.',
        fix: 'Move the build directory to an SSD or NVMe drive.'
      });
    }
    if (sstate === 'No') {
      recs.push({
        type: 'info', title: 'No sstate-cache',
        desc: 'Set up a shared sstate-cache — subsequent builds of unchanged recipes take seconds instead of minutes.',
        fix: 'Add SSTATE_MIRRORS or a local SSTATE_DIR to local.conf.'
      });
    }
    if (est.recipeCount > 8000) {
      recs.push({
        type: 'warning', title: 'Large Layer Stack',
        desc: 'Your layer stack is large. Consider using a minimal image target first (core-image-minimal) to validate the build before attempting a full image.',
        fix: 'bitbake core-image-minimal'
      });
    }
    if (conflictCount > 10) {
      recs.push({
        type: 'critical', title: 'Many Layer Conflicts',
        desc: `You have ${conflictCount} layer conflicts — resolve BBFILE_PRIORITY issues before starting a full build to avoid unexpected recipe selections.`,
        fix: 'Check the Conflict Detector tab and adjust layer priorities.'
      });
    }
    if (orphanCount > 0) {
      recs.push({
        type: 'critical', title: 'Orphan BBAppends',
        desc: `You have ${orphanCount} orphan bbappends — these will cause BitBake warnings and may indicate misconfigured layers.`,
        fix: 'Remove or update orphaned bbappends to match current recipe versions.'
      });
    }
    
    recs.push({
      type: 'info', title: 'Optimal Threading',
      desc: 'Set BB_NUMBER_THREADS and PARALLEL_MAKE based on available RAM (at least 2GB per thread recommended to prevent OOM).',
      fix: `BB_NUMBER_THREADS = "${Math.min(cores, Math.max(1, Math.floor(ram / 2)))}"\nPARALLEL_MAKE = "-j ${Math.min(cores, Math.max(1, Math.floor(ram / 2)))}"`
    });
    
    if (network === 'Slow') {
      recs.push({
        type: 'warning', title: 'Slow Network Speed',
        desc: 'Pre-fetch all sources before starting the full build to avoid timeouts.',
        fix: 'bitbake --runall=fetch <image>'
      });
    }
    return recs;
  }, [est, cores, storage, sstate, network, conflictCount, orphanCount]);

  const handleExport = () => {
    if (!est) return;
    let report = `Yocto Build Estimate Report\n===========================\n\n`;
    report += `Machine Profile:\n- Cores: ${cores}\n- RAM: ${ram} GB\n- Storage: ${storage}\n- Network: ${network}\n\n`;
    report += `Estimated Times:\n- Cold Build: ${formatTime(est.coldTotal)}\n- Warm Build: ${formatTime(est.warmTotal)}\n\n`;
    report += `Recommendations:\n`;
    recommendations.forEach(r => {
      report += `- [${r.type.toUpperCase()}] ${r.title}: ${r.desc}\n  Fix: ${r.fix.replace(/\n/g, ' ')}\n`;
    });
    
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'build-estimate-report.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (mins: number) => {
    if (mins < 60) return `${Math.round(mins)} mins`;
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return `${h}h ${m}m`;
  };

  const handleCopyConfig = () => {
    navigator.clipboard.writeText(`# Build performance settings
BB_NUMBER_THREADS = "${Math.min(cores, Math.max(1, Math.floor(ram / 2)))}"
PARALLEL_MAKE = "-j ${Math.min(cores, Math.max(1, Math.floor(ram / 2)))}"
SSTATE_DIR = "\${TOPDIR}/../sstate-cache"
DL_DIR = "\${TOPDIR}/../downloads"`);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg-primary)] overflow-y-auto custom-scrollbar text-[var(--text-primary)]">
      <div className="max-w-6xl mx-auto w-full p-6 space-y-8">
        
        {/* Section 1: Machine Profile */}
        <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Server className="w-5 h-5 text-[var(--text-code-blue)]" />
              Machine Profile
            </h2>
            <button 
              onClick={handleDetect}
              className="text-xs flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-tertiary)] hover:bg-[var(--border-strong)] border border-[var(--border)] rounded text-[var(--text-primary)] transition"
            >
              <Cpu className="w-3.5 h-3.5" />
              Detect from system
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)]">CPU Cores</label>
              <input type="number" min="1" max="128" value={cores} onChange={e => setCores(Number(e.target.value))} className="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)]">RAM (GB)</label>
              <input type="number" min="1" max="512" value={ram} onChange={e => setRam(Number(e.target.value))} className="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Storage Type</label>
              <select value={storage} onChange={e => setStorage(e.target.value as any)} className="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                <option value="HDD">HDD</option>
                <option value="SSD">SSD</option>
                <option value="NVMe">NVMe</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)]">sstate-cache</label>
              <select value={sstate} onChange={e => setSstate(e.target.value as any)} className="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                <option value="Yes">Yes (warm)</option>
                <option value="No">No (cold)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Network Speed</label>
              <select value={network} onChange={e => setNetwork(e.target.value as any)} className="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                <option value="Slow">Slow (&lt;10 Mbps)</option>
                <option value="Normal">Normal (10-100)</option>
                <option value="Fast">Fast (&gt;100 Mbps)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Previous Build</label>
              <select value={incremental} onChange={e => setIncremental(e.target.value as any)} className="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
          </div>
          
          <button 
            onClick={() => setHasCalculated(true)}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-md  transition"
          >
            Calculate Estimate
          </button>
        </div>

        {hasCalculated && est && (
          <>
            {/* Section 2: Estimate Results */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className={`lg:col-span-2 p-5 rounded-lg border ${est.coldTotal > 360 ? 'bg-red-900/20 border-red-500/30' : est.coldTotal > 120 ? 'bg-amber-900/20 border-amber-500/30' : 'bg-green-900/20 border-green-500/30'}`}>
                 <div className="text-xs font-bold uppercase tracking-wider mb-2 opacity-80 flex items-center gap-1.5">
                   <MonitorPlay className="w-4 h-4" /> Total Estimated Time
                 </div>
                 <div className="flex items-end gap-6">
                    <div>
                       <div className={`text-4xl font-bold ${est.coldTotal > 360 ? 'text-[var(--text-code-red)]' : est.coldTotal > 120 ? 'text-[var(--text-code-amber)]' : 'text-green-400'}`}>
                         {formatTime(est.coldTotal)}
                       </div>
                       <div className="text-xs font-semibold mt-1 opacity-70">Cold build</div>
                    </div>
                    <div className="pb-1">
                       <div className="text-xl font-bold text-[var(--text-primary)]">
                         {formatTime(est.warmTotal)}
                       </div>
                       <div className="text-xs font-semibold text-[var(--text-muted)]">Warm build (sstate)</div>
                    </div>
                 </div>
              </div>
              
              <div className="bg-[var(--bg-panel)] border border-[var(--border)] p-4 rounded-lg flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase flex items-center gap-1.5 mb-2"><Network className="w-3.5 h-3.5" /> Fetch phase</div>
                  <div className="text-xl font-bold text-[var(--text-primary)]">{formatTime(est.fetchMin)}</div>
                </div>
                <div className="mt-3 text-xs text-[var(--text-muted)] font-mono">
                  <div>{est.recipeCount} recipes</div>
                  <div>~{est.fetchGb.toFixed(1)} GB</div>
                </div>
              </div>

              <div className="bg-[var(--bg-panel)] border border-[var(--border)] p-4 rounded-lg flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase flex items-center gap-1.5 mb-2"><PackageSearch className="w-3.5 h-3.5" /> Parse phase</div>
                  <div className="text-xl font-bold text-[var(--text-primary)]">{formatTime(est.parseMin)}</div>
                </div>
                <div className="mt-3 text-xs text-[var(--text-muted)] font-mono">
                  <div>{est.recipeCount} recipes</div>
                  <div>{est.bbappendCount} bbappends</div>
                </div>
              </div>
              
              <div className="bg-[var(--bg-panel)] border border-[var(--border)] p-4 rounded-lg flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase flex items-center gap-1.5 mb-2"><Hammer className="w-3.5 h-3.5" /> Compile phase</div>
                  <div className="text-xl font-bold text-[var(--text-primary)]">{formatTime(est.compileMin)}</div>
                </div>
                <div className="mt-3 text-[10px] text-[var(--text-muted)]">Heaviest phase, scaled by {Math.min(cores, 8)} useful cores</div>
              </div>
              
              <div className="bg-[var(--bg-panel)] border border-[var(--border)] p-4 rounded-lg flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase flex items-center gap-1.5 mb-2"><PackageOpen className="w-3.5 h-3.5" /> Image creation</div>
                  <div className="text-xl font-bold text-[var(--text-primary)]">{formatTime(est.imageMin)}</div>
                </div>
                <div className="mt-3 text-[10px] text-[var(--text-muted)]">Scales with I/O ({storage})</div>
              </div>
            </div>

            <div className="text-[var(--text-primary)]enter text-[10px] text-[var(--text-muted)] italic mt-2">
              Estimates are based on recipe count and category weights. Actual build times vary significantly based on recipe complexity, network conditions, and compiler optimization flags. Cold build estimates assume no sstate-cache. Use these numbers for planning only.
            </div>

            {/* Section 3: Detailed Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
              
              {/* Left Column: Weights and Layers */}
              <div className="lg:col-span-2 space-y-6">
                 
                 {/* Layer Contribution Chart */}
                 <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-lg p-5">
                    <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[var(--text-code-blue)]" />
                      Layer Contribution
                    </h3>
                    <div className="flex h-6 rounded-full overflow-hidden bg-[var(--bg-tertiary)] w-full mb-4">
                      {est.layerContributions.map(l => (
                        <div key={l.name} className={`h-full ${est.layerColors[l.name] || 'bg-gray-500'}`} style={{ width: `${l.percent}%` }} title={`${l.name}: ${l.percent.toFixed(1)}%`} />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {est.layerContributions.slice(0, 8).map(l => (
                        <div key={l.name} className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                          <div className={`w-2 h-2 rounded-full ${est.layerColors[l.name] || 'bg-gray-500'}`} />
                          <span className="truncate max-w-[120px]">{l.name}</span>
                          <span className="font-mono text-[var(--text-muted)]">{l.percent.toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                 </div>

                 {/* Recipe Weight Table */}
                 <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-lg overflow-hidden flex flex-col max-h-[400px]">
                    <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-primary)]">
                      <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <Database className="w-4 h-4 text-[var(--text-code-amber)]" />
                        Heaviest Recipes (Top 20)
                      </h3>
                    </div>
                    <div className="overflow-y-auto flex-1">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[var(--bg-panel)] text-[10px] uppercase text-[var(--text-muted)] border-b border-[var(--border)] sticky top-0 ">
                            <th className="px-4 py-2 font-semibold">Recipe Name</th>
                            <th className="px-4 py-2 font-semibold">Layer</th>
                            <th className="px-4 py-2 font-semibold">Category</th>
                            <th className="px-4 py-2 font-semibold text-right">Compile Time</th>
                            <th className="px-4 py-2 font-semibold text-[var(--text-primary)]enter">Parallel</th>
                          </tr>
                        </thead>
                        <tbody className="text-xs">
                          {est.weights.map((w, i) => (
                            <tr key={i} className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-tertiary)]">
                              <td className="px-4 py-2 font-mono text-[var(--text-primary)]">{w.name}</td>
                              <td className="px-4 py-2 text-[var(--text-muted)]">{w.layer}</td>
                              <td className="px-4 py-2 text-[var(--text-muted)]">{w.category}</td>
                              <td className="px-4 py-2 text-right font-mono text-[var(--text-code-amber)]">{w.compileTime}m base</td>
                              <td className="px-4 py-2 text-[var(--text-primary)]enter">
                                {w.parallelizable ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mx-auto" /> : <AlertCircle className="w-3.5 h-3.5 text-[var(--text-code-red)] mx-auto" />}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                 </div>
              </div>
              
              {/* Right Column: Recommendations & Export */}
              <div className="space-y-4">
                 <div className="flex justify-end">
                   <button 
                     onClick={handleExport}
                     className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-tertiary)] hover:bg-[var(--border-strong)] text-[var(--text-primary)] text-xs font-semibold rounded border border-[var(--border)] transition"
                   >
                     <Download className="w-3.5 h-3.5" /> Export Report
                   </button>
                 </div>
                 
                 <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-lg p-5">
                    <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-[var(--text-code-amber)]" />
                      Recommendations
                    </h3>
                    <div className="space-y-3">
                      {recommendations.map((r, i) => (
                        <div key={i} className={`p-3 rounded border ${r.type === 'critical' ? 'bg-red-900/20 border-red-500/30' : r.type === 'warning' ? 'bg-amber-900/20 border-amber-500/30' : 'bg-blue-900/20 border-blue-500/30'}`}>
                          <div className="flex items-start gap-2 mb-1.5">
                            {r.type === 'critical' && <AlertCircle className="w-4 h-4 text-[var(--text-code-red)] shrink-0 mt-0.5" />}
                            {r.type === 'warning' && <AlertCircle className="w-4 h-4 text-[var(--text-code-amber)] shrink-0 mt-0.5" />}
                            {r.type === 'info' && <Info className="w-4 h-4 text-[var(--text-code-blue)] shrink-0 mt-0.5" />}
                            <div className={`text-xs font-bold ${r.type === 'critical' ? 'text-[var(--text-code-red)]' : r.type === 'warning' ? 'text-[var(--text-code-amber)]' : 'text-[var(--text-code-blue)]'}`}>
                              {r.title}
                            </div>
                          </div>
                          <p className="text-[11px] text-[var(--text-primary)] ml-6 leading-relaxed">{r.desc}</p>
                          <div className="mt-2 ml-6 text-[10px] font-mono bg-black/30 p-1.5 rounded text-[var(--text-muted)] border border-[var(--border)] break-words whitespace-pre-wrap">
                            {r.fix}
                          </div>
                        </div>
                      ))}
                    </div>
                 </div>

                 {/* local.conf generator */}
                 <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-lg p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-[var(--text-primary)]">local.conf Optimizer</h3>
                      <button className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition" onClick={handleCopyConfig}>
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <pre className="text-[10px] font-mono bg-[var(--bg-secondary)] border border-[var(--border)] p-3 rounded text-[var(--text-code-blue)] overflow-x-auto whitespace-pre-wrap">
                      {`# Build performance settings — generated\nBB_NUMBER_THREADS = "${Math.min(cores, Math.max(1, Math.floor(ram / 2)))}"\nPARALLEL_MAKE = "-j ${Math.min(cores, Math.max(1, Math.floor(ram / 2)))}"\nSSTATE_DIR = "\${TOPDIR}/../sstate-cache"\nDL_DIR = "\${TOPDIR}/../downloads"\n\n# Uncomment to enable build history\n# INHERIT += "buildhistory"\n# BUILDHISTORY_COMMIT = "1"`}
                    </pre>
                 </div>
              </div>
              
            </div>
          </>
        )}
      </div>
    </div>
  );
};
