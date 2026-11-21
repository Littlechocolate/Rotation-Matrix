import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEG2RAD,
  computeRotation,
  detectGimbalLock,
  extractAxisAngle,
  fmtCoord,
  fmtDeg,
  fmtNum,
  matDet,
  matMul,
  matTranspose,
  matVec,
  matrixCells,
  rodriguesMatrix,
  rotX,
  rotY,
  rotZ,
  vecNorm
} from '../src/math.js';

const EPS = 1e-12;

function assertMatClose(actual, expected, tol = EPS) {
  assert.equal(actual.length, 9);
  assert.equal(expected.length, 9);
  for (let i = 0; i < 9; i++) {
    assert.ok(
      Math.abs(actual[i] - expected[i]) <= tol,
      `Matrix entry ${i}: expected ${expected[i]}, got ${actual[i]}`
    );
  }
}

function assertVecClose(actual, expected, tol = EPS) {
  assert.equal(actual.length, 3);
  assert.equal(expected.length, 3);
  for (let i = 0; i < 3; i++) {
    assert.ok(
      Math.abs(actual[i] - expected[i]) <= tol,
      `Vector entry ${i}: expected ${expected[i]}, got ${actual[i]}`
    );
  }
}

const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];

test('SO(3) orthogonality (R^T R = I) and det(R) = +1 across angle ranges', () => {
  const cases = [
    [0, 0, 0],
    [30, 45, 60],
    [-125.5, 37.25, -18.75],
    [135, -150, 172],
    [180, -90, 90],
    [180, 180, 180]
  ];

  for (const [ax, ay, az] of cases) {
    const { R } = computeRotation({ vx: 2, vy: 1, vz: 1, ax, ay, az });
    const rtR = matMul(matTranspose(R), R);
    assertMatClose(rtR, IDENTITY);
    assert.ok(Math.abs(matDet(R) - 1) <= EPS, `det(R) was ${matDet(R)} for (${ax}, ${ay}, ${az})`);
  }
});

test('Norm preservation across v0 -> v1 -> v2 -> v3', () => {
  const { vs } = computeRotation({ vx: -3.2, vy: 4.5, vz: 1.8, ax: -73, ay: 118, az: 41 });
  const n0 = vecNorm(vs[0]);
  for (let i = 1; i < vs.length; i++) {
    assert.ok(Math.abs(vecNorm(vs[i]) - n0) <= EPS);
  }
});

test('Default walkthrough values for v = (2, 1, 1) and (30, 45, 60)', () => {
  const { vs, R, axisAngle, gimbalLock } = computeRotation({
    vx: 2,
    vy: 1,
    vz: 1,
    ax: 30,
    ay: 45,
    az: 60
  });

  const d = DEG2RAD;
  const c30 = Math.cos(30 * d), s30 = Math.sin(30 * d);
  const c45 = Math.cos(45 * d), s45 = Math.sin(45 * d);
  const c60 = Math.cos(60 * d), s60 = Math.sin(60 * d);
  const expV1 = [2, c30 - s30, s30 + c30];
  const expV2 = [c45 * expV1[0] + s45 * expV1[2], expV1[1], -s45 * expV1[0] + c45 * expV1[2]];
  const expV3 = [c60 * expV2[0] - s60 * expV2[1], s60 * expV2[0] + c60 * expV2[1], expV2[2]];

  assertVecClose(vs[0], [2, 1, 1]);
  assertVecClose(vs[1], expV1);
  assertVecClose(vs[2], expV2);
  assertVecClose(vs[3], expV3);
  assertVecClose(matVec(R, vs[0]), vs[3]);
  assert.equal(gimbalLock.locked, false);
  assert.equal(axisAngle.isIdentity, false);
  assert.equal(fmtDeg(axisAngle.angleDeg), '69.4°');
  assert.equal(fmtCoord(axisAngle.axis[0]), '0.039');
  assert.equal(fmtCoord(axisAngle.axis[1]), '0.773');
  assert.equal(fmtCoord(axisAngle.axis[2]), '0.633');
});

test('Right-hand rule elementary basis rotations at special angles', () => {
  // +90 deg around X sends +Y to +Z, +Z to -Y
  assertVecClose(matVec(rotX(90 * DEG2RAD), [0, 1, 0]), [0, 0, 1]);
  assertVecClose(matVec(rotX(90 * DEG2RAD), [0, 0, 1]), [0, -1, 0]);
  // +90 deg around Y sends +Z to +X, +X to -Z
  assertVecClose(matVec(rotY(90 * DEG2RAD), [0, 0, 1]), [1, 0, 0]);
  assertVecClose(matVec(rotY(90 * DEG2RAD), [1, 0, 0]), [0, 0, -1]);
  // +90 deg around Z sends +X to +Y, +Y to -X
  assertVecClose(matVec(rotZ(90 * DEG2RAD), [1, 0, 0]), [0, 1, 0]);
  assertVecClose(matVec(rotZ(90 * DEG2RAD), [0, 1, 0]), [-1, 0, 0]);
  // 180 deg around Z sends (1, 2, 3) to (-1, -2, 3)
  assertVecClose(matVec(rotZ(-180 * DEG2RAD), [1, 2, 3]), [-1, -2, 3]);
});

test('Non-commutativity of finite 3D rotations (Rz Ry Rx != Rx Ry Rz)', () => {
  const Rx = rotX(30 * DEG2RAD);
  const Ry = rotY(45 * DEG2RAD);
  const Rz = rotZ(60 * DEG2RAD);
  const rzyx = matMul(matMul(Rz, Ry), Rx);
  const rxyz = matMul(matMul(Rx, Ry), Rz);
  const v = [2, 1, 1];
  const a = matVec(rzyx, v);
  const b = matVec(rxyz, v);
  const diff = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  assert.ok(diff > 1.0, `Expected non-commutative difference > 1.0, got ${diff}`);
});

test('Zero-vector boundary yields zero steps and valid R', () => {
  const { vs, R } = computeRotation({ vx: 0, vy: 0, vz: 0, ax: 30, ay: 45, az: 60 });
  for (const v of vs) {
    assertVecClose(v, [0, 0, 0]);
  }
  assert.ok(Math.abs(matDet(R) - 1) <= EPS);
});

test('Euler axis-angle extraction handles identity, general rotations, and phi = pi singularities', () => {
  const idRes = extractAxisAngle(IDENTITY);
  assert.equal(idRes.isIdentity, true);
  assert.equal(idRes.angleDeg, 0);
  assert.equal(idRes.axis, null);

  // Single axis negative rotation
  const ny = extractAxisAngle(rotY(-72 * DEG2RAD));
  assert.equal(ny.isIdentity, false);
  assert.ok(Math.abs(ny.angleDeg - 72) <= 1e-10);
  assertVecClose(ny.axis, [0, -1, 0], 1e-10);

  // General composite rotation: u is an eigenvector (R u = u) and Rodrigues(u, phi) reconstructs R
  const { R } = computeRotation({ vx: 1, vy: 1, vz: 1, ax: 30, ay: 45, az: 60 });
  const aa = extractAxisAngle(R);
  assert.ok(Math.abs(vecNorm(aa.axis) - 1) <= EPS);
  assertVecClose(matVec(R, aa.axis), aa.axis);
  assertMatClose(rodriguesMatrix(aa.axis, aa.angleRad), R);

  // Half-turn singularities (phi = 180 deg)
  const halfTurnMatrices = [
    computeRotation({ vx: 1, vy: 2, vz: 3, ax: 180, ay: 0, az: 0 }).R,
    computeRotation({ vx: 1, vy: 2, vz: 3, ax: 0, ay: 180, az: 0 }).R,
    computeRotation({ vx: 1, vy: 2, vz: 3, ax: 0, ay: 0, az: 180 }).R,
    computeRotation({ vx: 1, vy: 2, vz: 3, ax: 180, ay: 45, az: 0 }).R,
    computeRotation({ vx: 1, vy: 2, vz: 3, ax: 0, ay: 60, az: 180 }).R,
    computeRotation({ vx: 1, vy: 2, vz: 3, ax: 180, ay: 0, az: 90 }).R,
    rodriguesMatrix([1, 2, -2], Math.PI)
  ];
  for (const Rh of halfTurnMatrices) {
    const axisAngle = extractAxisAngle(Rh);
    assert.equal(axisAngle.isIdentity, false);
    assert.ok(Math.abs(axisAngle.angleDeg - 180) <= 1e-8);
    assert.ok(Math.abs(vecNorm(axisAngle.axis) - 1) <= EPS);
    assertVecClose(matVec(Rh, axisAngle.axis), axisAngle.axis, 1e-10);
    assertMatClose(rodriguesMatrix(axisAngle.axis, axisAngle.angleRad), Rh, 1e-10);
  }
});

test('Gimbal Lock detection and algebraic degeneracy at theta_y = +-90 deg', () => {
  // At ay = +90, R depends only on ax - az
  const g1 = computeRotation({ vx: 2, vy: 1, vz: 1, ax: 30, ay: 90, az: 60 });
  const g2 = computeRotation({ vx: 2, vy: 1, vz: 1, ax: 50, ay: 90, az: 80 });
  assert.equal(g1.gimbalLock.locked, true);
  assert.equal(g1.gimbalLock.sign, 1);
  assert.equal(g1.gimbalLock.effectiveDeg, -30);
  assert.equal(g2.gimbalLock.effectiveDeg, -30);
  assertMatClose(g1.R, g2.R);
  assertVecClose(g1.vs[3], g2.vs[3]);

  // At ay = -90, R depends only on ax + az
  const n1 = computeRotation({ vx: 2, vy: 1, vz: 1, ax: 20, ay: -90, az: 50 });
  const n2 = computeRotation({ vx: 2, vy: 1, vz: 1, ax: -10, ay: -90, az: 80 });
  assert.equal(n1.gimbalLock.locked, true);
  assert.equal(n1.gimbalLock.sign, -1);
  assert.equal(n1.gimbalLock.effectiveDeg, 70);
  assert.equal(n2.gimbalLock.effectiveDeg, 70);
  assertMatClose(n1.R, n2.R);
  assertVecClose(n1.vs[3], n2.vs[3]);

  assert.equal(detectGimbalLock(89, 30, 60).locked, false);
});

test('Formatting helpers consistently use mathematical minus (−) and suppress negative zero', () => {
  assert.equal(fmtNum(0), '0');
  assert.equal(fmtNum(-0), '0');
  assert.equal(fmtNum(-1e-12), '0');
  assert.equal(fmtNum(-0.0001), '0.000');
  assert.equal(fmtNum(-1), '−1');
  assert.equal(fmtNum(-0.5), '−0.500');

  assert.equal(fmtCoord(-0.0002), '0.000');
  assert.equal(fmtCoord(-0.4482), '−0.448');
  assert.equal(fmtCoord(2.38), '2.380');

  assert.equal(fmtDeg(-0), '0°');
  assert.equal(fmtDeg(-0.04), '0.0°');
  assert.equal(fmtDeg(-30), '−30°');
  assert.equal(fmtDeg(-45.26), '−45.3°');
  assert.equal(fmtDeg(69.356), '69.4°');

  const symX = matrixCells('X', 30, true);
  assert.equal(symX[5], '−sin θ<sub>x</sub>');
});
