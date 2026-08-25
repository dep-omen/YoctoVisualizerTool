import React, { useState, useMemo } from 'react';
import {
  ConflictDetectionResult,
  ConflictItem,
  ConflictType,
  OrphanBbappend,
  YoctoBuildConfig
} from '../types';
import { detectYoctoConflicts } from '../utils/conflictDetector';
import {
  AlertTriangle,
  AlertOctagon,
  FileQuestion,
  CheckCircle2,
  Search,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Layers,
  FileCode,
  Copy,
  Check,
  Info,
  ArrowRight,
  ArrowUpDown,
  Filter
} from 'lucide-react';

interface ConflictDetectorProps {
  config: YoctoBuildConfig;
}

type FilterOption = 'ALL' | 'CRITICAL' | 'VERSION BUMP' | 'FORK' | 'ORPHANS';
type SortField = 'name' | 'priority' | 'type' | 'overrides';
type SortOrder = 'asc' | 'desc';

export const ConflictDetector: React.FC<ConflictDetectorProps> = ({ config }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterOption>('ALL');
  const [expandedConflictId, setExpandedConflictId] = useState<string | null>(null);
  const [isOrphansCollapsed, setIsOrphansCollapsed] = useState(false);
  const [sortField, setSortField] = useState<SortField>('type');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  // Compute conflict detection result
  const conflictResult: ConflictDetectionResult = useMemo(() => {
    return detectYoctoConflicts(config);
  }, [config]);

  const { conflicts, orphanBbappends, stats } = conflictResult;

  // Filter conflicts
  const filteredConflicts = useMemo(() => {
    return conflicts.filter(item => {
      // Filter by type
      if (activeFilter === 'CRITICAL' && item.type !== 'CRITICAL') return false;
      if (activeFilter === 'VERSION BUMP' && item.type !== 'VERSION BUMP') return false;
      if (activeFilter === 'FORK' && item.type !== 'FORK') return false;
      if (activeFilter === 'ORPHANS') return false; // Handled separately in orphans section

      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesRecipe = item.recipeName.toLowerCase().includes(query);
        const matchesWinner = item.winningLayer.name.toLowerCase().includes(query);
        const matchesLoser = item.losingLayers.some(
          l => l.layer.name.toLowerCase().includes(query) || l.filename.toLowerCase().includes(query)
        );
        return matchesRecipe || matchesWinner || matchesLoser;
      }
      return true;
    });
  }, [conflicts, activeFilter, searchQuery]);

  // Sort conflicts
  const sortedConflicts = useMemo(() => {
    return [...filteredConflicts].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        comparison = a.recipeName.localeCompare(b.recipeName);
      } else if (sortField === 'priority') {
        comparison = (b.winningPriority || 0) - (a.winningPriority || 0);
      } else if (sortField === 'type') {
        const priorityOrder: Record<ConflictType, number> = {
          'CRITICAL': 1,
          'VERSION BUMP': 2,
          'FORK': 3
        };
        comparison = priorityOrder[a.type] - priorityOrder[b.type];
        if (comparison === 0) {
          comparison = a.recipeName.localeCompare(b.recipeName);
        }
      } else if (sortField === 'overrides') {
        comparison = b.losingLayers.length - a.losingLayers.length;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredConflicts, sortField, sortOrder]);

  // Filter orphans
  const filteredOrphans = useMemo(() => {
    if (!searchQuery.trim()) return orphanBbappends;
    const query = searchQuery.toLowerCase().trim();
    return orphanBbappends.filter(
      o =>
        o.filename.toLowerCase().includes(query) ||
        o.layer.name.toLowerCase().includes(query) ||
        o.targetRecipe.toLowerCase().includes(query)
    );
  }, [orphanBbappends, searchQuery]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleCopyPath = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(path);
    setCopiedPath(path);
    setTimeout(() => {
      setCopiedPath(null);
    }, 2000);
  };

  const toggleRowExpand = (id: string) => {
    setExpandedConflictId(prev => (prev === id ? null : id));
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-y-auto custom-scrollbar select-text">
      {/* SECTION 1 — SUMMARY BAR AT THE TOP */}
      <div className="p-4 md:p-6 border-b border-[var(--border)] bg-[var(--bg-panel)]/90 backdrop-blur shrink-0">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[var(--text-code-blue)]" />
                <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">BitBake Conflict & Override Detector</h2>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Analyzes duplicate <code className="text-[var(--text-code-blue)] font-mono">.bb</code> recipe collisions and unreferenced <code className="text-[var(--text-code-purple)] font-mono">.bbappend</code> orphans across all active layers based on <code className="text-[var(--text-code-amber)] font-mono">BBFILE_PRIORITY</code>.
              </p>
            </div>
            {stats.totalConflicts === 0 && stats.orphanBbappends === 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-950/80 border border-green-600 rounded-lg text-green-300 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span>No conflicts detected in active layers</span>
              </div>
            )}
          </div>

          {/* 4 Telemetry Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* 1. Recipe Collisions */}
            <div className="p-3 bg-[var(--bg-primary)] border border-amber-500/30 rounded-xl flex items-center gap-3 relative overflow-hidden">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-[var(--text-code-amber)]" />
              </div>
              <div>
                <div className="text-[11px] font-medium text-[var(--text-code-amber)]/80 uppercase tracking-wider">Conflicts</div>
                <div className="text-xl font-bold font-mono text-[var(--text-code-amber)]">{stats.totalConflicts}</div>
              </div>
            </div>

            {/* 2. Silent Overrides */}
            <div className="p-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4 text-[var(--text-muted)]" />
              </div>
              <div>
                <div className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Silent Overrides</div>
                <div className="text-xl font-bold font-mono text-[var(--text-primary)]">{stats.silentOverrides}</div>
              </div>
            </div>

            {/* 3. Critical Conflicts (Equal Priority) */}
            <div className={`p-3 bg-[var(--bg-primary)] border rounded-xl flex items-center gap-3 ${
              stats.criticalConflicts > 0 ? 'border-red-500/60 bg-red-950/20 animate-pulse' : 'border-[var(--border)]'
            }`}>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                stats.criticalConflicts > 0 ? 'bg-red-500/20 border border-red-500 text-[var(--text-code-red)]' : 'bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-muted)]'
              }`}>
                <AlertOctagon className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] font-medium text-[var(--text-code-red)] uppercase tracking-wider">Critical Conflicts</div>
                <div className="text-xl font-bold font-mono text-[var(--text-code-red)]">{stats.criticalConflicts}</div>
              </div>
            </div>

            {/* 4. Orphan BBAppends */}
            <div className="p-3 bg-[var(--bg-primary)] border border-purple-500/30 rounded-xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center shrink-0">
                <FileQuestion className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <div className="text-[11px] font-medium text-[var(--text-code-purple)] uppercase tracking-wider">Orphan bbappends</div>
                <div className="text-xl font-bold font-mono text-[var(--text-code-purple)]">{stats.orphanBbappends}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2 — CONFLICT TABLE (MAIN AREA) */}
      <div className="p-4 md:p-6 max-w-7xl mx-auto w-full space-y-4">
        {/* Controls Toolbar: Search & Filter Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[var(--bg-panel)] p-3 rounded-xl border border-[var(--border)]">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter by recipe name or layer..."
              className="w-full bg-[var(--bg-primary)] border border-[var(--border)] text-xs text-[var(--text-primary)] pl-9 pr-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 transition font-mono placeholder:text-[var(--text-muted)]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs px-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[var(--text-muted)] flex items-center gap-1 text-[11px] font-medium mr-1 hidden sm:flex">
              <Filter className="w-3 h-3" /> Filter:
            </span>
            <button
              onClick={() => setActiveFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                activeFilter === 'ALL'
                  ? 'bg-blue-600 text-white '
                  : 'bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              ALL ({conflicts.length})
            </button>
            <button
              onClick={() => setActiveFilter('CRITICAL')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                activeFilter === 'CRITICAL'
                  ? 'bg-red-600 text-white'
                  : 'bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-code-red)] hover:bg-red-950/40'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-red-400"></span>
              CRITICAL ({stats.criticalConflicts})
            </button>
            <button
              onClick={() => setActiveFilter('VERSION BUMP')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                activeFilter === 'VERSION BUMP'
                  ? 'bg-blue-600 text-white'
                  : 'bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-code-blue)] hover:bg-blue-950/40'
              }`}
            >
              VERSION BUMP ({conflicts.filter(c => c.type === 'VERSION BUMP').length})
            </button>
            <button
              onClick={() => setActiveFilter('FORK')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                activeFilter === 'FORK'
                  ? 'bg-amber-600 text-white'
                  : 'bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-code-amber)] hover:bg-amber-950/40'
              }`}
            >
              FORK ({conflicts.filter(c => c.type === 'FORK').length})
            </button>
            <button
              onClick={() => setActiveFilter('ORPHANS')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                activeFilter === 'ORPHANS'
                  ? 'bg-purple-600 text-white'
                  : 'bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-code-purple)] hover:bg-purple-950/40'
              }`}
            >
              ORPHANS ({stats.orphanBbappends})
            </button>
          </div>
        </div>

        {/* Conflict Items Table (when active filter is not purely ORPHANS) */}
        {activeFilter !== 'ORPHANS' && (
          <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-xl overflow-hidden ">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-muted)] uppercase tracking-wider font-semibold text-[10px]">
                    <th className="py-3 px-4 w-8"></th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-[var(--text-primary)] transition select-none"
                      onClick={() => toggleSort('name')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Recipe Name</span>
                        <ArrowUpDown className="w-3 h-3 text-[var(--text-muted)]" />
                      </div>
                    </th>
                    <th className="py-3 px-4">Winning Layer</th>
                    <th className="py-3 px-4">Winning Version</th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-[var(--text-primary)] transition select-none"
                      onClick={() => toggleSort('priority')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Winning Priority</span>
                        <ArrowUpDown className="w-3 h-3 text-[var(--text-muted)]" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-[var(--text-primary)] transition select-none"
                      onClick={() => toggleSort('overrides')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Overridden By (Silently Ignored)</span>
                        <ArrowUpDown className="w-3 h-3 text-[var(--text-muted)]" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-[var(--text-primary)] transition select-none"
                      onClick={() => toggleSort('type')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Conflict Type</span>
                        <ArrowUpDown className="w-3 h-3 text-[var(--text-muted)]" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60 font-sans">
                  {sortedConflicts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-[var(--text-primary)]enter text-[var(--text-muted)]">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <CheckCircle2 className="w-8 h-8 text-green-500" />
                          <span className="text-sm font-semibold text-[var(--text-primary)]">
                            {searchQuery ? 'No matching recipe conflicts found for your search query.' : 'No conflicts detected in active layers.'}
                          </span>
                          <span className="text-xs text-[var(--text-muted)]">All recipe names are uniquely defined across configured layers.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sortedConflicts.map(item => {
                      const isExpanded = expandedConflictId === item.id;
                      return (
                        <React.Fragment key={item.id}>
                          <tr
                            onClick={() => toggleRowExpand(item.id)}
                            className={`cursor-pointer transition-colors ${
                              isExpanded
                                ? 'bg-[var(--bg-tertiary)]'
                                : 'hover:bg-[var(--bg-tertiary)]'
                            } ${item.isCritical ? 'bg-red-950/10' : ''}`}
                          >
                            {/* Expand Chevron */}
                            <td className="py-3.5 px-3 text-[var(--text-primary)]enter text-[var(--text-muted)]">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-[var(--text-code-blue)]" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)]" />
                              )}
                            </td>

                            {/* Recipe Name */}
                            <td className="py-3.5 px-4 font-mono font-bold text-[var(--text-primary)]">
                              <span className="text-[var(--text-code-blue)] hover:underline">{item.recipeName}</span>
                            </td>

                            {/* Winning Layer */}
                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/70 border border-emerald-600/70 text-emerald-400 font-mono font-semibold text-[11px] ">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                {item.winningLayer.name}
                              </span>
                            </td>

                            {/* Winning Version */}
                            <td className="py-3.5 px-4 font-mono text-[var(--text-primary)]">
                              {item.winningVersion ? (
                                <span className="px-1.5 py-0.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded text-emerald-300">
                                  {item.winningVersion}
                                </span>
                              ) : (
                                <span className="text-[var(--text-muted)] italic">—</span>
                              )}
                            </td>

                            {/* Winning Priority */}
                            <td className="py-3.5 px-4 font-mono font-semibold text-[var(--text-primary)]">
                              <span className="px-2 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border)]">
                                {item.winningPriority}
                              </span>
                            </td>

                            {/* Overridden / Losers List */}
                            <td className="py-3.5 px-4">
                              <div className="flex flex-wrap gap-1.5 items-center">
                                {item.losingLayers.map((loser, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-950/70 border border-rose-800/80 text-rose-400 font-mono text-[10px]"
                                    title={`Ignored recipe: ${loser.relativePath}`}
                                  >
                                    <span className="font-semibold">{loser.layer.name}</span>
                                    {loser.version && (
                                      <span className="line-through text-rose-400/80 opacity-85">
                                        v{loser.version}
                                      </span>
                                    )}
                                    <span className="text-rose-500 font-bold bg-rose-900/40 px-1 rounded">
                                      P:{loser.priority}
                                    </span>
                                  </span>
                                ))}
                              </div>
                            </td>

                            {/* Conflict Type Badge */}
                            <td className="py-3.5 px-4">
                              {item.type === 'CRITICAL' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-950/90 border border-red-500 text-red-300 font-bold text-[10px] uppercase tracking-wider animate-pulse  -red-500/20">
                                  <AlertOctagon className="w-3 h-3 text-[var(--text-code-red)]" />
                                  CRITICAL
                                </span>
                              )}
                              {item.type === 'VERSION BUMP' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-950/70 border border-blue-600/70 text-[var(--text-code-blue)] font-semibold text-[10px] uppercase tracking-wider">
                                  VERSION BUMP
                                </span>
                              )}
                              {item.type === 'FORK' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-950/70 border border-amber-600/70 text-[var(--text-code-amber)] font-semibold text-[10px] uppercase tracking-wider">
                                  FORK
                                </span>
                              )}
                            </td>
                          </tr>

                          {/* Expanded Detail View */}
                          {isExpanded && (
                            <tr className="bg-[var(--bg-panel)] border-b border-[var(--border)]">
                              <td colSpan={7} className="p-4 pl-12 space-y-4">
                                {/* BitBake Rule Note Box */}
                                <div className={`p-3 rounded-lg border flex items-start gap-2.5 ${
                                  item.isCritical
                                    ? 'bg-red-950/30 border-red-800/60 text-red-200'
                                    : 'bg-blue-950/20 border-blue-800/40 text-blue-200'
                                }`}>
                                  <Info className={`w-4 h-4 shrink-0 mt-0.5 ${item.isCritical ? 'text-[var(--text-code-red)]' : 'text-[var(--text-code-blue)]'}`} />
                                  <div className="text-xs space-y-1">
                                    <div className="font-semibold text-[var(--text-primary)]">
                                      {item.isCritical ? 'Undefined BitBake Behavior Detected' : 'BitBake Priority Resolution Note'}
                                    </div>
                                    <p className="leading-relaxed opacity-90">{item.explanation}</p>
                                  </div>
                                </div>

                                {/* Detailed Path Breakdown */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                                  {/* Winning Recipe File */}
                                  <div className="p-3.5 bg-[var(--bg-primary)] border border-emerald-600/40 rounded-lg space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-emerald-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                                        <Check className="w-3.5 h-3.5" />
                                        Active / Winning Recipe
                                      </span>
                                      <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 rounded border border-emerald-800 text-[10px] font-bold">
                                        PRIORITY {item.winningPriority}
                                      </span>
                                    </div>
                                    <div className="text-[var(--text-primary)] font-semibold flex items-center gap-1.5">
                                      <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                                      {item.winningFilename}
                                    </div>
                                    <div className="p-2 bg-[var(--bg-panel)] rounded border border-[var(--border)] text-[11px] text-[var(--text-primary)] break-all flex items-center justify-between gap-2">
                                      <span className="truncate">{item.winningPath}</span>
                                      <button
                                        onClick={(e) => handleCopyPath(item.winningPath, e)}
                                        className="shrink-0 p-1 hover:bg-[var(--border-strong)] rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
                                        title="Copy full path"
                                      >
                                        {copiedPath === item.winningPath ? (
                                          <Check className="w-3.5 h-3.5 text-green-400" />
                                        ) : (
                                          <Copy className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                    </div>
                                    <div className="text-[10px] text-[var(--text-muted)]">
                                      Layer: <span className="text-[var(--text-primary)] font-semibold">{item.winningLayer.name}</span> ({item.winningLayer.path})
                                    </div>
                                  </div>

                                  {/* Losing Overridden Recipes */}
                                  <div className="space-y-2">
                                    <div className="text-rose-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                                      <AlertTriangle className="w-3.5 h-3.5" />
                                      Silently Ignored Recipes ({item.losingLayers.length})
                                    </div>
                                    {item.losingLayers.map((loser, lIdx) => (
                                      <div
                                        key={lIdx}
                                        className="p-3 bg-[var(--bg-primary)] border border-rose-800/40 rounded-lg space-y-2"
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="text-rose-400 font-semibold text-[11px] flex items-center gap-1.5">
                                            <FileCode className="w-3.5 h-3.5" />
                                            {loser.filename}
                                          </span>
                                          <span className="px-2 py-0.5 bg-rose-950 text-rose-300 rounded border border-rose-800 text-[10px] font-bold">
                                            PRIORITY {loser.priority}
                                          </span>
                                        </div>
                                        <div className="p-2 bg-[var(--bg-panel)] rounded border border-[var(--border)] text-[11px] text-[var(--text-muted)] break-all flex items-center justify-between gap-2">
                                          <span className="truncate">{loser.path}</span>
                                          <button
                                            onClick={(e) => handleCopyPath(loser.path, e)}
                                            className="shrink-0 p-1 hover:bg-[var(--border-strong)] rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
                                            title="Copy full path"
                                          >
                                            {copiedPath === loser.path ? (
                                              <Check className="w-3.5 h-3.5 text-green-400" />
                                            ) : (
                                              <Copy className="w-3.5 h-3.5" />
                                            )}
                                          </button>
                                        </div>
                                        <div className="text-[10px] text-[var(--text-muted)]">
                                          Layer: <span className="text-[var(--text-primary)] font-semibold">{loser.layer.name}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SECTION 3 — ORPHAN BBAPPENDS (BELOW CONFLICT TABLE) */}
        <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-xl overflow-hidden  mt-6">
          <div
            onClick={() => setIsOrphansCollapsed(prev => !prev)}
            className="p-4 bg-[var(--bg-panel)] border-b border-[var(--border)] flex items-center justify-between cursor-pointer hover:bg-[var(--bg-tertiary)] transition select-none"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-950/60 border border-purple-800/80 flex items-center justify-center">
                <FileQuestion className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[var(--text-primary)] tracking-tight">
                    Orphan .bbappend Files
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-purple-950 border border-purple-800 text-[var(--text-code-purple)] font-mono text-[10px] font-bold">
                    {filteredOrphans.length}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Append files that do not match any known <code className="text-[var(--text-primary)] font-mono">.bb</code> recipe in any active layer (targets missing or inactive upstream recipes).
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs">
              <span>{isOrphansCollapsed ? 'Expand Section' : 'Collapse Section'}</span>
              {isOrphansCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>

          {!isOrphansCollapsed && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-muted)] uppercase tracking-wider font-semibold text-[10px]">
                    <th className="py-3 px-4">bbappend Filename</th>
                    <th className="py-3 px-4">Layer</th>
                    <th className="py-3 px-4">Target Recipe (Parsed)</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Full Path</th>
                    <th className="py-3 px-4">Status Badge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60 font-sans">
                  {filteredOrphans.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-[var(--text-primary)]enter text-[var(--text-muted)]">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <CheckCircle2 className="w-6 h-6 text-green-500" />
                          <span className="text-xs font-semibold text-[var(--text-primary)]">
                            No orphan .bbappend files detected.
                          </span>
                          <span className="text-[11px] text-[var(--text-muted)]">All .bbappend files cleanly match an active .bb recipe.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredOrphans.map(orphan => (
                      <tr key={orphan.id} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-[var(--text-code-purple)]">
                          {orphan.filename}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-semibold text-[var(--text-primary)]">
                          <span className="px-2 py-0.5 bg-[var(--bg-tertiary)] rounded border border-[var(--border)] text-[var(--text-primary)] text-[11px]">
                            {orphan.layer.name}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[var(--text-code-amber)]">
                          <span className="px-2 py-0.5 bg-amber-950/40 border border-amber-800/60 rounded text-[11px]">
                            {orphan.targetRecipe}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-[var(--text-muted)] font-mono text-[11px]">
                          {orphan.category}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-[var(--text-muted)]">
                          <div className="flex items-center gap-2 max-w-xs md:max-w-md truncate">
                            <span className="truncate">{orphan.fullPath}</span>
                            <button
                              onClick={(e) => handleCopyPath(orphan.fullPath, e)}
                              className="p-1 hover:bg-[var(--bg-tertiary)] rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0"
                              title="Copy path"
                            >
                              {copiedPath === orphan.fullPath ? (
                                <Check className="w-3.5 h-3.5 text-green-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-950/90 border border-purple-600/80 text-[var(--text-code-purple)] font-bold text-[10px] uppercase tracking-wider">
                            <AlertTriangle className="w-3 h-3 text-purple-400" />
                            NO RECIPE FOUND
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
