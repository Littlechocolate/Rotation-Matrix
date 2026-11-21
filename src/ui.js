import { I18N } from './i18n.js';
import {
  computeRotation,
  fmtCoord,
  fmtDeg,
  fmtNum,
  matrixCells,
  vecNorm
} from './math.js';

export function createUI(sceneCtrl) {
  const state = {
    lang: 'en',
    vx: 2,
    vy: 1,
    vz: 1,
    ax: 30,
    ay: 45,
    az: 60,
    matrixMode: 'symbolic',
    showSteps: true,
    showAxis: true,
    animating: false
  };

  const ANG_IDS = ['ax', 'ay', 'az'];
  const stepsEl = document.getElementById('steps');
  const eulerReadoutEl = document.getElementById('eulerReadout');
  const gimbalNoteEl = document.getElementById('gimbalNote');
  const matricesEl = document.getElementById('matrices');
  const animBtn = document.getElementById('animateBtn');
  const langSeg = document.getElementById('langSeg');
  const legendV1 = document.getElementById('legend-v1');
  const legendV2 = document.getElementById('legend-v2');
  const legendU = document.getElementById('legend-u');

  let lastRes = null;
  let anim = null;

  function updateSliderFill(id, val) {
    const slider = document.getElementById(id);
    const row = slider.closest('.ang-row');
    const pct = ((val + 180) / 360) * 100;
    row.style.setProperty('--fill-start', `${Math.min(50, pct).toFixed(2)}%`);
    row.style.setProperty('--fill-end', `${Math.max(50, pct).toFixed(2)}%`);
  }

  function setAngleUI(id, val, roundReadout = false) {
    state[id] = val;
    document.getElementById(id).value = val;
    document.getElementById(id + 'v').textContent = roundReadout ? fmtDeg(Math.round(val)) : fmtDeg(val);
    updateSliderFill(id, val);
  }

  function syncPlayButton() {
    const t = I18N[state.lang];
    const allZero = [state.ax, state.ay, state.az].every((a) => Math.abs(a) < 1e-6);
    if (state.animating) {
      animBtn.disabled = false;
      animBtn.textContent = t.stop;
      animBtn.classList.add('active');
      animBtn.removeAttribute('title');
    } else {
      animBtn.disabled = allZero;
      animBtn.textContent = t.play;
      animBtn.classList.remove('active');
      if (allZero) {
        animBtn.setAttribute('title', t.playDisabledHint);
      } else {
        animBtn.removeAttribute('title');
      }
    }
  }

  function renderSteps(vs) {
    const f = (v) => `(${fmtCoord(v[0])}, ${fmtCoord(v[1])}, ${fmtCoord(v[2])})`;
    const rows = [
      ['v<sub>0</sub>', vs[0]],
      ['v<sub>1</sub> = R<sub>x</sub>v<sub>0</sub>', vs[1]],
      ['v<sub>2</sub> = R<sub>y</sub>v<sub>1</sub>', vs[2]],
      ['v′ = R<sub>z</sub>v<sub>2</sub>', vs[3]]
    ];
    stepsEl.innerHTML = rows
      .map(
        ([expr, vec], i) =>
          `<div class="step-row${i === 3 ? ' final' : ''}"><span class="step-expr">${expr}</span><span class="step-val">${f(vec)}</span></div>`
      )
      .join('');
  }

  function renderEuler(axisAngle, gimbalLock) {
    const t = I18N[state.lang];
    if (axisAngle.isIdentity) {
      eulerReadoutEl.innerHTML = `<div class="euler-identity">${t.identity}</div>`;
    } else {
      const [ux, uy, uz] = axisAngle.axis;
      const uStr = `(${fmtCoord(ux)}, ${fmtCoord(uy)}, ${fmtCoord(uz)})`;
      eulerReadoutEl.innerHTML = `
        <div class="euler-row"><span>û</span><span>${uStr}</span></div>
        <div class="euler-row"><span>φ</span><span>${fmtDeg(axisAngle.angleDeg)}</span></div>
      `;
    }

    if (gimbalLock.locked) {
      const prefix = gimbalLock.sign > 0 ? t.gimbalNotePos : t.gimbalNoteNeg;
      gimbalNoteEl.textContent = `${prefix} ${fmtDeg(gimbalLock.effectiveDeg)}`;
      gimbalNoteEl.hidden = false;
    } else {
      gimbalNoteEl.hidden = true;
    }
  }

  function renderMatrices(R) {
    const axisColors = { X: 'var(--x)', Y: 'var(--y)', Z: 'var(--z)' };
    const ang = { X: state.ax, Y: state.ay, Z: state.az };
    const isSymbolic = state.matrixMode === 'symbolic';

    const makeBlock = (name, dotColor, rightText, cells, gridMode) => {
      const b = document.createElement('div');
      b.className = 'matrix-block';
      b.innerHTML = `
        <div class="matrix-head">
          <span class="matrix-name"><i class="matrix-dot" style="background:${dotColor}"></i><span>${name}</span></span>
          ${rightText ? `<span class="matrix-angle">${rightText}</span>` : ''}
        </div>
        <div class="matbox">
          <div class="bracket l"></div>
          <div class="matgrid ${gridMode}">${cells.map((v) => `<span>${v}</span>`).join('')}</div>
          <div class="bracket r"></div>
        </div>
      `;
      return b;
    };

    matricesEl.innerHTML = '';
    ['Z', 'Y', 'X'].forEach((a) => {
      const k = a.toLowerCase();
      matricesEl.appendChild(
        makeBlock(
          `R<sub>${k}</sub>`,
          axisColors[a],
          fmtDeg(ang[a]),
          matrixCells(a, ang[a], isSymbolic),
          isSymbolic ? 'symbolic' : 'numeric'
        )
      );
    });

    const compCells = R.map((v) => fmtNum(v));
    matricesEl.appendChild(
      makeBlock('R = R<sub>z</sub>R<sub>y</sub>R<sub>x</sub>', 'var(--vf)', '', compCells, 'numeric')
    );
  }

  function update() {
    const res = computeRotation(state);
    lastRes = res;

    sceneCtrl.updateScene(res, {
      ax: state.ax,
      ay: state.ay,
      az: state.az,
      showSteps: state.showSteps,
      showAxis: state.showAxis
    });

    legendV1.classList.toggle('hidden', !state.showSteps);
    legendV2.classList.toggle('hidden', !state.showSteps);
    legendU.classList.toggle('hidden', !state.showAxis || res.axisAngle.isIdentity);

    renderSteps(res.vs);
    renderEuler(res.axisAngle, res.gimbalLock);
    renderMatrices(res.R);
    syncPlayButton();
    return res;
  }

  function applyLanguage(lang) {
    const t = I18N[lang] || I18N.en;
    state.lang = lang in I18N ? lang : 'en';
    document.documentElement.lang = state.lang;
    document.title = t.title;
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n;
      if (key in t) el.textContent = t[key];
    });
    langSeg.setAttribute('aria-label', t.langGroup);
    langSeg.querySelectorAll('button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.lang === state.lang);
    });
    document.getElementById('ax').setAttribute('aria-label', t.ariaAx);
    document.getElementById('ay').setAttribute('aria-label', t.ariaAy);
    document.getElementById('az').setAttribute('aria-label', t.ariaAz);
    if (lastRes) {
      renderEuler(lastRes.axisAngle, lastRes.gimbalLock);
    }
    syncPlayButton();
  }

  function stopAnim() {
    state.animating = false;
    anim = null;
    syncPlayButton();
  }

  ['vx', 'vy', 'vz'].forEach((id) => {
    const input = document.getElementById(id);
    input.addEventListener('input', () => {
      const parsed = parseFloat(input.value);
      state[id] = Number.isFinite(parsed) ? parsed : 0;
      update();
    });
  });

  ANG_IDS.forEach((id) => {
    const slider = document.getElementById(id);
    const valEl = document.getElementById(id + 'v');
    updateSliderFill(id, state[id]);

    slider.addEventListener('input', () => {
      if (state.animating) stopAnim();
      setAngleUI(id, parseFloat(slider.value));
      update();
    });

    const openEditor = () => {
      if (valEl.querySelector('input')) return;
      if (state.animating) stopAnim();
      const prev = state[id];
      const input = document.createElement('input');
      input.type = 'number';
      input.step = 'any';
      input.min = '-180';
      input.max = '180';
      input.value = String(prev);
      valEl.textContent = '';
      valEl.appendChild(input);
      input.focus();
      input.select();

      let done = false;
      const finish = (commit) => {
        if (done) return;
        done = true;
        let n = prev;
        if (commit) {
          const parsed = parseFloat(input.value);
          if (Number.isFinite(parsed)) {
            n = Math.max(-180, Math.min(180, parsed));
          }
        }
        setAngleUI(id, n);
        update();
      };

      input.addEventListener('blur', () => finish(true));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          finish(true);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          finish(false);
        }
      });
    };

    valEl.addEventListener('click', openEditor);
    valEl.addEventListener('keydown', (e) => {
      if (e.target !== valEl) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openEditor();
      }
    });
  });

  langSeg.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyLanguage(btn.dataset.lang);
    });
  });

  document.querySelectorAll('#matModeSeg button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#matModeSeg button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.matrixMode = btn.dataset.mode;
      update();
    });
  });

  document.getElementById('showSteps').addEventListener('change', (e) => {
    state.showSteps = e.target.checked;
    update();
  });

  document.getElementById('showAxis').addEventListener('change', (e) => {
    state.showAxis = e.target.checked;
    update();
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    stopAnim();
    ANG_IDS.forEach((id) => setAngleUI(id, 0));
    sceneCtrl.clearTrail();
    update();
  });

  document.getElementById('gimbalBtn').addEventListener('click', () => {
    stopAnim();
    setAngleUI('ax', 30);
    setAngleUI('ay', 90);
    setAngleUI('az', 60);
    sceneCtrl.clearTrail();
    update();
  });

  document.getElementById('resetViewBtn').addEventListener('click', () => {
    const len = lastRes ? vecNorm(lastRes.vs[0]) : 0;
    sceneCtrl.resetView(len);
  });

  animBtn.addEventListener('click', () => {
    if (state.animating) {
      ANG_IDS.forEach((id, i) => setAngleUI(id, anim.t[i]));
      stopAnim();
      update();
      return;
    }
    const targets = [state.ax, state.ay, state.az];
    if (targets.every((a) => Math.abs(a) < 1e-6)) return;
    anim = { t: targets, phase: 0 };
    state.animating = true;
    ANG_IDS.forEach((id) => setAngleUI(id, 0, true));
    sceneCtrl.clearTrail();
    const res = update();
    sceneCtrl.pushTrailPoint(res.vs[3]);
  });

  function animateStep(dt) {
    if (!state.animating || !anim) return;
    while (anim.phase < 3 && state[ANG_IDS[anim.phase]] === anim.t[anim.phase]) {
      anim.phase++;
    }
    if (anim.phase >= 3) {
      stopAnim();
      return;
    }
    const id = ANG_IDS[anim.phase];
    const target = anim.t[anim.phase];
    const remain = target - state[id];
    const step = 60 * dt;
    const nextVal = Math.abs(remain) <= step ? target : state[id] + Math.sign(remain) * step;
    setAngleUI(id, nextVal, true);
    if (nextVal === target) {
      setAngleUI(id, target);
      anim.phase++;
      while (anim.phase < 3 && state[ANG_IDS[anim.phase]] === anim.t[anim.phase]) {
        anim.phase++;
      }
    }
    const res = update();
    sceneCtrl.pushTrailPoint(res.vs[3]);
    if (anim.phase >= 3) {
      stopAnim();
    }
  }

  applyLanguage('en');
  update();

  return { animateStep };
}
