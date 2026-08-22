'use client';

import { useLabStore } from '@/store/useLabStore';
import { LAB_TOOLS } from '@/lib/labConstants';
import { MousePointer2, Move, Plus, Minus, Spline, FlipHorizontal, SplitSquareHorizontal, Undo, Redo, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LabTool } from '@/types/Lab';

// Icon mapping since we store strings in config
const getIcon = (iconName: string) => {
  switch (iconName) {
    case 'MousePointer2': return MousePointer2;
    case 'Move': return Move;
    case 'Plus': return Plus;
    case 'Minus': return Minus;
    case 'Spline': return Spline;
    case 'FlipHorizontal': return FlipHorizontal;
    case 'Symmetry': return SplitSquareHorizontal;
    default: return MousePointer2;
  }
};

export function Toolbar() {
  const { activeTool, setActiveTool, undo, redo, historyIndex, history, editMode, setPoints } = useLabStore();
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  if (!editMode) {
    return null; // Toolbar only visible in edit mode
  }

  const handleReset = () => {
    if (confirm('Tem certeza de que deseja resetar a geometria para o perfil padrão original?')) {
       // Ideally import getDefaultKnifeProfile here and call setPoints
       // But for simplicity of this demo file, we'll just reload the page or trigger a specific event
       window.location.reload(); 
    }
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 sm:gap-2 bg-[#111111]/90 backdrop-blur-md p-1.5 rounded-xl border border-[#222] shadow-2xl z-50 max-w-[calc(100vw-2rem)] overflow-x-auto no-scrollbar whitespace-nowrap">
      
      {/* Tools */}
      <div className="flex items-center gap-1">
        {LAB_TOOLS.map(tool => {
          const Icon = getIcon(tool.icon);
          const isActive = activeTool === tool.id;
          
          return (
            <button
              key={tool.id}
              onClick={() => {
                if (tool.id === 'smooth') {
                  useLabStore.getState().smoothGeometry();
                  useLabStore.getState().pushHistory();
                } else if (tool.id === 'mirror') {
                  useLabStore.getState().mirrorGeometry();
                  useLabStore.getState().pushHistory();
                } else if (tool.id === 'symmetry') {
                  useLabStore.getState().centerGeometry();
                  useLabStore.getState().pushHistory();
                } else {
                  setActiveTool(tool.id);
                }
              }}
              title={`${tool.label} (${tool.shortcut})`}
              className={cn(
                "p-2 rounded-lg transition-all duration-200 group relative",
                isActive 
                  ? "bg-[#8B0000] text-white" 
                  : "text-gray-400 hover:text-white hover:bg-[#222]"
              )}
            >
              <Icon className="w-4 h-4" />
              
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap border border-[#333] transition-opacity">
                {tool.label} <span className="text-gray-500 ml-1">{tool.shortcut}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="w-px h-6 bg-[#333] mx-1"></div>

      {/* History */}
      <div className="flex items-center gap-1">
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Desfazer (Ctrl+Z)"
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#222] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <Undo className="w-4 h-4" />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Refazer (Ctrl+Y)"
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#222] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <Redo className="w-4 h-4" />
        </button>
      </div>

      <div className="w-px h-6 bg-[#333] mx-1"></div>

      {/* Reset */}
      <button
        onClick={handleReset}
        title="Resetar Perfil Original"
        className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#222] transition-colors"
      >
        <RotateCcw className="w-4 h-4" />
      </button>
      
    </div>
  );
}
