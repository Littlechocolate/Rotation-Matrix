import { createScene } from './scene.js';
import { createUI } from './ui.js';

const darkMql = window.matchMedia('(prefers-color-scheme: dark)');
const host = document.getElementById('canvasHost');
const sceneCtrl = createScene(host, darkMql.matches);
const { animateStep } = createUI(sceneCtrl);

if (darkMql.addEventListener) {
  darkMql.addEventListener('change', (e) => {
    sceneCtrl.applyTheme(e.matches);
  });
}

let lastTime = performance.now();
function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  animateStep(dt);
  sceneCtrl.render();
}

loop();
