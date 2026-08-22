import { create } from 'zustand';
import type { ControlPoint, LabConfig, LabTool, PointGroup } from '@/types/Lab';
import { DEFAULT_LAB_CONFIG } from '@/lib/labConstants';
import { getDefaultKnifeProfile } from '@/components/CustomLab/geometry/KnifeGeometry';
import { scalePoints } from '@/components/CustomLab/geometry/GeometryUtils';

// ── Snap Guide (visual alignment feedback) ──

export interface SnapGuide {
  type: 'horizontal' | 'vertical';
  x1: number; y1: number;
  x2: number; y2: number;
  color: string;
  label?: string;
}

interface LabState {
  // Editor State
  editMode: boolean;
  viewMode: 'mechanic' | '3d';
  activeTool: LabTool;
  
  // Geometry State
  points: ControlPoint[];
  selectedPointIds: string[];
  
  // Snap Guides (visual alignment feedback during drag)
  snapGuides: SnapGuide[];

  // History (Undo/Redo)
  history: ControlPoint[][];
  historyIndex: number;

  // Configuration
  config: LabConfig;

  // Actions
  setEditMode: (mode: boolean) => void;
  setViewMode: (mode: 'mechanic' | '3d') => void;
  setActiveTool: (tool: LabTool) => void;
  
  // Point Actions
  setPoints: (points: ControlPoint[]) => void;
  movePoint: (id: string, x: number, y: number) => void;
  selectPoint: (id: string, multi?: boolean) => void;
  clearSelection: () => void;
  clearSnapGuides: () => void;
  
  // History Actions
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  // Config Actions
  updateConfig: (updates: Partial<LabConfig>) => void;

  // Toolbar Actions
  addPoint: (x: number, y: number) => void;
  deletePoint: (id: string) => void;
  smoothGeometry: () => void;
  mirrorGeometry: () => void;
  centerGeometry: () => void;
}

export const useLabStore = create<LabState>((set, get) => ({
  editMode: false,
  viewMode: 'mechanic',
  activeTool: 'cursor',
  
  points: getDefaultKnifeProfile(),
  selectedPointIds: [],
  snapGuides: [],
  
  history: [getDefaultKnifeProfile()],
  historyIndex: 0,
  
  config: { ...DEFAULT_LAB_CONFIG },

  setEditMode: (mode) => set({ editMode: mode }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  clearSnapGuides: () => set({ snapGuides: [] }),
  
  setPoints: (points) => {
    set({ points });
    get().pushHistory();
  },

  movePoint: (id, x, y) => set((state) => {
    const targetIdx = state.points.findIndex(p => p.id === id);
    if (targetIdx === -1) return state;

    const pt = state.points[targetIdx];
    if (pt.locked) return state;

    const group = pt.group;
    const pts = state.points;

    // ── Anatomical reference landmarks ──
    const byGroup = (g: string) => pts.filter(p => p.group === g);
    const tipPt = pts[0]; // tip is always first point
    const edgePts = byGroup('edge');
    const spinePts = byGroup('spine');
    const htPts = byGroup('handle-top');
    const hbPts = byGroup('handle-bottom');
    const pommelPts = byGroup('pommel');
    const guardPts = byGroup('guard');
    const ricassoPt = pts.find(p => p.group === 'ricasso');
    const choilPt = pts.find(p => p.group === 'choil');

    // Blade-handle boundary X
    const bladeHandleX = guardPts.length > 0
      ? Math.min(...guardPts.map(p => p.x))
      : (ricassoPt ? ricassoPt.x + 10 : (choilPt ? choilPt.x + 20 : 470));

    // Handle X/Y bounds
    const handleAndPommelPts = [...htPts, ...hbPts, ...pommelPts];
    const handleYs = handleAndPommelPts.map(p => p.y);
    const handleYMin = handleYs.length > 0 ? Math.min(...handleYs) : 250;
    const handleYMax = handleYs.length > 0 ? Math.max(...handleYs) : 350;

    const MIN_GAP = 8;

    // ── Clamp to canvas ──
    let safeX = Math.max(-2000, Math.min(x, 2000));
    let safeY = Math.max(-2000, Math.min(y, 2000));

    // ══════════════════════════════════════════════════════════════
    // PER-GROUP ANATOMICAL CONSTRAINTS
    // Based on real knife anatomy:
    //   Bottom path (LTR): tip → edge → choil → ricasso → guard → handle-bottom → pommel
    //   Top path (RTL):    pommel → handle-top → guard → spine → (back to tip)
    // ══════════════════════════════════════════════════════════════

    switch (group) {
      case 'tip': {
        // Tip must be the leftmost point on the knife
        const others = pts.filter(p => p.group !== 'tip');
        if (others.length > 0) {
          safeX = Math.min(safeX, Math.min(...others.map(p => p.x)) - 15);
        }
        // Y: between spine and edge level with room
        const spineAvgY = spinePts.length > 0 ? spinePts.reduce((s, p) => s + p.y, 0) / spinePts.length : 250;
        const edgeAvgY = edgePts.length > 0 ? edgePts.reduce((s, p) => s + p.y, 0) / edgePts.length : 360;
        safeY = Math.max(spineAvgY - 100, Math.min(safeY, edgeAvgY + 50));
        break;
      }

      case 'edge': {
        // Edge runs from tip toward blade-handle boundary, BELOW the spine
        safeX = Math.max(safeX, tipPt.x + 15);
        safeX = Math.min(safeX, bladeHandleX + 30);
        // Must stay below nearest spine point
        if (spinePts.length > 0) {
          const nearSpine = spinePts.reduce((best, sp) =>
            Math.abs(sp.x - safeX) < Math.abs(best.x - safeX) ? sp : best
          );
          safeY = Math.max(safeY, nearSpine.y + MIN_GAP);
        }
        break;
      }

      case 'spine': {
        // Spine runs from blade-handle boundary toward tip, ABOVE the edge
        safeX = Math.max(safeX, tipPt.x + 15);
        safeX = Math.min(safeX, bladeHandleX + 30);
        // Must stay above nearest edge point
        if (edgePts.length > 0) {
          const nearEdge = edgePts.reduce((best, ep) =>
            Math.abs(ep.x - safeX) < Math.abs(best.x - safeX) ? ep : best
          );
          safeY = Math.min(safeY, nearEdge.y - MIN_GAP);
        }
        break;
      }

      case 'choil': {
        // Choil sits near the blade-handle junction, on the edge side
        safeX = Math.max(safeX, bladeHandleX - 100);
        safeX = Math.min(safeX, bladeHandleX + 20);
        break;
      }

      case 'ricasso': {
        // Ricasso is near the blade-handle junction
        safeX = Math.max(safeX, bladeHandleX - 60);
        safeX = Math.min(safeX, bladeHandleX + 20);
        break;
      }

      case 'guard': {
        // Guard stays at the blade-handle junction area
        safeX = Math.max(safeX, bladeHandleX - 20);
        safeX = Math.min(safeX, bladeHandleX + 80);
        break;
      }

      case 'handle-bottom': {
        // Handle bottom: between guard area and pommel, below handle-top
        safeX = Math.max(safeX, bladeHandleX + 5);
        const pommelMinX = pommelPts.length > 0 ? Math.min(...pommelPts.map(p => p.x)) : 750;
        safeX = Math.min(safeX, pommelMinX - 10);
        // Stay below nearest handle-top
        if (htPts.length > 0) {
          const nearTop = htPts.reduce((best, tp) =>
            Math.abs(tp.x - safeX) < Math.abs(best.x - safeX) ? tp : best
          );
          safeY = Math.max(safeY, nearTop.y + MIN_GAP);
        }
        break;
      }

      case 'handle-top': {
        // Handle top: between guard area and pommel, above handle-bottom
        safeX = Math.max(safeX, bladeHandleX + 5);
        const pommelMinX = pommelPts.length > 0 ? Math.min(...pommelPts.map(p => p.x)) : 750;
        safeX = Math.min(safeX, pommelMinX - 10);
        // Stay above nearest handle-bottom
        if (hbPts.length > 0) {
          const nearBot = hbPts.reduce((best, bp) =>
            Math.abs(bp.x - safeX) < Math.abs(best.x - safeX) ? bp : best
          );
          safeY = Math.min(safeY, nearBot.y - MIN_GAP);
        }
        break;
      }

      case 'pommel': {
        // Pommel must stay right of all handle points
        const allHandleX = [...htPts, ...hbPts].map(p => p.x);
        if (allHandleX.length > 0) {
          safeX = Math.max(safeX, Math.max(...allHandleX) + 5);
        }
        // Y bounded by handle range with extra room
        safeY = Math.max(safeY, handleYMin - 50);
        safeY = Math.min(safeY, handleYMax + 50);
        // Don't let pommel points cross each other
        const otherPommel = pommelPts.find(p => p.id !== pt.id);
        if (otherPommel) {
          if (pt.y <= otherPommel.y) {
            // This is the top pommel — stay above the other
            safeY = Math.min(safeY, otherPommel.y - MIN_GAP);
          } else {
            // This is the bottom pommel — stay below the other
            safeY = Math.max(safeY, otherPommel.y + MIN_GAP);
          }
        }
        break;
      }

      case 'skull-crusher': {
        // Skull crusher extends beyond pommel
        const pommelMaxX = pommelPts.length > 0 ? Math.max(...pommelPts.map(p => p.x)) : 750;
        safeX = Math.max(safeX, pommelMaxX - 10);
        break;
      }
    }

    // ══════════════════════════════════════════════════════════════
    // APPLY MOVEMENT
    // Structural points (tip, pommel, guard, ricasso, choil) move
    // independently. Profile points (edge, spine, handle) apply
    // mild proportional influence on same-group neighbors ONLY.
    // ══════════════════════════════════════════════════════════════

    const structuralGroups = ['tip', 'pommel', 'guard', 'ricasso', 'choil', 'skull-crusher'];
    const isStructural = structuralGroups.includes(group);

    const originalPoints = state.history[state.historyIndex] || state.points;
    const originalTarget = originalPoints.find(p => p.id === id);
    if (!originalTarget) return state;

    const dx = safeX - originalTarget.x;
    const dy = safeY - originalTarget.y;

    let newPoints = state.points.map((p, idx) => {
      if (p.id === id) {
        return { ...p, x: safeX, y: safeY };
      }

      // Proportional movement — same group neighbors only, not for structural points
      if (!isStructural && !p.locked && p.group === group) {
        const steps = Math.min(
          Math.abs(idx - targetIdx),
          state.points.length - Math.abs(idx - targetIdx)
        );

        let weight = 0;
        if (steps === 1) weight = 0.25;
        else if (steps === 2) weight = 0.06;

        if (weight > 0) {
          const originalP = originalPoints.find(op => op.id === p.id);
          if (originalP) {
            return {
              ...p,
              x: originalP.x + dx * weight,
              y: originalP.y + dy * weight,
            };
          }
        }
      }
      return p;
    });

    // ══════════════════════════════════════════════════════════════
    // SMART SNAP & ANATOMICAL ALIGNMENT
    // ══════════════════════════════════════════════════════════════

    const SNAP_THRESHOLD = 6;
    const guides: SnapGuide[] = [];
    const target = newPoints[targetIdx];

    const GROUP_COLORS: Record<string, string> = {
      'spine': '#f97316', 'edge': '#ef4444', 'tip': '#f43f5e',
      'ricasso': '#a855f7', 'choil': '#d946ef', 'handle-top': '#3b82f6',
      'handle-bottom': '#06b6d4', 'guard': '#eab308', 'pommel': '#22c55e',
      'skull-crusher': '#14b8a6',
    };

    // ── 1. Y-alignment snap (horizontal) with ANY point ──
    const allOtherPts = newPoints.filter((_, i) => i !== targetIdx);
    let snappedY = false;
    for (const op of allOtherPts) {
      if (Math.abs(target.y - op.y) < SNAP_THRESHOLD) {
        target.y = op.y;
        const opColor = GROUP_COLORS[op.group] || '#888';
        const x1 = Math.min(target.x, op.x) - 30;
        const x2 = Math.max(target.x, op.x) + 30;
        guides.push({ type: 'horizontal', x1, y1: op.y, x2, y2: op.y, color: opColor, label: 'Alinhado Y' });
        snappedY = true;
        break;
      }
    }

    // ── 2. X-alignment snap (vertical) with ANY point ──
    let snappedX = false;
    for (const op of allOtherPts) {
      if (Math.abs(target.x - op.x) < SNAP_THRESHOLD) {
        target.x = op.x;
        const opColor = GROUP_COLORS[op.group] || '#888';
        const y1 = Math.min(target.y, op.y) - 30;
        const y2 = Math.max(target.y, op.y) + 30;
        guides.push({ type: 'vertical', x1: op.x, y1, x2: op.x, y2, color: opColor, label: 'Alinhado X' });
        snappedX = true;
        break;
      }
    }

    // ── 3. Handle centerline symmetry hint (optional) ──
    if (target.group === 'handle-top' || target.group === 'handle-bottom') {
      const oppositeGroup = target.group === 'handle-top' ? 'handle-bottom' : 'handle-top';

      const allHPts = newPoints.filter(p =>
        p.group === 'handle-top' || p.group === 'handle-bottom' || p.group === 'pommel'
      );
      if (allHPts.length >= 2) {
        const hCenterY = (Math.min(...allHPts.map(p => p.y)) + Math.max(...allHPts.map(p => p.y))) / 2;

        const oppPts = newPoints.filter(p => p.group === oppositeGroup);
        let bestOpp: typeof newPoints[0] | null = null;
        let bestDist = Infinity;
        for (const op of oppPts) {
          const d = Math.abs(op.x - target.x);
          if (d < bestDist) { bestDist = d; bestOpp = op; }
        }

        if (bestOpp && bestDist < 80) {
          const mirrorY = hCenterY - (bestOpp.y - hCenterY);
          if (Math.abs(target.y - mirrorY) < SNAP_THRESHOLD) {
            target.y = mirrorY;
            guides.push({
              type: 'horizontal',
              x1: Math.min(target.x, bestOpp.x) - 15, y1: hCenterY,
              x2: Math.max(target.x, bestOpp.x) + 15, y2: hCenterY,
              color: '#8b5cf6', label: 'Simetria do Cabo',
            });
          }
        }
      }
    }

    // ── 4. Guard vertical pairing ──
    if (target.group === 'guard') {
      const otherGuard = newPoints.find((p, i) => i !== targetIdx && p.group === 'guard');
      if (otherGuard) {
        otherGuard.x = target.x;
        const gy1 = Math.min(target.y, otherGuard.y) - 20;
        const gy2 = Math.max(target.y, otherGuard.y) + 20;
        guides.push({
          type: 'vertical', x1: target.x, y1: gy1, x2: target.x, y2: gy2,
          color: '#eab308', label: 'Guarda Pareada',
        });
      }
    }

    // ── 5. Spine straightening snap ──
    if (target.group === 'spine') {
      const spineYs = newPoints.filter(p => p.group === 'spine').map(p => p.y);
      const spineMinY = Math.min(...spineYs);
      const spineMaxY = Math.max(...spineYs);
      if (spineMaxY - spineMinY < SNAP_THRESHOLD * 2) {
        const avgY = spineYs.reduce((a, b) => a + b, 0) / spineYs.length;
        for (const p of newPoints) { if (p.group === 'spine') p.y = avgY; }
        const spineXs = newPoints.filter(p => p.group === 'spine').map(p => p.x);
        guides.push({
          type: 'horizontal',
          label: 'Dorso Reto',
          x1: Math.min(...spineXs),
          y1: avgY,
          x2: Math.max(...spineXs),
          y2: avgY,
          color: 'rgba(255, 255, 255, 0.5)'
        });
      }
    }

    // ── 6. Cross-group alignment hints ──
    // Snap to same Y as structurally related points across groups
    // e.g. pommel aligning with handle-top/bottom extremes
    if (!snappedY && (target.group === 'pommel' || target.group === 'handle-top' || target.group === 'handle-bottom')) {
      const relatedGroups = ['pommel', 'handle-top', 'handle-bottom', 'guard'];
      const relatedPts = newPoints.filter((p, i) => i !== targetIdx && relatedGroups.includes(p.group));
      for (const rp of relatedPts) {
        if (Math.abs(target.y - rp.y) < SNAP_THRESHOLD) {
          target.y = rp.y;
          const x1 = Math.min(target.x, rp.x) - 20;
          const x2 = Math.max(target.x, rp.x) + 20;
          guides.push({ type: 'horizontal', x1, y1: rp.y, x2, y2: rp.y, color: '#64748b', label: 'Alinhado' });
          break;
        }
      }
    }

    return { points: newPoints, snapGuides: guides };
  }),

  selectPoint: (id, multi = false) => set((state) => {
    if (multi) {
      const isSelected = state.selectedPointIds.includes(id);
      return {
        selectedPointIds: isSelected 
          ? state.selectedPointIds.filter(pid => pid !== id)
          : [...state.selectedPointIds, id]
      };
    }
    return { selectedPointIds: [id] };
  }),

  clearSelection: () => set({ selectedPointIds: [] }),

  pushHistory: () => set((state) => {
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push([...state.points]);
    return {
      history: newHistory,
      historyIndex: newHistory.length - 1
    };
  }),

  undo: () => set((state) => {
    if (state.historyIndex > 0) {
      const newIndex = state.historyIndex - 1;
      return {
        points: [...state.history[newIndex]],
        historyIndex: newIndex
      };
    }
    return state;
  }),

  redo: () => set((state) => {
    if (state.historyIndex < state.history.length - 1) {
      const newIndex = state.historyIndex + 1;
      return {
        points: [...state.history[newIndex]],
        historyIndex: newIndex
      };
    }
    return state;
  }),

  addPoint: (x, y) => set((state) => {
    if (state.points.length === 0) return state;
    
    // Limit point creation to prevent performance issues and spaghetti geometry
    if (state.points.length >= 40) return state;
    
    let closestIdx = 0;
    let minD = Infinity;
    
    // Find closest point
    for (let i = 0; i < state.points.length; i++) {
      const p = state.points[i];
      const d = Math.pow(p.x - x, 2) + Math.pow(p.y - y, 2);
      if (d < minD) {
        minD = d;
        closestIdx = i;
      }
    }
    
    // If user clicked too far away from the curve (> 100px), ignore it to prevent random "loose" points
    if (minD > 10000) return state;

    const closest = state.points[closestIdx];
    
    // To prevent zig-zag lines, we must insert the new point in the correct topological order.
    // Check if the click is closer to the previous point or the next point in the spline.
    const prevIdx = closestIdx === 0 ? state.points.length - 1 : closestIdx - 1;
    const nextIdx = (closestIdx + 1) % state.points.length;
    
    const prev = state.points[prevIdx];
    const next = state.points[nextIdx];
    
    const distToPrev = Math.pow(prev.x - x, 2) + Math.pow(prev.y - y, 2);
    const distToNext = Math.pow(next.x - x, 2) + Math.pow(next.y - y, 2);
    
    // If it's closer to the previous point, insert it BEFORE the closest point.
    // Otherwise insert AFTER the closest point.
    const insertIdx = distToNext < distToPrev ? closestIdx + 1 : closestIdx;
    
    const newPoint = {
      id: `p_${Date.now()}_${Math.random()}`,
      x,
      y,
      group: closest.group, // inherit group
      locked: false,
      selected: false
    };
    
    const newPoints = [...state.points];
    newPoints.splice(insertIdx, 0, newPoint);
    return { points: newPoints };
  }),

  deletePoint: (id) => set((state) => {
    const newPoints = state.points.filter(p => p.id !== id);
    if (newPoints.length < 3) return state; // Prevent destroying geometry entirely
    return { points: newPoints };
  }),

  smoothGeometry: () => set((state) => {
    // Structural points that anchor the knife's core shape should never be moved by the smooth tool
    const structuralGroups = ['tip', 'pommel', 'guard', 'ricasso', 'choil'];
    
    const newPoints = state.points.map((p, i, arr) => {
      if (p.locked || structuralGroups.includes(p.group)) return p;
      
      // Wrap around array for neighbors
      const prev = arr[i === 0 ? arr.length - 1 : i - 1];
      const next = arr[(i + 1) % arr.length];
      
      // Target: 50% towards the average of neighbors (Laplacian smoothing)
      const targetX = p.x * 0.5 + (prev.x + next.x) * 0.25;
      const targetY = p.y * 0.5 + (prev.y + next.y) * 0.25;
      
      // Limit the max movement to 15px per click to prevent the blade from shrinking into a blob
      const maxMove = 15;
      let dx = targetX - p.x;
      let dy = targetY - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist > maxMove) {
        dx = (dx / dist) * maxMove;
        dy = (dy / dist) * maxMove;
      }
      
      return {
        ...p,
        x: p.x + dx,
        y: p.y + dy
      };
    });
    return { points: newPoints };
  }),

  mirrorGeometry: () => set((state) => {
    const minX = Math.min(...state.points.map(p => p.x));
    const maxX = Math.max(...state.points.map(p => p.x));
    const centerX = (minX + maxX) / 2;
    const newPoints = state.points.map(p => ({
      ...p,
      x: centerX - (p.x - centerX)
    }));
    return { points: newPoints };
  }),

  centerGeometry: () => set((state) => {
    const minX = Math.min(...state.points.map(p => p.x));
    const maxX = Math.max(...state.points.map(p => p.x));
    const minY = Math.min(...state.points.map(p => p.y));
    const maxY = Math.max(...state.points.map(p => p.y));
    const dx = 400 - (minX + maxX) / 2;
    const dy = 300 - (minY + maxY) / 2;
    
    return {
      points: state.points.map(p => ({
        ...p,
        x: p.x + dx,
        y: p.y + dy
      }))
    };
  }),

  updateConfig: (updates) => set((state) => {
    let newPoints = state.points;
    const originX = 460; // Assuming ricasso/guard is around x=460 in default profile
    const originY = 300; // Center line of the knife

    // Parametric scaling for Blade Length
    if (updates.bladeLength !== undefined && state.config.bladeLength !== updates.bladeLength) {
      const scaleX = updates.bladeLength / state.config.bladeLength;
      newPoints = scalePoints(newPoints, ['edge', 'spine', 'tip', 'choil'], scaleX, 1, originX, originY);
    }

    // Parametric scaling for Blade Height
    if (updates.bladeHeight !== undefined && state.config.bladeHeight !== updates.bladeHeight) {
      const scaleY = updates.bladeHeight / state.config.bladeHeight;
      newPoints = scalePoints(newPoints, ['edge', 'spine', 'tip'], 1, scaleY, originX, originY);
    }

    // Parametric scaling for Handle Length (if added in the future, we prepare for it)
    if (updates.handleLength !== undefined && state.config.handleLength !== updates.handleLength) {
      const scaleX = updates.handleLength / state.config.handleLength;
      newPoints = scalePoints(newPoints, ['handle-top', 'handle-bottom', 'pommel', 'skull-crusher'], scaleX, 1, originX, originY);
    }

    // Geometry modifier for Finger Choil (Côncavo de Dedo)
    if (updates.hasFingerChoil !== undefined && state.config.hasFingerChoil !== updates.hasFingerChoil) {
      const edgePoints = state.points.filter(p => p.group === 'edge');
      const ricassoPoints = state.points.filter(p => p.group === 'ricasso');
      const spinePoints = state.points.filter(p => p.group === 'spine');
      
      const lastEdge = edgePoints.length > 0 ? edgePoints.reduce((max, p) => p.x > max.x ? p : max, edgePoints[0]) : null;
      const ricasso = ricassoPoints.length > 0 ? ricassoPoints[0] : null;
      const avgSpineY = spinePoints.length > 0 ? spinePoints.reduce((sum, p) => sum + p.y, 0) / spinePoints.length : originY - 50;

      newPoints = newPoints.map(p => {
        if (p.group === 'choil') {
          // Calculate a standard anchor position between the end of the blade and the ricasso
          const stdX = (lastEdge && ricasso) ? (lastEdge.x + ricasso.x) / 2 : p.x;
          const stdBaseY = (lastEdge && ricasso) ? (lastEdge.y + ricasso.y) / 2 : p.y;
          
          if (updates.hasFingerChoil) {
             // Turn ON: snap to standard X, and make a standard deep cutout
             const distToSpine = stdBaseY - avgSpineY;
             return { ...p, x: stdX - 10, y: stdBaseY - (distToSpine * 0.45) };
          } else {
             // Turn OFF: snap back to standard flush position between edge and ricasso
             return { ...p, x: stdX, y: stdBaseY };
          }
        }
        return p;
      });
    }

    // Geometry modifier for Guard (Guarda / Colarinho)
    const hasGuardChanged = updates.hasGuard !== undefined && state.config.hasGuard !== updates.hasGuard;
    const guardSizeChanged = updates.guardSize !== undefined && state.config.guardSize !== updates.guardSize;

    if (hasGuardChanged) {
      const isGuardOn = updates.hasGuard!;
      const offsetAmt = updates.guardSize !== undefined ? updates.guardSize : state.config.guardSize;

      if (!isGuardOn) {
        // ── Guard OFF: remove all guard points from geometry ──
        newPoints = newPoints.filter(p => p.group !== 'guard');
      } else {
        // ── Guard ON: re-insert guard points at the correct topological positions ──
        // We need two guard points:
        //   Bottom guard: between the last bottom-side point (ricasso/choil/edge) and the first handle-bottom
        //   Top guard:    between the last handle-top and the first spine point

        // Find insertion indices
        let bottomInsertIdx = -1;
        let topInsertIdx = -1;

        for (let i = 0; i < newPoints.length; i++) {
          const curr = newPoints[i];
          const next = newPoints[(i + 1) % newPoints.length];
          
          // Bottom guard: transition from blade-side (ricasso/choil/edge) → handle-bottom
          if (['ricasso', 'choil', 'edge'].includes(curr.group) && next.group === 'handle-bottom') {
            bottomInsertIdx = i + 1;
          }
          // Top guard: transition from handle-top → spine
          if (curr.group === 'handle-top' && next.group === 'spine') {
            topInsertIdx = i + 1;
          }
        }

        const genId = () => `p_${Date.now()}_${Math.random()}`;

        // Determine guard X: use the ricasso/choil boundary X (blade-handle junction)
        const ricassoPt = newPoints.find(p => p.group === 'ricasso');
        const choilPt = newPoints.find(p => p.group === 'choil');
        const lastEdgePt = newPoints.filter(p => p.group === 'edge').sort((a, b) => b.x - a.x)[0];
        const firstHB = newPoints.find(p => p.group === 'handle-bottom');
        const lastHT = [...newPoints].filter(p => p.group === 'handle-top').sort((a, b) => a.x - b.x)[0];

        // Guard X should be at the blade-handle junction
        const guardX = ricassoPt ? ricassoPt.x + 10
          : choilPt ? choilPt.x + 20
          : lastEdgePt ? lastEdgePt.x + 20
          : 470;

        // Calculate anatomical center Y from spine and edge averages
        const spineAvgY = newPoints.filter(p => p.group === 'spine')
          .reduce((s, p, _, a) => s + p.y / a.length, 0) || 250;
        const edgeAvgY = newPoints.filter(p => p.group === 'edge')
          .reduce((s, p, _, a) => s + p.y / a.length, 0) || 360;
        const anatomyCenterY = (spineAvgY + edgeAvgY) / 2;

        // Insert bottom guard
        if (bottomInsertIdx !== -1) {
          const prev = newPoints[bottomInsertIdx - 1];
          const next = newPoints[bottomInsertIdx];
          const flushY = (prev.y + next.y) / 2;
          const bottomGuard: ControlPoint = {
            id: genId(), x: guardX, y: flushY + offsetAmt,
            group: 'guard', locked: false, selected: false,
          };
          newPoints.splice(bottomInsertIdx, 0, bottomGuard);
          // After splice, topInsertIdx shifts by 1 if it was after this index
          if (topInsertIdx !== -1 && topInsertIdx >= bottomInsertIdx) topInsertIdx++;
        }

        // Insert top guard
        if (topInsertIdx !== -1) {
          const prev = newPoints[topInsertIdx - 1];
          const next = newPoints[topInsertIdx];
          const flushY = (prev.y + next.y) / 2;
          const topGuard: ControlPoint = {
            id: genId(), x: guardX, y: flushY - offsetAmt,
            group: 'guard', locked: false, selected: false,
          };
          newPoints.splice(topInsertIdx, 0, topGuard);
        }
      }
    } else if (guardSizeChanged && state.config.hasGuard) {
      // Guard size slider changed while guard exists — adjust Y offset
      const offsetAmt = updates.guardSize!;
      // Calculate anatomical center Y to reliably detect top vs bottom guard
      const spineAvgY = newPoints.filter(p => p.group === 'spine')
        .reduce((s, p, _, a) => s + p.y / a.length, 0) || 250;
      const edgeAvgY = newPoints.filter(p => p.group === 'edge')
        .reduce((s, p, _, a) => s + p.y / a.length, 0) || 360;
      const anatomyCenterY = (spineAvgY + edgeAvgY) / 2;

      newPoints = newPoints.map((p, idx) => {
        if (p.group === 'guard') {
          const prev = newPoints[idx === 0 ? newPoints.length - 1 : idx - 1];
          const next = newPoints[(idx + 1) % newPoints.length];
          const flushY = (prev.y + next.y) / 2;
          // Use anatomical center instead of hardcoded 300
          const offset = p.y < anatomyCenterY ? -offsetAmt : offsetAmt;
          return { ...p, y: flushY + offset };
        }
        return p;
      });
    }

    // Geometry modifier for Skull Crusher (Quebra-Crânio)
    if (updates.hasSkullCrusher !== undefined && state.config.hasSkullCrusher !== updates.hasSkullCrusher) {
      const pommelPts = newPoints.filter(p => p.group === 'pommel');
      if (pommelPts.length >= 2) {
        // Find the rightmost pommel (furthest from blade)
        const rightmost = pommelPts.reduce((a, b) => a.x > b.x ? a : b);
        const deltaX = updates.hasSkullCrusher ? 30 : -30;
        newPoints = newPoints.map(p => {
          if (p.id === rightmost.id) {
            return { ...p, x: p.x + deltaX };
          }
          return p;
        });
      }
    }

    // Auto-sync handleColor when handleMaterial changes
    const finalUpdates = { ...updates };
    if (updates.handleMaterial !== undefined) {
      const MATERIAL_COLORS: Record<string, string> = {
        'jacaranda': '#3d2b1f',
        'resin-hybrid': '#2a4a6b',
        'micarta': '#4a3728',
        'g10': '#2d2d2d',
        'carbon-fiber': '#1a1a1a',
        'brass': '#b5a642',
        'titanium': '#8a9a9a',
      };
      finalUpdates.handleColor = MATERIAL_COLORS[updates.handleMaterial] || '#3d2b1f';
    }

    return {
      config: { ...state.config, ...finalUpdates },
      points: newPoints
    };
  }),
}));

