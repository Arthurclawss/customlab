// ═══════════════════════════════════════════════════════════════
// Catmull-Rom Spline Interpolation
// ═══════════════════════════════════════════════════════════════

export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Interpolates a Catmull-Rom spline through the given control points.
 * Returns an array of interpolated points for smooth rendering.
 *
 * @param points   - Array of control points the curve passes through
 * @param segments - Number of interpolated segments between each pair of points
 * @param closed   - Whether the curve should close back to the first point
 * @param alpha    - Tension parameter (0 = uniform, 0.5 = centripetal, 1 = chordal)
 */
export function catmullRomSpline(
  points: Vec2[],
  segments: number = 16,
  closed: boolean = false,
  alpha: number = 0.5,
): Vec2[] {
  if (points.length < 2) return [...points];

  const result: Vec2[] = [];
  const n = points.length;

  const getPoint = (i: number): Vec2 => {
    if (closed) {
      return points[((i % n) + n) % n];
    }
    if (i < 0) {
      return {
        x: points[0].x - (points[1].x - points[0].x),
        y: points[0].y - (points[1].y - points[0].y)
      };
    }
    if (i >= n) {
      return {
        x: points[n - 1].x + (points[n - 1].x - points[n - 2].x),
        y: points[n - 1].y + (points[n - 1].y - points[n - 2].y)
      };
    }
    return points[i];
  };

  const loopEnd = closed ? n : n - 1;

  for (let i = 0; i < loopEnd; i++) {
    const p0 = getPoint(i - 1);
    const p1 = getPoint(i);
    const p2 = getPoint(i + 1);
    const p3 = getPoint(i + 2);

    for (let t = 0; t < segments; t++) {
      const frac = t / segments;
      const pt = catmullRomPoint(p0, p1, p2, p3, frac, alpha);
      result.push(pt);
    }
  }

  // Add the final point
  if (!closed) {
    result.push(points[n - 1]);
  }

  return result;
}

/**
 * Computes a single point on a Catmull-Rom segment using centripetal parameterization.
 */
function catmullRomPoint(
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  t: number,
  alpha: number,
): Vec2 {
  const d1 = Math.sqrt(Math.pow(p1.x - p0.x, 2) + Math.pow(p1.y - p0.y, 2));
  const d2 = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  const d3 = Math.sqrt(Math.pow(p3.x - p2.x, 2) + Math.pow(p3.y - p2.y, 2));

  const d1a = Math.pow(d1, alpha);
  const d2a = Math.pow(d2, alpha);
  const d3a = Math.pow(d3, alpha);

  // Avoid division by zero
  const eps = 1e-6;
  const sd1a = Math.max(d1a, eps);
  const sd2a = Math.max(d2a, eps);
  const sd3a = Math.max(d3a, eps);

  const b1x = (d1a * d1a * p2.x - d2a * d2a * p0.x + (2 * d1a * d1a + 3 * d1a * d2a + d2a * d2a) * p1.x) / (3 * sd1a * (sd1a + sd2a));
  const b1y = (d1a * d1a * p2.y - d2a * d2a * p0.y + (2 * d1a * d1a + 3 * d1a * d2a + d2a * d2a) * p1.y) / (3 * sd1a * (sd1a + sd2a));

  const b2x = (d3a * d3a * p1.x - d2a * d2a * p3.x + (2 * d3a * d3a + 3 * d3a * d2a + d2a * d2a) * p2.x) / (3 * sd3a * (sd3a + sd2a));
  const b2y = (d3a * d3a * p1.y - d2a * d2a * p3.y + (2 * d3a * d3a + 3 * d3a * d2a + d2a * d2a) * p2.y) / (3 * sd3a * (sd3a + sd2a));

  // Cubic Bezier from the Catmull-Rom conversion
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    x: mt3 * p1.x + 3 * mt2 * t * b1x + 3 * mt * t2 * b2x + t3 * p2.x,
    y: mt3 * p1.y + 3 * mt2 * t * b1y + 3 * mt * t2 * b2y + t3 * p2.y,
  };
}
