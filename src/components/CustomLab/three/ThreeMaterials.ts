import * as THREE from 'three';
import { LabConfig } from '@/types/Lab';
import { 
  generateDamascusTexture, 
  generateStonewashTexture, 
  generateWoodTexture,
  generateMicartaTexture,
  generateResinTexture,
  generateBrushedSteelTexture,
  generateCarbonSteelTexture,
  generateD2Texture,
  generateG10Texture
} from './TextureGenerator';

// Reusing colors from constants where applicable
const STEEL_COLORS: Record<string, number> = {
  'carbon-1095': 0x4a3b32,      // Darker, warmer
  'd2': 0x3b4247,               // Cool dark grey
  'sandvik-14c28n': 0xc0c0c0,   // Bright silver
  'vg10': 0x9ba6b5,             // Blue-ish tint
  'damascus': 0x5a5a5a,         // Neutral grey
};

const HANDLE_COLORS: Record<string, number> = {
  'jacaranda': 0x3d2b1f,
  'resin-hybrid': 0x1c3b57,
  'micarta': 0x4a3728,
  'g10': 0x222222,
  'carbon-fiber': 0x111111,
  'brass': 0xb5a642,
  'titanium': 0x8a9a9a,
};

// Simple texture cache to avoid regenerating on every render
const textureCache: Record<string, any> = {};

export function getSteelMaterial(config: LabConfig): THREE.MeshPhysicalMaterial {
  const baseColor = STEEL_COLORS[config.steelType] || 0xa0a0a0;
  
  let metalness = 1.0;
  let roughness = 0.2;
  let map = null;
  let normalMap = null;
  let roughnessMap = null;
  let normalScale = new THREE.Vector2(1, 1);
  let clearcoat = 0.0;
  let clearcoatRoughness = 0.0;
  
  // Base Steel Textures - using actual SteelType values
  if (config.steelType === 'damascus') {
    if (!textureCache['damascus']) {
      const tex = generateDamascusTexture();
      tex.map.repeat.set(1, 1);
      tex.normal.repeat.set(1, 1);
      textureCache['damascus'] = tex;
    }
    map = textureCache['damascus'].map;
    normalMap = textureCache['damascus'].normal;
    // Damascus: Metalness: 1.0, Roughness: 0.28, Normal intensity: Medium, Clearcoat: Low
    metalness = 1.0;
    roughness = 0.28;
    normalScale.set(1.0, 1.0);
    clearcoat = 0.2;
    clearcoatRoughness = 0.1;
  } else if (config.steelType === 'carbon-1095') {
    if (!textureCache['carbon-1095']) {
      const tex = generateCarbonSteelTexture();
      tex.map.repeat.set(1, 1);
      tex.normal.repeat.set(1, 1);
      tex.roughness.repeat.set(1, 1);
      textureCache['carbon-1095'] = tex;
    }
    map = textureCache['carbon-1095'].map;
    normalMap = textureCache['carbon-1095'].normal;
    roughnessMap = textureCache['carbon-1095'].roughness;
    // 1095: Metalness: 1.0, Roughness: 0.40, Normal intensity: Low
    metalness = 1.0;
    roughness = 0.40;
    normalScale.set(0.6, 0.6);
  } else if (config.steelType === 'd2') {
    if (!textureCache['d2']) {
      const tex = generateD2Texture();
      tex.map.repeat.set(1, 1);
      tex.normal.repeat.set(1, 1);
      tex.roughness.repeat.set(1, 1);
      textureCache['d2'] = tex;
    }
    map = textureCache['d2'].map;
    normalMap = textureCache['d2'].normal;
    roughnessMap = textureCache['d2'].roughness;
    // D2: Metalness: 1.0, Roughness: 0.34, Normal intensity: Low
    metalness = 1.0;
    roughness = 0.34;
    normalScale.set(0.5, 0.5);
  } else if (config.steelType === 'sandvik-14c28n') {
    if (!textureCache['brushed']) {
      const tex = generateBrushedSteelTexture();
      tex.map.repeat.set(1, 1);
      tex.normal.repeat.set(1, 1);
      tex.roughness.repeat.set(1, 1);
      textureCache['brushed'] = tex;
    }
    map = textureCache['brushed'].map;
    normalMap = textureCache['brushed'].normal;
    roughnessMap = textureCache['brushed'].roughness;
    // Sandvik: Metalness: 1.0, Roughness: 0.20, Normal intensity: Very Low
    metalness = 1.0;
    roughness = 0.20;
    normalScale.set(0.2, 0.2);
  } else if (config.steelType === 'vg10') {
    if (!textureCache['brushed']) {
      const tex = generateBrushedSteelTexture();
      tex.map.repeat.set(1, 1);
      tex.normal.repeat.set(1, 1);
      tex.roughness.repeat.set(1, 1);
      textureCache['brushed'] = tex;
    }
    map = textureCache['brushed'].map;
    normalMap = textureCache['brushed'].normal;
    roughnessMap = textureCache['brushed'].roughness;
    // VG-10: Metalness: 1.0, Roughness: 0.18, Normal intensity: Very Low
    metalness = 1.0;
    roughness = 0.18;
    normalScale.set(0.15, 0.15);
  }
  
  // Apply Finishes (Overrides or adds to the base)
  if (config.finishType === 'mirror-polish') {
    metalness = 1.0;
    roughness = 0.1;
    clearcoat = 1.0;
    clearcoatRoughness = 0.02;
    normalScale.set(0.05, 0.05); // Almost completely flattened by polishing
  } else if (config.finishType === 'stonewash') {
    metalness = 0.8;
    roughness = 0.5;
    if (!textureCache['stonewash']) {
      const tex = generateStonewashTexture();
      tex.map.repeat.set(4, 4);
      tex.normal.repeat.set(4, 4);
      tex.roughness.repeat.set(4, 4);
      textureCache['stonewash'] = tex;
    }
    normalMap = textureCache['stonewash'].normal;
    roughnessMap = textureCache['stonewash'].roughness;
    normalScale.set(1.0, 1.0); // Medium scratching
  } else if (config.finishType === 'acid-wash') {
    metalness = 0.7;
    roughness = 0.6;
    if (!textureCache['stonewash']) {
      const tex = generateStonewashTexture();
      tex.map.repeat.set(4, 4);
      tex.normal.repeat.set(4, 4);
      tex.roughness.repeat.set(4, 4);
      textureCache['stonewash'] = tex;
    }
    normalMap = textureCache['stonewash'].normal;
    roughnessMap = textureCache['stonewash'].roughness;
    normalScale.set(0.8, 0.8); // Softer scratching after acid
  } else if (config.finishType === 'brut-de-forge') {
    metalness = 0.6;
    roughness = 0.85;
    if (!textureCache['stonewash']) {
      const tex = generateStonewashTexture();
      tex.map.repeat.set(4, 4);
      tex.normal.repeat.set(4, 4);
      tex.roughness.repeat.set(4, 4);
      textureCache['stonewash'] = tex;
    }
    normalMap = textureCache['stonewash'].normal;
    roughnessMap = textureCache['stonewash'].roughness;
    normalScale.set(1.5, 1.5); // Hammer marks, deeper but still soft enough for lighting
  }
  
  const material = new THREE.MeshPhysicalMaterial({
    color: baseColor,
    metalness: metalness,
    roughness: roughness,
    map: map,
    normalMap: normalMap,
    roughnessMap: roughnessMap,
    normalScale: normalScale,
    clearcoat: clearcoat,
    clearcoatRoughness: clearcoatRoughness,
    envMapIntensity: 1.0,
  });

  return material;
}

export function getHardwareMaterial(materialType: string): THREE.MeshPhysicalMaterial {
  let color = 0xa0a0a0;
  let roughness = 0.3;
  let metalness = 1.0;
  let clearcoat = 0.1;

  switch (materialType) {
    case 'brass':
      color = 0xb5a642; // Brass gold
      roughness = 0.3;
      break;
    case 'copper':
      color = 0xb87333; // Copper reddish
      roughness = 0.4;
      break;
    case 'titanium':
      color = 0x8a9a9a; // Titanium matte grey
      roughness = 0.6; // More matte
      clearcoat = 0.0;
      break;
    case 'steel':
    case 'stainless':
    default:
      color = 0xc0c0c0; // Stainless steel
      roughness = 0.2;
      break;
  }

  return new THREE.MeshPhysicalMaterial({
    color: color,
    metalness: metalness,
    roughness: roughness,
    clearcoat: clearcoat,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1.0,
  });
}

export function getHandleMaterial(config: LabConfig): THREE.MeshPhysicalMaterial {
  const baseColor = HANDLE_COLORS[config.handleMaterial] || 0x4a3728;
  
  let metalness = 0.1;
  let roughness = 0.7;
  let map = null;
  let normalMap = null;
  let roughnessMap = null;
  let normalScale = new THREE.Vector2(1, 1);
  let clearcoat = 0.0;
  let clearcoatRoughness = 0.0;
  let transmission = 0.0;
  let ior = 1.5;
  
  if (config.handleMaterial === 'jacaranda') {
    if (!textureCache['wood_v2']) {
      const tex = generateWoodTexture();
      tex.map.repeat.set(1.0, 1.0);
      tex.normal.repeat.set(1.0, 1.0);
      if (tex.roughness) tex.roughness.repeat.set(1.0, 1.0);
      textureCache['wood_v2'] = tex;
    }
    map = textureCache['wood_v2'].map;
    normalMap = textureCache['wood_v2'].normal;
    roughnessMap = textureCache['wood_v2'].roughness || null;
    normalScale.set(0.8, 0.8);
    roughness = 0.8;
    clearcoat = 0.1;
    clearcoatRoughness = 0.6;
  } else if (config.handleMaterial === 'micarta') {
    if (!textureCache['micarta_v2']) {
      const tex = generateMicartaTexture();
      tex.map.repeat.set(1.0, 1.0);
      tex.normal.repeat.set(1.0, 1.0);
      if (tex.roughness) tex.roughness.repeat.set(1.0, 1.0);
      textureCache['micarta_v2'] = tex;
    }
    map = textureCache['micarta_v2'].map;
    normalMap = textureCache['micarta_v2'].normal;
    roughnessMap = textureCache['micarta_v2'].roughness || null;
    normalScale.set(1.5, 1.5);
    roughness = 0.85;
  } else if (config.handleMaterial === 'g10') {
    if (!textureCache['g10_v2']) {
      const tex = generateG10Texture();
      tex.map.repeat.set(1.0, 1.0);
      tex.normal.repeat.set(1.0, 1.0);
      if (tex.roughness) tex.roughness.repeat.set(1.0, 1.0);
      textureCache['g10_v2'] = tex;
    }
    map = textureCache['g10_v2'].map;
    normalMap = textureCache['g10_v2'].normal;
    roughnessMap = textureCache['g10_v2'].roughness || null;
    normalScale.set(1.5, 1.5);
    roughness = 0.7; // G10 is slightly less rough than micarta
  } else if (config.handleMaterial === 'resin-hybrid') {
    if (!textureCache['resin']) {
      const tex = generateResinTexture();
      tex.map.repeat.set(1.0, 1.0);
      tex.normal.repeat.set(1.0, 1.0);
      textureCache['resin'] = tex;
    }
    map = textureCache['resin'].map;
    normalMap = textureCache['resin'].normal;
    metalness = 0.2;
    roughness = 0.1;
    clearcoat = 1.0;
    clearcoatRoughness = 0.02;
  } else if (config.handleMaterial === 'brass') {
    metalness = 1.0;
    roughness = 0.3;
    clearcoat = 0.3;
  } else if (config.handleMaterial === 'titanium') {
    metalness = 0.9;
    roughness = 0.45;
  }
  
  return new THREE.MeshPhysicalMaterial({
    color: map ? 0xffffff : baseColor,
    map: map,
    normalMap: normalMap,
    roughnessMap: roughnessMap,
    normalScale: normalScale,
    metalness,
    roughness,
    clearcoat,
    clearcoatRoughness,
    transmission,
    ior,
    envMapIntensity: 1.5,
  });
}

export function getPinMaterial(config: LabConfig): THREE.MeshStandardMaterial {
  let color = 0xcccccc;
  let metalness = 0.9;
  let roughness = 0.2;
  
  if (config.pinMaterial === 'brass') {
    color = 0xb5a642;
    roughness = 0.3;
  } else if (config.pinMaterial === 'mosaic') {
    color = 0xaa8833;
    roughness = 0.5;
  }
  
  return new THREE.MeshStandardMaterial({
    color,
    metalness,
    roughness,
    envMapIntensity: 1.0,
  });
}
