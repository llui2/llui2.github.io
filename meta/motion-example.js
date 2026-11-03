// Build a Julia set with a small number of clear, nested curls.
(function () {
  const canvas = document.querySelector('.fractal-generation');
  const context = canvas && canvas.getContext('2d');
  const replay = document.querySelector('.fractal-replay');
  if (!context || !replay) return;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const side = 120, limit = 120;
  const real = new Float64Array(side * side);
  const imaginary = new Float64Array(side * side);
  const escape = new Uint8Array(side * side);
  const image = context.createImageData(side, side);
  const tones = [[222, 67, 2], [252, 76, 2], [253, 108, 48],
    [253, 144, 98], [254, 180, 149]];
  let iteration = 0, frame = 0, lastStep = 0;
  canvas.width = side; canvas.height = 64;

  function reset() {
    iteration = 0; lastStep = 0;
    escape.fill(0);
    for (let y = 0; y < side; y += 1) {
      for (let x = 0; x < side; x += 1) {
        const at = y * side + x;
        real[at] = ((x + 0.5) / side - 0.5) * 3.4;
        imaginary[at] = ((y + 0.5) / side - 0.5) * 3.4;
      }
    }
  }

  function step() {
    iteration += 1;
    for (let at = 0; at < real.length; at += 1) {
      if (escape[at]) continue;
      const x = real[at], y = imaginary[at];
      real[at] = x * x - y * y - 0.8;
      imaginary[at] = 2 * x * y + 0.156;
      if (real[at] ** 2 + imaginary[at] ** 2 >= 16) escape[at] = iteration;
    }
  }

  function draw() {
    for (let at = 0; at < escape.length; at += 1) {
      const value = escape[at];
      // The unresolved region shrinks as further iterations reveal the boundary.
      const depth = value ? Math.max(0, Math.min(1, (value - 16) / 76)) : 1;
      const tone = depth < 0.23 ? 4 : depth < 0.45 ? 3 : depth < 0.68 ? 2 : depth < 0.88 ? 1 : 0;
      const color = value && value < 16 ? [255, 255, 255] : tones[tone];
      image.data.set([...color, 255], at * 4);
    }
    context.putImageData(image, 0, -28);
  }

  function tick(now) {
    frame = 0;
    if (!lastStep || now - lastStep >= 110) {
      // Show early changes slowly, then refine the finer details faster.
      const steps = iteration < 16 ? 1 : 3;
      for (let i = 0; i < steps && iteration < limit; i += 1) step();
      lastStep = now;
      draw();
    }
    if (iteration < limit) frame = requestAnimationFrame(tick);
  }

  function start() {
    cancelAnimationFrame(frame);
    reset();
    // Start with the broad shape rather than a solid square.
    for (let i = 0; i < 3; i += 1) step();
    if (reducedMotion.matches) while (iteration < limit) step();
    draw();
    if (iteration < limit && !document.hidden) frame = requestAnimationFrame(tick);
  }
  replay.addEventListener('click', start);
  reducedMotion.addEventListener('change', start);
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(frame);
    lastStep = 0;
    if (!document.hidden && iteration < limit) frame = requestAnimationFrame(tick);
  });
  start();
})();
