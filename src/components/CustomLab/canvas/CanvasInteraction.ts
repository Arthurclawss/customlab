// ═══════════════════════════════════════════════════════════════
// Custom Lab — Canvas Interaction Logic
// ═══════════════════════════════════════════════════════════════

import { LAB_DIMENSIONS } from '@/lib/labConstants';
import type { ControlPoint, CanvasViewport } from '@/types/Lab';
import { pointInRadius } from '../geometry/GeometryUtils';

/**
 * Converts screen coordinates (mouse) to canvas world coordinates.
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  viewport: CanvasViewport
) {
  return {
    x: (screenX - viewport.offsetX) / viewport.zoom,
    y: (screenY - viewport.offsetY) / viewport.zoom,
  };
}

/**
 * Finds the topmost control point at the given screen coordinates.
 */
export function getPointAtScreenCoords(
  screenX: number,
  screenY: number,
  points: ControlPoint[],
  viewport: CanvasViewport
): ControlPoint | null {
  const worldPos = screenToWorld(screenX, screenY, viewport);
  
  // Search in reverse order to prefer points drawn on top
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    // Hit radius scales with zoom so it remains a constant screen size
    const hitRadius = LAB_DIMENSIONS.pointHitRadius / viewport.zoom;
    
    if (pointInRadius(worldPos.x, worldPos.y, { x: p.x, y: p.y }, hitRadius)) {
      return p;
    }
  }
  
  return null;
}
