'use client';

// ═══════════════════════════════════════════════════════════════
// Custom Lab — Knife Canvas Component
// ═══════════════════════════════════════════════════════════════

import { useEffect, useRef, useState, useCallback } from 'react';
import { useLabStore } from '@/store/useLabStore';
import { renderCanvas } from './CanvasRenderer';
import { getPointAtScreenCoords, screenToWorld } from './CanvasInteraction';
import type { HoveredPoint, CanvasViewport } from '@/types/Lab';

export function KnifeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Zustand Store
  const { points, editMode, viewMode, activeTool, selectedPointIds, snapGuides, movePoint, selectPoint, pushHistory, clearSnapGuides, config } = useLabStore();

  // Local State
  const [viewport, setViewport] = useState<CanvasViewport>({ offsetX: 0, offsetY: 0, zoom: 1 });
  const [hoveredPoint, setHoveredPoint] = useState<HoveredPoint | null>(null);
  
  // Dragging state
  const isDragging = useRef(false);
  const draggedPointId = useRef<string | null>(null);
  const isPanning = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Center the geometry initially
  useEffect(() => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      setViewport({
        offsetX: width / 2 - 400, // Assuming geometry is roughly centered around x=400
        offsetY: height / 2 - 300, // Assuming geometry is roughly centered around y=300
        zoom: 1,
      });
    }
  }, []);

  // Main render loop
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderCanvas(
      ctx,
      canvas.width,
      canvas.height,
      points,
      viewport,
      editMode,
      hoveredPoint,
      selectedPointIds,
      config,
      snapGuides
    );
  }, [points, viewport, editMode, hoveredPoint, selectedPointIds, config, snapGuides]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const { width, height } = container.getBoundingClientRect();
      
      // Handle High DPI displays
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
      
      // Ensure canvas element is scaled correctly via CSS
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      render();
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call

    return () => window.removeEventListener('resize', handleResize);
  }, [render]);

  // Re-render when dependencies change
  useEffect(() => {
    render();
  }, [render]);

  // ── Mouse Interaction Handlers ──

  const handlePointerDown = (e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    lastMousePos.current = { x, y };

    // Pan camera on middle click, alt+click, or if Pan tool ('move') is selected
    if (e.button === 1 || (e.button === 0 && (e.altKey || activeTool === 'move'))) {
      isPanning.current = true;
      document.body.style.cursor = 'grabbing';
      return;
    }

    if (!editMode) {
      // In view mode, clicking anywhere pans the camera
      isPanning.current = true;
      document.body.style.cursor = 'grabbing';
      return;
    }

    const point = getPointAtScreenCoords(x, y, points, viewport);
    
    if (point) {
      if (point.locked) return;
      
      if (activeTool === 'cursor') {
        isDragging.current = true;
        draggedPointId.current = point.id;
        selectPoint(point.id, e.shiftKey);
      } else if (activeTool === 'delete-point') {
        useLabStore.getState().deletePoint(point.id);
        useLabStore.getState().pushHistory();
      }
    } else {
      // Clicked empty space
      if (activeTool === 'add-point') {
        const worldPos = screenToWorld(x, y, viewport);
        useLabStore.getState().addPoint(worldPos.x, worldPos.y);
        useLabStore.getState().pushHistory();
      } else {
        // Start panning when dragging on empty background
        isPanning.current = true;
        document.body.style.cursor = 'grabbing';
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const dx = x - lastMousePos.current.x;
    const dy = y - lastMousePos.current.y;

    if (isPanning.current) {
      setViewport(prev => ({
        ...prev,
        offsetX: prev.offsetX + dx,
        offsetY: prev.offsetY + dy
      }));
      lastMousePos.current = { x, y };
      return;
    }

    if (isDragging.current && draggedPointId.current) {
      const worldPos = screenToWorld(x, y, viewport);
      movePoint(draggedPointId.current, worldPos.x, worldPos.y);
      return;
    }

    if (editMode) {
      const point = getPointAtScreenCoords(x, y, points, viewport);
      if (point !== hoveredPoint) {
        setHoveredPoint(point ? { id: point.id, screenX: x, screenY: y } : null);
      }
    }
  };

  const handlePointerUp = () => {
    if (isDragging.current) {
      pushHistory(); // Save state after drag ends
    }
    isDragging.current = false;
    draggedPointId.current = null;
    isPanning.current = false;
    clearSnapGuides();
    document.body.style.cursor = 'default';
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    
    const zoomFactor = 1.1;
    const direction = e.deltaY > 0 ? -1 : 1;
    
    setViewport(prev => {
      let newZoom = prev.zoom * (direction > 0 ? zoomFactor : 1 / zoomFactor);
      newZoom = Math.max(0.1, Math.min(newZoom, 10)); // Clamp zoom between 0.1x and 10x
      
      // Calculate new offset to zoom towards mouse cursor
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return prev;
      
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const worldX = (mouseX - prev.offsetX) / prev.zoom;
      const worldY = (mouseY - prev.offsetY) / prev.zoom;
      
      return {
        zoom: newZoom,
        offsetX: mouseX - worldX * newZoom,
        offsetY: mouseY - worldY * newZoom
      };
    });
  };

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full relative overflow-hidden bg-[#050505] touch-none"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block cursor-crosshair"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
        style={{ touchAction: 'none' }}
      />
      
      {/* HUD overlays could go here (e.g. tooltip for hovered point) */}
      {hoveredPoint && (
        <div 
          className="absolute pointer-events-none text-[10px] text-white/50 px-2 py-1 bg-black/50 rounded"
          style={{ 
            left: hoveredPoint.screenX + 15, 
            top: hoveredPoint.screenY + 15 
          }}
        >
          {(() => {
            const rawGroup = points.find(p => p.id === hoveredPoint.id)?.group || '';
            const labels: Record<string, string> = {
              'tip': 'Ponta',
              'spine': 'Dorso',
              'edge': 'Fio',
              'choil': 'Côncavo (Choil)',
              'ricasso': 'Ricasso',
              'guard': 'Guarda',
              'handle-top': 'Cabo Superior',
              'handle-bottom': 'Cabo Inferior',
              'pommel': 'Pomo',
              'skull-crusher': 'Quebra-Crânio',
            };
            return labels[rawGroup] || rawGroup || 'Ponto';
          })()}
        </div>
      )}

      {/* 3D Placeholder Overlay */}
      {!editMode && viewMode === '3d' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#050505] z-10">
          <div className="w-16 h-16 border-4 border-[#333] border-t-[#8B0000] rounded-full animate-spin mb-6"></div>
          <h2 className="text-2xl font-bold text-white tracking-widest mb-2 uppercase">Visão 3D</h2>
          <p className="text-gray-500 text-sm">O renderizador 3D estará disponível em breve...</p>
        </div>
      )}
    </div>
  );
}
