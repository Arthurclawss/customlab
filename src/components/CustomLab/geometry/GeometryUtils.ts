// ═══════════════════════════════════════════════════════════════
// Custom Lab — Geometry Utilities
// ═══════════════════════════════════════════════════════════════

import type { ControlPoint } from '@/types/Lab';
import type { Vec2 } from './CatmullRom';

/**
 * Calculates the Euclidean distance between two points.
 */
export function distance(p1: Vec2, p2: Vec2): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

/**
 * Checks if a point (x,y) is within a certain radius of a target point.
 * Useful for hit-testing control points.
 */
export function pointInRadius(x: number, y: number, target: Vec2, radius: number): boolean {
  return distance({ x, y }, target) <= radius;
}

/**
 * Calculates the bounding box of a set of points.
 * Returns { minX, minY, maxX, maxY, width, height }
 */
export function getBoundingBox(points: Vec2[]) {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Normalizes a set of points to fit within a specific coordinate space.
 * (Often useful if loading a preset shape).
 */
export function normalizePoints(points: ControlPoint[], targetWidth: number, targetHeight: number): ControlPoint[] {
  const box = getBoundingBox(points);
  
  const scaleX = targetWidth / (box.width || 1);
  const scaleY = targetHeight / (box.height || 1);
  const scale = Math.min(scaleX, scaleY); // Keep aspect ratio

  const offsetX = -box.minX * scale;
  const offsetY = -box.minY * scale;

  return points.map(p => ({
    ...p,
    x: p.x * scale + offsetX,
    y: p.y * scale + offsetY,
  }));
}

/**
 * Calculates a proportional movement (soft selection) based on a Gaussian falloff.
 * Returns the new (x,y) for a given point based on the movement of a target point.
 * 
 * @param currentPoint - The point to potentially move
 * @param targetOriginalPos - The original position of the point being dragged
 * @param dx - The delta X movement of the dragged point
 * @param dy - The delta Y movement of the dragged point
 * @param radius - The radius of influence
 */
export function calculateProportionalMove(
  currentPoint: Vec2, 
  targetOriginalPos: Vec2, 
  dx: number, 
  dy: number, 
  radius: number = 100
): Vec2 {
  const dist = distance(currentPoint, targetOriginalPos);
  
  if (dist >= radius) {
    return currentPoint; // Outside radius of influence
  }

  // Gaussian-like falloff: e^(-(dist^2)/(2*(radius/2)^2))
  // A simpler falloff: 1 - (dist / radius)^2
  const weight = 1 - Math.pow(dist / radius, 2);
  
  return {
    x: currentPoint.x + dx * weight,
    y: currentPoint.y + dy * weight
  };
}

/**
 * Scales a specific group of points proportionally.
 */
export function scalePoints(
  points: ControlPoint[],
  targetGroups: string[],
  scaleX: number,
  scaleY: number,
  originX: number,
  originY: number
): ControlPoint[] {
  return points.map(p => {
    if (!targetGroups.includes(p.group)) {
      return p;
    }
    
    // Scale relative to origin
    const dx = p.x - originX;
    const dy = p.y - originY;
    
    return {
      ...p,
      x: originX + (dx * scaleX),
      y: originY + (dy * scaleY)
    };
  });
}
