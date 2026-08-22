import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════════
// Ultra-Realistic Procedural Texture Generator (Smooth Gradient Noise)
// ═══════════════════════════════════════════════════════════════

// --- Gradient Noise (Perlin-style) for smooth, organic results ---
// Pre-compute a permutation table and gradient vectors
const PERM = new Uint8Array(512);
const GRAD: [number, number][] = [];
{
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  // Fisher-Yates shuffle with a fixed seed for deterministic results
  let seed = 42;
  const rng = () => { seed = (seed * 16807 + 0) % 2147483647; return (seed - 1) / 2147483646; };
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
  // 8 unit-circle gradient vectors
  for (let i = 0; i < 256; i++) {
    const angle = (i / 256) * Math.PI * 2;
    GRAD.push([Math.cos(angle), Math.sin(angle)]);
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function dotGrad(hash: number, x: number, y: number): number {
  const g = GRAD[hash & 255];
  return g[0] * x + g[1] * y;
}

function noise2D(x: number, y: number): number {
  const X = Math.floor(x);
  const Y = Math.floor(y);
  const xf = x - X;
  const yf = y - Y;
  const xi = X & 255;
  const yi = Y & 255;

  const u = fade(xf);
  const v = fade(yf);

  const aa = PERM[PERM[xi] + yi];
  const ab = PERM[PERM[xi] + yi + 1];
  const ba = PERM[PERM[xi + 1] + yi];
  const bb = PERM[PERM[xi + 1] + yi + 1];

  const x1 = lerp(dotGrad(aa, xf, yf), dotGrad(ba, xf - 1, yf), u);
  const x2 = lerp(dotGrad(ab, xf, yf - 1), dotGrad(bb, xf - 1, yf - 1), u);

  return lerp(x1, x2, v); // Returns roughly -1 to 1
}

// Fractal Brownian Motion for complex noise
function fbm(x: number, y: number, octaves: number, persistence = 0.5, lacunarity = 2.0) {
  let total = 0;
  let frequency = 1;
  let amplitude = 1;
  let maxValue = 0;
  for (let i = 0; i < octaves; i++) {
    total += noise2D(x * frequency, y * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  return total / maxValue;
}

// Helper to create a texture from pixel data with LINEAR filtering for smoothness
function createTextureFromData(width: number, height: number, data: Uint8ClampedArray): THREE.DataTexture {
  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 16;
  return tex;
}

// Apply a box blur pass on RGBA data to eliminate any remaining pixellation
function blurRGBA(data: Uint8ClampedArray, w: number, h: number, radius: number = 1): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let rr = 0, gg = 0, bb = 0, aa = 0, count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = (x + dx + w) % w;
          const ny = (y + dy + h) % h;
          const idx = (ny * w + nx) * 4;
          rr += data[idx]; gg += data[idx+1]; bb += data[idx+2]; aa += data[idx+3];
          count++;
        }
      }
      const oidx = (y * w + x) * 4;
      out[oidx] = rr / count;
      out[oidx+1] = gg / count;
      out[oidx+2] = bb / count;
      out[oidx+3] = aa / count;
    }
  }
  return out;
}

// Convert a grayscale height map array to a normal map array
function heightToNormalMap(width: number, height: number, heightData: Float32Array, strength: number = 2.0): Uint8ClampedArray {
  const normalData = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      // Get neighbors with wrap around
      const xl = (x - 1 + width) % width;
      const xr = (x + 1) % width;
      const yu = (y - 1 + height) % height;
      const yd = (y + 1) % height;
      
      const hL = heightData[y * width + xl];
      const hR = heightData[y * width + xr];
      const hU = heightData[yu * width + x];
      const hD = heightData[yd * width + x];
      
      // Calculate derivatives
      const dx = (hR - hL) * strength;
      const dy = (hD - hU) * strength;
      
      // Normalize vector (-dx, -dy, 1)
      const len = Math.sqrt(dx * dx + dy * dy + 1);
      const nx = -dx / len;
      const ny = -dy / len;
      const nz = 1 / len;
      
      // Convert to 0-255 RGB
      const outIdx = idx * 4;
      normalData[outIdx] = (nx * 0.5 + 0.5) * 255;
      normalData[outIdx + 1] = (ny * 0.5 + 0.5) * 255;
      normalData[outIdx + 2] = (nz * 0.5 + 0.5) * 255;
      normalData[outIdx + 3] = 255;
    }
  }
  return normalData;
}

// ----------------------------------------------------------------
// 1. Stonewash / Acid Wash (Normal & Roughness)
// ----------------------------------------------------------------
export function generateStonewashTexture() {
  const size = 512;
  const heightData = new Float32Array(size * size);
  const colorData = new Uint8ClampedArray(size * size * 4);
  const roughData = new Uint8ClampedArray(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      // Medium frequency noise for pits, not ultra-high
      const n1 = fbm(x * 0.1, y * 0.1, 3);
      // Low frequency noise for color variation
      const n2 = fbm(x * 0.01, y * 0.01, 3);
      
      // Pits and scratches (make it look weathered but not jagged)
      let h = n1 > 0.5 ? (n1 - 0.5) * 2 : 0; 
      h += noise2D(x * 0.05, y * 0.05) * 0.1;
      heightData[idx] = h;
      
      // Acid wash look (darker in pits)
      const c = 128 + n2 * 40 - (h > 0.1 ? 40 : 0);
      const cIdx = idx * 4;
      colorData[cIdx] = colorData[cIdx+1] = colorData[cIdx+2] = c;
      colorData[cIdx+3] = 255;
      
      // Roughness varies with pits
      const r = 160 + h * 80;
      roughData[cIdx] = roughData[cIdx+1] = roughData[cIdx+2] = Math.min(255, r);
      roughData[cIdx+3] = 255;
    }
  }

  // Softened from 4.0 to 1.0 to remove the diamond/glitter effect
  const normalData = heightToNormalMap(size, size, heightData, 1.0);
  
  return {
    map: createTextureFromData(size, size, colorData),
    normal: createTextureFromData(size, size, normalData),
    roughness: createTextureFromData(size, size, roughData)
  };
}

// ----------------------------------------------------------------
// 2. Damascus Steel (Color & Normal Map)
// ----------------------------------------------------------------
export function generateDamascusTexture() {
  const size = 1024;
  const heightData = new Float32Array(size * size);
  const colorData = new Uint8ClampedArray(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Domain warping for folded steel look
      const qx = fbm(x * 0.005, y * 0.005, 3);
      const qy = fbm(x * 0.005 + 5.2, y * 0.005 + 1.3, 3);
      
      // Generate sine wave pattern disturbed by noise
      const pattern = Math.sin((x * 0.01 + qx * 3) * Math.PI) * Math.cos((y * 0.01 + qy * 3) * Math.PI);
      
      // Softer bands for Damascus
      const bands = Math.abs(pattern) > 0.3 ? 1.0 : 0.0;
      
      const idx = y * size + x;
      // Height map based on bands (acid etches different layers differently)
      heightData[idx] = bands * 0.3 + fbm(x * 0.05, y * 0.05, 2) * 0.05;
      
      // Color
      const c = bands > 0.5 ? 90 : 160; // Dark grey and light grey
      const cIdx = idx * 4;
      colorData[cIdx] = colorData[cIdx+1] = colorData[cIdx+2] = c;
      colorData[cIdx+3] = 255;
    }
  }
  const normalData = heightToNormalMap(size, size, heightData, 1.0);
  
  return {
    map: createTextureFromData(size, size, colorData),
    normal: createTextureFromData(size, size, normalData)
  };
}

// ----------------------------------------------------------------
// 3. Brushed Stainless Steel (Sandvik, VG-10)
// ----------------------------------------------------------------
export function generateBrushedSteelTexture() {
  const size = 512;
  const heightData = new Float32Array(size * size);
  const colorData = new Uint8ClampedArray(size * size * 4);
  const roughData = new Uint8ClampedArray(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      
      // Satin finish: long horizontal lines, almost no vertical variation
      // We use 1D noise essentially by squashing the X frequency
      const brush = fbm(x * 0.05, y * 5.0, 3);
      const microGrain = fbm(x * 0.1, y * 10.0, 2);
      
      // Keep height variation extremely subtle so it catches light but doesn't look like rock
      heightData[idx] = brush * 0.15 + microGrain * 0.05;
      
      const c = 200 + brush * 20; 
      const cIdx = idx * 4;
      colorData[cIdx] = colorData[cIdx+1] = colorData[cIdx+2] = c;
      colorData[cIdx+3] = 255;
      
      roughData[cIdx] = roughData[cIdx+1] = roughData[cIdx+2] = 80 + brush * 40;
      roughData[cIdx+3] = 255;
    }
  }

  return {
    map: createTextureFromData(size, size, colorData),
    normal: createTextureFromData(size, size, heightToNormalMap(size, size, heightData, 0.8)), // Soft normal
    roughness: createTextureFromData(size, size, roughData)
  };
}

// ----------------------------------------------------------------
// 4. Carbon Steel Patina (1095)
// ----------------------------------------------------------------
export function generateCarbonSteelTexture() {
  const size = 512;
  const heightData = new Float32Array(size * size);
  const colorData = new Uint8ClampedArray(size * size * 4);
  const roughData = new Uint8ClampedArray(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      // Soft, broad patina clouds
      const patina = fbm(x * 0.03, y * 0.03, 3);
      // Soft pitting
      const pitting = fbm(x * 1.5, y * 1.5, 2);
      
      const isRust = patina > 0.6;
      heightData[idx] = isRust ? pitting * 0.2 : pitting * 0.05;
      
      const r = isRust ? 85 : 120 - patina * 30;
      const g = isRust ? 75 : 120 - patina * 30;
      const b = isRust ? 70 : 130 - patina * 30;
      
      const cIdx = idx * 4;
      colorData[cIdx] = r;
      colorData[cIdx+1] = g;
      colorData[cIdx+2] = b;
      colorData[cIdx+3] = 255;
      
      roughData[cIdx] = roughData[cIdx+1] = roughData[cIdx+2] = isRust ? 180 : 130;
      roughData[cIdx+3] = 255;
    }
  }

  return {
    map: createTextureFromData(size, size, colorData),
    normal: createTextureFromData(size, size, heightToNormalMap(size, size, heightData, 1.0)),
    roughness: createTextureFromData(size, size, roughData)
  };
}

// ----------------------------------------------------------------
// 5. Tool Steel (D2)
// ----------------------------------------------------------------
export function generateD2Texture() {
  const size = 512;
  const heightData = new Float32Array(size * size);
  const colorData = new Uint8ClampedArray(size * size * 4);
  const roughData = new Uint8ClampedArray(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      // D2 is known for "orange peel" when polished due to large carbides.
      // This is a medium-frequency noise, not high-frequency glitter.
      const carbide = fbm(x * 0.2, y * 0.2, 3);
      const satin = fbm(x * 0.05, y * 5.0, 2);
      
      heightData[idx] = carbide * 0.2 + satin * 0.1;
      
      const c = 140 + carbide * 20; 
      const cIdx = idx * 4;
      colorData[cIdx] = colorData[cIdx+1] = colorData[cIdx+2] = c;
      colorData[cIdx+3] = 255;
      
      roughData[cIdx] = roughData[cIdx+1] = roughData[cIdx+2] = 140 + carbide * 30;
      roughData[cIdx+3] = 255;
    }
  }

  return {
    map: createTextureFromData(size, size, colorData),
    normal: createTextureFromData(size, size, heightToNormalMap(size, size, heightData, 1.2)),
    roughness: createTextureFromData(size, size, roughData)
  };
}
export function generateWoodTexture() {
  const size = 1024;
  const heightData = new Float32Array(size * size);
  let colorData = new Uint8ClampedArray(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Normalized coordinates for smooth sampling
      const nx = x / size;
      const ny = y / size;

      // Domain warping for organic, flowing grain
      const warp1 = fbm(nx * 4, ny * 4, 5, 0.5);
      const warp2 = fbm(nx * 4 + 5.2, ny * 4 + 1.3, 5, 0.5);

      // Jacaranda: elongated grain lines running along Y
      // Use very low X frequency + moderate Y frequency for long horizontal grain
      const grainCoord = (nx * 2.0 + warp1 * 0.8) * 8.0;
      const rawGrain = Math.sin(grainCoord * Math.PI);
      // Sharpen into thin dark lines with smooth falloff
      const grain = smoothstep(0.0, 0.3, Math.abs(rawGrain));

      // Broad color variation across the surface (large-scale warmth shifts)
      const colorShift = fbm(nx * 2 + warp2 * 0.5, ny * 2, 3, 0.4) * 0.5 + 0.5;

      // Subtle pore texture (very gentle, not pointy)
      const pore = fbm(nx * 12, ny * 3, 2, 0.3) * 0.15;

      const idx = y * size + x;
      heightData[idx] = (1.0 - grain) * 0.3 + pore;

      const darkR = 35, darkG = 18, darkB = 10;
      const lightR = 120, lightG = 65, lightB = 35;
      const warmR = 140, warmG = 70, warmB = 38;

      const baseR = lerp(darkR, lerp(lightR, warmR, colorShift), grain);
      const baseG = lerp(darkG, lerp(lightG, warmG, colorShift), grain);
      const baseB = lerp(darkB, lerp(lightB, warmB, colorShift), grain);

      const cIdx = idx * 4;
      colorData[cIdx] = Math.max(0, Math.min(255, baseR + pore * 30));
      colorData[cIdx + 1] = Math.max(0, Math.min(255, baseG + pore * 15));
      colorData[cIdx + 2] = Math.max(0, Math.min(255, baseB + pore * 10));
      colorData[cIdx + 3] = 255;
    }
  }

  // Generate Roughness Map (wood grain is rougher)
  const roughData = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < heightData.length; i++) {
    const rough = 150 + heightData[i] * 100;
    const cIdx = i * 4;
    roughData[cIdx] = roughData[cIdx+1] = roughData[cIdx+2] = rough;
    roughData[cIdx+3] = 255;
  }

  colorData = blurRGBA(colorData, size, size, 2) as any;
  const normalData = heightToNormalMap(size, size, heightData, 1.5);

  return {
    map: createTextureFromData(size, size, colorData),
    normal: createTextureFromData(size, size, normalData),
    roughness: createTextureFromData(size, size, roughData)
  };
}

// ----------------------------------------------------------------
// 4. Micarta Celeron Texture
// ----------------------------------------------------------------
export function generateMicartaTexture() {
  const size = 512;
  const heightData = new Float32Array(size * size);
  let colorData = new Uint8ClampedArray(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;

      // Micarta is layers of canvas soaked in phenolic resin, then sanded.
      // The sanding exposes contour lines of the layered material.

      // 1. Broad undulating layers (topographical contour lines)
      const warp = fbm(nx * 3, ny * 3, 4, 0.5);
      const layerCoord = (nx * 6 + warp * 2.0) + (ny * 1.5);
      const layerRaw = Math.sin(layerCoord * Math.PI * 2.5);
      // Smooth contour bands
      const layer = smoothstep(-0.15, 0.15, layerRaw);

      // 2. Very subtle fabric texture (not dots, just gentle directional texture)
      const fabricX = fbm(nx * 20, ny * 6, 2, 0.3);
      const fabricY = fbm(nx * 6, ny * 20, 2, 0.3);
      const fabric = (fabricX + fabricY) * 0.08;

      const idx = y * size + x;
      heightData[idx] = (1.0 - layer) * 0.15 + fabric;

      // Micarta colors: warm brown/olive canvas alternating with darker resin bands
      const bandR = lerp(85, 115, layer);
      const bandG = lerp(70, 100, layer);
      const bandB = lerp(50, 75, layer);

      const cIdx = idx * 4;
      colorData[cIdx] = Math.max(0, Math.min(255, bandR + fabric * 60));
      colorData[cIdx + 1] = Math.max(0, Math.min(255, bandG + fabric * 50));
      colorData[cIdx + 2] = Math.max(0, Math.min(255, bandB + fabric * 40));
      colorData[cIdx + 3] = 255;
    }
  }

  // Generate Roughness Map
  const roughData = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < heightData.length; i++) {
    const rough = 120 + heightData[i] * 120;
    const cIdx = i * 4;
    roughData[cIdx] = roughData[cIdx+1] = roughData[cIdx+2] = rough;
    roughData[cIdx+3] = 255;
  }

  colorData = blurRGBA(colorData, size, size, 2) as any;
  const normalData = heightToNormalMap(size, size, heightData, 1.2);

  return {
    map: createTextureFromData(size, size, colorData),
    normal: createTextureFromData(size, size, normalData),
    roughness: createTextureFromData(size, size, roughData)
  };
}

// ----------------------------------------------------------------
// 4b. G10 Fiberglass Texture
// ----------------------------------------------------------------
export function generateG10Texture() {
  const size = 512;
  const heightData = new Float32Array(size * size);
  let colorData = new Uint8ClampedArray(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;

      // G10 is fiberglass cloth + epoxy resin, pressed into sheets and sanded.
      // Sanding reveals concentric-ish contour lines of the laminated layers.

      // 1. Laminate layers (smooth topographical bands)
      const warp = fbm(nx * 4, ny * 4, 3, 0.45);
      const layerCoord = nx * 5.0 + ny * 3.0 + warp * 1.5;
      const layerRaw = Math.sin(layerCoord * Math.PI * 3.0);
      const layer = smoothstep(-0.1, 0.1, layerRaw);

      // 2. Very fine directional texture (fiberglass weave, not dots)
      const weaveDir = fbm(nx * 30, ny * 8, 2, 0.2) * 0.05;

      const idx = y * size + x;
      heightData[idx] = layer * 0.1 + weaveDir;

      // G10 colors: dark black/charcoal alternating with medium grey layers
      const darkVal = 25 + weaveDir * 100;
      const lightVal = 80 + weaveDir * 100;
      const c = lerp(darkVal, lightVal, layer);

      const cIdx = idx * 4;
      colorData[cIdx] = Math.max(0, Math.min(255, c));
      colorData[cIdx + 1] = Math.max(0, Math.min(255, c));
      colorData[cIdx + 2] = Math.max(0, Math.min(255, c + 5)); // Slightly cooler tone
      colorData[cIdx + 3] = 255;
    }
  }

  // Generate Roughness Map
  const roughData = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < heightData.length; i++) {
    const rough = 100 + heightData[i] * 100;
    const cIdx = i * 4;
    roughData[cIdx] = roughData[cIdx+1] = roughData[cIdx+2] = rough;
    roughData[cIdx+3] = 255;
  }

  colorData = blurRGBA(colorData, size, size, 2) as any;
  const normalData = heightToNormalMap(size, size, heightData, 1.0);

  return {
    map: createTextureFromData(size, size, colorData),
    normal: createTextureFromData(size, size, normalData),
    roughness: createTextureFromData(size, size, roughData)
  };
}

// ----------------------------------------------------------------
// 5. Resin / Glossy Pattern
// ----------------------------------------------------------------
export function generateResinTexture() {
  const size = 512;
  const colorData = new Uint8ClampedArray(size * size * 4);
  const normalData = new Uint8ClampedArray(size * size * 4); // Flat normal

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Swirling resin clouds using FBM
      const qx = fbm(x * 0.01, y * 0.01, 4);
      const qy = fbm(x * 0.01 + 5.2, y * 0.01 + 1.3, 4);
      const noise = fbm(x * 0.01 + qx * 2, y * 0.01 + qy * 2, 4);
      
      // Gold flakes
      const flake = fbm(x * 0.5, y * 0.5, 2) > 0.8 ? 1.0 : 0.0;
      
      const cIdx = (y * size + x) * 4;
      if (flake > 0) {
        colorData[cIdx] = 212; // Gold R
        colorData[cIdx+1] = 175; // Gold G
        colorData[cIdx+2] = 55; // Gold B
      } else {
        // Blue resin
        colorData[cIdx] = 10 + noise * 40;
        colorData[cIdx+1] = 25 + noise * 125;
        colorData[cIdx+2] = 47 + noise * 200;
      }
      colorData[cIdx+3] = 255;

      // Flat normal (0.5, 0.5, 1.0 in RGB)
      normalData[cIdx] = 128;
      normalData[cIdx+1] = 128;
      normalData[cIdx+2] = 255;
      normalData[cIdx+3] = 255;
    }
  }

  return {
    map: createTextureFromData(size, size, colorData),
    normal: createTextureFromData(size, size, normalData)
  };
}
