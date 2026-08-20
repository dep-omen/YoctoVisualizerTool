import React, { useState } from 'react';
import { YoctoBuildConfig, YoctoLayer } from '../types';
import {
  X,
  Copy,
  Check,
  FileCode,
  FilePlus,
  Code2
} from 'lucide-react';

interface LayerDetailPanelProps {
  layer: YoctoLayer;
  allConfig: YoctoBuildConfig;
  onClose: () => void;
  onSelectLayer: (layerId: string) => void;
}

const CATEGORY_BADGES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  core: { label: 'CORE', bg: 'bg-blue-900/30', text: 'text-blue-400', border: 'border-blue-500/30' },
  openembedded: { label: 'OPENEMBEDDED', bg: 'bg-teal-900/30', text: 'text-teal-400', border: 'border-teal-500/30' },
  'oe-sublayer': { label: 'OE SUBLAYER', bg: 'bg-cyan-900/30', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  'st-bsp': { label: 'BSP', bg: 'bg-amber-900/30', text: 'text-amber-500', border: 'border-amber-500/30' },
  bsp: { label: 'BSP', bg: 'bg-amber-900/30', text: 'text-amber-500', border: 'border-amber-500/30' },
  custom: { label: 'CUSTOM', bg: 'bg-purple-900/30', text: 'text-purple-400', border: 'border-purple-500/30' },
  missing: { label: 'MISSING', bg: 'bg-red-900/30', text: 'text-red-400', border: 'border-red-500/30' },
  ghost: { label: 'UNMET', bg: 'bg-gray-800/60', text: 'text-gray-400', border: 'border-gray-600/40' }
};

export const LayerDetailPanel: React.FC<LayerDetailPanelProps> = ({
  layer,
  allConfig,
  onClose,
  onSelectLayer
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
      className="w-full sm:w-[340px] md:w-[360px] lg:w-[380px] h-full border-l border-gray-800 bg-[#090c10] flex flex-col shrink-0 text-gray-200 z-20 select-none shadow-2xl"
    >
      {/* Top Metadata Header */}
      <div className="p-5 border-b border-gray-800 space-y-4">
        {/* Title & Badge */}
        <div>
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h2 className="text-xl font-bold text-white leading-tight truncate" title={layer.name}>
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
                className="p-1 rounded text-gray-500 hover:text-white hover:bg-gray-800 transition"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-gray-500 group">
            <span className="truncate" title={layer.path}>
              {layer.path}
            </span>
            <button
              onClick={handleCopyPath}
              className="p-1 rounded hover:bg-gray-800 text-gray-500 hover:text-gray-300 ml-1 shrink-0"
              title="Copy path"
            >
              {copiedPath ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Priority & Series Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] uppercase text-gray-500 mb-1 tracking-wider">Priority</div>
            <div className="text-lg font-mono text-white font-semibold">
              {layer.priority !== undefined ? layer.priority : '—'}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-gray-500 mb-1 tracking-wider">Series</div>
            <div className="text-xs font-mono text-white font-medium truncate" title={layer.seriesCompat?.join(' ') || 'None'}>
              {layer.seriesCompat && layer.seriesCompat.length > 0
                ? layer.seriesCompat.join(' ')
                : 'Not specified'}
            </div>
          </div>
        </div>

        {/* Dependencies & Categories */}
        <div className="space-y-3">
          {/* Layer Dependencies */}
          <div>
            <div className="text-[10px] uppercase text-gray-500 mb-1.5 tracking-wider">
              Layer Dependencies ({layer.dependsOn.length})
            </div>
            {layer.dependsOn.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {layer.dependsOn.map(dep => (
                  <button
                    key={dep}
                    id={`dep-pill-${dep}`}
                    onClick={() => onSelectLayer(dep)}
                    className="px-2 py-0.5 bg-gray-800 hover:bg-gray-700 rounded text-[10px] text-gray-300 font-mono transition"
                  >
                    {dep}
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-[11px] text-gray-600 font-mono italic">None (Root Layer)</span>
            )}
          </div>

          {/* Required By */}
          {requiredByLayers.length > 0 && (
            <div>
              <div className="text-[10px] uppercase text-gray-500 mb-1.5 tracking-wider">
                Required By ({requiredByLayers.length})
              </div>
              <div className="flex flex-wrap gap-1">
                {requiredByLayers.map(req => (
                  <button
                    key={req.id}
                    id={`required-by-${req.id}`}
                    onClick={() => onSelectLayer(req.id)}
                    className="px-2 py-0.5 bg-gray-800 hover:bg-gray-700 rounded text-[10px] text-amber-400 font-mono transition"
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
              <div className="text-[10px] uppercase text-gray-500 mb-1.5 tracking-wider">
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
                          : 'border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300'
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
      <div className="px-3 pt-2 bg-[#090c10] flex items-center gap-2 border-b border-gray-800 text-xs">
        <button
          id="tab-recipes-btn"
          onClick={() => setActiveTab('recipes')}
          className={`pb-2 px-2 text-[11px] font-semibold flex items-center gap-1.5 border-b-2 transition ${
            activeTab === 'recipes'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-300'
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
              : 'border-transparent text-gray-500 hover:text-gray-300'
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
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <Code2 className="w-3 h-3" />
            <span>layer.conf</span>
          </button>
        )}
      </div>

      {/* Main List Body */}
      <div className="flex-1 flex flex-col min-h-0 bg-[#0d1117]">
        {/* Search Bar for Tab items */}
        {activeTab !== 'conf' && (
          <div className="p-3 bg-[#161b22] border-b border-gray-800">
            <input
              type="text"
              placeholder={`Filter ${
                activeTab === 'recipes' ? `${layer.recipes.length} recipes...` : `${layer.bbappends.length} bbappends...`
              }`}
              value={recipeSearch}
              onChange={e => setRecipeSearch(e.target.value)}
              className="w-full bg-[#0d1117] border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 font-sans"
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
                    className="px-3 py-1.5 hover:bg-gray-800 text-blue-300 flex items-center justify-between group cursor-default transition rounded"
                    title={r.relativePath}
                  >
                    <span className="truncate">{r.filename}</span>
                    {r.version && (
                      <span className="opacity-0 group-hover:opacity-100 text-gray-500 text-[10px] shrink-0 ml-2">
                        v{r.version}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-xs text-gray-500 font-sans">
                  {layer.recipes.length === 0 ? 'No recipes in this layer' : 'No recipes matched filter'}
                </div>
              )}
            </div>
          )}

          {activeTab === 'bbappends' && (
            <div>
              {filteredBbappends.length > 0 ? (
                filteredBbappends.map((app, i) => (
                  <div
                    key={`${app.filename}-${i}`}
                    className="px-3 py-1.5 hover:bg-gray-800 text-amber-500 italic flex items-center justify-between group cursor-default transition rounded"
                    title={app.relativePath}
                  >
                    <span className="truncate">{app.filename}</span>
                    <span className="text-[9px] text-gray-500 not-italic shrink-0 ml-2">(override)</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-xs text-gray-500 font-sans">
                  {layer.bbappends.length === 0 ? 'No bbappends in this layer' : 'No bbappends matched filter'}
                </div>
              )}
            </div>
          )}

          {activeTab === 'conf' && layer.rawLayerConf && (
            <div className="p-3">
              <pre className="p-3 rounded bg-[#090c10] text-[11px] font-mono text-blue-300 whitespace-pre-wrap overflow-x-auto border border-gray-800 custom-scrollbar leading-relaxed">
                {layer.rawLayerConf}
              </pre>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

