import * as THREE from 'three';
import { useMemo } from 'react';
import { GuardStyle } from '@/types/Lab';

interface Guard3DProps {
  style: GuardStyle;
  centerX: number;
  centerY: number;
  height: number;
  width: number;
  thickness: number; // total depth in Z
  material: THREE.Material;
  dir: number; // 1 for right, -1 for left
  size: number; // config.guardSize (0-100 usually, default 12)
  handleEndX?: number; // Where the handle ends on the X axis
  onClick?: (e: any) => void;
  onPointerOver?: (e: any) => void;
  onPointerOut?: (e: any) => void;
}

// Helper: create an extruded bar along a CatmullRom path with a rectangular cross-section
// This produces a much more realistic forged metal bar than a TubeGeometry (which is round)
function createFlatBar(
  pathPoints: THREE.Vector3[],
  barWidth: number,
  barDepth: number,
  segments: number,
  taperFn?: (t: number) => number,
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(pathPoints, false);
  const frames = curve.computeFrenetFrames(segments, false);
  const pts = curve.getPoints(segments);

  const crossSectionPts = 8; // octagonal cross-section for a forged bar feel
  const totalVerts = (segments + 1) * crossSectionPts;
  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const scale = taperFn ? taperFn(t) : 1.0;
    const hw = (barWidth / 2) * scale;
    const hd = (barDepth / 2) * scale;

    const N = frames.normals[i];
    const B = frames.binormals[i];
    const P = pts[i];

    // Octagonal cross-section for that forged look
    for (let j = 0; j < crossSectionPts; j++) {
      const angle = (j / crossSectionPts) * Math.PI * 2;
      // Squash circle into rounded rectangle
      const cx = Math.cos(angle);
      const cy = Math.sin(angle);
      // Superellipse for rounded-rect feel
      const px = Math.sign(cx) * Math.pow(Math.abs(cx), 0.6) * hw;
      const py = Math.sign(cy) * Math.pow(Math.abs(cy), 0.6) * hd;

      const idx = (i * crossSectionPts + j) * 3;
      positions[idx]     = P.x + px * N.x + py * B.x;
      positions[idx + 1] = P.y + px * N.y + py * B.y;
      positions[idx + 2] = P.z + px * N.z + py * B.z;

      // Approximate normal
      normals[idx]     = cx * N.x + cy * B.x;
      normals[idx + 1] = cx * N.y + cy * B.y;
      normals[idx + 2] = cx * N.z + cy * B.z;
    }
  }

  // Indices
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < crossSectionPts; j++) {
      const a = i * crossSectionPts + j;
      const b = i * crossSectionPts + (j + 1) % crossSectionPts;
      const c = (i + 1) * crossSectionPts + (j + 1) % crossSectionPts;
      const d = (i + 1) * crossSectionPts + j;
      indices.push(a, b, c, a, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function Guard3D({
  style,
  centerX,
  centerY,
  height,
  width,
  thickness,
  material,
  dir,
  size,
  handleEndX,
  onClick,
  onPointerOver,
  onPointerOut,
}: Guard3DProps) {
  const geometries = useMemo(() => {
    const geos: THREE.BufferGeometry[] = [];
    
    // Base block parameters
    const w = Math.max(0.15, width);
    const h = height;
    const d = thickness;
    
    // Projection multiplier from size (0-100)
    const proj = 0.4 + size * 0.03;

    if (style === 'bolster') {
      // Classic blocky bolster with heavily rounded corners
      const shape = new THREE.Shape();
      const hwX = w / 2;
      const hh = h / 2;
      const cornerR = Math.min(0.08, hwX * 0.35, hh * 0.15);
      
      shape.moveTo(-hwX + cornerR, hh);
      shape.lineTo(hwX - cornerR, hh);
      shape.quadraticCurveTo(hwX, hh, hwX, hh - cornerR);
      shape.lineTo(hwX, -hh + cornerR);
      shape.quadraticCurveTo(hwX, -hh, hwX - cornerR, -hh);
      shape.lineTo(-hwX + cornerR, -hh);
      shape.quadraticCurveTo(-hwX, -hh, -hwX, -hh + cornerR);
      shape.lineTo(-hwX, hh - cornerR);
      shape.quadraticCurveTo(-hwX, hh, -hwX + cornerR, hh);

      const extGeo = new THREE.ExtrudeGeometry(shape, {
        depth: d,
        bevelEnabled: true,
        bevelSegments: 4,
        steps: 1,
        bevelSize: 0.04,
        bevelThickness: 0.04,
      });
      extGeo.translate(centerX, centerY, -d / 2);
      geos.push(extGeo);

    } else if (style === 'd-guard') {
      // ═══════════════════════════════════════════════════════════
      // D-GUARD — Cutlass / Sabre style knuckle bow
      // A polished metal bar sweeping from the guard collar in a 
      // smooth D-arc under the handle, reconnecting at the pommel.
      // Features: collar with fillet rings, flat-bar cross-section,
      // decorative scroll at blade-side, riveted end plate.
      // ═══════════════════════════════════════════════════════════
      
      const hh = h / 2;
      const hwX = w / 2;
      const barW = d * 0.35;  // bar width (in cross-section)
      const barD = d * 0.55;  // bar depth (flat side)
      const dDepth = hh * 2.0 + proj * 1.0; // how deep the D sweeps
      
      // Compute actual dLength from handle end, falling back to an estimate
      const actualLength = handleEndX !== undefined ? Math.abs(handleEndX - centerX) : w * 4.0;
      const dLength = Math.max(actualLength - 0.2, w * 1.5); // stop just slightly before the very tip
      
      // ── 1. Central collar (blade-handle junction) ──
      const collarShape = new THREE.Shape();
      const cw = hwX * 0.75;
      const chh = hh * 1.0;
      const cr = Math.min(0.06, cw * 0.3);
      
      collarShape.moveTo(-cw + cr, chh);
      collarShape.lineTo(cw - cr, chh);
      collarShape.quadraticCurveTo(cw, chh, cw, chh - cr);
      collarShape.lineTo(cw, -chh + cr);
      collarShape.quadraticCurveTo(cw, -chh, cw - cr, -chh);
      collarShape.lineTo(-cw + cr, -chh);
      collarShape.quadraticCurveTo(-cw, -chh, -cw, -chh + cr);
      collarShape.lineTo(-cw, chh - cr);
      collarShape.quadraticCurveTo(-cw, chh, -cw + cr, chh);
      
      const collarGeo = new THREE.ExtrudeGeometry(collarShape, {
        depth: d * 1.1,
        bevelEnabled: true,
        bevelSegments: 5,
        steps: 1,
        bevelSize: 0.04,
        bevelThickness: 0.035,
      });
      collarGeo.translate(centerX, centerY, -d * 0.55);
      geos.push(collarGeo);
      
      // ── 2. Collar fillet rings (decorative transition bands) ──
      const filletR = Math.max(chh, d * 0.45) * 0.6;
      const filletGeo1 = new THREE.TorusGeometry(filletR, d * 0.045, 10, 24);
      filletGeo1.rotateY(Math.PI / 2);
      filletGeo1.translate(centerX + cw * 0.9, centerY, 0);
      geos.push(filletGeo1);
      
      const filletGeo2 = new THREE.TorusGeometry(filletR, d * 0.045, 10, 24);
      filletGeo2.rotateY(Math.PI / 2);
      filletGeo2.translate(centerX - cw * 0.9, centerY, 0);
      geos.push(filletGeo2);
      
      // ── 3. Top scroll (Massive forward curl) ──
      const scrollPts: THREE.Vector3[] = [];
      const scrollSegs = 20;
      const scrollR2 = hh * 0.55; // Much larger
      for (let i = 0; i <= scrollSegs; i++) {
        const t = i / scrollSegs;
        const angle = t * Math.PI * 1.5;
        const decay = 1 - t * 0.25;
        // Curve forward aggressively, then loop down
        scrollPts.push(new THREE.Vector3(
          (-Math.sin(angle) * scrollR2 * 1.5 * decay + (t * w * 0.2)) * dir,
          -hh - scrollR2 * 0.3 - (1 - Math.cos(angle)) * scrollR2 * decay,
          0
        ));
      }
      const scrollCurve = new THREE.CatmullRomCurve3(scrollPts, false);
      const scrollGeo = new THREE.TubeGeometry(scrollCurve, scrollSegs, barW * 0.6, 8, false);
      scrollGeo.translate(centerX, centerY, 0);
      geos.push(scrollGeo);
      
      // Scroll tip ball
      const scrollTip = scrollPts[scrollPts.length - 1];
      const scrollBall = new THREE.SphereGeometry(barW * 0.65, 12, 12);
      scrollBall.translate(centerX + scrollTip.x, centerY + scrollTip.y, 0);
      geos.push(scrollBall);
      
      // ── 4. D-Bar (main knuckle bow) ──
      // Smooth D-curve from bottom of collar to pommel area
      const dBarPts: THREE.Vector3[] = [];
      const dSegs = 50;
      
      const startX = centerX;
      const startY = centerY + hh;
      const endX = centerX - dLength * dir;
      const endY = centerY - hh * 0.3;
      
      for (let i = 0; i <= dSegs; i++) {
        const t = i / dSegs;
        let px: number, py: number;
        
        if (t < 0.08) {
          // Smooth exit from collar bottom
          const lt = t / 0.08;
          const ease = lt * lt * (3 - 2 * lt);
          px = startX;
          py = startY + ease * dDepth * 0.15;
        } else if (t < 0.92) {
          // Main D-arc with smooth sinusoidal profile
          const ct = (t - 0.08) / 0.84;
          px = startX - ct * dLength * dir;
          // Smooth D-arc: deeper in middle, rises at ends
          const arcY = Math.sin(ct * Math.PI);
          // Add slight asymmetry: deeper at front, shallower at back
          const skew = 1 - ct * 0.2;
          py = startY + dDepth * 0.15 + arcY * dDepth * 0.85 * skew;
        } else {
          // Smooth approach to reconnect at handle/pommel
          const lt = (t - 0.92) / 0.08;
          const ease = lt * lt * (3 - 2 * lt);
          px = endX;
          py = startY + dDepth * 0.15 * (1 - ease) + endY * ease;
        }
        
        dBarPts.push(new THREE.Vector3(px, py, 0));
      }
      
      // Use flat-bar cross-section for realistic forged look
      const dBarGeo = createFlatBar(dBarPts, barW, barD, dSegs, (t) => {
        // Slight swell at the apex (middle), taper at ends
        const mid = Math.sin(t * Math.PI);
        return 0.85 + mid * 0.2;
      });
      geos.push(dBarGeo);
      
      // ── 5. End connection plate (riveted pommel attachment) ──
      // Flared connection where the D-bar meets the handle end
      const endPlateShape = new THREE.Shape();
      const epW = barW * 1.5;
      const epH = hh * 0.6;
      const epR = Math.min(epW * 0.3, epH * 0.2);
      
      endPlateShape.moveTo(-epW + epR, epH);
      endPlateShape.lineTo(epW - epR, epH);
      endPlateShape.quadraticCurveTo(epW, epH, epW, epH - epR);
      endPlateShape.lineTo(epW, -epH + epR);
      endPlateShape.quadraticCurveTo(epW, -epH, epW - epR, -epH);
      endPlateShape.lineTo(-epW + epR, -epH);
      endPlateShape.quadraticCurveTo(-epW, -epH, -epW, -epH + epR);
      endPlateShape.lineTo(-epW, epH - epR);
      endPlateShape.quadraticCurveTo(-epW, epH, -epW + epR, epH);
      
      const endPlateGeo = new THREE.ExtrudeGeometry(endPlateShape, {
        depth: barD * 0.9,
        bevelEnabled: true,
        bevelSegments: 3,
        steps: 1,
        bevelSize: 0.02,
        bevelThickness: 0.02,
      });
      endPlateGeo.translate(endX, endY, -barD * 0.45);
      geos.push(endPlateGeo);
      
      // Rivet on end plate
      const rivetGeo = new THREE.CylinderGeometry(barW * 0.2, barW * 0.25, barD * 0.2, 12);
      rivetGeo.rotateX(Math.PI / 2);
      rivetGeo.translate(endX, endY, barD * 0.35);
      geos.push(rivetGeo);

    } else if (style === 'double-guard') {
      // ═══════════════════════════════════════════════════════════
      // DOUBLE QUILLON — Epic Custom Bowie cross-guard
      // Thick, substantial quillon arms curving aggressively forward 
      // towards the blade, flared lug shoulders, and massive acorn finials.
      // ═══════════════════════════════════════════════════════════
      
      const blockH = h * 1.1; // Taller central block
      const qLen = proj * 3.5; // Much longer quillons
      
      // ── 1. Central block (substantial rectangular cross) ──
      const blockShape = new THREE.Shape();
      const bw = w * 0.65;
      const bhh = blockH / 2;
      const br = Math.min(0.08, bw * 0.25, bhh * 0.15);
      
      blockShape.moveTo(-bw + br, bhh);
      blockShape.lineTo(bw - br, bhh);
      blockShape.quadraticCurveTo(bw, bhh, bw, bhh - br);
      blockShape.lineTo(bw, -bhh + br);
      blockShape.quadraticCurveTo(bw, -bhh, bw - br, -bhh);
      blockShape.lineTo(-bw + br, -bhh);
      blockShape.quadraticCurveTo(-bw, -bhh, -bw, -bhh + br);
      blockShape.lineTo(-bw, bhh - br);
      blockShape.quadraticCurveTo(-bw, bhh, -bw + br, bhh);
      
      const blockGeo = new THREE.ExtrudeGeometry(blockShape, {
        depth: d * 1.4,
        bevelEnabled: true,
        bevelSegments: 5,
        steps: 1,
        bevelSize: 0.05,
        bevelThickness: 0.05,
      });
      blockGeo.translate(centerX, centerY, -d * 0.7);
      geos.push(blockGeo);
      
      // ── 2. Massive Lug Shoulders ──
      const shoulderR = d * 0.6;
      const topShoulder = new THREE.SphereGeometry(shoulderR, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
      topShoulder.scale(1.4, 0.6, 1.2);
      topShoulder.translate(centerX, centerY + bhh - 0.02, 0);
      geos.push(topShoulder);
      
      const botShoulder = new THREE.SphereGeometry(shoulderR, 16, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5);
      botShoulder.scale(1.4, 0.6, 1.2);
      botShoulder.translate(centerX, centerY - bhh + 0.02, 0);
      geos.push(botShoulder);

      // ── 3. Top Quillon arm (Curving fiercely forward) ──
      const qBarW = d * 0.55;
      const qBarD = d * 0.75;
      
      const topQPts: THREE.Vector3[] = [];
      const qSegs = 40;
      for (let i = 0; i <= qSegs; i++) {
        const t = i / qSegs;
        const y = bhh + t * qLen;
        // Aggressive forward curve (towards the blade)
        // dir=1 (blade right), dir=-1 (blade left)
        const curveX = (Math.pow(t, 1.8) * w * 2.5) * dir;
        topQPts.push(new THREE.Vector3(curveX, y, 0));
      }
      
      const topQGeo = createFlatBar(topQPts, qBarW, qBarD, qSegs, (t) => {
        // Massive flare at base, tapers in middle, swells slightly before finial
        if (t < 0.15) return 1.4 - t * 2.5; 
        if (t > 0.85) return 0.8 + (t - 0.85) * 1.5;
        return 0.9 - (t - 0.15) * 0.2;
      });
      topQGeo.translate(centerX, centerY, 0);
      geos.push(topQGeo);
      
      // Acorn Finial (Top)
      const topTipW = qBarW * 0.8;
      const topCapGeo = new THREE.SphereGeometry(topTipW, 16, 16);
      topCapGeo.scale(1.1, 1.4, 1.1); // Acorn shape
      const topTipCurveX = (Math.pow(1.0, 1.8) * w * 2.5) * dir;
      // Rotate acorn to point along the curve
      topCapGeo.rotateZ(-Math.PI * 0.15 * dir);
      topCapGeo.translate(centerX + topTipCurveX + (0.05 * dir), centerY + bhh + qLen + 0.05, 0);
      geos.push(topCapGeo);
      
      // ── 4. Bottom Quillon arm (Curving fiercely forward) ──
      const botQPts: THREE.Vector3[] = [];
      for (let i = 0; i <= qSegs; i++) {
        const t = i / qSegs;
        const y = -(bhh + t * qLen);
        const curveX = (Math.pow(t, 1.8) * w * 2.5) * dir;
        botQPts.push(new THREE.Vector3(curveX, y, 0));
      }
      
      const botQGeo = createFlatBar(botQPts, qBarW, qBarD, qSegs, (t) => {
        if (t < 0.15) return 1.4 - t * 2.5;
        if (t > 0.85) return 0.8 + (t - 0.85) * 1.5;
        return 0.9 - (t - 0.15) * 0.2;
      });
      botQGeo.translate(centerX, centerY, 0);
      geos.push(botQGeo);
      
      // Acorn Finial (Bottom)
      const botCapGeo = new THREE.SphereGeometry(topTipW, 16, 16);
      botCapGeo.scale(1.1, 1.4, 1.1);
      const botTipCurveX = (Math.pow(1.0, 1.8) * w * 2.5) * dir;
      botCapGeo.rotateZ(Math.PI * 0.15 * dir);
      botCapGeo.translate(centerX + botTipCurveX + (0.05 * dir), centerY - bhh - qLen - 0.05, 0);
      geos.push(botCapGeo);

    } else if (style === 's-guard') {
      // ═══════════════════════════════════════════════════════════
      // S-GUARD — Epic sweeping S-curves
      // Deep sweeping S-curves wrapping beautifully, flat bar 
      // cross-section terminating in large sculpted teardrop finials.
      // ═══════════════════════════════════════════════════════════
      
      const blockH = h * 0.95;
      
      // ── 1. Central collar ──
      const collarShape = new THREE.Shape();
      const cw = w * 0.6;
      const chh = blockH / 2;
      const cr = Math.min(0.06, cw * 0.3, chh * 0.15);
      
      collarShape.moveTo(-cw + cr, chh);
      collarShape.lineTo(cw - cr, chh);
      collarShape.quadraticCurveTo(cw, chh, cw, chh - cr);
      collarShape.lineTo(cw, -chh + cr);
      collarShape.quadraticCurveTo(cw, -chh, cw - cr, -chh);
      collarShape.lineTo(-cw + cr, -chh);
      collarShape.quadraticCurveTo(-cw, -chh, -cw, -chh + cr);
      collarShape.lineTo(-cw, chh - cr);
      collarShape.quadraticCurveTo(-cw, chh, -cw + cr, chh);
      
      const collarGeo = new THREE.ExtrudeGeometry(collarShape, {
        depth: d * 1.1,
        bevelEnabled: true,
        bevelSegments: 5,
        steps: 1,
        bevelSize: 0.04,
        bevelThickness: 0.04,
      });
      collarGeo.translate(centerX, centerY, -d * 0.55);
      geos.push(collarGeo);
      
      // Thick Collar fillet ring
      const sFilletR = Math.max(chh, d * 0.45) * 0.6;
      const sFilletGeo = new THREE.TorusGeometry(sFilletR, d * 0.05, 12, 24);
      sFilletGeo.rotateY(Math.PI / 2);
      sFilletGeo.translate(centerX, centerY, 0);
      geos.push(sFilletGeo);

      // ── 2. S-curve parameters ──
      const armLen = proj * 3.2; // Much longer
      const curveSweep = w * 2.8; // Deeper curve
      const sBarW = d * 0.45; // Thicker
      const sBarD = d * 0.65;
      
      // ── 3. Top arm (Curving boldly toward blade) ──
      const topPts: THREE.Vector3[] = [];
      const aSegs = 40;
      for (let i = 0; i <= aSegs; i++) {
        const t = i / aSegs;
        let px: number, py: number;
        
        if (t < 0.15) {
          // Sharp exit
          const lt = t / 0.15;
          const ease = lt * lt * (3 - 2 * lt);
          px = 0;
          py = ease * armLen * 0.15;
        } else if (t < 0.75) {
          // Deep sweeping curve toward blade
          const ct = (t - 0.15) / 0.6;
          // Dir=1 (blade right), Dir=-1 (blade left) -> +px means right
          px = Math.sin(ct * Math.PI) * curveSweep * dir;
          py = armLen * 0.15 + ct * armLen * 0.6;
        } else {
          // Tight curl back to form teardrop mount
          const et = (t - 0.75) / 0.25;
          const ease = Math.sin(et * Math.PI * 0.5);
          const prevX = Math.sin(Math.PI) * curveSweep * dir; // almost 0
          px = prevX + (ease * curveSweep * 0.2 * dir);
          py = armLen * 0.75 + ease * armLen * 0.25;
        }
        
        topPts.push(new THREE.Vector3(px, py, 0));
      }
      
      const topGeo = createFlatBar(topPts, sBarW, sBarD, aSegs, (t) => {
        if (t < 0.15) return 1.4 - t * 2.0; // Flare
        if (t > 0.8) return 0.8 + (t - 0.8) * 1.5; // Swell for finial
        return 0.9 - (t - 0.15) * 0.4; // Taper mid-way
      });
      topGeo.translate(centerX, centerY + chh, 0);
      geos.push(topGeo);
      
      // Teardrop Finial (Top)
      const topTip = topPts[topPts.length - 1];
      const topCapGeo = new THREE.SphereGeometry(sBarW * 0.7, 16, 16);
      topCapGeo.scale(1.0, 1.6, 1.0); // Teardrop stretch
      topCapGeo.rotateZ(Math.PI * 0.1 * dir); // Tilt
      topCapGeo.translate(centerX + topTip.x + (0.02 * dir), centerY + chh + topTip.y + 0.05, 0);
      geos.push(topCapGeo);
      
      // ── 4. Bottom arm (Curving boldly toward handle) ──
      const botPts: THREE.Vector3[] = [];
      for (let i = 0; i <= aSegs; i++) {
        const t = i / aSegs;
        let px: number, py: number;
        
        if (t < 0.15) {
          const lt = t / 0.15;
          const ease = lt * lt * (3 - 2 * lt);
          px = 0;
          py = -ease * armLen * 0.15;
        } else if (t < 0.75) {
          const ct = (t - 0.15) / 0.6;
          // Reverse curve toward handle (-px)
          px = -Math.sin(ct * Math.PI) * curveSweep * dir;
          py = -(armLen * 0.15 + ct * armLen * 0.6);
        } else {
          const et = (t - 0.75) / 0.25;
          const ease = Math.sin(et * Math.PI * 0.5);
          const prevX = -Math.sin(Math.PI) * curveSweep * dir;
          px = prevX - (ease * curveSweep * 0.2 * dir);
          py = -(armLen * 0.75 + ease * armLen * 0.25);
        }
        
        botPts.push(new THREE.Vector3(px, py, 0));
      }
      
      const botGeo = createFlatBar(botPts, sBarW, sBarD, aSegs, (t) => {
        if (t < 0.15) return 1.4 - t * 2.0;
        if (t > 0.8) return 0.8 + (t - 0.8) * 1.5;
        return 0.9 - (t - 0.15) * 0.4;
      });
      botGeo.translate(centerX, centerY - chh, 0);
      geos.push(botGeo);

      // Teardrop Finial (Bottom)
      const botTip = botPts[botPts.length - 1];
      const botCapGeo = new THREE.SphereGeometry(sBarW * 0.7, 16, 16);
      botCapGeo.scale(1.0, 1.6, 1.0);
      botCapGeo.rotateZ(-Math.PI * 0.1 * dir);
      botCapGeo.translate(centerX + botTip.x - (0.02 * dir), centerY - chh + botTip.y - 0.05, 0);
      geos.push(botCapGeo);
    }

    return geos;
  }, [style, centerX, centerY, height, width, thickness, dir, size, handleEndX]);

  return (
    <group 
      onClick={onClick} 
      onPointerOver={onPointerOver} 
      onPointerOut={onPointerOut}
    >
      {geometries.map((geo, idx) => (
        <mesh
          key={`${style}-${idx}`}
          castShadow
          receiveShadow
          material={material}
          geometry={geo}
        />
      ))}
    </group>
  );
}
