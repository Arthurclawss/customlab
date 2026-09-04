// ═══════════════════════════════════════════════════════════════
// Custom Lab — Canvas Renderer (Professional Mechanical Drawing)
// ═══════════════════════════════════════════════════════════════

import { LAB_COLORS, LAB_DIMENSIONS, STEEL_OPTIONS, HANDLE_MATERIAL_OPTIONS, FINISH_OPTIONS, EDGE_OPTIONS } from '@/lib/labConstants';
import { POINT_GROUP_COLORS, POINT_GROUP_LABELS } from '@/types/Lab';
import type { ControlPoint, CanvasViewport, HoveredPoint, PointGroup, LabConfig, GuardStyle } from '@/types/Lab';
import type { SnapGuide } from '@/store/useLabStore';
import { catmullRomSpline } from '../geometry/CatmullRom';
import { drawGrid } from './GridRenderer';

// ── Color palette ──
const C = {
  bg:           '#080a0d',
  dimLine:      'rgba(80, 160, 240, 0.6)',
  dimText:      '#7fc4fd',
  dimBg:        'rgba(8, 10, 13, 0.85)',
  annotLine:    'rgba(140, 150, 165, 0.4)',
  annotDot:     'rgba(140, 150, 165, 0.7)',
  annotText:    'rgba(180, 190, 205, 0.85)',
  annotSub:     'rgba(130, 140, 155, 0.5)',
  sectionLine:  'rgba(220, 80, 60, 0.6)',
  sectionFill:  'rgba(220, 80, 60, 0.85)',
  centerLine:   'rgba(46, 204, 113, 0.25)',
  cgFill:       'rgba(46, 204, 113, 0.6)',
  cgStroke:     'rgba(46, 204, 113, 0.9)',
  outline:      'rgba(180, 190, 200, 0.5)',
  outlineThick: 'rgba(130, 140, 155, 0.7)',
  titleBorder:  'rgba(50, 65, 85, 0.5)',
  titleBg:      'rgba(8, 10, 13, 0.92)',
  titleText:    'rgba(130, 150, 175, 0.8)',
  titleBright:  'rgba(200, 210, 225, 0.95)',
  gridFine:     'rgba(40, 55, 80, 0.07)',
  gridMajor:    'rgba(40, 55, 80, 0.15)',
  crosshatch:   'rgba(50, 70, 100, 0.04)',
} as const;

const FONT = '"SF Mono", "Cascadia Code", "Fira Code", "Courier New", monospace';

// ── Deterministic Noise (Perlin-style) ──
// Pre-compute permutation table and gradient vectors for stable procedural textures
const _PERM = new Uint8Array(512);
const _GRAD: [number, number][] = [];
{
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let seed = 42;
  const rng = () => { seed = (seed * 16807 + 0) % 2147483647; return (seed - 1) / 2147483646; };
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) _PERM[i] = p[i & 255];
  for (let i = 0; i < 256; i++) {
    const angle = (i / 256) * Math.PI * 2;
    _GRAD.push([Math.cos(angle), Math.sin(angle)]);
  }
}

function _fade(t: number): number { return t * t * t * (t * (t * 6 - 15) + 10); }
function _lerp(a: number, b: number, t: number): number { return a + t * (b - a); }
function _dotGrad(hash: number, x: number, y: number): number {
  const g = _GRAD[hash & 255];
  return g[0] * x + g[1] * y;
}

function _noise2D(x: number, y: number): number {
  const X = Math.floor(x);
  const Y = Math.floor(y);
  const xf = x - X;
  const yf = y - Y;
  const xi = X & 255;
  const yi = Y & 255;
  const u = _fade(xf);
  const v = _fade(yf);
  const aa = _PERM[_PERM[xi] + yi];
  const ab = _PERM[_PERM[xi] + yi + 1];
  const ba = _PERM[_PERM[xi + 1] + yi];
  const bb = _PERM[_PERM[xi + 1] + yi + 1];
  const x1 = _lerp(_dotGrad(aa, xf, yf), _dotGrad(ba, xf - 1, yf), u);
  const x2 = _lerp(_dotGrad(ab, xf, yf - 1), _dotGrad(bb, xf - 1, yf - 1), u);
  return _lerp(x1, x2, v); // roughly -1 to 1
}

function _fbm(x: number, y: number, octaves: number, persistence = 0.5, lacunarity = 2.0): number {
  let total = 0, frequency = 1, amplitude = 1, maxValue = 0;
  for (let i = 0; i < octaves; i++) {
    total += _noise2D(x * frequency, y * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  return total / maxValue;
}

// Simple deterministic hash for point-like noise (replaces Math.random for scatter patterns)
function _hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263 + 1013904223) | 0;
  h = ((h >>> 16) ^ h) * 0x45d9f3b | 0;
  h = ((h >>> 16) ^ h) * 0x45d9f3b | 0;
  h = (h >>> 16) ^ h;
  return (h & 0x7fffffff) / 0x7fffffff; // 0..1
}

// ── Helpers ──

function buildPath(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

function s(val: number, zoom: number) { return val; } // scale helper (disabled inverse scaling to keep proportions fixed)

function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, size: number) {
  ctx.save();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size, -size * 0.3);
  ctx.lineTo(-size * 0.7, 0);
  ctx.lineTo(-size, size * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawDimension(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  label: string,
  side: 'top' | 'bottom' | 'left' | 'right',
  offset: number, z: number,
) {
  const arrow = s(5, z);
  const fs = s(10, z);
  const gap = s(3, z);
  const over = s(5, z);

  ctx.save();
  ctx.strokeStyle = C.dimLine;
  ctx.fillStyle = C.dimText;
  ctx.lineWidth = s(0.8, z);
  ctx.font = `600 ${fs}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (side === 'bottom' || side === 'top') {
    const dir = side === 'bottom' ? 1 : -1;
    const base = side === 'bottom' ? Math.max(y1, y2) : Math.min(y1, y2);
    const ly = base + offset * dir;

    // Extension lines (thin dashed)
    ctx.setLineDash([s(2, z), s(2, z)]);
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(x1, base + gap * dir); ctx.lineTo(x1, ly + over * dir);
    ctx.moveTo(x2, base + gap * dir); ctx.lineTo(x2, ly + over * dir);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Main dim line
    ctx.beginPath(); ctx.moveTo(x1, ly); ctx.lineTo(x2, ly); ctx.stroke();
    drawArrow(ctx, x1, ly, 0, arrow);
    drawArrow(ctx, x2, ly, Math.PI, arrow);

    // Label
    const mx = (x1 + x2) / 2;
    const ty = ly + s(12, z) * dir;
    const tw = ctx.measureText(label).width + s(8, z);
    ctx.fillStyle = C.dimBg;
    ctx.fillRect(mx - tw / 2, ty - fs * 0.6, tw, fs * 1.2);
    ctx.fillStyle = C.dimText;
    ctx.fillText(label, mx, ty);
  } else {
    const dir = side === 'right' ? 1 : -1;
    const base = side === 'right' ? Math.max(x1, x2) : Math.min(x1, x2);
    const lx = base + offset * dir;

    ctx.setLineDash([s(2, z), s(2, z)]);
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(base + gap * dir, y1); ctx.lineTo(lx + over * dir, y1);
    ctx.moveTo(base + gap * dir, y2); ctx.lineTo(lx + over * dir, y2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    ctx.beginPath(); ctx.moveTo(lx, y1); ctx.lineTo(lx, y2); ctx.stroke();
    drawArrow(ctx, lx, y1, Math.PI / 2, arrow);
    drawArrow(ctx, lx, y2, -Math.PI / 2, arrow);

    const my = (y1 + y2) / 2;
    ctx.save();
    ctx.translate(lx + s(12, z) * dir, my);
    ctx.rotate(-Math.PI / 2);
    const tw = ctx.measureText(label).width + s(8, z);
    ctx.fillStyle = C.dimBg;
    ctx.fillRect(-tw / 2, -fs * 0.6, tw, fs * 1.2);
    ctx.fillStyle = C.dimText;
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

function drawAnnotation(
  ctx: CanvasRenderingContext2D,
  ax: number, ay: number,
  lx: number, ly: number,
  label: string, sub: string, z: number,
  color: string = '#8B0000'
) {
  const fs = s(10, z);
  const sfs = s(8, z);
  const dr = s(3.5, z);

  ctx.save();

  // Dot
  ctx.beginPath();
  ctx.arc(ax, ay, dr, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = s(1, z);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.stroke();

  // Leader
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = s(1.2, z);
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(lx, ly); ctx.stroke();

  // Measure text
  ctx.font = `800 ${fs}px ${FONT}`;
  const lWidth = ctx.measureText(label).width;
  ctx.font = `500 ${sfs}px ${FONT}`;
  const sWidth = ctx.measureText(sub).width;
  const maxWidth = Math.max(lWidth, sWidth);

  // Tick
  const tickDir = lx > ax ? 1 : -1;
  const tick = maxWidth + s(15, z);
  
  ctx.strokeStyle = color;
  ctx.lineWidth = s(2, z);
  ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + tick * tickDir, ly); ctx.stroke();

  // Text
  const tx = tickDir > 0 ? lx + s(5, z) : lx - s(5, z);
  ctx.textAlign = tickDir > 0 ? 'left' : 'right';

  ctx.font = `800 ${fs}px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'bottom';
  ctx.fillText(label, tx, ly - s(3, z));

  if (sub) {
    ctx.font = `500 ${sfs}px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.textBaseline = 'top';
    ctx.fillText(sub, tx, ly + s(4, z));
  }

  ctx.restore();
}

function drawCenterDash(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, z: number) {
  ctx.save();
  ctx.strokeStyle = C.centerLine;
  ctx.lineWidth = s(0.6, z);
  ctx.setLineDash([s(10, z), s(3, z), s(2, z), s(3, z)]);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawCrossSection(ctx: CanvasRenderingContext2D, cx: number, cy: number, edgeType: string, thickness: number, z: number) {
  const w = s(46, z);
  const h = s(28, z);
  const fs = s(7, z);
  const tfs = s(8, z);
  const pad = s(10, z);

  ctx.save();
  ctx.translate(cx, cy);

  // Box
  ctx.strokeStyle = C.sectionLine;
  ctx.lineWidth = s(0.8, z);
  const bx = -w / 2 - pad, by = -h / 2 - s(16, z);
  const bw = w + pad * 2, bh = h + s(32, z);
  ctx.strokeRect(bx, by, bw, bh);

  // Title
  ctx.font = `700 ${tfs}px ${FONT}`;
  ctx.fillStyle = C.sectionFill;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('SEÇÃO A-A', 0, by + s(3, z));

  // Profile
  ctx.strokeStyle = 'rgba(180,190,200,0.7)';
  ctx.lineWidth = s(1.2, z);
  ctx.fillStyle = 'rgba(180,190,200,0.1)';
  const hw = w * 0.38;
  const hh = (thickness / 10) * h * 0.35;

  ctx.beginPath();
  switch (edgeType) {
    case 'flat-grind':
      ctx.moveTo(0, hh + s(3, z)); ctx.lineTo(-hw, -hh); ctx.lineTo(hw, -hh); ctx.closePath(); break;
    case 'hollow-grind':
      ctx.moveTo(0, hh + s(3, z));
      ctx.quadraticCurveTo(-hw * 0.3, hh * 0.2, -hw, -hh);
      ctx.lineTo(hw, -hh);
      ctx.quadraticCurveTo(hw * 0.3, hh * 0.2, 0, hh + s(3, z)); break;
    case 'convex-grind':
      ctx.moveTo(0, hh + s(3, z));
      ctx.quadraticCurveTo(-hw * 1.3, hh * 0.5, -hw, -hh);
      ctx.lineTo(hw, -hh);
      ctx.quadraticCurveTo(hw * 1.3, hh * 0.5, 0, hh + s(3, z)); break;
    case 'scandi-grind':
      ctx.moveTo(0, hh + s(3, z));
      ctx.lineTo(-hw, -hh * 0.15); ctx.lineTo(-hw, -hh); ctx.lineTo(hw, -hh); ctx.lineTo(hw, -hh * 0.15);
      ctx.closePath(); break;
    default:
      ctx.moveTo(0, hh + s(3, z)); ctx.lineTo(-hw, -hh); ctx.lineTo(hw, -hh); ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();

  // Spine bar
  ctx.strokeStyle = 'rgba(180,190,200,0.4)';
  ctx.lineWidth = s(1.8, z);
  ctx.beginPath(); ctx.moveTo(-hw, -hh); ctx.lineTo(hw, -hh); ctx.stroke();

  // Edge type name
  ctx.font = `400 ${fs}px ${FONT}`;
  ctx.fillStyle = C.annotText;
  ctx.textBaseline = 'bottom';
  ctx.fillText(EDGE_OPTIONS.find(e => e.id === edgeType)?.name || edgeType, 0, by + bh - s(3, z));

  ctx.restore();
}

function drawTitleBlock(ctx: CanvasRenderingContext2D, w: number, h: number, config: LabConfig) {
  const bw = 220, bh = 72;
  const x = w - bw - 14, y = h - bh - 10;

  ctx.save();
  ctx.fillStyle = C.titleBg;
  ctx.fillRect(x, y, bw, bh);
  ctx.strokeStyle = C.titleBorder;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, bw, bh);

  // Dividers
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = C.titleBorder;
  for (const dy of [20, 38, 56]) {
    ctx.beginPath(); ctx.moveTo(x, y + dy); ctx.lineTo(x + bw, y + dy); ctx.stroke();
  }

  const px = x + 8;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  // Row 1: Title
  ctx.font = `700 9px ${FONT}`;
  ctx.fillStyle = C.titleBright;
  ctx.fillText('IRON FORGE — CUSTOM LAB', px, y + 10);

  // Row 2: Steel
  const steelName = STEEL_OPTIONS.find(s => s.id === config.steelType)?.name || '';
  ctx.font = `400 8px ${FONT}`;
  ctx.fillStyle = C.titleText;
  ctx.fillText(`AÇO: ${steelName.toUpperCase()}`, px, y + 29);

  // Row 3: Handle
  const handleName = HANDLE_MATERIAL_OPTIONS.find(h => h.id === config.handleMaterial)?.name || '';
  ctx.fillText(`CABO: ${handleName.toUpperCase()}`, px, y + 47);

  // Row 4: Construction + Scale
  ctx.fillText(config.isFullTang ? 'FULL TANG' : 'HIDDEN TANG', px, y + 64);
  ctx.textAlign = 'right';
  ctx.fillStyle = C.dimText;
  ctx.font = `700 8px ${FONT}`;
  ctx.fillText('1:1', x + bw - 8, y + 64);

  ctx.restore();
}

function drawMechanicalGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sp = 20;
  ctx.save();

  // Fine
  ctx.strokeStyle = C.gridFine;
  ctx.lineWidth = 0.5;
  for (let x = 0; x < w; x += sp) {
    ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke();
  }
  for (let y = 0; y < h; y += sp) {
    ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke();
  }

  // Major
  ctx.strokeStyle = C.gridMajor;
  const msp = sp * 5;
  for (let x = 0; x < w; x += msp) {
    ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke();
  }
  for (let y = 0; y < h; y += msp) {
    ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke();
  }

  // Diagonal hatch
  ctx.strokeStyle = C.crosshatch;
  ctx.lineWidth = 0.3;
  for (let d = -h; d < w + h; d += 40) {
    ctx.beginPath(); ctx.moveTo(d, 0); ctx.lineTo(d + h, h); ctx.stroke();
  }

  ctx.restore();
}

function adjustBrightness(hex: string, amt: number): string {
  const c = hex.startsWith('#') ? hex.slice(1) : hex;
  let R = parseInt(c.substring(0, 2), 16) || 61;
  let G = parseInt(c.substring(2, 4), 16) || 43;
  let B = parseInt(c.substring(4, 6), 16) || 31;
  R = Math.max(0, Math.min(255, R + amt));
  G = Math.max(0, Math.min(255, G + amt));
  B = Math.max(0, Math.min(255, B + amt));
  return `#${R.toString(16).padStart(2, '0')}${G.toString(16).padStart(2, '0')}${B.toString(16).padStart(2, '0')}`;
}

// ══════════════════════════════════════════════════════════════
// MAIN RENDER
// ══════════════════════════════════════════════════════════════

export function renderCanvas(
  ctx: CanvasRenderingContext2D,
  width: number, height: number,
  points: ControlPoint[],
  viewport: CanvasViewport,
  isEditMode: boolean,
  hoveredPoint: HoveredPoint | null,
  selectedPointIds: string[],
  config: LabConfig,
  snapGuides: SnapGuide[] = [],
) {
  ctx.clearRect(0, 0, width, height);
  drawGrid(ctx, width, height, viewport, isEditMode);

  // ═══ EDIT MODE ═══
  if (isEditMode) {
    ctx.save();
    ctx.translate(viewport.offsetX, viewport.offsetY);
    ctx.scale(viewport.zoom, viewport.zoom);

    if (points.length > 2) {
      const profilePts = points.filter(p => p.group !== 'guard');
      const curve = catmullRomSpline(profilePts, 20, true, 0.5);
      buildPath(ctx, curve);
      ctx.fillStyle = LAB_COLORS.curveEdit;
      ctx.fill();
      ctx.lineWidth = 2 / viewport.zoom;
      ctx.strokeStyle = LAB_COLORS.accent;
      ctx.stroke();

      // Connection lines removed to fix "linhas tracejadas se conectando"

    }

    // Track which groups already had their label drawn
    const labeledGroups = new Set<PointGroup>();

    // Control points — colored by group with labels
    for (const p of points) {
      const sel = selectedPointIds.includes(p.id);
      const hov = hoveredPoint?.id === p.id;
      const r = LAB_DIMENSIONS.pointRadius / viewport.zoom;
      const groupColor = POINT_GROUP_COLORS[p.group] || '#ff5c5c';

      // Outer glow ring for hovered/selected
      if (sel || hov) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 1.8, 0, Math.PI * 2);
        ctx.fillStyle = sel ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)';
        ctx.fill();
      }

      // Main dot
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      if (sel) {
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = groupColor;
        ctx.shadowBlur = 12 / viewport.zoom;
      } else if (hov) {
        ctx.fillStyle = '#ffffff';
      } else if (p.locked) {
        ctx.fillStyle = '#555555';
      } else {
        ctx.fillStyle = groupColor;
      }
      ctx.fill();
      ctx.shadowBlur = 0;

      // Border
      ctx.lineWidth = 1.5 / viewport.zoom;
      ctx.strokeStyle = sel ? groupColor : 'rgba(0,0,0,0.6)';
      ctx.stroke();

      // Group label — show on first point of each group, or hovered/selected point
      const shouldLabel = !labeledGroups.has(p.group) || sel || hov;
      if (shouldLabel) {
        labeledGroups.add(p.group);
        const label = POINT_GROUP_LABELS[p.group] || p.group;
        const fs = 11 / viewport.zoom;
        ctx.font = `600 ${fs}px "Inter", "SF Pro Display", system-ui, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        const tx = p.x + r * 2.2;
        const ty = p.y;
        const textW = ctx.measureText(label).width;
        const padH = 4 / viewport.zoom;
        const padV = 3 / viewport.zoom;
        const cornerR = 3 / viewport.zoom;

        // Tag background pill
        const bx = tx - padH;
        const by2 = ty - fs / 2 - padV;
        const bw = textW + padH * 2;
        const bh = fs + padV * 2;

        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.beginPath();
        ctx.roundRect(bx, by2, bw, bh, cornerR);
        ctx.fill();

        // Colored left accent bar
        ctx.fillStyle = groupColor;
        ctx.beginPath();
        ctx.roundRect(bx, by2, 3 / viewport.zoom, bh, [cornerR, 0, 0, cornerR]);
        ctx.fill();

        // Text
        ctx.fillStyle = '#e0e0e0';
        ctx.fillText(label, tx, ty);
      }
    }

    // ── Snap Guide Lines ──
    if (snapGuides.length > 0) {
      for (const guide of snapGuides) {
        ctx.save();
        ctx.strokeStyle = guide.color;
        ctx.lineWidth = 1.2 / viewport.zoom;
        ctx.setLineDash([6 / viewport.zoom, 4 / viewport.zoom]);
        ctx.globalAlpha = 0.85;

        ctx.beginPath();
        ctx.moveTo(guide.x1, guide.y1);
        ctx.lineTo(guide.x2, guide.y2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Small diamond markers at endpoints
        const dSize = 3 / viewport.zoom;
        for (const [ex, ey] of [[guide.x1, guide.y1], [guide.x2, guide.y2]]) {
          ctx.fillStyle = guide.color;
          ctx.beginPath();
          ctx.moveTo(ex, ey - dSize);
          ctx.lineTo(ex + dSize, ey);
          ctx.lineTo(ex, ey + dSize);
          ctx.lineTo(ex - dSize, ey);
          ctx.closePath();
          ctx.fill();
        }

        // Label pill at midpoint
        if (guide.label) {
          const mx = (guide.x1 + guide.x2) / 2;
          const my = (guide.y1 + guide.y2) / 2;
          const fs = 9 / viewport.zoom;
          ctx.font = `600 ${fs}px "Inter", system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const tw = ctx.measureText(guide.label).width;
          const ph = 3 / viewport.zoom;
          const pw = 5 / viewport.zoom;
          const cr = 2 / viewport.zoom;

          // Offset label above/to the side of line
          const labelOffY = guide.type === 'horizontal' ? -fs - ph * 2 : 0;
          const labelOffX = guide.type === 'vertical' ? tw / 2 + pw * 2 + 4 / viewport.zoom : 0;

          ctx.globalAlpha = 0.9;
          ctx.fillStyle = 'rgba(0,0,0,0.8)';
          ctx.beginPath();
          ctx.roundRect(
            mx + labelOffX - tw / 2 - pw,
            my + labelOffY - fs / 2 - ph,
            tw + pw * 2,
            fs + ph * 2,
            cr
          );
          ctx.fill();

          ctx.fillStyle = guide.color;
          ctx.globalAlpha = 1;
          ctx.fillText(guide.label, mx + labelOffX, my + labelOffY);
        }

        ctx.restore();
      }
    }

    ctx.restore();
    return;
  }

  // ═══ MECHANICAL DRAWING MODE ═══
  drawMechanicalGrid(ctx, width, height);

  ctx.save();
  ctx.translate(viewport.offsetX, viewport.offsetY);
  ctx.scale(viewport.zoom, viewport.zoom);

  if (points.length <= 2) { ctx.restore(); return; }

  const profilePts = points.filter(p => p.group !== 'guard');
  const curve = catmullRomSpline(profilePts, 20, true, 0.5);
  const z = viewport.zoom;

  // Bounding box
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;

  // ── Center lines ──
  drawCenterDash(ctx, minX - s(50, z), cy, maxX + s(50, z), cy, z);

  // ── 1. Steel silhouette (Blade Base) ──
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = s(20, z);
  ctx.shadowOffsetY = s(10, z);
  buildPath(ctx, curve);
  
  // Base Metallic Gradient — richer, more directional lighting
  const sg = ctx.createLinearGradient(0, minY - 15, 0, maxY + 15);
  if (config.finishType === 'mirror-polish') {
    sg.addColorStop(0, '#e8edf2'); sg.addColorStop(0.08, '#ffffff');
    sg.addColorStop(0.15, '#f5f7fa'); sg.addColorStop(0.35, '#dde2e8');
    sg.addColorStop(0.5, '#ffffff'); sg.addColorStop(0.65, '#b8c4d0');
    sg.addColorStop(0.85, '#8a929a'); sg.addColorStop(1, '#50555a');
  } else if (config.finishType === 'acid-wash') {
    sg.addColorStop(0, '#5a5d60'); sg.addColorStop(0.15, '#4a4d50');
    sg.addColorStop(0.4, '#3a3d40'); sg.addColorStop(0.6, '#2c2e30');
    sg.addColorStop(0.85, '#1d1f21'); sg.addColorStop(1, '#151719');
  } else if (config.finishType === 'brut-de-forge') {
    sg.addColorStop(0, '#3d3d3d'); sg.addColorStop(0.15, '#555555');
    sg.addColorStop(0.3, '#2a2a2a'); sg.addColorStop(0.5, '#181818');
    sg.addColorStop(0.7, '#3d3d3d'); sg.addColorStop(0.85, '#252525');
    sg.addColorStop(1, '#111111');
  } else if (config.finishType === 'stonewash') {
    sg.addColorStop(0, '#9fadb5'); sg.addColorStop(0.2, '#8f9c9d');
    sg.addColorStop(0.45, '#7a8a95'); sg.addColorStop(0.65, '#6d7d8e');
    sg.addColorStop(0.85, '#4a5a65'); sg.addColorStop(1, '#2c3333');
  } else {
    // Satin — premium brushed steel
    sg.addColorStop(0, '#e8ecf0'); sg.addColorStop(0.1, '#f0f3f5');
    sg.addColorStop(0.25, '#dce0e5'); sg.addColorStop(0.5, '#c0c8d2');
    sg.addColorStop(0.7, '#a5b5c6'); sg.addColorStop(0.9, '#7a8a9b');
    sg.addColorStop(1, '#5a6a7d');
  }
  ctx.fillStyle = sg;
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // --- Blade Finish Textures ---
  ctx.save();
  buildPath(ctx, curve);
  ctx.clip();
  
  if (config.steelType === 'damascus') {
    // Damascus wavy pattern
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1.2;
    const waveFreq = 0.08;
    const waveAmp = 6;
    for (let y = minY; y < maxY; y += 3) {
      ctx.beginPath();
      for (let x = minX; x < maxX; x += 5) {
        const wy = y + Math.sin(x * waveFreq + (y * 0.1)) * waveAmp + Math.sin(x * 0.02) * 15;
        if (x === minX) ctx.moveTo(x, wy);
        else ctx.lineTo(x, wy);
      }
      ctx.stroke();
    }
    // Deepen contrast for damascus
    ctx.fillStyle = 'rgba(20,20,20,0.1)';
    ctx.fill();
  }

  if (['stonewash', 'acid-wash', 'brut-de-forge'].includes(config.finishType)) {
    const baseAlpha = config.finishType === 'brut-de-forge' ? 0.12 : 0.06;
    for (let y = minY; y < maxY; y += 2) {
      for (let x = minX; x < maxX; x += 2) {
        const h = _hash(Math.round(x), Math.round(y));
        if (h > 0.55) {
          ctx.fillStyle = `rgba(0,0,0,${baseAlpha * (0.5 + h * 0.5)})`;
          ctx.fillRect(x, y, 1.5, 1.5);
        }
      }
    }
    if (config.finishType === 'brut-de-forge') {
      // Deterministic hammer marks near the spine
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      for (let i = 0; i < 40; i++) {
        const hx = _hash(i * 7 + 13, i * 3 + 7);
        const hy = _hash(i * 11 + 5, i * 5 + 3);
        const hr = _hash(i * 17 + 1, i * 2 + 9);
        const markY = minY + hy * (maxY - minY) * 0.4;
        ctx.beginPath();
        ctx.ellipse(minX + hx * (maxX - minX), markY, 4 + hr * 6, 2 + hr * 4, hr * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      // Forge soot/scale near the spine
      const forgeGrad = ctx.createLinearGradient(0, minY, 0, minY + 30);
      forgeGrad.addColorStop(0, 'rgba(0,0,0,0.7)');
      forgeGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = forgeGrad;
      ctx.fillRect(minX, minY, maxX - minX, 40);
    }
    if (config.finishType === 'stonewash') {
      // Deterministic subtle scratch marks
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < 100; i++) {
        const sx = minX + _hash(i * 13, i * 7 + 100) * (maxX - minX);
        const sy = minY + _hash(i * 7 + 200, i * 13) * (maxY - minY);
        const dx = (_hash(i * 3, i * 19) - 0.5) * 20;
        const dy = (_hash(i * 19 + 50, i * 3) - 0.5) * 20;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + dx, sy + dy);
        ctx.stroke();
      }
    }
  } else if (config.finishType === 'mirror-polish') {
    // Sharp slanted studio light reflections
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(minX + 45, minY - 20); ctx.lineTo(minX - 25, maxY + 20); ctx.stroke();
    
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(minX + 70, minY - 20); ctx.lineTo(minX + 0, maxY + 20); ctx.stroke();

    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath(); ctx.moveTo(minX + 100, minY - 20); ctx.lineTo(minX + 150, minY - 20); ctx.lineTo(minX + 80, maxY + 20); ctx.lineTo(minX + 30, maxY + 20); ctx.fill();
  } else if (config.finishType === 'satin') {
    // Horizontal brushed lines for satin finish — deterministic jitter
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 0.5;
    for (let y = minY; y < maxY; y += 1.5) {
      const jitter = (_hash(Math.round(y * 10), 999) - 0.5) * 0.5;
      ctx.beginPath();
      ctx.moveTo(minX - 10, y + jitter);
      ctx.lineTo(maxX + 10, y + jitter);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.03)';
    for (let y = minY; y < maxY; y += 2) {
      const jitter = (_hash(Math.round(y * 10), 1234) - 0.5) * 0.5;
      ctx.beginPath();
      ctx.moveTo(minX - 10, y + jitter);
      ctx.lineTo(maxX + 10, y + jitter);
      ctx.stroke();
    }
  }
  ctx.restore();

  // --- Spine Highlight (top edge light reflection) ---
  ctx.save();
  buildPath(ctx, curve);
  ctx.clip();
  const spinePts2 = points.filter(p => p.group === 'spine');
  if (spinePts2.length > 1) {
    const sortedSpine = [...spinePts2].sort((a, b) => a.x - b.x);
    const spineHighlight = catmullRomSpline(sortedSpine, 20, false, 0.5);
    
    // Bright highlight along spine
    ctx.beginPath();
    ctx.moveTo(spineHighlight[0].x, spineHighlight[0].y);
    for (let i = 1; i < spineHighlight.length; i++) ctx.lineTo(spineHighlight[i].x, spineHighlight[i].y);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = s(2.5, z);
    ctx.shadowColor = 'rgba(255,255,255,0.15)';
    ctx.shadowBlur = s(6, z);
    ctx.stroke();
    ctx.shadowColor = 'transparent';

    // Softer secondary glow
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = s(5, z);
    ctx.stroke();
  }
  ctx.restore();

  // --- Specular Band (central light reflection) ---
  ctx.save();
  buildPath(ctx, curve);
  ctx.clip();
  const specY = minY + (maxY - minY) * 0.35;
  const specGrad = ctx.createLinearGradient(0, specY - 8, 0, specY + 8);
  specGrad.addColorStop(0, 'rgba(255,255,255,0)');
  specGrad.addColorStop(0.4, 'rgba(255,255,255,0.08)');
  specGrad.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  specGrad.addColorStop(0.6, 'rgba(255,255,255,0.08)');
  specGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = specGrad;
  ctx.fillRect(minX - 10, specY - 12, maxX - minX + 20, 24);
  ctx.restore();

  // --- Edge Gradient (thickness taper towards cutting edge) ---
  ctx.save();
  buildPath(ctx, curve);
  ctx.clip();
  const edgeGrad = ctx.createLinearGradient(0, maxY - 20, 0, maxY + 5);
  edgeGrad.addColorStop(0, 'rgba(0,0,0,0)');
  edgeGrad.addColorStop(0.5, 'rgba(0,0,0,0.12)');
  edgeGrad.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = edgeGrad;
  ctx.fillRect(minX - 10, maxY - 20, maxX - minX + 20, 30);
  ctx.restore();

  // Damascus overlay pattern
  if (config.steelType === 'damascus') {
    ctx.save();
    buildPath(ctx, curve);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1.8;
    for (let y = minY - 30; y < maxY + 30; y += 4) {
      ctx.beginPath();
      for (let x = minX - 30; x < maxX + 30; x += 5) {
        const w = Math.sin(x * 0.04) * 8 + Math.cos((x + y) * 0.06) * 6 + Math.sin(y * 0.1) * 3;
        if (x <= minX - 30) ctx.moveTo(x, y + w);
        else ctx.lineTo(x, y + w);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 1.2;
    for (let y = minY - 28; y < maxY + 32; y += 4) {
      ctx.beginPath();
      for (let x = minX - 28; x < maxX + 32; x += 5) {
        const w = Math.sin(x * 0.04) * 8 + Math.cos((x + y) * 0.06) * 6 + Math.sin(y * 0.1) * 3;
        if (x <= minX - 28) ctx.moveTo(x, y + w);
        else ctx.lineTo(x, y + w);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // Steel Type Tints
  ctx.save();
  buildPath(ctx, curve);
  ctx.globalCompositeOperation = 'overlay';
  if (config.steelType === 'carbon-1095') {
    ctx.fillStyle = 'rgba(100, 60, 30, 0.35)';
    ctx.fill();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fill();
  } else if (config.steelType === 'd2') {
    ctx.fillStyle = 'rgba(30, 50, 70, 0.4)';
    ctx.fill();
  } else if (config.steelType === 'vg10') {
    ctx.fillStyle = 'rgba(180, 210, 255, 0.4)';
    ctx.fill();
  } else if (config.steelType === 'sandvik-14c28n') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fill();
  }
  ctx.restore();

  // Outline stroke
  buildPath(ctx, curve);
  ctx.lineWidth = s(1.5, z);
  ctx.strokeStyle = C.outlineThick;
  ctx.stroke();
  ctx.restore();

  // ── 1.5 Grind Line (Bevel Shading) ──
  if (config.edgeType) {
    const bevelPts = points.filter(p => ['tip', 'edge', 'choil', 'ricasso'].includes(p.group));
    if (bevelPts.length > 2) {
      let shift = 0, shadow = 0, alpha = 0.5, blurY = 0;
      let gradientStyle = 'flat'; 
      switch (config.edgeType) {
        case 'scandi-grind': shift = 15; alpha = 0.85; gradientStyle = 'scandi'; break;
        case 'hollow-grind': shift = 28; shadow = 12; alpha = 0.75; blurY = 4; gradientStyle = 'hollow'; break;
        case 'flat-grind': shift = 45; alpha = 0.4; gradientStyle = 'flat'; break;
        case 'convex-grind': shift = 22; alpha = 0.15; shadow = 25; blurY = 8; gradientStyle = 'convex'; break;
      }
      
      if (shift > 0) {
        const sp = bevelPts.map(p => ({
          ...p,
          y: p.y - shift * (p.group === 'tip' ? 0.2 : 1),
          x: p.x + (p.group === 'tip' ? shift * 0.8 : 0),
        }));
        const bc = catmullRomSpline(sp, 20, false, 0.5);
        
        ctx.save();
        buildPath(ctx, curve);
        ctx.clip(); // Clip to blade boundary
        
        // Grind boundary path
        const grindPath = new Path2D();
        grindPath.moveTo(bc[0].x, bc[0].y);
        for (let i = 1; i < bc.length; i++) grindPath.lineTo(bc[i].x, bc[i].y);
        
        // Base grind line shadow/stroke
        if (gradientStyle !== 'convex') { // Convex has no sharp grind line
          if (shadow > 0) { 
            ctx.shadowColor = 'rgba(0,0,0,0.9)'; 
            ctx.shadowBlur = shadow; 
            ctx.shadowOffsetY = blurY; 
          }
          ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
          ctx.lineWidth = gradientStyle === 'hollow' ? s(2.5, z) : s(1.5, z);
          ctx.stroke(grindPath);
          
          // Grind highlighting (Hollow grind has sharp highlight edge above the shadow)
          if (gradientStyle === 'hollow') {
            ctx.shadowColor = 'transparent'; 
            ctx.strokeStyle = 'rgba(255,255,255,0.4)'; 
            ctx.lineWidth = s(1, z); 
            // Draw slightly above
            ctx.translate(0, -s(1.5, z));
            ctx.stroke(grindPath);
            ctx.translate(0, s(1.5, z));
          }
        }
        
        // Fill the bevel area with a subtle lighting gradient
        const bevelFillPath = new Path2D(grindPath);
        // Trace the bottom edge of the blade backwards to close the path
        const edgeOnly = curve.filter(p => p.y >= bc[0].y - 40); 
        for (let i = edgeOnly.length - 1; i >= 0; i--) bevelFillPath.lineTo(edgeOnly[i].x, edgeOnly[i].y);
        bevelFillPath.closePath();
        
        const bevelMinY = Math.min(...bc.map(p=>p.y));
        const bevelGrad = ctx.createLinearGradient(0, bevelMinY, 0, maxY);
        
        if (gradientStyle === 'scandi') {
          // Scandi: sharp transition, flat bevel
          bevelGrad.addColorStop(0, 'rgba(255,255,255,0.2)');
          bevelGrad.addColorStop(0.2, 'rgba(0,0,0,0.05)');
          bevelGrad.addColorStop(1, 'rgba(0,0,0,0.4)');
        } else if (gradientStyle === 'hollow') {
          // Hollow: concave shape, dark top, bright middle, dark bottom
          bevelGrad.addColorStop(0, 'rgba(0,0,0,0.4)');
          bevelGrad.addColorStop(0.3, 'rgba(0,0,0,0.1)');
          bevelGrad.addColorStop(0.6, 'rgba(255,255,255,0.15)');
          bevelGrad.addColorStop(1, 'rgba(0,0,0,0.5)');
        } else if (gradientStyle === 'convex') {
          // Convex: large smooth diffuse highlight
          bevelGrad.addColorStop(0, 'rgba(0,0,0,0.1)');
          bevelGrad.addColorStop(0.4, 'rgba(255,255,255,0.1)');
          bevelGrad.addColorStop(0.7, 'rgba(255,255,255,0.05)');
          bevelGrad.addColorStop(1, 'rgba(0,0,0,0.6)');
        } else {
          // Flat
          bevelGrad.addColorStop(0, 'rgba(255,255,255,0.05)');
          bevelGrad.addColorStop(0.5, 'rgba(0,0,0,0.1)');
          bevelGrad.addColorStop(1, 'rgba(0,0,0,0.3)');
        }
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = bevelGrad;
        ctx.fill(bevelFillPath);
        
        ctx.restore();
      }
    }
  }

  // ── 2. Handle Scales (3D Shading) ──
  // Collect handle points by group for reliable ordering (not dependent on guard indices)
  let hPts: typeof points = [];
  {
    const hBottom = points.filter(p => p.group === 'handle-bottom').sort((a, b) => a.x - b.x);
    const hPommel = points.filter(p => p.group === 'pommel').sort((a, b) => b.y - a.y);
    const hTop = points.filter(p => p.group === 'handle-top').sort((a, b) => b.x - a.x);
    
    // Include guard points (sorted: bottom guard first by Y desc, top guard last by Y asc)
    let frontBottom = [];
    let frontTop = [];
    
    if (config.hasGuard) {
      const guardPts = points.filter(p => p.group === 'guard');
      const frontBottom = guardPts.filter(p => p.y >= (hBottom[0]?.y ?? 300)).sort((a, b) => b.y - a.y);
      const frontTop = guardPts.filter(p => p.y < (hBottom[0]?.y ?? 300)).sort((a, b) => a.y - b.y);
      hPts = [...frontBottom, ...hBottom, ...hPommel, ...hTop, ...frontTop];
    } else {
      const ricassoPt = points.find(p => p.group === 'ricasso');
      const choilPt = points.find(p => p.group === 'choil');
      const lastEdgePt = points.filter(p => p.group === 'edge').sort((a, b) => b.x - a.x)[0];
      const guardX = ricassoPt ? ricassoPt.x + 10 : choilPt ? choilPt.x + 20 : lastEdgePt ? lastEdgePt.x + 20 : 470;
      
      const spinePt = points.filter(p => p.group === 'spine').sort((a, b) => b.x - a.x)[0];
      
      // Compute Y coordinates that follow the blade naturally
      const botY = ricassoPt ? ricassoPt.y + 5 : choilPt ? choilPt.y + 5 : hBottom[0]?.y ?? 330;
      const topY = spinePt ? spinePt.y + 5 : hTop[hTop.length - 1]?.y ?? 250;
      
      const frontBottom = [{ id: 'synth_b1', x: guardX, y: botY, group: 'guard', locked: true, selected: false } as any];
      const frontTop = [{ id: 'synth_t1', x: guardX, y: topY, group: 'guard', locked: true, selected: false } as any];
      
      hPts = [...frontBottom, ...hBottom, ...hPommel, ...hTop, ...frontTop];
    }
  }

  if (hPts.length > 2) {
    let hCurve = catmullRomSpline(hPts, 20, false, 0.5);

    if (config.isFullTang) {
      let hcx = 0, hcy = 0;
      for (const p of hPts) { hcx += p.x; hcy += p.y; }
      hcx /= hPts.length; hcy /= hPts.length;
      hCurve = hCurve.map(p => ({ ...p, x: p.x + (hcx - p.x) * 0.04, y: p.y + (hcy - p.y) * 0.06 }));
    }

    ctx.save();
    // Handle drop shadow
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = s(15, z);
    ctx.shadowOffsetY = s(8, z);

    ctx.beginPath();
    ctx.moveTo(hCurve[0].x, hCurve[0].y);
    for (let i = 1; i < hCurve.length; i++) ctx.lineTo(hCurve[i].x, hCurve[i].y);
    ctx.closePath();

    const hMinY = Math.min(...hPts.map(p => p.y));
    const hMaxY = Math.max(...hPts.map(p => p.y));
    
    // Complex 3D cylinder gradient for the handle
    const hg = ctx.createLinearGradient(0, hMinY - 5, 0, hMaxY + 15);
    const bc = config.handleColor || '#3d2b1f';
    
    // Ergonomic lighting: top highlight, middle base, bottom core shadow, bottom edge rim light
    hg.addColorStop(0, adjustBrightness(bc, 70));
    hg.addColorStop(0.12, adjustBrightness(bc, 30));
    hg.addColorStop(0.35, bc);
    hg.addColorStop(0.7, adjustBrightness(bc, -40));
    hg.addColorStop(0.9, adjustBrightness(bc, -85));
    hg.addColorStop(1, adjustBrightness(bc, -20)); // Rim light
    
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    
    // Inner shadow/chamfer effect
    ctx.lineWidth = s(2, z);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.stroke();
    ctx.lineWidth = s(1, z);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; // inner highlight
    ctx.stroke();
    
    // --- Handle Material Textures ---
    ctx.save();
    ctx.clip();
    
    if (config.handleMaterial === 'carbon-fiber') {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      for (let y = hMinY; y < hMaxY; y += 4) {
        for (let x = minX; x < maxX; x += 4) {
          if ((Math.floor(x/4) + Math.floor(y/4)) % 2 === 0) {
            ctx.rect(x, y, 3, 3);
          }
        }
      }
      ctx.fill();
      // Add a clear coat shine
      const cfShine = ctx.createLinearGradient(0, hMinY, 0, hMaxY);
      cfShine.addColorStop(0, 'rgba(255,255,255,0.2)');
      cfShine.addColorStop(0.3, 'rgba(255,255,255,0)');
      cfShine.addColorStop(0.7, 'rgba(255,255,255,0)');
      cfShine.addColorStop(1, 'rgba(255,255,255,0.05)');
      ctx.fillStyle = cfShine;
      ctx.fill();
    } else if (config.handleMaterial === 'jacaranda') {
      // Premium Wood grain pattern
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1.8;
      for (let y = hMinY - 10; y < hMaxY + 10; y += 4) {
        ctx.beginPath();
        for (let x = minX; x < maxX; x += 10) {
          const w = Math.sin(x * 0.015) * 8 + Math.cos(x * 0.03 + y * 0.1) * 3;
          if (x === minX) ctx.moveTo(x, y + w);
          else ctx.lineTo(x, y + w);
        }
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(100,30,10,0.1)';
      ctx.lineWidth = 4;
      for (let y = hMinY - 10; y < hMaxY + 10; y += 12) {
        ctx.beginPath(); ctx.moveTo(minX, y); ctx.lineTo(maxX, y); ctx.stroke();
      }
    } else if (config.handleMaterial === 'micarta' || config.handleMaterial === 'g10') {
      // High-res Fabric/Canvas weave pattern
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      for (let y = hMinY; y < hMaxY; y += 3) {
        for (let x = minX; x < maxX; x += 3) {
          if ((Math.floor(x/3) + Math.floor(y/3)) % 2 === 0) {
            ctx.rect(x, y, 2, 2);
          }
        }
      }
      ctx.fill();
      // Add a subtle wave to simulate layered micarta sanding
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 3;
      for (let x = minX + 20; x < maxX - 20; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, hMinY);
        ctx.bezierCurveTo(x + 30, hMinY + (hMaxY - hMinY)*0.5, x - 30, hMinY + (hMaxY - hMinY)*0.8, x, hMaxY);
        ctx.stroke();
      }
    } else if (config.handleMaterial === 'resin-hybrid') {
      // ═══ Premium Procedural Resin — Domain-warped FBM ═══
      // Uses deterministic noise so texture stays stable across camera movements
      const hW = maxX - minX;
      const hH = hMaxY - hMinY;
      const step = 3; // pixel step for performance

      for (let py = hMinY; py < hMaxY; py += step) {
        for (let px = minX; px < maxX; px += step) {
          // Normalize coords
          const nx = (px - minX) / hW;
          const ny = (py - hMinY) / hH;

          // Domain warping: warp coordinates with noise for organic swirls
          const qx = _fbm(nx * 4.0, ny * 4.0, 4);
          const qy = _fbm(nx * 4.0 + 5.2, ny * 4.0 + 1.3, 4);
          const warpedNoise = _fbm(nx * 4.0 + qx * 2.5, ny * 4.0 + qy * 2.5, 5);

          // Secondary swirl layer for depth
          const rx = _fbm(nx * 6.0 + warpedNoise * 1.5 + 3.7, ny * 6.0 + 9.2, 3);
          const ry = _fbm(nx * 6.0 + 8.3, ny * 6.0 + warpedNoise * 1.5 + 2.8, 3);
          const deepSwirl = _fbm(nx * 6.0 + rx * 2.0, ny * 6.0 + ry * 2.0, 4);

          // Combine layers (range roughly -1 to 1, normalize to 0..1)
          const combined = (warpedNoise * 0.6 + deepSwirl * 0.4 + 1.0) * 0.5;

          // Color mapping: deep blue resin base with cyan/teal highlights and subtle gold flecks
          const t = Math.max(0, Math.min(1, combined));

          // Base color: deep ocean blue -> bright teal
          let r = 5 + t * 45;
          let g = 20 + t * 160;
          let b = 55 + t * 200;

          // Gold/amber fleck highlights in peaks
          const fleckNoise = _fbm(px * 0.15, py * 0.15, 2);
          if (fleckNoise > 0.72) {
            const fleckIntensity = (fleckNoise - 0.72) / 0.28;
            r = r + (210 - r) * fleckIntensity * 0.6;
            g = g + (175 - g) * fleckIntensity * 0.5;
            b = b * (1 - fleckIntensity * 0.7);
          }

          // Overall alpha: semi-transparent so the handle gradient shows through
          const alpha = 0.45 + t * 0.3;

          ctx.fillStyle = `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${alpha.toFixed(2)})`;
          ctx.fillRect(px, py, step, step);
        }
      }

      // Specular highlight band (gloss effect over resin)
      const glossGrad = ctx.createLinearGradient(0, hMinY, 0, hMaxY);
      glossGrad.addColorStop(0, 'rgba(255,255,255,0.25)');
      glossGrad.addColorStop(0.15, 'rgba(255,255,255,0.08)');
      glossGrad.addColorStop(0.4, 'rgba(255,255,255,0)');
      glossGrad.addColorStop(0.6, 'rgba(255,255,255,0)');
      glossGrad.addColorStop(0.85, 'rgba(255,255,255,0.04)');
      glossGrad.addColorStop(1, 'rgba(255,255,255,0.15)');
      ctx.fillStyle = glossGrad;
      ctx.fillRect(minX, hMinY, hW, hH);

      // Diagonal shine streak for wet/glossy resin look
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = 'rgba(255,255,255,1)';
      ctx.lineWidth = 6;
      const shineX = minX + hW * 0.3;
      ctx.beginPath();
      ctx.moveTo(shineX + 30, hMinY - 5);
      ctx.lineTo(shineX - 15, hMaxY + 5);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.1;
      ctx.beginPath();
      ctx.moveTo(shineX + 55, hMinY - 5);
      ctx.lineTo(shineX + 10, hMaxY + 5);
      ctx.stroke();
      ctx.restore();
    }
    
    ctx.restore();
    ctx.restore();
  }

  // ── 3. Guard / Bolster (Metallic Shine) ──
  const guardPtsAll = points.filter(p => p.group === 'guard');
  if (config.hasGuard && guardPtsAll.length >= 2) {
    // Reliably find bottom guard (highest Y) and top guard (lowest Y)
    const sortedGuards = [...guardPtsAll].sort((a, b) => a.y - b.y);
    const tg = sortedGuards[0]; // top guard (lowest Y value)
    const bg = sortedGuards[sortedGuards.length - 1]; // bottom guard (highest Y value)
    ctx.save();
    
    // Guard drop shadow
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = s(8, z);
    ctx.shadowOffsetX = s(2, z);
    ctx.shadowOffsetY = s(4, z);

    const baseSize = config.guardSize || 12;
    const protrude = 10 + baseSize * 0.5;
    const gw = 7; 
    const style = config.guardStyle || 'bolster';

    const isDGuard = style === 'd-guard';
    const isDoubleGuard = style === 'double-guard';
    const isSGuard = style === 's-guard';

    // Sharp metallic gradient across X axis
    const gg = ctx.createLinearGradient(tg.x - 12, 0, tg.x + 8, 0);
    const mat = config.guardMaterial || 'brass';
    if (mat === 'brass') {
      gg.addColorStop(0, '#5c4e14'); gg.addColorStop(0.2, '#f9e79f'); gg.addColorStop(0.3, '#d4af37'); gg.addColorStop(0.7, '#8c761e'); gg.addColorStop(0.9, '#f9e79f'); gg.addColorStop(1, '#3d340d');
    } else if (mat === 'titanium') {
      gg.addColorStop(0, '#3a3e42'); gg.addColorStop(0.2, '#8a929a'); gg.addColorStop(0.3, '#6a727a'); gg.addColorStop(0.7, '#4a4e52'); gg.addColorStop(0.9, '#9aa2aa'); gg.addColorStop(1, '#2a2e32');
    } else if (mat === 'copper') {
      gg.addColorStop(0, '#4a2511'); gg.addColorStop(0.2, '#d97b48'); gg.addColorStop(0.3, '#b85d33'); gg.addColorStop(0.7, '#8c3d1e'); gg.addColorStop(0.9, '#e89666'); gg.addColorStop(1, '#2a1106');
    } else { // Steel
      gg.addColorStop(0, '#2b343c'); gg.addColorStop(0.2, '#ffffff'); gg.addColorStop(0.3, '#abb2b9'); gg.addColorStop(0.7, '#566573'); gg.addColorStop(0.9, '#e5e7e9'); gg.addColorStop(1, '#1a1f24');
    }
    
    if (isDGuard) {
      // ═══════════════════════════════════════════════════════════
      // 2D D-GUARD — Cutlass / Sabre style knuckle bow
      // Rich metallic shading, sculpted collar with fillet rings,
      // flowing D-arc under handle, and riveted end plate.
      // ═══════════════════════════════════════════════════════════
      const midY = (tg.y + bg.y) / 2;
      const guardW = 16;
      const dDepth = 40 + baseSize * 1.5; // Depth of D curve
      
      // Calculate actual handle length to make D-guard connect to the pommel
      const handlePts = points.filter(p => p.group.includes('handle') || p.group === 'pommel');
      const bladePts = points.filter(p => p.group.includes('blade') || p.group === 'tip');
      let dLength = 90 + baseSize * 2.5; // fallback
      let dir = 1; // 1 means handle is on the right
      
      if (handlePts.length > 0 && bladePts.length > 0) {
        const hMin = Math.min(...handlePts.map(p => p.x));
        const hMax = Math.max(...handlePts.map(p => p.x));
        const bCenter = (Math.min(...bladePts.map(p => p.x)) + Math.max(...bladePts.map(p => p.x))) / 2;
        const hCenter = (hMin + hMax) / 2;
        const isBladeRight = bCenter > hCenter;
        
        dir = isBladeRight ? -1 : 1;
        const handleEndX = isBladeRight ? hMin : hMax;
        dLength = Math.max(20, Math.abs(handleEndX - tg.x) - 4); // subtract 4 to not overshoot
      }
      
      const barW = 9; // Thickness of the D-bar
      
      // ── 1. Central Collar Block ──
      const collarW = guardW;
      const collarH = bg.y - tg.y + 8;
      const collarX = tg.x - collarW / 2;
      const collarY = tg.y - 4;
      const cr = 3;
      
      ctx.beginPath();
      ctx.moveTo(collarX + cr, collarY);
      ctx.lineTo(collarX + collarW - cr, collarY);
      ctx.quadraticCurveTo(collarX + collarW, collarY, collarX + collarW, collarY + cr);
      ctx.lineTo(collarX + collarW, collarY + collarH - cr);
      ctx.quadraticCurveTo(collarX + collarW, collarY + collarH, collarX + collarW - cr, collarY + collarH);
      ctx.lineTo(collarX + cr, collarY + collarH);
      ctx.quadraticCurveTo(collarX, collarY + collarH, collarX, collarY + collarH - cr);
      ctx.lineTo(collarX, collarY + cr);
      ctx.quadraticCurveTo(collarX, collarY, collarX + cr, collarY);
      ctx.closePath();
      
      // Shadow for collar
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;
      ctx.fillStyle = gg;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      
      ctx.lineWidth = s(1.5, z);
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.stroke();
      
      // Collar edge highlights for 3D bevel effect
      ctx.beginPath();
      ctx.moveTo(collarX + 3, collarY + 3);
      ctx.lineTo(collarX + 3, collarY + collarH - 3);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(collarX + collarW - 3, collarY + 3);
      ctx.lineTo(collarX + collarW - 3, collarY + collarH - 3);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.stroke();

      // ── 2. Fillet Rings (Decorative transition) ──
      const drawRing = (y: number) => {
        ctx.beginPath();
        ctx.ellipse(tg.x, y, collarW * 0.6, 2.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = gg;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.stroke();
        // Ring highlight
        ctx.beginPath();
        ctx.ellipse(tg.x - 2, y, collarW * 0.4, 1, 0, 0, Math.PI * 2);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.stroke();
      };
      drawRing(tg.y - 1);
      drawRing(bg.y + 1);

      // ── 3. Top Scroll (Massive forward curl) ──
      const scrollR = 11;
      ctx.beginPath();
      // Draw spiral path leaning forward
      const spiralCenterY = tg.y - 8 - scrollR;
      const spiralCenterX = tg.x + 3 * dir;
      ctx.arc(spiralCenterX, spiralCenterY, scrollR, Math.PI * 0.5, Math.PI * 2.5);
      ctx.lineWidth = 8;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; // Outline
      ctx.stroke();
      ctx.lineWidth = 6;
      ctx.strokeStyle = gg; // Metallic fill
      ctx.stroke();
      // Inner spiral highlight
      ctx.beginPath();
      ctx.arc(spiralCenterX - 1 * dir, spiralCenterY, scrollR - 1.5, Math.PI * 0.6, Math.PI * 1.9);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.stroke();

      // ── 4. Main D-Bar ──
      ctx.beginPath();
      // Start at bottom of collar
      ctx.moveTo(tg.x + (-barW/2 + 2) * dir, bg.y + 4);
      // Smooth descent and sweep back
      ctx.bezierCurveTo(
        tg.x - (barW/2) * dir, bg.y + dDepth * 0.4,
        tg.x + dLength * 0.2 * dir, bg.y + dDepth,
        tg.x + dLength * 0.6 * dir, bg.y + dDepth * 0.8
      );
      // Rise to reconnect
      ctx.bezierCurveTo(
        tg.x + dLength * 0.9 * dir, bg.y + dDepth * 0.5,
        tg.x + (dLength + 5) * dir, midY + 15,
        tg.x + dLength * dir, midY + 2
      );
      // Inner edge returning
      ctx.lineTo(tg.x + (dLength - barW * 0.8) * dir, midY - 2);
      ctx.bezierCurveTo(
        tg.x + (dLength - 5) * dir, midY + 10,
        tg.x + dLength * 0.8 * dir, bg.y + dDepth * 0.4,
        tg.x + dLength * 0.55 * dir, bg.y + dDepth * 0.65
      );
      ctx.bezierCurveTo(
        tg.x + dLength * 0.25 * dir, bg.y + dDepth - barW,
        tg.x + (barW/2 + 2) * dir, bg.y + dDepth * 0.4,
        tg.x + (barW/2 + 2) * dir, bg.y + 4
      );
      ctx.closePath();
      
      // Shadow for D-bar
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = gg;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      
      ctx.lineWidth = s(1.5, z);
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.stroke();
      
      // D-bar volume highlight (creates flat-bar forged look)
      ctx.beginPath();
      ctx.moveTo(tg.x - 1 * dir, bg.y + 6);
      ctx.bezierCurveTo(
        tg.x - 1 * dir, bg.y + dDepth * 0.35,
        tg.x + dLength * 0.2 * dir, bg.y + dDepth * 0.9,
        tg.x + dLength * 0.6 * dir, bg.y + dDepth * 0.75
      );
      ctx.bezierCurveTo(
        tg.x + dLength * 0.85 * dir, bg.y + dDepth * 0.5,
        tg.x + (dLength + 2) * dir, midY + 15,
        tg.x + (dLength - 2) * dir, midY + 5
      );
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.stroke();
      
      // D-bar inner shadow
      ctx.beginPath();
      ctx.moveTo(tg.x + 4 * dir, bg.y + 6);
      ctx.bezierCurveTo(
        tg.x + 4 * dir, bg.y + dDepth * 0.35,
        tg.x + dLength * 0.2 * dir, bg.y + dDepth * 0.7,
        tg.x + dLength * 0.55 * dir, bg.y + dDepth * 0.6
      );
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.stroke();

      // ── 5. End Plate (Riveted connection) ──
      const epX = tg.x + (dLength - 2) * dir;
      const epY = midY - 1;
      
      // Plate base
      ctx.beginPath();
      ctx.ellipse(epX, epY, 7, 12, 0, 0, Math.PI * 2);
      ctx.fillStyle = gg;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.stroke();
      
      // Plate highlight
      ctx.beginPath();
      ctx.ellipse(epX - 2 * dir, epY, 3, 9, 0, 0, Math.PI * 2);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.stroke();
      
      // Rivet head
      ctx.beginPath();
      ctx.arc(epX, epY, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(200,200,200,0.9)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.stroke();
      // Rivet highlight
      ctx.fillStyle = '#fff';
      ctx.fillRect(epX - 1 * dir, epY - 1, 1.5, 1.5);
      
    } else if (isDoubleGuard) {
      // ═══════════════════════════════════════════════════════════
      // 2D DOUBLE QUILLON — Epic Custom Bowie cross-guard
      // Thick central block, massive flared shoulders, aggressive
      // forward-curving arms, and huge acorn finials.
      // ═══════════════════════════════════════════════════════════
      const proj = 40 + baseSize * 2.0; // Much longer
      const armW = 16; // Thicker
      const x = tg.x - armW / 2;
      const midY = (tg.y + bg.y) / 2;
      // dir logic for double guard
      const bCenter = points.filter(p => p.group.includes('blade') || p.group === 'tip').reduce((sum, p) => sum + p.x, 0) / points.filter(p => p.group.includes('blade') || p.group === 'tip').length;
      const hCenter = points.filter(p => p.group.includes('handle') || p.group === 'pommel').reduce((sum, p) => sum + p.x, 0) / points.filter(p => p.group.includes('handle') || p.group === 'pommel').length;
      const dir = bCenter > hCenter ? -1 : 1;
      
      // ── 1. Central Block ──
      const blockTop = tg.y + 4;
      const blockBot = bg.y - 4;
      const br = 3;
      
      ctx.beginPath();
      ctx.moveTo(x + br, blockTop);
      ctx.lineTo(x + armW - br, blockTop);
      ctx.quadraticCurveTo(x + armW, blockTop, x + armW, blockTop + br);
      ctx.lineTo(x + armW, blockBot - br);
      ctx.quadraticCurveTo(x + armW, blockBot, x + armW - br, blockBot);
      ctx.lineTo(x + br, blockBot);
      ctx.quadraticCurveTo(x, blockBot, x, blockBot - br);
      ctx.lineTo(x, blockTop + br);
      ctx.quadraticCurveTo(x, blockTop, x + br, blockTop);
      ctx.closePath();
      
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;
      ctx.fillStyle = gg;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      
      ctx.lineWidth = s(1.5, z);
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.stroke();
      
      // Block highlights
      ctx.beginPath();
      ctx.moveTo(x + 3, blockTop + br);
      ctx.lineTo(x + 3, blockBot - br);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.stroke();
      
      // ── 2. Flared Shoulders ──
      const drawShoulder = (y: number) => {
        ctx.beginPath();
        ctx.ellipse(tg.x, y, armW * 0.7, 4, 0, 0, Math.PI * 2);
        ctx.fillStyle = gg;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(tg.x - 2, y, armW * 0.4, 2, 0, 0, Math.PI * 2);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.stroke();
      };
      drawShoulder(blockTop - 2);
      drawShoulder(blockBot + 2);

      // ── 3. Top Quillon Arm ──
      const topEnd = tg.y - proj;
      const topTipW = armW * 0.7;
      const curveOff = 18 * dir; // Massive curve toward blade
      
      ctx.beginPath();
      ctx.moveTo(x, blockTop - 2);
      ctx.bezierCurveTo(
        x - 4 * dir, blockTop - proj * 0.4,
        x + (armW - topTipW)/2 + curveOff * 0.6, topEnd + proj * 0.3,
        x + (armW - topTipW)/2 + curveOff, topEnd + 8
      );
      ctx.lineTo(x + (armW + topTipW)/2 + curveOff, topEnd + 8);
      ctx.bezierCurveTo(
        x + armW + 4 * dir, topEnd + proj * 0.3,
        x + armW + 2 * dir, blockTop - proj * 0.4,
        x + armW, blockTop - 2
      );
      ctx.closePath();
      
      ctx.fillStyle = gg;
      ctx.fill();
      ctx.lineWidth = s(1.5, z);
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.stroke();
      
      // Volumetric highlight for flat-bar look
      ctx.beginPath();
      ctx.moveTo(tg.x - 2, blockTop - 4);
      ctx.bezierCurveTo(
        tg.x - 2, blockTop - proj * 0.4,
        tg.x - 2 + curveOff * 0.5, topEnd + proj * 0.3,
        tg.x - 2 + curveOff * 0.8, topEnd + 6
      );
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.stroke();
      
      // Top spherical cap
      ctx.beginPath();
      ctx.arc(tg.x + curveOff * 0.9, topEnd + 3, topTipW * 0.9, 0, Math.PI * 2);
      ctx.fillStyle = gg;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.stroke();
      // Cap highlight
      ctx.beginPath();
      ctx.arc(tg.x + curveOff * 0.9 - 2, topEnd + 1, topTipW * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fill();

      // ── 4. Bottom Quillon Arm (Mirror) ──
      const botEnd = bg.y + proj;
      
      ctx.beginPath();
      ctx.moveTo(x, blockBot + 2);
      ctx.bezierCurveTo(
        x - 1, blockBot + proj * 0.3,
        x + (armW - topTipW)/2 + curveOff, botEnd - proj * 0.2,
        x + (armW - topTipW)/2 - curveOff, botEnd - 4
      );
      ctx.lineTo(x + (armW + topTipW)/2 - curveOff, botEnd - 4);
      ctx.bezierCurveTo(
        x + armW + 1 - curveOff, botEnd - proj * 0.2,
        x + armW + 1, blockBot + proj * 0.3,
        x + armW, blockBot + 2
      );
      ctx.closePath();
      
      ctx.fillStyle = gg;
      ctx.fill();
      ctx.lineWidth = s(1.5, z);
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.stroke();
      
      // Bottom highlight
      ctx.beginPath();
      ctx.moveTo(tg.x - 2, blockBot + 4);
      ctx.bezierCurveTo(
        tg.x - 2, blockBot + proj * 0.4,
        tg.x - 2 - curveOff * 0.5, botEnd - proj * 0.3,
        tg.x - 2 - curveOff * 0.8, botEnd - 6
      );
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.stroke();
      
      // Bottom spherical cap
      ctx.beginPath();
      ctx.arc(tg.x - curveOff * 0.9, botEnd - 3, topTipW * 0.9, 0, Math.PI * 2);
      ctx.fillStyle = gg;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(tg.x - curveOff * 0.9 - 2, botEnd - 5, topTipW * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fill();
      
    } else if (isSGuard) {
      // ═══════════════════════════════════════════════════════════
      // 2D S-GUARD — Epic sweeping S-curves
      // Deep sweeping S-curves wrapping beautifully, terminating
      // in large sculpted teardrop finials.
      // ═══════════════════════════════════════════════════════════
      const ext = 45 + baseSize * 2.0; // Much longer
      const curveSweep = 35; // Deeper sweep
      const stemW = 12; // Thicker
      // dir logic for s-guard
      const bCenter = points.filter(p => p.group.includes('blade') || p.group === 'tip').reduce((sum, p) => sum + p.x, 0) / points.filter(p => p.group.includes('blade') || p.group === 'tip').length;
      const hCenter = points.filter(p => p.group.includes('handle') || p.group === 'pommel').reduce((sum, p) => sum + p.x, 0) / points.filter(p => p.group.includes('handle') || p.group === 'pommel').length;
      const dir = bCenter > hCenter ? -1 : 1;
      
      // ── 1. Central Collar ──
      const collarH = bg.y - tg.y + 6;
      const collarW = 16;
      const collarX = tg.x - collarW / 2;
      const collarY = tg.y - 3;
      const cr = 4;
      
      ctx.beginPath();
      ctx.moveTo(collarX + cr, collarY);
      ctx.lineTo(collarX + collarW - cr, collarY);
      ctx.quadraticCurveTo(collarX + collarW, collarY, collarX + collarW, collarY + cr);
      ctx.lineTo(collarX + collarW, collarY + collarH - cr);
      ctx.quadraticCurveTo(collarX + collarW, collarY + collarH, collarX + collarW - cr, collarY + collarH);
      ctx.lineTo(collarX + cr, collarY + collarH);
      ctx.quadraticCurveTo(collarX, collarY + collarH, collarX, collarY + collarH - cr);
      ctx.lineTo(collarX, collarY + cr);
      ctx.quadraticCurveTo(collarX, collarY, collarX + cr, collarY);
      ctx.closePath();
      
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;
      ctx.fillStyle = gg;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      
      ctx.lineWidth = s(1.5, z);
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.stroke();
      
      // Collar highlight
      ctx.beginPath();
      ctx.moveTo(collarX + 3, collarY + 3);
      ctx.lineTo(collarX + 3, collarY + collarH - 3);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.stroke();

      // Collar fillet ring
      ctx.beginPath();
      ctx.ellipse(tg.x, (tg.y + bg.y)/2, collarW * 0.7, 3, 0, 0, Math.PI * 2);
      ctx.fillStyle = gg;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.stroke();
      
      // ── 2. Top S-Arm (Teardrop Finial) ──
      ctx.beginPath();
      ctx.moveTo(tg.x - stemW/2, tg.y - 1);
      // Outer sweeping edge
      ctx.bezierCurveTo(
        tg.x - stemW/2 * dir, tg.y - ext * 0.3,
        tg.x - curveSweep * dir, tg.y - ext * 0.6,
        tg.x - (curveSweep * 0.5) * dir, tg.y - ext
      );
      // Teardrop curl
      ctx.bezierCurveTo(
        tg.x + (curveSweep * 0.3) * dir, tg.y - ext - 10,
        tg.x + (curveSweep * 0.8) * dir, tg.y - ext + 5,
        tg.x + (curveSweep * 0.2) * dir, tg.y - ext * 0.8
      );
      // Inner return
      ctx.bezierCurveTo(
        tg.x - (curveSweep * 0.5) * dir, tg.y - ext * 0.5,
        tg.x + stemW/2 * dir, tg.y - ext * 0.3,
        tg.x + stemW/2, tg.y - 1
      );
      ctx.fill();
      ctx.lineWidth = s(1.5, z);
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.stroke();
      
      // Top arm highlight
      ctx.beginPath();
      ctx.moveTo(tg.x - 1, tg.y - 3);
      ctx.bezierCurveTo(
        tg.x - 1 * dir, tg.y - ext * 0.3,
        tg.x - (curveSweep * 0.6) * dir, tg.y - ext * 0.55,
        tg.x - (curveSweep * 0.3) * dir, tg.y - ext * 0.9
      );
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.stroke();
      
      // ── 3. Bottom S-Arm (Mirror) ──
      ctx.beginPath();
      ctx.moveTo(bg.x - stemW/2, bg.y + 1);
      ctx.bezierCurveTo(
        bg.x - stemW/2, bg.y + ext * 0.3,
        bg.x + curveSweep - stemW * 0.3, bg.y + ext * 0.6,
        bg.x + curveSweep * 0.5 - 4, bg.y + ext
      );
      ctx.quadraticCurveTo(
        bg.x + curveSweep * 0.2, bg.y + ext + 5,
        bg.x - 2, bg.y + ext + 6
      );
      ctx.quadraticCurveTo(
        bg.x + curveSweep * 0.4, bg.y + ext + 2,
        bg.x + curveSweep * 0.5 - 6, bg.y + ext - 2
      );
      ctx.bezierCurveTo(
        bg.x + curveSweep + stemW * 0.5, bg.y + ext * 0.5,
        bg.x + stemW/2, bg.y + ext * 0.3,
        bg.x + stemW/2, bg.y + 1
      );
      ctx.closePath();
      
      ctx.fillStyle = gg;
      ctx.fill();
      ctx.lineWidth = s(1.2, z);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.stroke();
      
      // Bottom arm highlight
      ctx.beginPath();
      ctx.moveTo(bg.x + 1, bg.y + 3);
      ctx.bezierCurveTo(
        bg.x + 1, bg.y + ext * 0.3,
        bg.x + curveSweep * 0.6, bg.y + ext * 0.55,
        bg.x + curveSweep * 0.5 - 4, bg.y + ext
      );
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.stroke();
      
    } else {
      // ── Bolster (unchanged) ──
      ctx.beginPath();
      const w = 14;
      const bh = (bg.y - tg.y) + 6;
      const bx = tg.x - w/2;
      const by = tg.y - 3;
      const r = 4;
      
      ctx.moveTo(bx + r, by);
      ctx.lineTo(bx + w - r, by);
      ctx.quadraticCurveTo(bx + w, by, bx + w, by + r);
      ctx.lineTo(bx + w, by + bh - r);
      ctx.quadraticCurveTo(bx + w, by + bh, bx + w - r, by + bh);
      ctx.lineTo(bx + r, by + bh);
      ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
      ctx.lineTo(bx, by + r);
      ctx.quadraticCurveTo(bx, by, bx + r, by);
      ctx.closePath();
      
      ctx.fillStyle = gg;
      ctx.fill();
      ctx.lineWidth = s(1.5, z);
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.stroke();
      
      // Bolster inner metallic edge highlight
      ctx.beginPath();
      ctx.moveTo(tg.x - 4, tg.y - 2);
      ctx.lineTo(bg.x - 4, bg.y + 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.stroke();
    }
    
    ctx.shadowColor = 'transparent';
    ctx.restore();
  }

  // ── 4. Pins (positioned from handle geometry) ──
  const pinCount = config.pinCount || 2;
  {
    const hTopPts = points.filter(p => p.group === 'handle-top');
    const hBotPts = points.filter(p => p.group === 'handle-bottom');
    const pommelPts2 = points.filter(p => p.group === 'pommel');

    // Calculate handle X range from guard (or ricasso/choil fallback) to pommel
    const guardPtsForPin = points.filter(p => p.group === 'guard');
    const ricassoP2 = points.find(p => p.group === 'ricasso');
    const guardX = guardPtsForPin.length > 0
      ? Math.min(...guardPtsForPin.map(p => p.x))
      : (ricassoP2 ? ricassoP2.x + 10 : cx);
    const pommelX = pommelPts2.length > 0 ? Math.max(...pommelPts2.map(p => p.x)) : maxX;
    const handleSpan = pommelX - guardX;

    if (handleSpan > 0) {
      for (let i = 0; i < pinCount; i++) {
        const t = (i + 1) / (pinCount + 1); // distribute evenly
        const px = guardX + handleSpan * t;

        // Find Y center between top and bottom handle at this X
        const topY = interpolateY(hTopPts, px) ?? cy - 20;
        const botY = interpolateY(hBotPts, px) ?? cy + 20;
        const py = (topY + botY) / 2;

        const pr = s(3.5, z);
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);

        let pinColor = '#b5a642';
        if (config.pinMaterial === 'stainless') pinColor = '#abb2b9';
        else if (config.pinMaterial === 'mosaic') pinColor = '#111';

        ctx.fillStyle = pinColor;
        ctx.fill();
        ctx.lineWidth = s(0.8, z);
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.stroke();

        // Mosaic detail
        if (config.pinMaterial === 'mosaic') {
          ctx.fillStyle = '#b5a642';
          for (const [dx, dy] of [[-1.2, -1.2], [1.2, 1.2], [-1.2, 1.2], [1.2, -1.2]]) {
            ctx.beginPath(); ctx.arc(px + dx, py + dy, 0.7, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
    }
  }

  // ── 5. Lanyard Hole ──
  if (config.hasLanyardHole) {
    const pommelPts = points.filter(p => p.group === 'pommel');
    if (pommelPts.length > 0) {
      const pp = pommelPts[0];
      const hx = pp.x - 20, hy = pp.y;
      ctx.beginPath();
      ctx.arc(hx, hy, s(4.5, z), 0, Math.PI * 2);
      ctx.fillStyle = C.bg;
      ctx.fill();
      ctx.lineWidth = s(1.2, z);
      ctx.strokeStyle = 'rgba(200,210,220,0.35)';
      ctx.stroke();
    }
  }

  // ══════════════════════════════════════════
  // DIMENSIONS
  // ══════════════════════════════════════════

  const tipPt = points.find(p => p.group === 'tip');
  const pommelPts = points.filter(p => p.group === 'pommel');
  const spinePts = points.filter(p => p.group === 'spine');
  const edgePts = points.filter(p => p.group === 'edge');

  const tipX = tipPt?.x ?? minX;
  const pommelMaxX = pommelPts.length > 0 ? Math.max(...pommelPts.map(p => p.x)) : maxX;
  const ricassoP = points.find(p => p.group === 'ricasso');
  const boundaryX = ricassoP?.x ?? (guardPtsAll.length > 0 ? Math.min(...guardPtsAll.map(p => p.x)) : cx);

  const totalLen = config.bladeLength + config.handleLength;

  if (config.showAnnotations !== false) {
    // Total length
    drawDimension(ctx, tipX, maxY, pommelMaxX, maxY, `${totalLen.toFixed(1)} cm`, 'bottom', s(50, z), z);

  // Blade
  drawDimension(ctx, tipX, maxY, boundaryX, maxY, `${config.bladeLength.toFixed(1)} cm`, 'bottom', s(24, z), z);

  // Handle
  drawDimension(ctx, boundaryX, maxY, pommelMaxX, maxY, `${config.handleLength.toFixed(1)} cm`, 'bottom', s(24, z), z);

  // Blade height
  const spineMinY = spinePts.length > 0 ? Math.min(...spinePts.map(p => p.y)) : minY;
  const edgeMaxY = edgePts.length > 0 ? Math.max(...edgePts.map(p => p.y)) : maxY;
  drawDimension(ctx, minX, spineMinY, minX, edgeMaxY, `${config.bladeHeight.toFixed(1)} cm`, 'left', s(35, z), z);

  // ══════════════════════════════════════════
  // ANNOTATIONS
  // ══════════════════════════════════════════

  // Thickness note near spine
  if (spinePts.length > 0) {
    const sp = spinePts[Math.floor(spinePts.length / 2)];
    drawAnnotation(ctx, sp.x, sp.y, sp.x - s(15, z), sp.y - s(50, z),
      `${config.bladeThickness.toFixed(1)} mm`, 'Espessura do Dorso', z, '#888888');
  }

  // Tip
  if (tipPt) {
    drawAnnotation(ctx, tipPt.x, tipPt.y, tipPt.x - s(45, z), tipPt.y - s(35, z), 'PONTA', 'Tip', z, POINT_GROUP_COLORS['tip']);
  }

  // Spine
  if (spinePts.length > 0) {
    const sp = spinePts[0];
    drawAnnotation(ctx, sp.x, sp.y, sp.x + s(15, z), sp.y - s(45, z), 'DORSO', 'Spine', z, POINT_GROUP_COLORS['spine']);
  }

  // Edge
  if (edgePts.length > 1) {
    const ep = edgePts[Math.floor(edgePts.length / 2)];
    drawAnnotation(ctx, ep.x, ep.y, ep.x - s(15, z), ep.y + s(45, z), 'FIO', 'Cutting Edge', z, POINT_GROUP_COLORS['edge']);
  }

  // Guard
  if (config.hasGuard && guardPtsAll.length > 0) {
    const gp = guardPtsAll.reduce((best, p) => p.y > best.y ? p : best, guardPtsAll[0]);
    drawAnnotation(ctx, gp.x, gp.y, gp.x + s(25, z), gp.y + s(55, z), 'GUARDA', 'Bolster', z, POINT_GROUP_COLORS['guard']);
  }

  // Handle
  const hTopPts = points.filter(p => p.group === 'handle-top');
  if (hTopPts.length > 0) {
    const ht = hTopPts[Math.floor(hTopPts.length / 2)];
    const matName = HANDLE_MATERIAL_OPTIONS.find(h => h.id === config.handleMaterial)?.name || '';
    drawAnnotation(ctx, ht.x, ht.y, ht.x + s(15, z), ht.y - s(50, z), 'CABO', matName, z, POINT_GROUP_COLORS['handle-top']);
  }

  // Pommel
  if (pommelPts.length > 0) {
    const pp = pommelPts[0];
    drawAnnotation(ctx, pp.x, pp.y, pp.x + s(35, z), pp.y + s(40, z),
      'POMMEL', config.hasSkullCrusher ? 'Skull Crusher' : 'Pommel', z, POINT_GROUP_COLORS['pommel']);
  }

  // ── Center of Gravity ──
  const bladeW = config.bladeLength * config.bladeHeight * config.bladeThickness;
  const handleW = config.handleLength * config.handleThickness * 2;
  const totalW = bladeW + handleW;
  const cgX = ((tipX + boundaryX) / 2 * bladeW + (boundaryX + pommelMaxX) / 2 * handleW) / totalW;
  const cgS = s(5, z);

  ctx.save();
  ctx.translate(cgX, cy);
  ctx.beginPath();
  ctx.moveTo(0, -cgS); ctx.lineTo(cgS, 0); ctx.lineTo(0, cgS); ctx.lineTo(-cgS, 0); ctx.closePath();
  ctx.fillStyle = C.cgFill;
  ctx.fill();
  ctx.strokeStyle = C.cgStroke;
  ctx.lineWidth = s(1.2, z);
  ctx.stroke();

  ctx.font = `700 ${s(7, z)}px ${FONT}`;
  ctx.fillStyle = C.cgStroke;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('CG', 0, cgS + s(3, z));
  ctx.restore();

  // ── Section Cut Line ──
  const secX = tipX + (boundaryX - tipX) * 0.55;
  ctx.save();
  ctx.strokeStyle = C.sectionLine;
  ctx.lineWidth = s(1, z);
  ctx.setLineDash([s(6, z), s(2, z), s(1.5, z), s(2, z)]);
  ctx.beginPath();
  ctx.moveTo(secX, minY - s(30, z)); ctx.lineTo(secX, maxY + s(30, z));
  ctx.stroke();
  ctx.setLineDash([]);

  const mr = s(7, z);
  const mfs = s(8, z);
  for (const my of [minY - s(40, z), maxY + s(40, z)]) {
    ctx.beginPath();
    ctx.arc(secX, my, mr, 0, Math.PI * 2);
    ctx.fillStyle = C.sectionFill;
    ctx.fill();
    ctx.font = `700 ${mfs}px ${FONT}`;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('A', secX, my);
  }
  ctx.restore();

  // ── Cross Section ──
  drawCrossSection(ctx, maxX + s(80, z), cy, config.edgeType, config.bladeThickness, z);
  }

  ctx.restore();

  // ── Title Block (screen space) ──
  drawTitleBlock(ctx, width, height, config);
}

// ── Utility: interpolate Y value in a point array at a given X ──
function interpolateY(pts: ControlPoint[], x: number): number | null {
  if (pts.length === 0) return null;
  if (pts.length === 1) return pts[0].y;

  // Sort by X
  const sorted = [...pts].sort((a, b) => a.x - b.x);

  if (x <= sorted[0].x) return sorted[0].y;
  if (x >= sorted[sorted.length - 1].x) return sorted[sorted.length - 1].y;

  for (let i = 0; i < sorted.length - 1; i++) {
    if (x >= sorted[i].x && x <= sorted[i + 1].x) {
      const t = (x - sorted[i].x) / (sorted[i + 1].x - sorted[i].x);
      return sorted[i].y + t * (sorted[i + 1].y - sorted[i].y);
    }
  }
  return null;
}
