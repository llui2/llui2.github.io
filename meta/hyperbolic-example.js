// The same Möbius interpolation used to draw the research graph edges.
(function () {
  const svg = document.querySelector('.hyperbolic-example');
  if (!svg) return;
  const pathLayer = svg.querySelector('.hyperbolic-example-paths');
  const steps = svg.querySelector('.hyperbolic-example-steps');
  // A wide triangle near the rim makes the geodesic curvature visible.
  const positions = {
    p: { x: -0.797, y: -0.46 },
    q: { x: 0.797, y: -0.46 },
    r: { x: 0, y: 0.92 },
  };
  const handles = Array.from(svg.querySelectorAll('.hyperbolic-endpoint'));
  const edges = [['p', 'q'], ['q', 'r'], ['r', 'p']].map(([source, target]) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathLayer.appendChild(path);
    const dots = Array.from({length: 2}, () => {
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('r', '3.5');
      steps.appendChild(dot);
      return dot;
    });
    return {source, target, path, dots, distance: source === 'p' ? 3.8 : source === 'q' ? 4.2 : 4.0};
  });
  let active = null;
  const keys = Object.keys(positions);
  const velocity = Object.fromEntries(keys.map(key => [key, {x: 0, y: 0}]));
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0, previous = 0, accumulator = 0;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function dot(a, b) { return a.x * b.x + a.y * b.y; }
  function add(a, b) {
    const aa = dot(a, a), bb = dot(b, b), ab = dot(a, b);
    const d = 1 + 2 * ab + aa * bb;
    return { x: ((1 + 2 * ab + bb) * a.x + (1 - aa) * b.x) / d,
      y: ((1 + 2 * ab + bb) * a.y + (1 - aa) * b.y) / d };
  }
  function interpolate(a, b, t) {
    const relative = add({ x: -a.x, y: -a.y }, b);
    const length = Math.hypot(relative.x, relative.y);
    if (length < 1e-10) return a;
    const factor = Math.tanh(t * Math.atanh(Math.min(length, 0.999999))) / length;
    return add(a, { x: relative.x * factor, y: relative.y * factor });
  }
  function screen(point) { return { x: 200 + 146 * point.x, y: 170 + 146 * point.y }; }
  function render() {
    edges.forEach(({source, target, path, dots}) => {
      const a = positions[source], b = positions[target];
      const points = Array.from({length: 81}, (_, i) => screen(interpolate(a, b, i / 80)));
      path.setAttribute('d', points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' '));
      dots.forEach((dot, i) => {
        const p = screen(interpolate(a, b, (i + 1) / (dots.length + 1)));
        dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y);
      });
    });
    handles.forEach(handle => {
      const key = handle.dataset.point, p = screen(positions[key]);
      handle.setAttribute('cx', p.x); handle.setAttribute('cy', p.y);
      handle.setAttribute('aria-description', `Disk position ${positions[key].x.toFixed(2)}, ${positions[key].y.toFixed(2)}`);

    });
  }
  function move(key, point) {
    const radius = Math.hypot(point.x, point.y);
    if (radius > 0.93) { point.x *= 0.93 / radius; point.y *= 0.93 / radius; }
    positions[key] = point;
    render();
  }
  function simulate() {
    const forces = Object.fromEntries(keys.map(key => [key, {x: 0, y: 0}]));
    keys.forEach(key => {
      const point = positions[key], radius = Math.hypot(point.x, point.y);
      if (radius > 1e-8) {
        const pull = (0.86 - radius) * 0.02;
        forces[key].x += point.x / radius * pull;
        forces[key].y += point.y / radius * pull;
      }
    });
    edges.forEach(({source, target, distance}) => {
      const a = positions[source], b = positions[target];
      const dx = b.x - a.x, dy = b.y - a.y;
      const length = Math.hypot(dx, dy) || 1e-8;
      const relative = add({x: -a.x, y: -a.y}, b);
      const separation = 2 * Math.atanh(Math.min(0.9999, Math.hypot(relative.x, relative.y)));
      const spring = (separation - distance) * 0.004;
      // The small example uses the research graph's reference-node clearance.
      const repulsion = Math.max(0, 66 / 146 - length) * 0.022;
      const force = spring - repulsion;
      forces[source].x += dx / length * force;
      forces[source].y += dy / length * force;
      forces[target].x -= dx / length * force;
      forces[target].y -= dy / length * force;
    });
    keys.forEach(key => {
      if (active && active.key === key) return;
      const v = velocity[key], f = forces[key];
      v.x = clamp((v.x + f.x) * 0.78, -0.012, 0.012);
      v.y = clamp((v.y + f.y) * 0.78, -0.012, 0.012);
      const point = positions[key];
      point.x += v.x; point.y += v.y;
      const radius = Math.hypot(point.x, point.y);
      if (radius > 0.93) { point.x *= 0.93 / radius; point.y *= 0.93 / radius; }
    });
  }
  function tick(now) {
    frame = 0;
    accumulator += previous ? Math.min(0.1, (now - previous) / 1000) : 1 / 60;
    previous = now;
    while (accumulator >= 1 / 60) { simulate(); accumulator -= 1 / 60; }
    render();
    frame = requestAnimationFrame(tick);
  }
  function syncAnimation() {
    cancelAnimationFrame(frame);
    previous = 0; accumulator = 0;
    if (!document.hidden && !reducedMotion.matches) frame = requestAnimationFrame(tick);
  }
  handles.forEach(handle => {
    handle.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault();
      active = {key: handle.dataset.point, pointerId: event.pointerId};
      velocity[active.key] = {x: 0, y: 0};
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener('pointermove', event => {
      if (!active || active.pointerId !== event.pointerId) return;
      const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
      const local = point.matrixTransform(svg.getScreenCTM().inverse());
      move(active.key, { x: (local.x - 200) / 146, y: (local.y - 170) / 146 });
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      handle.addEventListener(event, () => { active = null; });
    }
    handle.addEventListener('keydown', event => {
      const delta = {ArrowLeft: [-0.03, 0], ArrowRight: [0.03, 0], ArrowUp: [0, -0.03], ArrowDown: [0, 0.03]}[event.key];
      if (!delta) return;
      event.preventDefault();
      const key = handle.dataset.point;
      velocity[key] = {x: 0, y: 0};
      move(key, { x: positions[key].x + delta[0], y: positions[key].y + delta[1] });
    });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) active = null;
    syncAnimation();
  });
  window.addEventListener('blur', () => { active = null; });
  reducedMotion.addEventListener('change', syncAnimation);
  render();
  syncAnimation();
})();
