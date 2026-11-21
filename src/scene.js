import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DEG2RAD, vecDist, vecNorm } from './math.js';

const PALETTES = {
  light: {
    bg: 0xf5f6f8,
    gridMajor: 0xd5dae2,
    gridMinor: 0xe7eaef,
    origin: 0x646b78,
    x: 0xd63d2e,
    y: 0x1f8a4c,
    z: 0x2264c4,
    v0: 0x8b93a1,
    vf: 0x16181d,
    axisU: 0x7c3aed
  },
  dark: {
    bg: 0x121418,
    gridMajor: 0x2b303b,
    gridMinor: 0x1d2129,
    origin: 0x8d95a5,
    x: 0xe66558,
    y: 0x45b572,
    z: 0x5798ec,
    v0: 0x747d8e,
    vf: 0xf2f4f8,
    axisU: 0xa78bfa
  }
};

const AXIS_LEN = 5;
const BASE_CAM = new THREE.Vector3(8.2, 5.8, 10.5);
const UP = new THREE.Vector3(0, 1, 0);
const AX = {
  X: new THREE.Vector3(1, 0, 0),
  Y: new THREE.Vector3(0, 1, 0),
  Z: new THREE.Vector3(0, 0, 1)
};

const hexStr = (n) => '#' + n.toString(16).padStart(6, '0');
const toVec3 = (arr) => new THREE.Vector3(arr[0], arr[1], arr[2]);

function orientAlong(obj, dir) {
  if (dir.y < -0.99999) {
    obj.quaternion.setFromAxisAngle(AX.X, Math.PI);
  } else {
    obj.quaternion.setFromUnitVectors(UP, dir);
  }
}

export function createScene(host, initialDark) {
  let palette = initialDark ? PALETTES.dark : PALETTES.light;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(palette.bg);
  scene.fog = new THREE.Fog(palette.bg, 22, 60);

  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 1000);
  camera.position.copy(BASE_CAM);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  host.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 4;
  controls.maxDistance = 30;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x80848c, 1.35));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
  dirLight.position.set(8, 12, 10);
  scene.add(dirLight);

  function makeAxis(color, dir) {
    const g = new THREE.Group();
    const posMat = new THREE.LineBasicMaterial({ color });
    const posLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        dir.clone().multiplyScalar(AXIS_LEN - 0.16)
      ]),
      posMat
    );
    g.add(posLine);

    const negMat = new THREE.LineDashedMaterial({
      color,
      dashSize: 0.16,
      gapSize: 0.14,
      transparent: true,
      opacity: 0.28
    });
    const negLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        dir.clone().multiplyScalar(-AXIS_LEN)
      ]),
      negMat
    );
    negLine.computeLineDistances();
    g.add(negLine);

    const coneMat = new THREE.MeshBasicMaterial({ color });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.19, 16), coneMat);
    cone.position.copy(dir).multiplyScalar(AXIS_LEN - 0.095);
    orientAlong(cone, dir);
    g.add(cone);

    g.userData.materials = [posMat, negMat, coneMat];
    return g;
  }

  const axisGroups = {
    x: makeAxis(palette.x, AX.X),
    y: makeAxis(palette.y, AX.Y),
    z: makeAxis(palette.z, AX.Z)
  };
  scene.add(axisGroups.x, axisGroups.y, axisGroups.z);

  let grid = null;
  function rebuildGrid() {
    if (grid) {
      scene.remove(grid);
      grid.geometry.dispose();
      if (Array.isArray(grid.material)) {
        grid.material.forEach((m) => m.dispose());
      } else {
        grid.material.dispose();
      }
    }
    grid = new THREE.GridHelper(AXIS_LEN * 2, 20, palette.gridMajor, palette.gridMinor);
    grid.material.transparent = true;
    grid.material.opacity = 0.72;
    scene.add(grid);
  }
  rebuildGrid();

  const originMat = new THREE.MeshBasicMaterial({ color: palette.origin });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 16), originMat));

  function drawLabelCanvas(canvas, text, colorHex) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = colorHex;
    ctx.font = 'italic 600 58px -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 64);
  }

  function makeLabel(text, colorHex, position) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    drawLabelCanvas(canvas, text, colorHex);
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
    sprite.scale.set(0.45, 0.45, 1);
    sprite.position.set(...position);
    sprite.userData = { text, canvas, texture };
    scene.add(sprite);
    return sprite;
  }

  const axisLabels = {
    x: makeLabel('x', hexStr(palette.x), [AXIS_LEN + 0.42, 0, 0]),
    y: makeLabel('y', hexStr(palette.y), [0, AXIS_LEN + 0.42, 0]),
    z: makeLabel('z', hexStr(palette.z), [0, 0, AXIS_LEN + 0.42])
  };

  function makeDashedVector(color, opacity) {
    const g = new THREE.Group();
    const lineMat = new THREE.LineDashedMaterial({
      color,
      dashSize: 0.18,
      gapSize: 0.1,
      transparent: true,
      opacity
    });
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)]),
      lineMat
    );
    line.computeLineDistances();
    const tipMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity });
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 16), tipMat);
    g.add(line, tip);
    g.userData = { dashed: true, line, tip, materials: [lineMat, tipMat] };
    return g;
  }

  function makeSolidVector(color, opacity, shaftRadius, headRadius, baseHeadLen) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.55,
      metalness: 0.06,
      transparent: opacity < 1,
      opacity
    });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(shaftRadius, shaftRadius, 1, 16), mat);
    const head = new THREE.Mesh(new THREE.ConeGeometry(headRadius, 1, 20), mat);
    g.add(shaft, head);
    g.userData = { dashed: false, shaft, head, baseHeadLen, materials: [mat] };
    return g;
  }

  function updateVector(g, vec) {
    const len = vec.length();
    if (len < 0.001) {
      g.visible = false;
      return;
    }
    g.visible = true;
    if (g.userData.dashed) {
      const pos = g.userData.line.geometry.attributes.position;
      pos.setXYZ(1, vec.x, vec.y, vec.z);
      pos.needsUpdate = true;
      g.userData.line.geometry.computeBoundingSphere();
      g.userData.line.computeLineDistances();
      g.userData.tip.position.copy(vec);
      return;
    }
    const { shaft, head, baseHeadLen } = g.userData;
    const headLen = Math.min(baseHeadLen, len * 0.35);
    const headScale = headLen / baseHeadLen;
    const shaftLen = Math.max(0, len - headLen);
    shaft.visible = shaftLen > 0.0005;
    if (shaft.visible) {
      shaft.scale.set(headScale, shaftLen, headScale);
      shaft.position.set(0, shaftLen * 0.5, 0);
    }
    head.scale.set(headScale, headLen, headScale);
    head.position.set(0, shaftLen + headLen * 0.5, 0);
    orientAlong(g, vec.clone().normalize());
  }

  const origVec = makeDashedVector(palette.v0, 0.65);
  const stepVecs = [
    makeSolidVector(palette.x, 0.62, 0.022, 0.065, 0.18),
    makeSolidVector(palette.y, 0.62, 0.022, 0.065, 0.18)
  ];
  const finalVec = makeSolidVector(palette.vf, 1.0, 0.036, 0.095, 0.26);
  scene.add(origVec, stepVecs[0], stepVecs[1], finalVec);

  function makeRotationArc(color) {
    const lineMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 });
    const line = new THREE.Line(new THREE.BufferGeometry(), lineMat);
    const sectorMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.09,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const sector = new THREE.Mesh(new THREE.BufferGeometry(), sectorMat);
    scene.add(line, sector);
    return { line, sector, materials: [lineMat, sectorMat] };
  }

  const arcs = [
    makeRotationArc(palette.x),
    makeRotationArc(palette.y),
    makeRotationArc(palette.z)
  ];

  function updateArc(arc, axisKey, v0, deg, visible) {
    const axisVec = AX[axisKey];
    const center = axisVec.clone().multiplyScalar(v0.dot(axisVec));
    const radius = v0.distanceTo(center);
    const show = visible && Math.abs(deg) > 0.01 && radius > 0.005;
    arc.line.visible = show;
    arc.sector.visible = show;
    if (!show) return;

    const n = Math.max(12, Math.ceil(Math.abs(deg) / 2));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      pts.push(v0.clone().applyAxisAngle(axisVec, (deg * DEG2RAD * i) / n));
    }
    arc.line.geometry.dispose();
    arc.line.geometry = new THREE.BufferGeometry().setFromPoints(pts);

    const verts = new Float32Array(n * 9);
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const o = i * 9;
      verts[o] = center.x;     verts[o + 1] = center.y;     verts[o + 2] = center.z;
      verts[o + 3] = a.x;      verts[o + 4] = a.y;          verts[o + 5] = a.z;
      verts[o + 6] = b.x;      verts[o + 7] = b.y;          verts[o + 8] = b.z;
    }
    arc.sector.geometry.dispose();
    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    arc.sector.geometry = sGeo;
  }

  // Euler invariant axis û + direct geodesic arc
  const eulerGroup = new THREE.Group();
  const eulerLineMat = new THREE.LineDashedMaterial({
    color: palette.axisU,
    dashSize: 0.2,
    gapSize: 0.12,
    transparent: true,
    opacity: 0.85
  });
  const eulerLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 1, 0)]),
    eulerLineMat
  );
  eulerLine.computeLineDistances();

  const eulerConeMat = new THREE.MeshBasicMaterial({ color: palette.axisU });
  const eulerCone = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.19, 16), eulerConeMat);
  const eulerLabel = makeLabel('û', hexStr(palette.axisU), [0, 1, 0]);
  eulerGroup.add(eulerLine, eulerCone, eulerLabel);
  scene.add(eulerGroup);

  const geodesicMat = new THREE.LineDashedMaterial({
    color: palette.axisU,
    dashSize: 0.12,
    gapSize: 0.1,
    transparent: true,
    opacity: 0.55
  });
  const geodesicLine = new THREE.Line(new THREE.BufferGeometry(), geodesicMat);
  scene.add(geodesicLine);

  function updateInvariantAxis(axisAngle, v0, vecLen, showAxis) {
    const show = showAxis && !axisAngle.isIdentity && axisAngle.axis !== null;
    eulerGroup.visible = show;
    if (!show) {
      geodesicLine.visible = false;
      return;
    }

    const u = toVec3(axisAngle.axis).normalize();
    const span = Math.max(AXIS_LEN * 0.92, vecLen * 1.18);
    const pStart = u.clone().multiplyScalar(-span);
    const pEnd = u.clone().multiplyScalar(span);

    const pos = eulerLine.geometry.attributes.position;
    pos.setXYZ(0, pStart.x, pStart.y, pStart.z);
    pos.setXYZ(1, pEnd.x, pEnd.y, pEnd.z);
    pos.needsUpdate = true;
    eulerLine.geometry.computeBoundingSphere();
    eulerLine.computeLineDistances();

    eulerCone.position.copy(u).multiplyScalar(span - 0.095);
    orientAlong(eulerCone, u);
    eulerLabel.position.copy(u).multiplyScalar(span + 0.36);

    const center = u.clone().multiplyScalar(v0.dot(u));
    const radius = v0.distanceTo(center);
    const showGeodesic = radius > 0.01 && Math.abs(axisAngle.angleRad) > 1e-4;
    geodesicLine.visible = showGeodesic;
    if (showGeodesic) {
      const n = Math.max(12, Math.ceil(Math.abs(axisAngle.angleDeg) / 2));
      const pts = [];
      for (let i = 0; i <= n; i++) {
        pts.push(v0.clone().applyAxisAngle(u, (axisAngle.angleRad * i) / n));
      }
      geodesicLine.geometry.dispose();
      geodesicLine.geometry = new THREE.BufferGeometry().setFromPoints(pts);
      geodesicLine.geometry.computeBoundingSphere();
      geodesicLine.computeLineDistances();
    }
  }

  // Zero-GC animation trail
  const MAX_TRAIL = 600;
  const trailBuf = new Float32Array(MAX_TRAIL * 3);
  let trailCount = 0;
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailBuf, 3));
  trailGeo.setDrawRange(0, 0);
  const trailMat = new THREE.LineBasicMaterial({ color: palette.vf, transparent: true, opacity: 0.28 });
  const trailLine = new THREE.Line(trailGeo, trailMat);
  trailLine.frustumCulled = false;
  scene.add(trailLine);

  function pushTrailPoint(p) {
    if (trailCount < MAX_TRAIL) {
      const o = trailCount * 3;
      trailBuf[o] = p[0];
      trailBuf[o + 1] = p[1];
      trailBuf[o + 2] = p[2];
      trailCount++;
    } else {
      trailBuf.copyWithin(0, 3);
      const o = (MAX_TRAIL - 1) * 3;
      trailBuf[o] = p[0];
      trailBuf[o + 1] = p[1];
      trailBuf[o + 2] = p[2];
    }
    trailGeo.attributes.position.needsUpdate = true;
    trailGeo.setDrawRange(0, trailCount);
  }

  function clearTrail() {
    trailCount = 0;
    trailGeo.setDrawRange(0, 0);
  }

  function setGroupColor(g, hex) {
    g.userData.materials.forEach((m) => m.color.setHex(hex));
  }

  function applyTheme(isDark) {
    palette = isDark ? PALETTES.dark : PALETTES.light;
    scene.background.setHex(palette.bg);
    scene.fog.color.setHex(palette.bg);
    rebuildGrid();
    originMat.color.setHex(palette.origin);
    setGroupColor(axisGroups.x, palette.x);
    setGroupColor(axisGroups.y, palette.y);
    setGroupColor(axisGroups.z, palette.z);
    ['x', 'y', 'z'].forEach((k) => {
      const spr = axisLabels[k];
      drawLabelCanvas(spr.userData.canvas, spr.userData.text, hexStr(palette[k]));
      spr.userData.texture.needsUpdate = true;
    });
    drawLabelCanvas(eulerLabel.userData.canvas, eulerLabel.userData.text, hexStr(palette.axisU));
    eulerLabel.userData.texture.needsUpdate = true;
    eulerLineMat.color.setHex(palette.axisU);
    eulerConeMat.color.setHex(palette.axisU);
    geodesicMat.color.setHex(palette.axisU);

    setGroupColor(origVec, palette.v0);
    setGroupColor(stepVecs[0], palette.x);
    setGroupColor(stepVecs[1], palette.y);
    setGroupColor(finalVec, palette.vf);
    arcs[0].materials.forEach((m) => m.color.setHex(palette.x));
    arcs[1].materials.forEach((m) => m.color.setHex(palette.y));
    arcs[2].materials.forEach((m) => m.color.setHex(palette.z));
    trailMat.color.setHex(palette.vf);
  }

  function updateScene(res, opts) {
    const [a0, a1, a2, a3] = res.vs;
    const v0 = toVec3(a0);
    const v1 = toVec3(a1);
    const v2 = toVec3(a2);
    const v3 = toVec3(a3);
    const vecLen = vecNorm(a0);

    controls.maxDistance = Math.max(30, vecLen * 5.5);
    scene.fog.near = Math.max(22, vecLen * 2.5);
    scene.fog.far = Math.max(60, vecLen * 6.5);

    updateVector(origVec, v0);
    updateVector(finalVec, v3);
    updateVector(stepVecs[0], v1);
    updateVector(stepVecs[1], v2);

    // Avoid z-fighting when intermediate step coincides with v0, previous step, or final v'
    stepVecs[0].visible =
      stepVecs[0].visible &&
      opts.showSteps &&
      Math.abs(opts.ax) > 0.01 &&
      vecDist(a1, a0) > 0.01 &&
      vecDist(a1, a3) > 0.01;
    stepVecs[1].visible =
      stepVecs[1].visible &&
      opts.showSteps &&
      Math.abs(opts.ay) > 0.01 &&
      vecDist(a2, a1) > 0.01 &&
      vecDist(a2, a3) > 0.01;

    updateArc(arcs[0], 'X', v0, opts.ax, opts.showSteps);
    updateArc(arcs[1], 'Y', v1, opts.ay, opts.showSteps);
    updateArc(arcs[2], 'Z', v2, opts.az, opts.showSteps);

    updateInvariantAxis(res.axisAngle, v0, vecLen, opts.showAxis);
  }

  function resetView(vecLen = 0) {
    controls.target.set(0, 0, 0);
    const scale = Math.max(1, (vecLen * 1.35) / AXIS_LEN);
    camera.position.copy(BASE_CAM).multiplyScalar(scale);
    controls.update();
  }

  function resize() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    renderer.render(scene, camera);
  }

  new ResizeObserver(resize).observe(host);
  resize();

  function render() {
    controls.update();
    renderer.render(scene, camera);
  }

  return {
    updateScene,
    pushTrailPoint,
    clearTrail,
    resetView,
    applyTheme,
    render
  };
}
