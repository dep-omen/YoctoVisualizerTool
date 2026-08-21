import React from 'react';
import { YoctoBuildConfig } from '../types';
import { Search } from 'lucide-react';

interface StatsBarProps {
  config: YoctoBuildConfig;
  searchFilter: string;
  onSearchChange: (val: string) => void;
}

export const StatsBar: React.FC<StatsBarProps> = ({
  config,
  searchFilter,
  onSearchChange
}) => {
  const { stats } = config;

  return (
    <div
      id="yocto-stats-bar"
      className="h-10 bg-[#0d1117] border-b border-gray-800 flex items-center px-4 justify-between gap-4 text-[11px] text-gray-400 shrink-0 select-none uppercase tracking-wider"
    >
      {/* Stats indicators matching design specification */}
      <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto custom-scrollbar whitespace-nowrap">
        {/* Layers */}
        <div className="flex items-center gap-1.5" title="Total active layers configured">
          <span className="text-blue-500 text-xs">●</span>
          <span>Layers:</span>
          <span className="text-white font-mono font-semibold">
            {stats.activeLayers}
            {stats.missingLayers > 0 && (
              <span className="text-red-400 font-normal text-[10px] ml-1 lowercase">
                ({stats.missingLayers} missing)
              </span>
            )}
            {stats.ghostLayers > 0 && (
              <span className="text-gray-500 font-normal text-[10px] ml-1 lowercase">
                (+{stats.ghostLayers} unmet)
              </span>
            )}
          </span>
          {config.discoveryMode === 'fallback' ? (
            <span id="mode-badge-auto" className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-tight bg-amber-500/20 text-amber-300 border border-amber-500/40">
              AUTO-DISCOVERED
            </span>
          ) : (
            <span id="mode-badge-bblayers" className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-tight bg-green-500/20 text-green-300 border border-green-500/40">
              FROM BBLAYERS.CONF
            </span>
          )}
        </div>

        {/* Recipes */}
        <div className="flex items-center gap-1.5" title="Total parsed .bb recipes across all active layers">
          <span className="text-teal-500 text-xs">●</span>
          <span>Recipes:</span>
          <span className="text-white font-mono font-semibold">
            {stats.totalRecipes.toLocaleString()}
          </span>
        </div>

        {/* BBAppends */}
        <div className="flex items-center gap-1.5" title="Total parsed .bbappend recipe overrides">
          <span className="text-amber-500 text-xs">●</span>
          <span>BBAppends:</span>
          <span className="text-white font-mono font-semibold">
            {stats.totalBbappends.toLocaleString()}
          </span>
        </div>

        {/* Dependencies */}
        <div className="flex items-center gap-1.5" title="Total LAYERDEPENDS relationship edges">
          <span className="text-purple-500 text-xs">●</span>
          <span>Dependencies:</span>
          <span className="text-white font-mono font-semibold">
            {stats.totalDependencies}
          </span>
        </div>

        {/* Release Pill */}
        <div className="hidden lg:flex items-center gap-1.5" title="Detected Yocto Project Release Compatibility">
          <span className="text-gray-500">RELEASE:</span>
          <span className="text-white font-mono font-semibold">
            {stats.primaryRelease || config.activeYoctoRelease || 'Custom'}
          </span>
        </div>

        {/* OEROOT Debug Indicator */}
        {config.oeRoot && (
          <div className="hidden md:flex items-center gap-1.5" title={`Resolved OEROOT: ${config.oeRoot}`}>
            <span className="text-gray-500">OEROOT:</span>
            <span id="stat-oeroot" className="text-blue-400 font-mono font-semibold truncate max-w-[220px]">
              {config.oeRoot}
            </span>
          </div>
        )}
      </div>

      {/* Live Graph Search / Filter Input */}
      <div className="relative w-44 sm:w-60 shrink-0">
        <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          id="graph-search-input"
          placeholder="Filter layers & recipes..."
          value={searchFilter}
          onChange={e => onSearchChange(e.target.value)}
          className="w-full pl-8 pr-7 py-1 text-xs bg-[#161b22] border border-gray-700 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition normal-case tracking-normal"
        />
        {searchFilter && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-white"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};

