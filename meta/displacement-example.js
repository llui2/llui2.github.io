// The same Julia geometry, with contour directions sampled at three scales.
(function () {
  const views = Array.from(document.querySelectorAll('.fractal-displacement'), canvas =>
    ({ canvas, context: canvas.getContext('2d') }));
  if (!views.length || views.some(view => !view.context)) return;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const side = 48, limit = 120;
  const escape = new Uint8Array(side * side);
  const phases = new Float32Array(side * side);
  const scales = [
    { radius: 4, amplitude: 1.5, speed: 0.5, color: [222, 48, 63] },
    { radius: 2, amplitude: 1.5, speed: 0.75, color: [23, 147, 96] },
    { radius: 1, amplitude: 1.5, speed: 1.1, color: [113, 64, 199] },
  ];
  const pixels = [];
  let frame = 0, elapsed = 0, previous = 0;

  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      let real = ((x + 0.5) / side - 0.5) * 3.4;
      let imaginary = ((y + 0.5) / side - 0.5) * 3.4;
      let n = 0, cos = 0, sin = 0;
      while (real * real + imaginary * imaginary < 16 && n < limit) {
        const next = real * real - imaginary * imaginary - 0.8;
        imaginary = 2 * real * imaginary + 0.156;
        real = next;
        n += 1;
        if (n >= 5 && n <= 8) {
          const length = Math.hypot(real, imaginary) || 1;
          cos += real / length; sin += imaginary / length;
        }
      }
      escape[y * side + x] = n;
      phases[y * side + x] = Math.atan2(sin, cos);
    }
  }

  // Summed areas let the contour direction follow fine and broad structures.
  const stride = side + 1;
  const integral = new Float64Array(stride * stride);
  const cosIntegral = new Float64Array(stride * stride);
  const sinIntegral = new Float64Array(stride * stride);
  for (let y = 0; y < side; y += 1) {
    let sum = 0, cos = 0, sin = 0;
    for (let x = 0; x < side; x += 1) {
      sum += escape[y * side + x];
      cos += Math.cos(phases[y * side + x]);
      sin += Math.sin(phases[y * side + x]);
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + sum;
      cosIntegral[(y + 1) * stride + x + 1] = cosIntegral[y * stride + x + 1] + cos;
      sinIntegral[(y + 1) * stride + x + 1] = sinIntegral[y * stride + x + 1] + sin;
    }
  }
  function average(x, y, radius, source = integral) {
    const l = Math.max(0, x - radius), r = Math.min(side - 1, x + radius);
    const t = Math.max(0, y - radius), b = Math.min(side - 1, y + radius);
    return (source[(b + 1) * stride + r + 1] - source[t * stride + r + 1] -
      source[(b + 1) * stride + l] + source[t * stride + l]) / ((r - l + 1) * (b - t + 1));
  }
  for (let y = 2; y < side - 2; y += 1) {
    for (let x = 2; x < side - 2; x += 1) {
      const value = escape[y * side + x];
      if (value < 16) continue;
      const depth = Math.max(0, Math.min(1, (value - 16) / 76));
      const tone = depth < 0.23 ? 4 : depth < 0.45 ? 3 : depth < 0.68 ? 2 : depth < 0.88 ? 1 : 0;
      const directions = scales.map(({radius}) => {
        const gx = average(x + 1, y, radius) - average(x - 1, y, radius);
        const gy = average(x, y + 1, radius) - average(x, y - 1, radius);
        const length = Math.hypot(gx, gy) || 1;
        return { x: -gy / length, y: gx / length };
      });
      const localPhases = scales.map(({radius}) => Math.atan2(
        average(x, y, radius, sinIntegral), average(x, y, radius, cosIntegral)));
      pixels.push({ x, y, tone, phases: localPhases, directions,
        moving: value < limit });
    }
  }

  const zoomCanvas = document.querySelector('.fractal-pixel-zoom');
  const zoom = zoomCanvas && zoomCanvas.getContext('2d');
  // Pick a boundary cell with a well-defined broad-scale tangent.
  const selected = pixels.filter(p => p.moving && Math.hypot(p.directions[0].x, p.directions[0].y) > 0.9)
    .reduce((best, p) => !best || (p.x - 17) ** 2 + (p.y - 23) ** 2 <
      (best.x - 17) ** 2 + (best.y - 23) ** 2 ? p : best, null);

  function drawZoom() {
    if (!zoom || !selected) return;
    zoom.setTransform(2, 0, 0, 2, 0, -72);
    zoom.clearRect(0, 0, 560, 260);
    const cx = 390, cy = 130, cell = 20;
    const tangent = selected.directions[0];
    const normal = { x: -tangent.y, y: tangent.x };
    const amplitude = scales[0].amplitude;
    function gridPosition(angle) {
      return {
        x: cx + cell * Math.round(amplitude * (tangent.x * Math.sin(angle) + 0.28 * normal.x * Math.cos(angle))),
        y: cy + cell * Math.round(amplitude * (tangent.y * Math.sin(angle) + 0.28 * normal.y * Math.cos(angle))),
      };
    }
    const phase = selected.phases[0] * 0.72 - elapsed * scales[0].speed;
    const {x: px, y: py} = gridPosition(phase);

    // Locate the same cell in the full fractal on the left.
    zoom.fillStyle = '#d9dbe1';
    for (const pixel of pixels) zoom.fillRect(15 + pixel.x * 3, 85 + (pixel.y - 9) * 3, 3, 3);
    const sx = 15 + selected.x * 3 + 1.5, sy = 85 + (selected.y - 9) * 3 + 1.5;
    zoom.strokeStyle = '#b8bac6';
    zoom.lineWidth = 3;
    zoom.beginPath();
    zoom.moveTo(sx + 15, sy - 15); zoom.lineTo(cx - 92.5, cy - 92.5);
    zoom.moveTo(sx + 15, sy + 15); zoom.lineTo(cx - 92.5, cy + 92.5);
    zoom.stroke();
    zoom.strokeStyle = '#de303f';
    zoom.strokeRect(sx - 15, sy - 15, 30, 30);
    zoom.fillStyle = '#de303f';
    zoom.fillRect(sx - 2, sy - 2, 4, 4);

    // Match the two-unit pixel gap inside the three-unit border.
    zoom.strokeStyle = '#de303f';
    zoom.lineWidth = 3;
    zoom.strokeRect(cx - 92.5, cy - 92.5, 185, 185);

    // The neighbours remain fixed so only the selected pixel is moving.
    for (const pixel of pixels) {
      const dx = pixel.x - selected.x, dy = pixel.y - selected.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4 || pixel === selected) continue;
      zoom.fillStyle = '#d9dbe1';
      zoom.fillRect(cx + dx * cell - 9, cy + dy * cell - 9, 18, 18);
    }
    // Show the rounded orbit as occupied cells and a stepped path.
    const path = [];
    for (let sample = 0; sample <= 240; sample += 1) {
      const point = gridPosition(sample / 240 * Math.PI * 2);
      const previous = path[path.length - 1];
      if (!previous || point.x !== previous.x || point.y !== previous.y) path.push(point);
    }
    zoom.fillStyle = '#c8cbd3';
    for (const point of path) zoom.fillRect(point.x - 9, point.y - 9, 18, 18);
    zoom.strokeStyle = '#9096a3';
    zoom.lineWidth = 3;
    zoom.lineJoin = 'miter';
    zoom.beginPath();
    path.forEach((point, i) => {
      if (!i) zoom.moveTo(point.x, point.y);
      else {
        const previous = path[i - 1];
        // Keep each segment aligned with the pixel grid.
        if (previous.x !== point.x && previous.y !== point.y) zoom.lineTo(point.x, previous.y);
        zoom.lineTo(point.x, point.y);
      }
    });
    zoom.stroke();

    function arrow(direction, length, label, color, labelRows = 0, labelColumns = 0) {
      const x = cx + direction.x * length, y = cy + direction.y * length;
      zoom.strokeStyle = color; zoom.fillStyle = color; zoom.lineWidth = 3;
      zoom.lineCap = 'round'; zoom.lineJoin = 'round';
      zoom.beginPath();
      zoom.moveTo(x - direction.x * 7 - direction.y * 3, y - direction.y * 7 + direction.x * 3);
      zoom.lineTo(x, y);
      zoom.lineTo(x - direction.x * 7 + direction.y * 3, y - direction.y * 7 - direction.x * 3);
      zoom.moveTo(x, y);
      zoom.lineTo(cx, cy);
      zoom.stroke();
      zoom.font = '16px ui-monospace, monospace';
      zoom.textAlign = 'center';
      zoom.textBaseline = 'middle';
      const labelX = cx + cell * (Math.round(direction.x * (length + 18) / cell) + labelColumns);
      const labelY = cy + cell * (Math.round(direction.y * (length + 18) / cell) + labelRows);
      zoom.fillText(label, labelX, labelY);
    }
    arrow(tangent, 70, 'tₖ', '#0f1222');
    arrow(normal, 62, 'tₖ⊥', '#596174', 1, 1);
    zoom.fillStyle = '#0f1222';
    zoom.fillRect(cx - 2, cy - 2, 4, 4);
    zoom.font = '14px ui-monospace, monospace';
    zoom.textAlign = 'center';
    zoom.textBaseline = 'middle';
    zoom.fillText('r₀', cx + cell, cy + cell);
    zoom.fillStyle = '#de303f';
    zoom.fillRect(px - 9, py - 9, 18, 18);
  }

  function draw() {
    views.forEach(({canvas, context}, k) => {
      const {amplitude, speed, color} = scales[k];
      const tones = [0, 0.04, 0.18, 0.35, 0.55].map(light =>
        `rgb(${color.map(channel => Math.round(channel + (255 - channel) * light)).join(',')})`);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.globalAlpha = 0.18;
      context.fillStyle = `rgb(${color.join(',')})`;
      for (const pixel of pixels) context.fillRect(pixel.x, pixel.y - 9, 1, 1);
      context.globalAlpha = 1;
      for (const pixel of pixels) {
        let dx = 0, dy = 0;
        if (pixel.moving) {
          // Each view shows only its own term from the sum in r(t).
          const direction = pixel.directions[k];
          const phase = pixel.phases[k] * (0.72 + k * 0.16) - elapsed * speed;
          dx = amplitude * (direction.x * Math.sin(phase) - 0.28 * direction.y * Math.cos(phase));
          dy = amplitude * (direction.y * Math.sin(phase) + 0.28 * direction.x * Math.cos(phase));
        }
        context.fillStyle = tones[pixel.tone];
        context.fillRect(Math.round(pixel.x + dx), Math.round(pixel.y + dy) - 9, 1, 1);
      }
    });
    drawZoom();
  }
  function tick(now) {
    frame = 0;
    if (previous) elapsed += Math.min(0.1, (now - previous) / 1000);
    previous = now;
    draw();
    frame = requestAnimationFrame(tick);
  }
  function update() {
    cancelAnimationFrame(frame);
    previous = 0;
    draw();
    if (!reducedMotion.matches && !document.hidden) frame = requestAnimationFrame(tick);
  }
  document.addEventListener('visibilitychange', update);
  reducedMotion.addEventListener('change', update);
  update();
})();
