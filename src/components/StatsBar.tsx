import React from 'react';
import { YoctoBuildConfig } from '../types';
import { Search } from 'lucide-react';

interface StatsBarProps {
  config: YoctoBuildConfig | null;
  searchFilter: string;
  onSearchChange: (val: string) => void;
}

export const StatsBar: React.FC<StatsBarProps> = ({
  config, searchFilter, onSearchChange
}) => {
  if (!config) return null;

  const bblayersCount = config.layers.filter(l => l.source === 'bblayers.conf').length;
  const autoCount = config.layers.filter(l => l.source === 'auto-discovered').length;
  
  const coreCount = config.layers.filter(l => l.category === 'core').length;
  const oeCount = config.layers.filter(l => l.category === 'openembedded').length;
  const bspCount = config.layers.filter(l => l.category === 'bsp').length;
  const customCount = config.layers.filter(l => l.category === 'custom').length;

  return (
    <div className="h-[32px] bg-[var(--bg-primary)] border-b border-[var(--border)] flex items-center justify-between px-4 shrink-0">
      
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 text-[11px]">
          <span className="text-[var(--text-muted)]">LAYERS:</span>
          <span className="text-[var(--text-primary)] font-medium">{config.layers.length}</span>
        </div>
        <span className="text-[var(--border-strong)]">·</span>
        
        <div className="flex items-center gap-1 text-[11px]">
          <span className="w-2 h-2 rounded-full bg-[var(--node-core)]" />
          <span className="text-[var(--text-muted)]">CORE:</span>
          <span className="text-[var(--text-primary)] font-medium">{coreCount}</span>
        </div>
        <span className="text-[var(--border-strong)]">·</span>
        
        <div className="flex items-center gap-1 text-[11px]">
          <span className="w-2 h-2 rounded-full bg-[var(--node-oe)]" />
          <span className="text-[var(--text-muted)]">OE:</span>
          <span className="text-[var(--text-primary)] font-medium">{oeCount}</span>
        </div>
        <span className="text-[var(--border-strong)]">·</span>
        
        <div className="flex items-center gap-1 text-[11px]">
          <span className="w-2 h-2 rounded-full bg-[var(--node-bsp)]" />
          <span className="text-[var(--text-muted)]">BSP:</span>
          <span className="text-[var(--text-primary)] font-medium">{bspCount}</span>
        </div>
        <span className="text-[var(--border-strong)]">·</span>
        
        <div className="flex items-center gap-1 text-[11px]">
          <span className="w-2 h-2 rounded-full bg-[var(--node-custom)]" />
          <span className="text-[var(--text-muted)]">CUSTOM:</span>
          <span className="text-[var(--text-primary)] font-medium">{customCount}</span>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {bblayersCount > 0 && (
            <span className="px-[4px] py-[2px] bg-[var(--success-bg)] text-[var(--success)] text-[11px] rounded-[4px] font-medium uppercase">
              {bblayersCount} FROM BBLAYERS.CONF
            </span>
          )}
          {autoCount > 0 && (
            <span className="px-[4px] py-[2px] bg-[var(--warning-bg)] text-[var(--warning)] text-[11px] rounded-[4px] font-medium uppercase">
              {autoCount} AUTO-DISCOVERED
            </span>
          )}
        </div>
        
        <div className="h-4 w-[1px] bg-[var(--border)]" />
        
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Filter layers..."
            value={searchFilter}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-[24px] w-48 pl-7 pr-2 bg-[var(--bg-primary)] border border-[var(--border)] focus:border-[var(--accent)] rounded-[6px] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition-colors"
          />
        </div>
      </div>
      
    </div>
  );
};
