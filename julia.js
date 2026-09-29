// Homepage Julia boundary: the rendered cells move along their own geometry.
(function () {
  const canvas = document.querySelector(".julia-canvas");
  const main = document.querySelector("main");
  const context = canvas && canvas.getContext("2d", { alpha: true });
  if (!canvas || !main || !context) return;

  const PIXEL_SIZE = 5;
  const MAX_ITERATIONS = 120;
  const EDGE_START = 16;
  const FPS = 15;
  const STEP_TIME = 0.14;
  const TRAIL_TIME = 26;
  const SCENE_SCALE = 1.65 / 900;
  const WALK_DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const MOTION_SPEEDS = [0.24, 0.36, 0.52];
  const MOTION_STRENGTHS = [1.05, 0.68, 0.22];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  const hex = /^#[0-9a-f]{6}$/i.test(accent) ? accent : "#fc4c02";
  const orange = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const lighten = (amount) => orange.map((value) => Math.round(value + (255 - value) * amount));
  const backgroundHex = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
  const bg = /^#[0-9a-f]{6}$/i.test(backgroundHex) ? backgroundHex : "#ffffff";
  const background = [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16));
  const tones = [orange.map((v) => Math.max(0, Math.round(v * 0.88))), orange,
    lighten(0.18), lighten(0.38), lighten(0.58), background];
  let columns = 0, rows = 0, branchX = 0, textTop = 0, canvasLeft = 0, canvasTop = 0;
  let frameImage, boundary = [], fieldPixels = [], tips = [], walkers = [];
  let elapsed = 0, nextSpawn = 0.5, lastFrame = 0;
  let frameRequest = 0, resizeTimer = 0, resizePending = false;
  let hidden = document.hidden;

  function complexAt(x, y) {
    return { real: ((x + 0.5) * PIXEL_SIZE + canvasLeft - branchX) * SCENE_SCALE - 0.7,
      imaginary: ((y + 0.5) * PIXEL_SIZE + canvasTop - textTop) * SCENE_SCALE - 0.7 };
  }

  function cellAt(real, imaginary) {
    return { x: Math.round((branchX + (real + 0.7) / SCENE_SCALE - canvasLeft) / PIXEL_SIZE - 0.5),
      y: Math.round((textTop + (imaginary + 0.7) / SCENE_SCALE - canvasTop) / PIXEL_SIZE - 0.5) };
  }

  function isEdge(value) {
    return value >= EDGE_START && value < MAX_ITERATIONS;
  }

  function prepareField() {
    const nextColumns = Math.max(1, Math.ceil((window.innerWidth + 30) / PIXEL_SIZE));
    const nextRows = Math.max(1, Math.ceil((window.innerHeight + 30) / PIXEL_SIZE));
    // Exact CSS cell dimensions keep x and y world scales identical.
    canvas.style.width = `${nextColumns * PIXEL_SIZE}px`;
    canvas.style.height = `${nextRows * PIXEL_SIZE}px`;
    const bounds = canvas.getBoundingClientRect();
    const nextBranchX = main.getBoundingClientRect().left + 625;
    const nextTextTop = (parseFloat(getComputedStyle(document.body).paddingTop) || 0) + 100;
    if (nextColumns === columns && nextRows === rows &&
        nextBranchX === branchX && nextTextTop === textTop &&
        bounds.left === canvasLeft && bounds.top === canvasTop) return false;
    columns = nextColumns; rows = nextRows;
    branchX = nextBranchX; textTop = nextTextTop;
    canvasLeft = bounds.left; canvasTop = bounds.top;
    canvas.width = columns; canvas.height = rows;
    context.imageSmoothingEnabled = false;
    frameImage = context.createImageData(columns, rows);
    const escape = new Uint8Array(columns * rows);
    const smooth = new Float32Array(columns * rows);
    const orbitCos = new Float32Array(columns * rows);
    const orbitSin = new Float32Array(columns * rows);
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < columns; x += 1) {
        const position = complexAt(x, y);
        let real = position.real, imaginary = position.imaginary, iteration = 0;
        let angleX = 0, angleY = 0;
        while (real * real + imaginary * imaginary < 16 && iteration < MAX_ITERATIONS) {
          const nextReal = real * real - imaginary * imaginary - 0.5251993;
          imaginary = 2 * real * imaginary - 0.5251993;
          real = nextReal;
          iteration += 1;
          if (iteration >= 5 && iteration <= 8) {
            const length = Math.hypot(real, imaginary) || 1;
            angleX += real / length;
            angleY += imaginary / length;
          }
        }
        const at = y * columns + x;
        escape[at] = iteration;
        const angleLength = Math.hypot(angleX, angleY) || 1;
        orbitCos[at] = angleX / angleLength;
        orbitSin[at] = angleY / angleLength;
      }
    }
    for (let y = 1; y < rows - 1; y += 1) {
      for (let x = 1; x < columns - 1; x += 1) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) sum += escape[(y + dy) * columns + x + dx];
        }
        smooth[y * columns + x] = sum / 9;
      }
    }
    // Integral image makes several geometry scales cheap to sample once per resize.
    const stride = columns + 1;
    const integral = new Float64Array(stride * (rows + 1));
    const orbitCosIntegral = new Float64Array(stride * (rows + 1));
    const orbitSinIntegral = new Float64Array(stride * (rows + 1));
    for (let y = 0; y < rows; y += 1) {
      let running = 0, runningCos = 0, runningSin = 0;
      for (let x = 0; x < columns; x += 1) {
        const at = y * columns + x;
        running += smooth[at];
        runningCos += orbitCos[at];
        runningSin += orbitSin[at];
        const target = (y + 1) * stride + x + 1;
        integral[target] = integral[y * stride + x + 1] + running;
        orbitCosIntegral[target] = orbitCosIntegral[y * stride + x + 1] + runningCos;
        orbitSinIntegral[target] = orbitSinIntegral[y * stride + x + 1] + runningSin;
      }
    }
    function averageFrom(source, x, y, radius) {
      const left = Math.max(0, x - radius), right = Math.min(columns - 1, x + radius);
      const top = Math.max(0, y - radius), bottom = Math.min(rows - 1, y + radius);
      const sum = source[(bottom + 1) * stride + right + 1] -
        source[top * stride + right + 1] -
        source[(bottom + 1) * stride + left] + source[top * stride + left];
      return sum / ((right - left + 1) * (bottom - top + 1));
    }
    function average(x, y, radius) {
      return averageFrom(integral, x, y, radius);
    }
    function orbitAngle(x, y, radius) {
      return Math.atan2(averageFrom(orbitSinIntegral, x, y, radius),
        averageFrom(orbitCosIntegral, x, y, radius));
    }
    function tangent(x, y, radius) {
      const gx = average(x + 1, y, radius) - average(x - 1, y, radius);
      const gy = average(x, y + 1, radius) - average(x, y - 1, radius);
      const length = Math.hypot(gx, gy);
      return length > 0.001 ? { x: -gy / length, y: gx / length } : null;
    }
    const previousWalkers = walkers;
    boundary = [];
    fieldPixels = [];
    const candidates = [];
    for (let y = 2; y < rows - 2; y += 1) {
      for (let x = 2; x < columns - 2; x += 1) {
        const value = escape[y * columns + x];
        const field = smooth[y * columns + x];
        // The averaged escape band supplies a stepped, structural fringe.
        // It fades outward without making the Julia interior transparent.
        if (value < EDGE_START && field >= 5) {
          const weight = Math.min(1, (field - 5) / 20);
          const tone = weight < 0.1 ? 5 : weight < 0.65 ? 4 : 3;
          fieldPixels.push({ x, y, tone, alpha: Math.round(55 + 150 * weight) });
        } else if (value === MAX_ITERATIONS && field < 116) {
          const weight = Math.min(1, (116 - field) / 35);
          fieldPixels.push({ x, y, tone: weight < 0.45 ? 3 : 4,
            alpha: Math.round(155 + 85 * weight) });
        }
        if (!isEdge(value)) continue;
        const gx = smooth[y * columns + x + 1] - smooth[y * columns + x - 1];
        const gy = smooth[(y + 1) * columns + x] - smooth[(y - 1) * columns + x];
        const gradient = Math.hypot(gx, gy);
        const position = complexAt(x, y);
        const angle = Math.atan2(position.imaginary + 0.18, position.real + 0.18);
        // Color is a permanent property of the local escape field, independent
        // of amplitude, phase, speed, and current displacement.
        const depth = Math.max(0, Math.min(1, (field - EDGE_START) / 76));
        const tone = depth < 0.23 ? 4 : depth < 0.45 ? 3 :
          depth < 0.68 ? 2 : depth < 0.88 ? 1 : 0;
        const alpha = tone === 4 ? 230 : 250;
        const fine = tangent(x, y, 2);
        const medium = tangent(x, y, 7);
        const large = tangent(x, y, 18);
        const fallback = fine || medium || large || { x: 0, y: 0 };
        // Curl directions come from escape-field contours. Their smoothed
        // versions carry related angular motion through nested structures.
        const point = {
          x, y, real: position.real, imaginary: position.imaginary,
          tx: fallback.x, ty: fallback.y,
          directions: [large || fallback, medium || fallback, fine || fallback],
          phases: [orbitAngle(x, y, 18) * 0.72 + angle * 0.65,
            orbitAngle(x, y, 7) * 0.9 + angle * 1.1,
            orbitAngle(x, y, 2) * 1.05 + angle * 1.55],
          tone, alpha, detached: false,
        };
        boundary.push(point);
        let edgeNeighbors = 0, exterior = 0, nx = 0, ny = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (!dx && !dy) continue;
            const nearby = escape[(y + dy) * columns + x + dx];
            if (isEdge(nearby)) { edgeNeighbors += 1; nx += dx; ny += dy; }
            else if (nearby < EDGE_START) exterior += 1;
          }
        }
        if (value >= 22 && edgeNeighbors >= 1 && edgeNeighbors <= 5 &&
            exterior >= 2 && gradient > 2) {
          const length = Math.hypot(nx, ny) || 1;
          point.outX = -nx / length;
          point.outY = -ny / length;
          candidates.push({ point, score: gradient + (8 - edgeNeighbors) * 3 + value * 0.2 });
        }
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    tips = [];
    for (const candidate of candidates) {
      if (tips.every((point) => (point.x - candidate.point.x) ** 2 +
          (point.y - candidate.point.y) ** 2 > 36)) {
        tips.push(candidate.point);
        if (tips.length >= 220) break;
      }
    }
    // Keep walker time, position, trail and age. Reattach its source when a
    // matching Julia cell remains in the new viewport projection.
    for (const walker of previousWalkers) {
      if (!walker.active) continue;
      const source = boundary.find((point) =>
        Math.abs(point.real - walker.sourceReal) < PIXEL_SIZE * SCENE_SCALE * 0.55 &&
        Math.abs(point.imaginary - walker.sourceImaginary) < PIXEL_SIZE * SCENE_SCALE * 0.55);
      walker.source = source || null;
      if (source) source.detached = true;
    }
    return true;
  }

  function displaced(point, time) {
    let dx = 0, dy = 0;
    for (let scale = 0; scale < 3; scale += 1) {
      const angle = point.phases[scale] - time * MOTION_SPEEDS[scale];
      const distance = MOTION_STRENGTHS[scale] * Math.sin(angle);
      dx += point.directions[scale].x * distance;
      dy += point.directions[scale].y * distance;
    }
    const length = Math.hypot(dx, dy);
    if (length > 2) { dx *= 2 / length; dy *= 2 / length; }
    return { x: Math.round(point.x + dx), y: Math.round(point.y + dy) };
  }

  function spawnWalker() {
    if (walkers.filter((walker) => walker.active).length >= 35 || !tips.length) return;
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const point = tips[Math.floor(Math.random() * tips.length)];
      if (point.detached) continue;
      const location = displaced(point, elapsed);
      // One orthogonal outward step separates the source before unbiased walking.
      const outward = Math.abs(point.outX) >= Math.abs(point.outY) ?
        [Math.sign(point.outX) || 1, 0] : [0, Math.sign(point.outY) || 1];
      point.detached = true;
      const start = { real: point.real + (location.x - point.x) * PIXEL_SIZE * SCENE_SCALE,
        imaginary: point.imaginary + (location.y - point.y) * PIXEL_SIZE * SCENE_SCALE };
      const real = start.real + outward[0] * PIXEL_SIZE * SCENE_SCALE;
      const imaginary = start.imaginary + outward[1] * PIXEL_SIZE * SCENE_SCALE;
      walkers.push({ source: point, sourceReal: point.real, sourceImaginary: point.imaginary,
        tone: point.tone, alpha: point.alpha, real, imaginary,
        outX: point.outX, outY: point.outY,
        born: elapsed, lifetime: 14 + Math.random() * 6,
        nextStep: elapsed + STEP_TIME, active: true,
        trail: [{ ...start, born: elapsed }, { real, imaginary, born: elapsed }] });
      return;
    }
  }

  function moveWalker(walker) {
    // A mild cardinal-choice bias fades with distance from the source.
    // Every chosen move remains exactly one orthogonal lattice cell.
    const distance = Math.hypot(walker.real - walker.sourceReal,
      walker.imaginary - walker.sourceImaginary) / (PIXEL_SIZE * SCENE_SCALE);
    const beta = 0.65 * Math.exp(-distance / 24);
    const weights = WALK_DIRECTIONS.map(([dx, dy]) =>
      Math.exp(beta * (dx * walker.outX + dy * walker.outY)));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let draw = Math.random() * total;
    let choice = WALK_DIRECTIONS.length - 1;
    for (let i = 0; i < weights.length; i += 1) {
      draw -= weights[i];
      if (draw < 0) { choice = i; break; }
    }
    const [dx, dy] = WALK_DIRECTIONS[choice];
    walker.real += dx * PIXEL_SIZE * SCENE_SCALE;
    walker.imaginary += dy * PIXEL_SIZE * SCENE_SCALE;
    walker.trail.push({ real: walker.real, imaginary: walker.imaginary, born: elapsed });
  }

  function updateWalkers() {
    for (const walker of walkers) {
      if (walker.active && elapsed - walker.born >= walker.lifetime) {
        walker.active = false;
        if (walker.source) walker.source.detached = false;
      }
      while (walker.active && elapsed >= walker.nextStep) {
        walker.nextStep += STEP_TIME;
        moveWalker(walker);
      }
      walker.trail = walker.trail.filter((point) => elapsed - point.born < TRAIL_TIME);
    }
    walkers = walkers.filter((walker) => walker.active || walker.trail.length);
    if (elapsed >= nextSpawn) {
      spawnWalker();
      nextSpawn = elapsed + 0.48 + Math.random() * 0.08;
    }
  }

  function paintPixel(x, y, tone, alpha) {
    if (x < 0 || x >= columns || y < 0 || y >= rows || alpha <= 0) return;
    const offset = (y * columns + x) * 4;
    if (alpha <= frameImage.data[offset + 3]) return;
    const color = tones[tone];
    frameImage.data[offset] = color[0];
    frameImage.data[offset + 1] = color[1];
    frameImage.data[offset + 2] = color[2];
    frameImage.data[offset + 3] = alpha;
  }

  function drawFrame(animate) {
    if (animate) updateWalkers();
    frameImage.data.fill(0);
    for (const pixel of fieldPixels) {
      paintPixel(pixel.x, pixel.y, pixel.tone, pixel.alpha);
    }
    for (const point of boundary) {
      if (point.detached) continue;
      const location = animate ? displaced(point, elapsed) : point;
      paintPixel(location.x, location.y, point.tone, point.alpha);
    }
    if (animate) {
      for (const walker of walkers) {
        for (const point of walker.trail) {
          const age = (elapsed - point.born) / TRAIL_TIME;
          const fade = (1 - age) ** 2;
          const cell = cellAt(point.real, point.imaginary);
          paintPixel(cell.x, cell.y, walker.tone, Math.round(walker.alpha * 0.8 * fade));
        }
        if (walker.active) {
          const age = (elapsed - walker.born) / walker.lifetime;
          const fade = (1 - age) ** 2;
          const cell = cellAt(walker.real, walker.imaginary);
          paintPixel(cell.x, cell.y, walker.tone, Math.round(walker.alpha * fade));
        }
      }
    }
    context.putImageData(frameImage, 0, 0);
  }

  function stopAnimation() {
    if (frameRequest) cancelAnimationFrame(frameRequest);
    frameRequest = 0; lastFrame = 0;
  }
  function startAnimation() {
    if (frameRequest || hidden || reducedMotion.matches) return;
    frameRequest = requestAnimationFrame(tick);
  }
  function tick(now) {
    frameRequest = 0;
    if (hidden || reducedMotion.matches) return;
    const interval = 1000 / FPS;
    if (lastFrame && now - lastFrame < interval) { startAnimation(); return; }
    const delta = lastFrame ? Math.min(0.2, (now - lastFrame) / 1000) : interval / 1000;
    lastFrame = now; elapsed += delta;
    drawFrame(true); startAnimation();
  }
  function rebuildAfterResize() {
    resizeTimer = 0;
    if (hidden) { resizePending = true; return; }
    if (prepareField()) drawFrame(!reducedMotion.matches);
    startAnimation();
  }
  function queueResize() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(rebuildAfterResize, 200);
  }
  function syncMotionPreference() {
    stopAnimation();
    if (hidden) return;
    drawFrame(!reducedMotion.matches);
    startAnimation();
  }
  function syncVisibility() {
    hidden = document.hidden;
    if (hidden) { stopAnimation(); return; }
    if (resizePending) { resizePending = false; prepareField(); }
    drawFrame(!reducedMotion.matches);
    startAnimation();
  }

  prepareField(); drawFrame(false);
  startAnimation();
  window.addEventListener("resize", queueResize);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", queueResize);
  document.addEventListener("visibilitychange", syncVisibility);
  window.addEventListener("pagehide", stopAnimation);
  window.addEventListener("pageshow", syncVisibility);
  reducedMotion.addEventListener("change", syncMotionPreference);
})();
