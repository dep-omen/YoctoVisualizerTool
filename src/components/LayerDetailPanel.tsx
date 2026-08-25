import React, { useState } from 'react';
import { YoctoBuildConfig, YoctoLayer } from '../types';
import { isStandardKnownRelease } from '../utils/yoctoParser';
import {
  X,
  Copy,
  Check,
  FileCode,
  FilePlus,
  Code2,
  Layers,
  Sparkles,
  FolderOpen
} from 'lucide-react';

interface LayerDetailPanelProps {
  layer: YoctoLayer;
  allConfig: YoctoBuildConfig;
  onClose: () => void;
  onSelectLayer: (layerId: string) => void;
  onViewBbappends?: () => void;
}

const CATEGORY_BADGES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  core: { label: 'CORE', bg: 'bg-blue-900/30', text: 'text-[var(--text-code-blue)]', border: 'border-blue-500/30' },
  openembedded: { label: 'OPENEMBEDDED', bg: 'bg-teal-900/30', text: 'text-teal-400', border: 'border-teal-500/30' },
  'oe-sublayer': { label: 'OE SUBLAYER', bg: 'bg-cyan-900/30', text: 'text-[var(--text-code-blue)]', border: 'border-cyan-500/30' },
  'st-bsp': { label: 'BSP', bg: 'bg-amber-900/30', text: 'text-amber-500', border: 'border-amber-500/30' },
  bsp: { label: 'BSP', bg: 'bg-amber-900/30', text: 'text-amber-500', border: 'border-amber-500/30' },
  custom: { label: 'CUSTOM', bg: 'bg-purple-900/30', text: 'text-purple-400', border: 'border-purple-500/30' },
  missing: { label: 'MISSING', bg: 'bg-red-900/30', text: 'text-[var(--text-code-red)]', border: 'border-red-500/30' },
  ghost: { label: 'UNMET', bg: 'bg-[var(--bg-tertiary)]', text: 'text-[var(--text-muted)]', border: 'border-[var(--border)]' }
};

export const LayerDetailPanel: React.FC<LayerDetailPanelProps> = ({
  layer,
  allConfig,
  onClose,
  onSelectLayer,
  onViewBbappends
}) => {
  const [activeTab, setActiveTab] = useState<'recipes' | 'bbappends' | 'conf'>('recipes');
  const [recipeSearch, setRecipeSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState(false);

  // Identify layers that depend on THIS layer ("Required by")
  const requiredByLayers = allConfig.layers.filter(l =>
    l.dependsOn.some(
      dep => dep === layer.id || dep === layer.collectionName || dep === layer.name
    )
  );

  const handleCopyPath = () => {
    navigator.clipboard.writeText(layer.path);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  const badgeInfo = CATEGORY_BADGES[layer.categoryType] || CATEGORY_BADGES.custom;

  // Filter recipes
  const filteredRecipes = layer.recipes.filter(r => {
    const matchesSearch =
      r.name.toLowerCase().includes(recipeSearch.toLowerCase()) ||
      r.filename.toLowerCase().includes(recipeSearch.toLowerCase()) ||
      r.category.toLowerCase().includes(recipeSearch.toLowerCase());
    const matchesCat = !selectedCategoryFilter || r.category === selectedCategoryFilter;
    return matchesSearch && matchesCat;
  });

  const filteredBbappends = layer.bbappends.filter(app => {
    return (
      app.filename.toLowerCase().includes(recipeSearch.toLowerCase()) ||
      app.targetRecipe.toLowerCase().includes(recipeSearch.toLowerCase())
    );
  });

  return (
    <aside
      id="layer-detail-panel"
      className="w-full sm:w-[340px] md:w-[360px] lg:w-[380px] h-full border-l border-[var(--border)] bg-[var(--bg-secondary)] flex flex-col shrink-0 text-[var(--text-primary)] z-20 select-none "
    >
      {/* Top Metadata Header */}
      <div className="p-5 border-b border-[var(--border)] space-y-4">
        {/* Title & Badge */}
        <div>
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h2 className="text-xl font-bold text-[var(--text-primary)] leading-tight truncate" title={layer.name}>
              {layer.name}
            </h2>
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-tighter border ${badgeInfo.bg} ${badgeInfo.text} ${badgeInfo.border}`}
              >
                {badgeInfo.label}
              </span>
              <button
                id="close-detail-panel-btn"
                onClick={onClose}
                className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)] group">
            <span className="truncate" title={layer.path}>
              {layer.path}
            </span>
            <div className="flex items-center gap-0.5 shrink-0 ml-1">
              {window.electronAPI && (
                <button
                  onClick={() => {
                    if (layer.absolutePath || layer.path) {
                      window.electronAPI?.showItemInFolder(layer.absolutePath || layer.path);
                    }
                  }}
                  className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
                  title="Reveal in File Manager"
                >
                  <FolderOpen className="w-3 h-3" />
                </button>
              )}
              <button
                onClick={handleCopyPath}
                className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
                title="Copy path"
              >
                {copiedPath ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>

        {/* Priority & Series Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] uppercase text-[var(--text-muted)] mb-1 tracking-wider">Priority</div>
            <div className="text-lg font-mono text-[var(--text-primary)] font-semibold">
              {layer.priority !== undefined ? layer.priority : '—'}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-[var(--text-muted)] mb-1 tracking-wider">Series</div>
            {layer.seriesCompat && layer.seriesCompat.length > 0 ? (
              <div className="flex flex-wrap gap-1 items-center">
                {layer.seriesCompat.map(rel => (
                  <span
                    key={rel}
                    className="inline-flex items-center gap-1 text-xs font-mono text-[var(--text-primary)] font-medium bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded border border-[var(--border)]"
                  >
                    <span>{rel}</span>
                    {!isStandardKnownRelease(rel) && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-purple-900/50 text-[var(--text-code-purple)] border border-purple-500/40">
                        unreleased
                      </span>
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-xs font-mono text-[var(--text-muted)] italic">Not specified</div>
            )}
          </div>
        </div>

        {/* Dependencies & Categories */}
        <div className="space-y-3">
          {/* Hard Dependencies (LAYERDEPENDS) */}
          <div>
            <div className="text-[10px] uppercase text-[var(--text-muted)] mb-1.5 tracking-wider flex items-center gap-1.5">
              <Layers className="w-3 h-3 text-[var(--text-code-blue)]" />
              <span>Hard Dependencies ({layer.dependsOn.length})</span>
            </div>
            {layer.dependsOn.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {layer.dependsOn.map(dep => (
                  <button
                    key={dep}
                    id={`dep-pill-${dep}`}
                    onClick={() => onSelectLayer(dep)}
                    className="px-2 py-0.5 bg-[var(--bg-tertiary)] hover:bg-[var(--border-strong)] rounded text-[10px] text-[var(--text-primary)] font-mono transition border border-[var(--border)]/60"
                  >
                    {dep}
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-[11px] text-[var(--text-muted)] font-mono italic">None (Root Layer)</span>
            )}
          </div>

          {/* Dynamic Extensions (BBFILES_DYNAMIC) */}
          {layer.dynamicDepends && layer.dynamicDepends.length > 0 && (
            <div>
              <div className="text-[10px] uppercase text-[var(--text-muted)] mb-1 tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-[var(--text-primary)]yan-400" />
                <span>Dynamic Extensions ({layer.dynamicDepends.length})</span>
              </div>
              <p className="text-[10px] text-[var(--text-primary)]yan-400/80 mb-1.5 italic leading-tight">
                Extra recipes loaded if this layer is present
              </p>
              <div className="flex flex-wrap gap-1">
                {layer.dynamicDepends.map(dyn => (
                  <button
                    key={dyn}
                    id={`dynamic-pill-${dyn}`}
                    onClick={() => onSelectLayer(dyn)}
                    className="px-2 py-0.5 bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/40 rounded text-[10px] text-[var(--text-primary)]yan-300 font-mono transition"
                  >
                    {dyn}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Required By */}
          {requiredByLayers.length > 0 && (
            <div>
              <div className="text-[10px] uppercase text-[var(--text-muted)] mb-1.5 tracking-wider">
                Required By ({requiredByLayers.length})
              </div>
              <div className="flex flex-wrap gap-1">
                {requiredByLayers.map(req => (
                  <button
                    key={req.id}
                    id={`required-by-${req.id}`}
                    onClick={() => onSelectLayer(req.id)}
                    className="px-2 py-0.5 bg-[var(--bg-tertiary)] hover:bg-[var(--border-strong)] rounded text-[10px] text-[var(--text-code-amber)] font-mono transition"
                  >
                    {req.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recipe Categories */}
          {layer.recipeCategories.length > 0 && (
            <div>
              <div className="text-[10px] uppercase text-[var(--text-muted)] mb-1.5 tracking-wider">
                Recipe Categories
              </div>
              <div className="flex flex-wrap gap-1">
                {layer.recipeCategories.map(cat => {
                  const count = layer.recipes.filter(r => r.category === cat).length;
                  const isSelected = selectedCategoryFilter === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => {
                        setSelectedCategoryFilter(isSelected ? null : cat);
                        setActiveTab('recipes');
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition ${
                        isSelected
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {cat} ({count})
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-3 pt-2 bg-[var(--bg-secondary)] flex items-center gap-2 border-b border-[var(--border)] text-xs">
        <button
          id="tab-recipes-btn"
          onClick={() => setActiveTab('recipes')}
          className={`pb-2 px-2 text-[11px] font-semibold flex items-center gap-1.5 border-b-2 transition ${
            activeTab === 'recipes'
              ? 'border-blue-500 text-[var(--text-code-blue)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <FileCode className="w-3 h-3" />
          <span>Recipes ({layer.recipes.length})</span>
        </button>

        <button
          id="tab-bbappends-btn"
          onClick={() => setActiveTab('bbappends')}
          className={`pb-2 px-2 text-[11px] font-semibold flex items-center gap-1.5 border-b-2 transition ${
            activeTab === 'bbappends'
              ? 'border-amber-500 text-amber-500'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <FilePlus className="w-3 h-3" />
          <span>BBAppends ({layer.bbappends.length})</span>
        </button>

        {layer.rawLayerConf && (
          <button
            id="tab-layerconf-btn"
            onClick={() => setActiveTab('conf')}
            className={`pb-2 px-2 text-[11px] font-semibold flex items-center gap-1.5 border-b-2 transition ${
              activeTab === 'conf'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Code2 className="w-3 h-3" />
            <span>layer.conf</span>
          </button>
        )}
      </div>

      {/* Main List Body */}
      <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-primary)]">
        {/* Search Bar for Tab items */}
        {activeTab !== 'conf' && (
          <div className="p-3 bg-[var(--bg-panel)] border-b border-[var(--border)]">
            <input
              type="text"
              placeholder={`Filter ${
                activeTab === 'recipes' ? `${layer.recipes.length} recipes...` : `${layer.bbappends.length} bbappends...`
              }`}
              value={recipeSearch}
              onChange={e => setRecipeSearch(e.target.value)}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-gray-500 focus:outline-none focus:border-blue-500 font-sans"
            />
          </div>
        )}

        {/* Tab Content List */}
        <div className="flex-1 overflow-y-auto font-mono text-[11px] p-1 custom-scrollbar">
          {activeTab === 'recipes' && (
            <div>
              {filteredRecipes.length > 0 ? (
                filteredRecipes.map((r, i) => (
                  <div
                    key={`${r.filename}-${i}`}
                    className="px-3 py-1.5 hover:bg-[var(--bg-tertiary)] text-[var(--text-code-blue)] flex items-center justify-between group cursor-default transition rounded"
                    title={r.relativePath}
                  >
                    <span className="truncate">{r.filename}</span>
                    {r.version && (
                      <span className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] text-[10px] shrink-0 ml-2">
                        v{r.version}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-[var(--text-primary)]enter py-8 text-xs text-[var(--text-muted)] font-sans">
                  {layer.recipes.length === 0 ? 'No recipes in this layer' : 'No recipes matched filter'}
                </div>
              )}
            </div>
          )}

          {activeTab === 'bbappends' && (
            <div>
              {layer.bbappends.length > 0 && onViewBbappends && (
                <div className="p-2 mb-2">
                  <button
                    onClick={onViewBbappends}
                    className="w-full py-1.5 flex items-center justify-center gap-2 bg-amber-900/30 hover:bg-amber-800/40 border border-amber-500/30 rounded text-[var(--text-code-amber)] text-xs font-semibold transition"
                  >
                    <FilePlus className="w-3.5 h-3.5" />
                    Analyze BBAppends
                  </button>
                </div>
              )}
              {filteredBbappends.length > 0 ? (
                filteredBbappends.map((app, i) => (
                  <div
                    key={`${app.filename}-${i}`}
                    className="px-3 py-1.5 hover:bg-[var(--bg-tertiary)] text-amber-500 italic flex items-center justify-between group cursor-default transition rounded"
                    title={app.relativePath}
                  >
                    <span className="truncate">{app.filename}</span>
                    <span className="text-[9px] text-[var(--text-muted)] not-italic shrink-0 ml-2">(override)</span>
                  </div>
                ))
              ) : (
                <div className="text-[var(--text-primary)]enter py-8 text-xs text-[var(--text-muted)] font-sans">
                  {layer.bbappends.length === 0 ? 'No bbappends in this layer' : 'No bbappends matched filter'}
                </div>
              )}
            </div>
          )}

          {activeTab === 'conf' && layer.rawLayerConf && (
            <div className="p-3">
              <pre className="p-3 rounded bg-[var(--bg-secondary)] text-[11px] font-mono text-[var(--text-code-blue)] whitespace-pre-wrap overflow-x-auto border border-[var(--border)] custom-scrollbar leading-relaxed">
                {layer.rawLayerConf}
              </pre>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

