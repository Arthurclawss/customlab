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

  // Pinch & Multi-touch state
  const lastPinchDist = useRef<number | null>(null);
  const lastPinchCenter = useRef<{ x: number; y: number } | null>(null);
  const isTouchPinching = useRef(false);

  // Store latest viewport in ref for native event handlers
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  // Store latest state refs for native handlers  
  const editModeRef = useRef(editMode);
  editModeRef.current = editMode;
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;

  // Center the geometry initially
  useEffect(() => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      setViewport({
        offsetX: width / 2 - 400,
        offsetY: height / 2 - 300,
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
      
      // Handle High DPI displays, but cap at 2 for performance on mobile
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
      
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      render();
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, [render]);

  // Re-render when dependencies change
  useEffect(() => {
    render();
  }, [render]);

  // ══════════════════════════════════════════════════════
  // Native Touch Handlers (critical for pinch-to-zoom)
  // Using native events because React's synthetic events 
  // and setPointerCapture break multi-touch on mobile.
  // ══════════════════════════════════════════════════════
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getRelPos = (touch: Touch) => {
      const rect = canvas.getBoundingClientRect();
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    };

    const handleTouchStart = (e: TouchEvent) => {
      // Always prevent default to stop browser zoom/scroll
      e.preventDefault();

      if (e.targetTouches.length >= 2) {
        // Enter pinch mode — cancel any drag/pan
        isTouchPinching.current = true;
        isPanning.current = false;
        isDragging.current = false;
        draggedPointId.current = null;

        const t0 = getRelPos(e.targetTouches[0]);
        const t1 = getRelPos(e.targetTouches[1]);
        lastPinchDist.current = Math.hypot(t0.x - t1.x, t0.y - t1.y);
        lastPinchCenter.current = {
          x: (t0.x + t1.x) / 2,
          y: (t0.y + t1.y) / 2,
        };
        return;
      }

      // Single touch
      if (e.targetTouches.length === 1) {
        const pos = getRelPos(e.targetTouches[0]);
        lastMousePos.current = pos;
        isTouchPinching.current = false;

        if (!editModeRef.current) {
          // View mode: single touch pans
          isPanning.current = true;
          return;
        }

        // Edit mode: check if touching a point
        const point = getPointAtScreenCoords(pos.x, pos.y, pointsRef.current, viewportRef.current);
        if (point) {
          if (point.locked) return;
          if (activeToolRef.current === 'cursor') {
            isDragging.current = true;
            draggedPointId.current = point.id;
            selectPoint(point.id, false);
          } else if (activeToolRef.current === 'delete-point') {
            useLabStore.getState().deletePoint(point.id);
            useLabStore.getState().pushHistory();
          }
        } else {
          if (activeToolRef.current === 'add-point') {
            const worldPos = screenToWorld(pos.x, pos.y, viewportRef.current);
            useLabStore.getState().addPoint(worldPos.x, worldPos.y);
            useLabStore.getState().pushHistory();
          } else {
            isPanning.current = true;
          }
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();

      // Pinch zoom with two fingers
      if (e.targetTouches.length >= 2) {
        const t0 = getRelPos(e.targetTouches[0]);
        const t1 = getRelPos(e.targetTouches[1]);
        const dist = Math.hypot(t0.x - t1.x, t0.y - t1.y);
        const center = {
          x: (t0.x + t1.x) / 2,
          y: (t0.y + t1.y) / 2,
        };

        if (lastPinchDist.current && lastPinchDist.current > 0 && lastPinchCenter.current) {
          const scale = dist / lastPinchDist.current;
          const panX = center.x - lastPinchCenter.current.x;
          const panY = center.y - lastPinchCenter.current.y;

          setViewport(prev => {
            let newZoom = prev.zoom * scale;
            newZoom = Math.max(0.1, Math.min(newZoom, 10));

            // Apply pan
            let newOffsetX = prev.offsetX + panX;
            let newOffsetY = prev.offsetY + panY;

            // Zoom towards pinch center
            const worldX = (center.x - newOffsetX) / prev.zoom;
            const worldY = (center.y - newOffsetY) / prev.zoom;
            newOffsetX = center.x - worldX * newZoom;
            newOffsetY = center.y - worldY * newZoom;

            return { zoom: newZoom, offsetX: newOffsetX, offsetY: newOffsetY };
          });
        }

        lastPinchDist.current = dist;
        lastPinchCenter.current = center;
        return;
      }

      // Single finger
      if (isTouchPinching.current) return; // Just lifted one finger from pinch, ignore

      if (e.targetTouches.length === 1) {
        const pos = getRelPos(e.targetTouches[0]);
        const dx = pos.x - lastMousePos.current.x;
        const dy = pos.y - lastMousePos.current.y;

        if (isPanning.current) {
          setViewport(prev => ({
            ...prev,
            offsetX: prev.offsetX + dx,
            offsetY: prev.offsetY + dy,
          }));
        } else if (isDragging.current && draggedPointId.current) {
          const worldPos = screenToWorld(pos.x, pos.y, viewportRef.current);
          movePoint(draggedPointId.current, worldPos.x, worldPos.y);
        }

        lastMousePos.current = pos;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();

      if (e.targetTouches.length === 0) {
        // All fingers lifted
        if (isDragging.current) {
          pushHistory();
        }
        isDragging.current = false;
        draggedPointId.current = null;
        isPanning.current = false;
        isTouchPinching.current = false;
        lastPinchDist.current = null;
        lastPinchCenter.current = null;
        clearSnapGuides();
      } else if (e.targetTouches.length === 1) {
        // Went from 2 fingers to 1 — reset so single touch doesn't jump
        const pos = getRelPos(e.targetTouches[0]);
        lastMousePos.current = pos;
        lastPinchDist.current = null;
        lastPinchCenter.current = null;
        // Keep isTouchPinching true to ignore stray moves until full lift
      }
    };

    // Attach native touch events with {passive: false} to allow preventDefault
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [selectPoint, movePoint, pushHistory, clearSnapGuides]);

  const handleManualZoom = (factor: number) => {
    setViewport(prev => {
      let newZoom = prev.zoom * factor;
      newZoom = Math.max(0.1, Math.min(newZoom, 10));
      
      const canvas = canvasRef.current;
      if (!canvas) return prev;
      
      const rect = canvas.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const worldX = (centerX - prev.offsetX) / prev.zoom;
      const worldY = (centerY - prev.offsetY) / prev.zoom;
      
      return {
        zoom: newZoom,
        offsetX: centerX - worldX * newZoom,
        offsetY: centerY - worldY * newZoom
      };
    });
  };

  const handleResetView = () => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      setViewport({
        offsetX: width / 2 - 400,
        offsetY: height / 2 - 300,
        zoom: 1,
      });
    }
  };

  // ── Mouse/Pointer Interaction Handlers (desktop only) ──

  const handlePointerDown = (e: React.PointerEvent) => {
    // Skip touch events — handled by native touch listeners above
    if (e.pointerType === 'touch') return;

    e.currentTarget.setPointerCapture(e.pointerId);

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
      if (activeTool === 'add-point') {
        const worldPos = screenToWorld(x, y, viewport);
        useLabStore.getState().addPoint(worldPos.x, worldPos.y);
        useLabStore.getState().pushHistory();
      } else {
        isPanning.current = true;
        document.body.style.cursor = 'grabbing';
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isPanning.current) {
      const dx = x - lastMousePos.current.x;
      const dy = y - lastMousePos.current.y;
      setViewport(prev => ({
        ...prev,
        offsetX: prev.offsetX + dx,
        offsetY: prev.offsetY + dy
      }));
      lastMousePos.current = { x, y };
      return;
    }

    lastMousePos.current = { x, y };

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

  const handlePointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;

    if (isDragging.current) {
      pushHistory();
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
      newZoom = Math.max(0.1, Math.min(newZoom, 10));
      
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
        onPointerCancel={handlePointerUp}
        onPointerOut={handlePointerUp}
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

      {/* Manual Zoom Controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-10">
        <button 
          onClick={() => handleManualZoom(1.2)} 
          className="w-10 h-10 bg-[#111111] border border-[#333] text-white rounded-lg flex items-center justify-center hover:bg-[#222] transition-colors active:scale-95 shadow-lg"
          title="Zoom In"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
        <button 
          onClick={() => handleManualZoom(1/1.2)} 
          className="w-10 h-10 bg-[#111111] border border-[#333] text-white rounded-lg flex items-center justify-center hover:bg-[#222] transition-colors active:scale-95 shadow-lg"
          title="Zoom Out"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
        <button 
          onClick={handleResetView} 
          className="w-10 h-10 bg-[#111111] border border-[#333] text-white rounded-lg flex items-center justify-center hover:bg-[#222] transition-colors active:scale-95 shadow-lg mt-2"
          title="Resetar Visão"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
        </button>
      </div>
    </div>
  );
}
