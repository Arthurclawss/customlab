import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { LabConfig, ControlPoint } from '@/types/Lab';
import { catmullRomSpline } from '../geometry/CatmullRom';
import { getSteelMaterial, getHandleMaterial, getPinMaterial, getHardwareMaterial } from './ThreeMaterials';
import { getBoundingBox } from '../geometry/GeometryUtils';
import { useLabStore } from '@/store/useLabStore';
import { Guard3D } from './Guard3D';

interface ThreeKnifeProps {
  config: LabConfig;
  points: ControlPoint[];
}

export function ThreeKnife({ config, points }: ThreeKnifeProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Generate high density curve
  const curvePoints = useMemo(() => {
    // Filter out guard points so they don't deform the knife blank silhouette when dragged horizontally
    const profilePts = points.filter(p => p.group !== 'guard');
    return catmullRomSpline(profilePts, 20);
  }, [points]);

  // Compute shared normalization parameters
  const normParams = useMemo(() => {
    const bbox = getBoundingBox(curvePoints);
    const scale = 0.03;
    const cx = bbox.minX + bbox.width / 2;
    const cy = bbox.minY + bbox.height / 2;
    return { bbox, scale, cx, cy };
  }, [curvePoints]);

  const normalize = (x: number, y: number) => {
    return {
      x: (x - normParams.cx) * normParams.scale,
      y: -(y - normParams.cy) * normParams.scale,
    };
  };

  // ─── Shared Boundary Logic ───
  const handleOriginalPoints = useMemo(() => points.filter(
    p => p.group.includes('handle') || p.group === 'pommel' || p.group === 'guard'
  ), [points]);
  const bladeOriginalPoints = useMemo(() => points.filter(
    p => p.group.includes('blade') || p.group === 'tip'
  ), [points]);

  const { handleMinX, handleMaxX, handleMinXPixel, handleMaxXPixel, isBladeRight, tipX } = useMemo(() => {
    if (handleOriginalPoints.length === 0 || bladeOriginalPoints.length === 0) {
      return { handleMinX: 0, handleMaxX: 0, handleMinXPixel: 0, handleMaxXPixel: 0, isBladeRight: false, tipX: 0 };
    }
    const hMin = Math.min(...handleOriginalPoints.map(p => p.x));
    const hMax = Math.max(...handleOriginalPoints.map(p => p.x));
    const bMin = Math.min(...bladeOriginalPoints.map(p => p.x));
    const bMax = Math.max(...bladeOriginalPoints.map(p => p.x));
    
    const hCenter = (hMin + hMax) / 2;
    const bCenter = (bMin + bMax) / 2;
    const isRight = bCenter > hCenter;

    return { 
      handleMinX: (hMin - normParams.cx) * normParams.scale, 
      handleMaxX: (hMax - normParams.cx) * normParams.scale,
      handleMinXPixel: hMin,
      handleMaxXPixel: hMax,
      isBladeRight: isRight,
      tipX: (isRight ? bMax - normParams.cx : bMin - normParams.cx) * normParams.scale
    };
  }, [handleOriginalPoints, bladeOriginalPoints, normParams]);

  // ─── Build blade geometry manually with cross-section tapering ───
  const bladeGeometry = useMemo(() => {
    if (curvePoints.length < 4) return new THREE.BufferGeometry();

    const allNorm = curvePoints.map(p => normalize(p.x, p.y));

    let minXIdx = 0;
    let maxXIdx = 0;
    for (let i = 0; i < allNorm.length; i++) {
      if (allNorm[i].x < allNorm[minXIdx].x) minXIdx = i;
      if (allNorm[i].x > allNorm[maxXIdx].x) maxXIdx = i;
    }

    const topCurve: { x: number; y: number }[] = [];
    const bottomCurve: { x: number; y: number }[] = [];

    const n = allNorm.length;
    for (let i = minXIdx; ; i = (i + 1) % n) {
      topCurve.push(allNorm[i]);
      if (i === maxXIdx) break;
      if (topCurve.length > n) break;
    }
    for (let i = minXIdx; ; i = (i - 1 + n) % n) {
      bottomCurve.push(allNorm[i]);
      if (i === maxXIdx) break;
      if (bottomCurve.length > n) break;
    }

    const avgY = (arr: { y: number }[]) => arr.reduce((s, p) => s + p.y, 0) / arr.length;
    if (avgY(topCurve) < avgY(bottomCurve)) {
      const tmp = [...topCurve];
      topCurve.length = 0;
      topCurve.push(...bottomCurve);
      bottomCurve.length = 0;
      bottomCurve.push(...tmp);
    }

    const bladeThick = config.bladeThickness * 0.05;
    const halfThick = bladeThick / 2;

    const numSlices = 70;
    const xMin = allNorm[minXIdx].x;
    const xMax = allNorm[maxXIdx].x;

    const interpY = (curve: { x: number; y: number }[], targetX: number): number => {
      for (let i = 0; i < curve.length - 1; i++) {
        const a = curve[i], b = curve[i + 1];
        const ax = Math.min(a.x, b.x), bx = Math.max(a.x, b.x);
        if (targetX >= ax && targetX <= bx) {
          const t = bx === ax ? 0.5 : (targetX - a.x) / (b.x - a.x);
          return a.y + t * (b.y - a.y);
        }
      }
      return curve[curve.length - 1].y;
    };

    let grindRatio = 0.5; // How much of the blade height is the grind
    let grindSegments = 1;
    let grindCurve = 0; // 0=flat, 1=convex, -1=hollow

    switch (config.edgeType) {
      case 'flat-grind': grindRatio = 0.8; grindSegments = 1; grindCurve = 0; break;
      case 'scandi-grind': grindRatio = 0.25; grindSegments = 1; grindCurve = 0; break; // Very low
      case 'convex-grind': grindRatio = 0.6; grindSegments = 8; grindCurve = 1; break; // Bulge out
      case 'hollow-grind': grindRatio = 0.7; grindSegments = 8; grindCurve = -1; break; // Scoop in
    }

    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const crossSectionPoints = 2 + grindSegments;
    const slices: { x: number; points: { y: number; z: number }[] }[] = [];

    // Small transition zone to flatten the tang
    const tangTransitionZone = 0.5; 

    for (let s = 0; s <= numSlices; s++) {
      const t = s / numSlices;
      const x = xMin + (xMax - xMin) * t;

      let yTop = interpY(topCurve, x);
      let yBottom = interpY(bottomCurve, x);
      let bladeH = yTop - yBottom;

      // Taper thickness near the tip
      const distFromTip = Math.abs(x - tipX);
      const bladeTotalLength = Math.abs(xMax - xMin);
      const tipFactor = Math.min(1, distFromTip / (bladeTotalLength * 0.15));
      let localHalfThick = halfThick * (0.3 + 0.7 * tipFactor);

      // Tang Logic
      let isTangArea = x >= handleMinX && x <= handleMaxX;
      let tangBlend = 0;
      
      if (isTangArea) {
        // Distance to the blade side boundary
        const distToBlade = isBladeRight ? (handleMaxX - x) : (x - handleMinX);
        tangBlend = Math.min(1, distToBlade / tangTransitionZone);

        if (!config.isFullTang) {
          // Hidden tang: shrink the steel so it stays inside the handle
          yTop -= bladeH * 0.15 * tangBlend;
          yBottom += bladeH * 0.15 * tangBlend;
          localHalfThick *= (1 - 0.5 * tangBlend);
          bladeH = yTop - yBottom;
        } else {
          // Full tang: expand the tang slightly to match the handle's outward bevel
          const tangExpansion = 0.1;
          yTop += tangExpansion * tangBlend;
          yBottom -= tangExpansion * tangBlend;
          bladeH = yTop - yBottom;
        }
      }

      // If full tang, the grind flattens out into a slab
      // We interpolate the edge thickness to become the full thickness
      const edgeThickTarget = config.isFullTang ? localHalfThick : localHalfThick * 0.02;
      const edgeThick = localHalfThick * 0.02 * (1 - tangBlend) + edgeThickTarget * tangBlend;
      
      const grindYTarget = config.isFullTang ? yBottom : (yBottom + bladeH * grindRatio);
      const grindY = (yBottom + bladeH * grindRatio) * (1 - tangBlend) + grindYTarget * tangBlend;

      const csPoints: { y: number; z: number }[] = [];
      csPoints.push({ y: yTop, z: localHalfThick });
      csPoints.push({ y: grindY, z: localHalfThick });

      for (let g = 1; g <= grindSegments; g++) {
        const gt = g / grindSegments;
        const gy = grindY + (yBottom - grindY) * gt;
        let gz: number;
        
        // Base linear interpolation
        const linearZ = localHalfThick + (edgeThick - localHalfThick) * gt;
        
        if (grindCurve === 0 || tangBlend > 0.9) {
          gz = linearZ; // Flat grind
        } else if (grindCurve > 0) {
          // Convex grind (bulges outward over the linear path)
          // 4t(1-t) is a parabola that is 0 at t=0 and t=1, peaking at t=0.5
          const bulge = 4 * gt * (1 - gt) * (localHalfThick * 0.3);
          gz = linearZ + bulge * (1 - tangBlend);
        } else {
          // Hollow grind (scoops inward)
          const scoop = 4 * gt * (1 - gt) * (localHalfThick * 0.6);
          gz = linearZ - scoop * (1 - tangBlend);
        }
        
        csPoints.push({ y: gy, z: Math.max(edgeThick, gz) });
      }

      slices.push({ x, points: csPoints });
    }

    const ptsPerSlice = crossSectionPoints * 2;
    let globalYMin = Infinity, globalYMax = -Infinity;
    for (const sl of slices) {
      for (const cp of sl.points) {
        if (cp.y < globalYMin) globalYMin = cp.y;
        if (cp.y > globalYMax) globalYMax = cp.y;
      }
    }
    const yRange = globalYMax - globalYMin || 1;

    for (let s = 0; s < slices.length; s++) {
      const sl = slices[s];
      const u = s / (slices.length - 1);
      for (const cp of sl.points) {
        positions.push(sl.x, cp.y, cp.z);
        uvs.push(u, (cp.y - globalYMin) / yRange);
      }
      for (const cp of sl.points) {
        positions.push(sl.x, cp.y, -cp.z);
        uvs.push(u, (cp.y - globalYMin) / yRange);
      }
    }

    for (let s = 0; s < slices.length - 1; s++) {
      const base = s * ptsPerSlice;
      const nextBase = (s + 1) * ptsPerSlice;
      const halfPts = crossSectionPoints;

      for (let p = 0; p < halfPts - 1; p++) {
        const a = base + p, b = base + p + 1, c = nextBase + p + 1, d = nextBase + p;
        indices.push(a, b, c);
        indices.push(a, c, d);
      }
      for (let p = 0; p < halfPts - 1; p++) {
        const a = base + halfPts + p, b = base + halfPts + p + 1, c = nextBase + halfPts + p + 1, d = nextBase + halfPts + p;
        indices.push(a, c, b);
        indices.push(a, d, c);
      }
      indices.push(base, nextBase, nextBase + halfPts);
      indices.push(base, nextBase + halfPts, base + halfPts);
      const fbl = base + halfPts - 1, bbl = base + halfPts * 2 - 1;
      const fbr = nextBase + halfPts - 1, bbr = nextBase + halfPts * 2 - 1;
      indices.push(fbl, bbr, fbr);
      indices.push(fbl, bbl, bbr);
    }

    const halfPts = crossSectionPoints;
    for (let p = 0; p < halfPts - 1; p++) {
      indices.push(p, halfPts + p, p + 1);
      indices.push(p + 1, halfPts + p, halfPts + p + 1);
    }
    const lastBase = (slices.length - 1) * ptsPerSlice;
    for (let p = 0; p < halfPts - 1; p++) {
      indices.push(lastBase + p, lastBase + p + 1, lastBase + halfPts + p);
      indices.push(lastBase + p + 1, lastBase + halfPts + p + 1, lastBase + halfPts + p);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [curvePoints, config.bladeThickness, config.edgeType, config.isFullTang, normParams, handleMinX]);

  // ─── Handle scales & Guard geometry ───
  const { handleLeftGeo, handleRightGeo, guardProps } = useMemo(() => {
    if (handleOriginalPoints.length < 2 || curvePoints.length < 4) {
      return { 
        handleLeftGeo: new THREE.BufferGeometry(), handleRightGeo: new THREE.BufferGeometry(),
        guardProps: null
      };
    }

    const guardOriginalPoints = points.filter(p => p.group === 'guard');
    const hasGuard = config.hasGuard && guardOriginalPoints.length > 0;
    
    let guardMaxX = -Infinity;
    let guardMinX = Infinity;
    if (hasGuard) {
       guardMaxX = Math.max(...guardOriginalPoints.map(p => p.x)) + 10;
       guardMinX = Math.min(...guardOriginalPoints.map(p => p.x)) - 10;
    }

    let hPoints: typeof curvePoints;

    if (isBladeRight) {
       const hLimit = hasGuard ? guardMinX : handleMaxXPixel + 20;
       hPoints = curvePoints.filter(p => p.x >= handleMinXPixel - 20 && p.x <= hLimit);
    } else {
       const hLimit = hasGuard ? guardMaxX : handleMinXPixel - 20;
       hPoints = curvePoints.filter(p => p.x >= hLimit && p.x <= handleMaxXPixel + 20);
    }

    const bladeHalf = config.bladeThickness * 0.05 / 2;
    const handleBevelSize = 0.06;
    const handleBevelThick = 0.04;
    const baseScaleThick = (config.handleThickness * 0.03 - config.bladeThickness * 0.05) / 2;
    const scaleThick = Math.max(0.01, baseScaleThick - handleBevelThick);

    const hShape = new THREE.Shape();
    if (hPoints.length >= 3) {
      const start = normalize(hPoints[0].x, hPoints[0].y);
      hShape.moveTo(start.x, start.y);
      for (let i = 1; i < hPoints.length; i++) {
        const pt = normalize(hPoints[i].x, hPoints[i].y);
        hShape.lineTo(pt.x, pt.y);
      }
      hShape.closePath();
    }
    
    const extSettings = {
      depth: scaleThick,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: handleBevelSize,
      bevelThickness: handleBevelThick,
    };

    const handleLeftGeo = new THREE.ExtrudeGeometry(hShape, extSettings);
    handleLeftGeo.translate(0, 0, bladeHalf + handleBevelThick);

    const handleRightGeo = new THREE.ExtrudeGeometry(hShape, extSettings);
    handleRightGeo.translate(0, 0, -(bladeHalf + scaleThick + handleBevelThick));

    // ─── Guard: single solid piece wrapping around the blade ───
    let guardProps: any = null;
    if (hasGuard) {
      // guardSize controls how much the guard extends beyond the knife profile
      // guardSize range is roughly 5-25, default 12
      const guardProtrusion = config.guardSize * 0.015; // how much it extends beyond profile
      
      // Get guard area X bounds — use tighter bounds (real bolsters are thin)
      const gMinXNorm = (guardMinX + 5 - normParams.cx) * normParams.scale;
      const gMaxXNorm = (guardMaxX - 5 - normParams.cx) * normParams.scale;
      
      // Find the knife profile height at the guard location
      const ptsAtGuard = curvePoints
         .filter(p => p.x >= guardMinX - 5 && p.x <= guardMaxX + 5)
         .map(p => normalize(p.x, p.y));
      
      let gMaxY = 0.5;
      let gMinY = -0.5;
      if (ptsAtGuard.length > 0) {
         gMaxY = Math.max(...ptsAtGuard.map(p => p.y));
         gMinY = Math.min(...ptsAtGuard.map(p => p.y));
      }
      
      const profileHeight = gMaxY - gMinY;
      const gCenterY = (gMaxY + gMinY) / 2;
      
      // Guard height = profile height + small protrusion on each side
      const gHeight = profileHeight + guardProtrusion * 2;
      
      const guardCenterX = (gMaxXNorm + gMinXNorm) / 2;
      const guardWidthX = Math.max(0.15, Math.abs(gMaxXNorm - gMinXNorm));
      const hwX = guardWidthX / 2;
      const hh = gHeight / 2;

      // Guard depth in Z — slightly thicker than the handle
      const guardThick = scaleThick + 0.03;
      const totalGuardDepth = (bladeHalf + guardThick + 0.04) * 2;
      const handleEndX = isBladeRight ? handleMinX : handleMaxX;

      guardProps = {
        style: config.guardStyle || 'bolster',
        centerX: guardCenterX,
        centerY: gCenterY,
        height: gHeight,
        width: guardWidthX,
        thickness: totalGuardDepth,
        dir: isBladeRight ? 1 : -1,
        size: config.guardSize,
        handleEndX: handleEndX,
      };
    }

    return { handleLeftGeo, handleRightGeo, guardProps };
  }, [curvePoints, points, config.bladeThickness, config.handleThickness, config.hasGuard, config.guardSize, config.guardStyle, normParams, isBladeRight, handleMinXPixel, handleMaxXPixel, handleMinX, handleMaxX]);

  // ─── Pin & Lanyard Hole positions ───
  const { pinPositions, lanyardPos } = useMemo(() => {
    if (handleOriginalPoints.length < 2) return { pinPositions: [], lanyardPos: null };

    const allNorm = curvePoints.map(p => normalize(p.x, p.y));

    // Find center Y by finding the top and bottom curve at a given X
    // and averaging them — this gives the true centerline of the handle
    const getCenterY = (targetX: number) => {
        // Collect all points near this X (wider search band for accuracy)
        const nearPts = allNorm.filter(p => Math.abs(p.x - targetX) < 0.8);
        if (nearPts.length < 2) {
          // Fallback: average of all near points
          if (nearPts.length > 0) return nearPts.reduce((s, p) => s + p.y, 0) / nearPts.length;
          return 0;
        }
        // Find min Y and max Y at this cross-section — true center is their midpoint
        const minY = Math.min(...nearPts.map(p => p.y));
        const maxY = Math.max(...nearPts.map(p => p.y));
        return (minY + maxY) / 2;
    };

    const paddingX = 1.0; // inward padding to avoid edges
    
    // Calculate guard bounds to avoid putting pins inside the guard
    const guardOriginalPoints = handleOriginalPoints.filter(p => p.group === 'guard');
    const hasGuard = config.hasGuard && guardOriginalPoints.length > 0;
    
    let guardMaxX = -Infinity;
    let guardMinX = Infinity;
    if (hasGuard) {
       guardMaxX = Math.max(...guardOriginalPoints.map(p => p.x));
       guardMinX = Math.min(...guardOriginalPoints.map(p => p.x));
    }
    
    // Calculate actual visual bounds of the handle mesh (excluding the guard)
    const guardMinXNorm = hasGuard ? (guardMinX - normParams.cx) * normParams.scale : 0;
    const guardMaxXNorm = hasGuard ? (guardMaxX - normParams.cx) * normParams.scale : 0;
    
    const actualHandleMinX = isBladeRight 
        ? handleMinX 
        : (hasGuard ? guardMaxXNorm : handleMinX);
        
    const actualHandleMaxX = isBladeRight 
        ? (hasGuard ? guardMinXNorm : handleMaxX) 
        : handleMaxX;

    let usableMinX = actualHandleMinX + paddingX;
    let usableMaxX = actualHandleMaxX - paddingX;
    
    // Allocate space for lanyard hole at the pommel (far end from blade)
    let lanyard = null;
    const lanyardOffset = 1.0;
    
    if (isBladeRight) {
       if (config.hasLanyardHole) {
           lanyard = { x: actualHandleMinX + 0.5, y: getCenterY(actualHandleMinX + 0.5) };
           usableMinX += lanyardOffset;
       }
    } else {
       if (config.hasLanyardHole) {
           lanyard = { x: actualHandleMaxX - 0.5, y: getCenterY(actualHandleMaxX - 0.5) };
           usableMaxX -= lanyardOffset;
       }
    }

    if(usableMaxX <= usableMinX) usableMaxX = usableMinX + 0.1;

    const count = config.pinCount || 0;
    const pins = [];
    
    for (let i = 0; i < count; i++) {
      // Distribute pins evenly using (i+1)/(count+1) to keep them away from edges
      const t = count === 1 ? 0.5 : (i + 1) / (count + 1);
      const px = usableMinX + (usableMaxX - usableMinX) * t;
      pins.push({ x: px, y: getCenterY(px) });
    }

    return { pinPositions: pins, lanyardPos: lanyard };
  }, [curvePoints, handleOriginalPoints, config.pinCount, config.hasLanyardHole, normParams, handleMinX, handleMaxX, isBladeRight, config.hasGuard]);

  // ─── Materials ───
  const steelMat = useMemo(() => getSteelMaterial(config), [config]);
  const handleMat = useMemo(() => getHandleMaterial(config), [config]);
  const pinMat = useMemo(() => getPinMaterial(config), [config]);
  const guardMat = useMemo(() => getHardwareMaterial(config.guardMaterial), [config.guardMaterial]);
  
  // Black matte material for the inside of the lanyard hole
  const holeMat = useMemo(() => new THREE.MeshStandardMaterial({ 
      color: 0x050505, roughness: 1, metalness: 0, side: THREE.DoubleSide
  }), []);

  const handleFullDepth = config.handleThickness * 0.03;
  const pinRadius = 0.12; // Larger, more visible pins
  const lanyardRadius = 0.20; // Larger lanyard hole
  const lanyardTubeThick = 0.05;

  return (
    <group ref={groupRef}>
      {/* Blade (custom tapered geometry) */}
      <mesh castShadow receiveShadow material={steelMat} geometry={bladeGeometry} />

      {/* Left Handle Scale */}
      <mesh castShadow receiveShadow material={handleMat} geometry={handleLeftGeo} />

      {/* Right Handle Scale */}
      <mesh castShadow receiveShadow material={handleMat} geometry={handleRightGeo} />

      {/* Guard (single solid piece wrapping around the blade) */}
      {/* Guard (Custom 3D Component) */}
      {guardProps && (
        <Guard3D 
          {...guardProps}
          material={guardMat}
          onClick={(e) => {
            e.stopPropagation();
            const currentStyle = config.guardStyle || 'bolster';
            // STANDBY: Other styles hidden for now
            const styles = ['bolster']; // 'd-guard', 'double-guard', 's-guard'
            const nextStyle = styles[(styles.indexOf(currentStyle) + 1) % styles.length];
            useLabStore.getState().updateConfig({ guardStyle: nextStyle as any });
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            document.body.style.cursor = 'default';
          }}
        />
      )}

      {/* Pins */}
      {pinPositions.map((pos, idx) => (
        <mesh
          key={`pin-${idx}`}
          position={[pos.x, pos.y, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
          receiveShadow
          material={pinMat}
        >
          {/* Over-extrude cylinder height (1.0) to guarantee piercing */}
          <cylinderGeometry args={[pinRadius, pinRadius, 1.0, 24]} />
        </mesh>
      ))}

      {/* Lanyard Hole Tube (Metallic Ring with dark interior) */}
      {lanyardPos && (
          <group position={[lanyardPos.x, lanyardPos.y, 0]} rotation={[Math.PI / 2, 0, 0]}>
              {/* Outer Metallic Tube */}
              <mesh castShadow receiveShadow material={pinMat}>
                  <cylinderGeometry args={[lanyardRadius, lanyardRadius, 1.0, 32, 1, true]} />
              </mesh>
              <mesh castShadow receiveShadow material={pinMat}>
                  <cylinderGeometry args={[lanyardRadius - lanyardTubeThick, lanyardRadius - lanyardTubeThick, 1.0, 32, 1, true]} />
              </mesh>
              {/* Ring Caps on the outside of handle */}
              <mesh position={[0, handleFullDepth/2 + 0.01, 0]} rotation={[-Math.PI/2, 0, 0]} material={pinMat}>
                  <ringGeometry args={[lanyardRadius - lanyardTubeThick, lanyardRadius, 32]} />
              </mesh>
              <mesh position={[0, -handleFullDepth/2 - 0.01, 0]} rotation={[Math.PI/2, 0, 0]} material={pinMat}>
                  <ringGeometry args={[lanyardRadius - lanyardTubeThick, lanyardRadius, 32]} />
              </mesh>
              {/* Inner Hole */}
              <mesh material={holeMat}>
                  <cylinderGeometry args={[lanyardRadius - lanyardTubeThick - 0.001, lanyardRadius - lanyardTubeThick - 0.001, 1.05, 32]} />
              </mesh>
          </group>
      )}
    </group>
  );
}
