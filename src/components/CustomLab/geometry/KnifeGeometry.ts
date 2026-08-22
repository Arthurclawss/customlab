// ═══════════════════════════════════════════════════════════════
// Custom Lab — Default Knife Geometry Profile
// ═══════════════════════════════════════════════════════════════

import type { ControlPoint, PointGroup } from '@/types/Lab';

// Helper to generate IDs
let nextId = 1;
const genId = () => `p_${Date.now()}_${nextId++}`;

const createPoint = (x: number, y: number, group: PointGroup, locked: boolean = false): ControlPoint => ({
  id: genId(),
  x,
  y,
  group,
  locked,
  selected: false,
});

/**
 * Returns a default Chef Knife profile with points centered around (0,0) or (400,300) depending on canvas mapping.
 * For simplicity, we define them in a roughly 800x300 space, and they can be centered later.
 */
export function getDefaultKnifeProfile(): ControlPoint[] {
  // A standard Chef knife profile. (x, y) coordinates.
  // Origin (0,0) could be the ricasso/guard area.
  // Let's define it roughly from X=0 (Tip) to X=800 (Pommel), Y=300 as center line.

  const points: ControlPoint[] = [];

  // Tip (1 point)
  points.push(createPoint(50, 280, 'tip'));

  // Edge (Curve from Tip to Choil)
  points.push(createPoint(120, 340, 'edge'));
  points.push(createPoint(250, 360, 'edge'));
  points.push(createPoint(400, 365, 'edge'));
  
  // Choil / Ricasso transition
  points.push(createPoint(450, 350, 'choil'));
  points.push(createPoint(460, 320, 'ricasso'));
  
  // Guard / Bolster bottom
  points.push(createPoint(470, 330, 'guard'));

  // Handle Bottom
  points.push(createPoint(550, 340, 'handle-bottom'));
  points.push(createPoint(650, 335, 'handle-bottom'));
  points.push(createPoint(720, 350, 'handle-bottom'));

  // Pommel (Back of the handle)
  points.push(createPoint(750, 320, 'pommel'));
  points.push(createPoint(745, 270, 'pommel'));

  // Handle Top
  points.push(createPoint(700, 260, 'handle-top'));
  points.push(createPoint(600, 255, 'handle-top'));
  points.push(createPoint(500, 260, 'handle-top'));

  // Guard / Bolster top
  points.push(createPoint(470, 255, 'guard'));
  
  // Spine (Back of the blade)
  points.push(createPoint(400, 250, 'spine'));
  points.push(createPoint(250, 245, 'spine'));
  points.push(createPoint(150, 255, 'spine'));

  // It should naturally close back to the tip when rendered as a closed polygon, 
  // or the renderer can draw the sections connected.

  return points;
}
