'use client';

// ═══════════════════════════════════════════════════════════════
// Custom Lab — Main Layout
// ═══════════════════════════════════════════════════════════════

import { useState } from 'react';
import { Navbar } from './panels/Navbar';
import { Sidebar } from './panels/Sidebar';
import { SpecPanel } from './panels/SpecPanel';
import { Toolbar } from './panels/Toolbar';
import { KnifeCanvas } from './canvas/KnifeCanvas';
import { SlidersHorizontal, BarChart3, X } from 'lucide-react';
import { useLabStore } from '@/store/useLabStore';
import { ThreeViewer } from './three/ThreeViewer';

export function CustomLabLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSpecOpen, setIsSpecOpen] = useState(false);
  const { viewMode } = useLabStore();

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-[#050505] text-white">
      
      {/* Top Navigation */}
      <Navbar />

      {/* Main Workspace Area */}
      <div className="flex flex-1 relative overflow-hidden">
        
        {/* Mobile Sidebar Overlay Backdrop */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        
        {/* Mobile SpecPanel Overlay Backdrop */}
        {isSpecOpen && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setIsSpecOpen(false)}
          />
        )}

        {/* Left Sidebar: Properties & Materials */}
        <div className={`
          fixed lg:relative top-12 lg:top-0 left-0 h-[calc(100vh-3rem)] lg:h-full z-50
          transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <Sidebar onClose={() => setIsSidebarOpen(false)} />
        </div>

        {/* Center Canvas: 2D Parametric Editor */}
        <main className="flex-1 relative bg-[#050505] flex flex-col">
          
          {/* Floating Mobile Toggle Buttons */}
          <div className="absolute top-4 left-4 right-4 z-30 flex justify-between lg:hidden pointer-events-none">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="pointer-events-auto flex items-center gap-1.5 px-3 py-2 bg-[#111111]/90 backdrop-blur-md rounded-lg border border-[#222] text-xs font-medium text-gray-300 hover:text-white shadow-lg active:scale-95 transition-all"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#8B0000]" />
              Propriedades
            </button>
            
            <button
              onClick={() => setIsSpecOpen(true)}
              className="pointer-events-auto flex items-center gap-1.5 px-3 py-2 bg-[#111111]/90 backdrop-blur-md rounded-lg border border-[#222] text-xs font-medium text-gray-300 hover:text-white shadow-lg active:scale-95 transition-all"
            >
              <BarChart3 className="w-3.5 h-3.5 text-[#8B0000]" />
              Especificações
            </button>
          </div>

          <div className="flex-1 relative w-full h-full">
            {viewMode === '3d' ? <ThreeViewer /> : <KnifeCanvas />}
          </div>
          
          {/* Floating Toolbar (only visible in Edit Mode) */}
          <Toolbar />
        </main>

        {/* Right Sidebar: Real-time Specs */}
        <div className={`
          fixed lg:relative top-12 lg:top-0 right-0 h-[calc(100vh-3rem)] lg:h-full z-50
          transition-transform duration-300 ease-in-out
          ${isSpecOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        `}>
          <SpecPanel onClose={() => setIsSpecOpen(false)} />
        </div>

      </div>
      
    </div>
  );
}

