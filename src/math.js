export const DEG2RAD = Math.PI / 180;

export const AXIS_VECTORS = {
  X: [1, 0, 0],
  Y: [0, 1, 0],
  Z: [0, 0, 1]
};

export function rotX(t) {
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [1, 0, 0, 0, c, -s, 0, s, c];
}

export function rotY(t) {
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
}

export function rotZ(t) {
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

export function matMul(A, B) {
  return [
    A[0] * B[0] + A[1] * B[3] + A[2] * B[6],
    A[0] * B[1] + A[1] * B[4] + A[2] * B[7],
    A[0] * B[2] + A[1] * B[5] + A[2] * B[8],

    A[3] * B[0] + A[4] * B[3] + A[5] * B[6],
    A[3] * B[1] + A[4] * B[4] + A[5] * B[7],
    A[3] * B[2] + A[4] * B[5] + A[5] * B[8],

    A[6] * B[0] + A[7] * B[3] + A[8] * B[6],
    A[6] * B[1] + A[7] * B[4] + A[8] * B[7],
    A[6] * B[2] + A[7] * B[5] + A[8] * B[8]
  ];
}

export function matVec(M, v) {
  return [
    M[0] * v[0] + M[1] * v[1] + M[2] * v[2],
    M[3] * v[0] + M[4] * v[1] + M[5] * v[2],
    M[6] * v[0] + M[7] * v[1] + M[8] * v[2]
  ];
}

export function matTranspose(M) {
  return [
    M[0], M[3], M[6],
    M[1], M[4], M[7],
    M[2], M[5], M[8]
  ];
}

export function matDet(M) {
  return (
    M[0] * (M[4] * M[8] - M[5] * M[7]) -
    M[1] * (M[3] * M[8] - M[5] * M[6]) +
    M[2] * (M[3] * M[7] - M[4] * M[6])
  );
}

export function matTrace(M) {
  return M[0] + M[4] + M[8];
}

export function vecDot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function vecCross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

export function vecNorm(v) {
  return Math.hypot(v[0], v[1], v[2]);
}

export function vecDist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function normalizeVec(v) {
  const n = vecNorm(v);
  return n > 1e-12 ? [v[0] / n, v[1] / n, v[2] / n] : [0, 0, 0];
}

export function rotateVecAroundAxis(v, axis, rad) {
  const k = normalizeVec(axis);
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const kxv = vecCross(k, v);
  const kdv = vecDot(k, v);
  return [
    v[0] * c + kxv[0] * s + k[0] * kdv * (1 - c),
    v[1] * c + kxv[1] * s + k[1] * kdv * (1 - c),
    v[2] * c + kxv[2] * s + k[2] * kdv * (1 - c)
  ];
}

export function rodriguesMatrix(axis, rad) {
  const [ux, uy, uz] = normalizeVec(axis);
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const k = 1 - c;
  return [
    c + ux * ux * k,      ux * uy * k - uz * s, ux * uz * k + uy * s,
    uy * ux * k + uz * s, c + uy * uy * k,      uy * uz * k - ux * s,
    uz * ux * k - uy * s, uz * uy * k + ux * s, c + uz * uz * k
  ];
}

export function extractAxisAngle(R) {
  const cosPhi = Math.max(-1, Math.min(1, (matTrace(R) - 1) * 0.5));
  const phi = Math.acos(cosPhi);
  if (phi < 1e-6) {
    return { isIdentity: true, angleRad: 0, angleDeg: 0, axis: null };
  }

  const a = [R[7] - R[5], R[2] - R[6], R[3] - R[1]];
  const aNorm = vecNorm(a);

  let axis;
  if (cosPhi >= -0.999 && aNorm > 1e-5) {
    axis = [a[0] / aNorm, a[1] / aNorm, a[2] / aNorm];
  } else {
    // Near half-turn (phi -> pi), sin(phi) vanishes; extract unit eigenvector from B = (R + R^T)/4 + I/2
    const B = [
      (R[0] + R[0]) * 0.25 + 0.5, (R[1] + R[3]) * 0.25,       (R[2] + R[6]) * 0.25,
      (R[3] + R[1]) * 0.25,       (R[4] + R[4]) * 0.25 + 0.5, (R[5] + R[7]) * 0.25,
      (R[6] + R[2]) * 0.25,       (R[7] + R[5]) * 0.25,       (R[8] + R[8]) * 0.25 + 0.5
    ];
    let k = 0;
    if (B[4] > B[0]) k = 1;
    if (B[8] > B[k * 4]) k = 2;
    const col = [B[k], B[3 + k], B[6 + k]];
    const cNorm = vecNorm(col);
    axis = cNorm > 1e-12 ? [col[0] / cNorm, col[1] / cNorm, col[2] / cNorm] : [1, 0, 0];

    if (aNorm > 1e-10) {
      if (vecDot(axis, a) < 0) axis = [-axis[0], -axis[1], -axis[2]];
    } else {
      for (let i = 0; i < 3; i++) {
        if (Math.abs(axis[i]) > 1e-8) {
          if (axis[i] < 0) axis = [-axis[0], -axis[1], -axis[2]];
          break;
        }
      }
    }
  }

  return {
    isIdentity: false,
    angleRad: phi,
    angleDeg: phi / DEG2RAD,
    axis
  };
}

export function detectGimbalLock(ay, ax, az) {
  const locked = Math.abs(Math.abs(ay) - 90) < 0.5;
  const sign = ay >= 0 ? 1 : -1;
  const effectiveDeg = sign > 0 ? ax - az : ax + az;
  return { locked, sign, effectiveDeg };
}

export function computeRotation({ vx, vy, vz, ax, ay, az }) {
  const Rx = rotX(ax * DEG2RAD);
  const Ry = rotY(ay * DEG2RAD);
  const Rz = rotZ(az * DEG2RAD);
  const v0 = [vx, vy, vz];
  const v1 = matVec(Rx, v0);
  const v2 = matVec(Ry, v1);
  const v3 = matVec(Rz, v2);
  const R = matMul(matMul(Rz, Ry), Rx);
  return {
    vs: [v0, v1, v2, v3],
    R,
    Rx,
    Ry,
    Rz,
    axisAngle: extractAxisAngle(R),
    gimbalLock: detectGimbalLock(ay, ax, az)
  };
}

export function fmtNum(n) {
  if (Math.abs(n) < 1e-10) return '0';
  if (Math.abs(n - 1) < 1e-10) return '1';
  if (Math.abs(n + 1) < 1e-10) return '−1';
  const val = Math.abs(n) < 5e-4 ? 0 : n;
  const s = val.toFixed(3);
  return s.startsWith('-') ? '−' + s.slice(1) : s;
}

export function fmtCoord(n) {
  const val = Math.abs(n) < 5e-4 ? 0 : n;
  const s = val.toFixed(3);
  return s.startsWith('-') ? '−' + s.slice(1) : s;
}

export function fmtDeg(n) {
  if (Math.abs(n) < 1e-6) return '0°';
  if (Number.isInteger(n)) {
    const s = String(n);
    return (s.startsWith('-') ? '−' + s.slice(1) : s) + '°';
  }
  const val = Math.abs(n) < 0.05 ? 0 : n;
  const s = val.toFixed(1);
  const clean = s === '-0.0' ? '0.0' : (s.startsWith('-') ? '−' + s.slice(1) : s);
  return clean + '°';
}

export function matrixCells(axis, theta, symbolic) {
  const rad = theta * DEG2RAD;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const sub = axis.toLowerCase();
  if (symbolic) {
    const cs = `cos θ<sub>${sub}</sub>`;
    const sn = `sin θ<sub>${sub}</sub>`;
    const ns = `−sin θ<sub>${sub}</sub>`;
    if (axis === 'X') return ['1', '0', '0', '0', cs, ns, '0', sn, cs];
    if (axis === 'Y') return [cs, '0', sn, '0', '1', '0', ns, '0', cs];
    return [cs, ns, '0', sn, cs, '0', '0', '0', '1'];
  }
  if (axis === 'X') return ['1', '0', '0', '0', fmtNum(c), fmtNum(-s), '0', fmtNum(s), fmtNum(c)];
  if (axis === 'Y') return [fmtNum(c), '0', fmtNum(s), '0', '1', '0', fmtNum(-s), '0', fmtNum(c)];
  return [fmtNum(c), fmtNum(-s), '0', fmtNum(s), fmtNum(c), '0', '0', '0', '1'];
}
