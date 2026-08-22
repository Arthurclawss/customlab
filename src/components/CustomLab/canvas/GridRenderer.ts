// ═══════════════════════════════════════════════════════════════
// Custom Lab — Grid Renderer
// ═══════════════════════════════════════════════════════════════

import { LAB_COLORS, LAB_DIMENSIONS } from '@/lib/labConstants';
import type { CanvasViewport } from '@/types/Lab';

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  viewport: CanvasViewport,
  isEditMode: boolean
) {
  if (!isEditMode) return; // Only draw grid in edit mode

  const { offsetX, offsetY, zoom } = viewport;
  const spacing = LAB_DIMENSIONS.gridSpacing * zoom;
  
  ctx.save();
  ctx.lineWidth = 1;

  // Calculate start points
  const startX = (offsetX % spacing) - spacing;
  const startY = (offsetY % spacing) - spacing;

  let lineCount = 0;

  // Vertical lines
  for (let x = startX; x < width + spacing; x += spacing) {
    const isMajor = lineCount % LAB_DIMENSIONS.gridMajorEvery === 0;
    ctx.strokeStyle = isMajor ? LAB_COLORS.gridLineMajor : LAB_COLORS.gridLine;
    
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, height);
    ctx.stroke();
    lineCount++;
  }

  lineCount = 0;

  // Horizontal lines
  for (let y = startY; y < height + spacing; y += spacing) {
    const isMajor = lineCount % LAB_DIMENSIONS.gridMajorEvery === 0;
    ctx.strokeStyle = isMajor ? LAB_COLORS.gridLineMajor : LAB_COLORS.gridLine;
    
    ctx.beginPath();
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(width, Math.round(y) + 0.5);
    ctx.stroke();
    lineCount++;
  }

  // Draw origin crosshair if visible
  if (offsetX > 0 && offsetX < width && offsetY > 0 && offsetY < height) {
    ctx.strokeStyle = LAB_COLORS.accentGlow;
    ctx.beginPath();
    ctx.moveTo(Math.round(offsetX) + 0.5, 0);
    ctx.lineTo(Math.round(offsetX) + 0.5, height);
    ctx.moveTo(0, Math.round(offsetY) + 0.5);
    ctx.lineTo(width, Math.round(offsetY) + 0.5);
    ctx.stroke();
  }

  ctx.restore();
}
