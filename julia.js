// Homepage Julia boundary: the rendered cells move along their own geometry.
(function () {
  const canvas = document.querySelector(".julia-canvas");
  const context = canvas && canvas.getContext("2d", { alpha: true });
  if (!canvas || !context) return;

  const PIXEL_SIZE = 5;
  const JULIA_SIZE = 1700;
  const ANIMATION_SIZE = 2300;
  const JULIA_OFFSET = (ANIMATION_SIZE - JULIA_SIZE) / (2 * PIXEL_SIZE);
  const ANIMATION_COLUMNS = ANIMATION_SIZE / PIXEL_SIZE;
  const columns = JULIA_SIZE / PIXEL_SIZE;
  const ORIGIN_X = 460;
  const ORIGIN_Y = 460;
  const MAX_ITERATIONS = 120;
  const EDGE_START = 16;
  const FPS = 15;
  const STEP_TIME = 0.14;
  const TRAIL_TIME = 42;
  const FORMATION_TIME = 4.5;
  const FORMATION_TRAVEL = 0.85;
  const SCENE_SCALE = 1.65 / 900;
  const SCALES = [
    { radius: 18, phase: 0.72, speed: 0.18, strength: 1.05, lag: 0 },
    { radius: 7, phase: 0.9, speed: 0.27, strength: 0.68, lag: 0.13 },
    { radius: 2, phase: 1.05, speed: 0.39, strength: 0.22, lag: 0.26 },
  ];
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
  let frameImage, boundary = [], fieldPixels = [], tips = [], walkers = [];
  let formationLookup;
  let elapsed = 0, nextSpawn = 0.5, lastFrame = 0;
  let frameRequest = 0;
  let hidden = document.hidden;

  function complexAt(x, y) {
    return { real: ((x + 0.5) * PIXEL_SIZE - ORIGIN_X) * SCENE_SCALE - 0.7,
      imaginary: ((y + 0.5) * PIXEL_SIZE - ORIGIN_Y) * SCENE_SCALE - 0.7 };
  }

  function isEdge(value) {
    return value >= EDGE_START && value < MAX_ITERATIONS;
  }

  function buildJuliaGeometry() {
    canvas.width = ANIMATION_COLUMNS; canvas.height = ANIMATION_COLUMNS;
    context.imageSmoothingEnabled = false;
    frameImage = context.createImageData(ANIMATION_COLUMNS, ANIMATION_COLUMNS);
    const escape = new Uint8Array(columns * columns);
    const smooth = new Float32Array(columns * columns);
    const orbitCos = new Float32Array(columns * columns);
    const orbitSin = new Float32Array(columns * columns);
    for (let y = 0; y < columns; y += 1) {
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
    for (let y = 1; y < columns - 1; y += 1) {
      for (let x = 1; x < columns - 1; x += 1) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) sum += escape[(y + dy) * columns + x + dx];
        }
        smooth[y * columns + x] = sum / 9;
      }
    }
    // Integral image makes several geometry scales cheap to sample once at initialization.
    const stride = columns + 1;
    const integral = new Float64Array(stride * stride);
    const orbitCosIntegral = new Float64Array(stride * stride);
    const orbitSinIntegral = new Float64Array(stride * stride);
    for (let y = 0; y < columns; y += 1) {
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
      const top = Math.max(0, y - radius), bottom = Math.min(columns - 1, y + radius);
      const sum = source[(bottom + 1) * stride + right + 1] -
        source[top * stride + right + 1] -
        source[(bottom + 1) * stride + left] + source[top * stride + left];
      return sum / ((right - left + 1) * (bottom - top + 1));
    }
    function orbitAngle(x, y, radius) {
      return Math.atan2(averageFrom(orbitSinIntegral, x, y, radius),
        averageFrom(orbitCosIntegral, x, y, radius));
    }
    function tangent(x, y, radius) {
      const gx = averageFrom(integral, x + 1, y, radius) - averageFrom(integral, x - 1, y, radius);
      const gy = averageFrom(integral, x, y + 1, radius) - averageFrom(integral, x, y - 1, radius);
      const length = Math.hypot(gx, gy);
      return length > 0.001 ? { x: -gy / length, y: gx / length } : null;
    }
    function phasesAt(x, y) {
      return SCALES.map(({ radius, phase }) => orbitAngle(x, y, radius) * phase);
    }
    boundary = [];
    fieldPixels = [];
    const candidates = [];
    for (let y = 2; y < columns - 2; y += 1) {
      for (let x = 2; x < columns - 2; x += 1) {
        const value = escape[y * columns + x];
        const field = smooth[y * columns + x];
        // The averaged escape band supplies a stepped, structural fringe.
        // It fades outward without making the Julia interior transparent.
        if (value < EDGE_START && field >= 5) {
          const weight = Math.min(1, (field - 5) / 20);
          const tone = weight < 0.1 ? 5 : weight < 0.65 ? 4 : 3;
          const phases = phasesAt(x, y);
          const entry = tangent(x, y, 2) || { x: 1, y: 0 };
          fieldPixels.push({ x, y, tone, alpha: Math.round(55 + 150 * weight),
            phases, entry, strength: weight * 0.2, born: null });
        } else if (value === MAX_ITERATIONS && field < 116) {
          const weight = Math.min(1, (116 - field) / 35);
          const phases = phasesAt(x, y);
          const entry = tangent(x, y, 2) || { x: 1, y: 0 };
          fieldPixels.push({ x, y, tone: weight < 0.45 ? 3 : 4,
            alpha: Math.round(155 + 85 * weight),
            phases, entry, strength: weight * 0.25, born: null });
        }
        if (!isEdge(value)) continue;
        const gx = smooth[y * columns + x + 1] - smooth[y * columns + x - 1];
        const gy = smooth[(y + 1) * columns + x] - smooth[(y - 1) * columns + x];
        const gradient = Math.hypot(gx, gy);
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
        const phases = phasesAt(x, y);
        // Curl directions come from escape-field contours. Their smoothed
        // versions carry related angular motion through nested structures.
        const point = {
          x, y,
          directions: [large || fallback, medium || fallback, fine || fallback],
          phases,
          tone, alpha, strength: depth, born: null,
          detached: false,
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
    formationLookup = new Array(columns * columns);
    for (const pixel of fieldPixels.concat(boundary)) {
      formationLookup[pixel.y * columns + pixel.x] = pixel;
    }
  }

  function motionPhase(point, time, scale) {
    const phase = point.phases[scale];
    const other = point.phases[(scale + 1) % 3];
    return phase + SCALES[scale].lag - time * SCALES[scale].speed +
      0.26 * Math.sin(time * (0.083 + scale * 0.028) + other) +
      0.14 * Math.sin(time * (0.053 + scale * 0.014) - phase);
  }

  function displaced(point, time) {
    let dx = 0, dy = 0;
    for (let scale = 0; scale < 3; scale += 1) {
      const angle = motionPhase(point, time, scale);
      const direction = point.directions[scale];
      const strength = SCALES[scale].strength;
      dx += strength * (direction.x * Math.sin(angle) -
        direction.y * 0.28 * Math.cos(angle));
      dy += strength * (direction.y * Math.sin(angle) +
        direction.x * 0.28 * Math.cos(angle));
    }
    const length = Math.hypot(dx, dy);
    if (length > 2) { dx *= 2 / length; dy *= 2 / length; }
    return { x: Math.round(point.x + dx), y: Math.round(point.y + dy) };
  }

  function spawnWalker() {
    if (walkers.filter((walker) => walker.active).length >= 35 || !tips.length) return;
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const point = tips[Math.floor(Math.random() * tips.length)];
      if (point.detached || point.born === null ||
          elapsed - point.born < FORMATION_TRAVEL) continue;
      const location = displaced(point, elapsed);
      // One orthogonal outward step separates the source before walking.
      const outward = Math.abs(point.outX) >= Math.abs(point.outY) ?
        [Math.sign(point.outX) || 1, 0] : [0, Math.sign(point.outY) || 1];
      point.detached = true;
      const start = { x: location.x + JULIA_OFFSET, y: location.y + JULIA_OFFSET };
      const x = start.x + outward[0], y = start.y + outward[1];
      walkers.push({ source: point, sourceX: start.x, sourceY: start.y,
        tone: point.tone, alpha: point.alpha, x, y,
        outX: point.outX, outY: point.outY,
        previous: outward, run: 1,
        born: elapsed, lifetime: 14 + Math.random() * 6,
        nextStep: elapsed + STEP_TIME, active: true,
        trail: [{ ...start, born: elapsed }, { x, y, born: elapsed }] });
      return;
    }
  }

  function moveWalker(walker) {
    // A mild cardinal-choice bias fades with distance from the source.
    // Every chosen move remains exactly one orthogonal lattice cell.
    const distance = Math.hypot(walker.x - walker.sourceX, walker.y - walker.sourceY);
    const beta = 0.65 * Math.exp(-distance / 24);
    const direction = window.PixelWalkers.direction(walker.outX, walker.outY,
      beta, walker.previous, walker.run);
    const [dx, dy] = direction;
    walker.run = dx === walker.previous[0] && dy === walker.previous[1] ?
      walker.run + 1 : 1;
    walker.previous = direction;
    walker.x += dx; walker.y += dy;
    walker.trail.push({ x: walker.x, y: walker.y, born: elapsed });
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
      walker.trail = window.PixelWalkers.keepTrail(walker.trail, elapsed, TRAIL_TIME);
    }
    walkers = walkers.filter((walker) => walker.active || walker.trail.length);
    if (elapsed >= nextSpawn) {
      const emission = Math.max(0, Math.min(1,
        (elapsed - FORMATION_TIME * 0.8) / 1.9));
      if (Math.random() < emission) spawnWalker();
      nextSpawn = elapsed + 0.48 + Math.random() * 0.08;
    }
  }

  function paintPixel(x, y, tone, alpha) {
    if (x < 0 || x >= ANIMATION_COLUMNS || y < 0 || y >= ANIMATION_COLUMNS || alpha <= 0) return;
    const offset = (y * ANIMATION_COLUMNS + x) * 4;
    if (alpha <= frameImage.data[offset + 3]) return;
    const color = tones[tone];
    frameImage.data[offset] = color[0];
    frameImage.data[offset + 1] = color[1];
    frameImage.data[offset + 2] = color[2];
    frameImage.data[offset + 3] = alpha;
  }

  function formationWave(pixel) {
    const formationTime = Math.min(elapsed, FORMATION_TIME);
    const envelope = Math.sin(Math.PI * formationTime / FORMATION_TIME);
    const wave = formationTime / FORMATION_TIME + envelope * (
      0.21 * Math.sin(pixel.phases[0] - elapsed * SCALES[0].speed) +
      0.11 * Math.sin(pixel.phases[1] - elapsed * SCALES[1].speed));
    const threshold = 0.08 + 0.55 * (1 - pixel.strength) -
      0.025 * pixel.strength;
    return wave > threshold;
  }

  function formationPosition(pixel, animate) {
    if (!animate) {
      pixel.born = elapsed - FORMATION_TRAVEL;
      pixel.fromX = pixel.x; pixel.fromY = pixel.y;
      return pixel;
    }
    if (pixel.born === null) {
      if (!formationWave(pixel)) return null;
      pixel.born = elapsed;
      // A newly introduced cell comes from a nearby visible Julia cell.
      // Isolated cells use their own local tangent as a short entry path.
      let source = null, best = Infinity;
      for (let dy = -3; dy <= 3; dy += 1) {
        for (let dx = -3; dx <= 3; dx += 1) {
          if (!dx && !dy) continue;
          const x = pixel.x + dx, y = pixel.y + dy;
          if (x < 0 || x >= columns || y < 0 || y >= columns) continue;
          const candidate = formationLookup[y * columns + x];
          if (!candidate || candidate.born === null || candidate === pixel ||
              candidate.detached || candidate.tone === 5) continue;
          const phaseGap = 1 - Math.cos(candidate.phases[1] - pixel.phases[1]);
          const settling = Math.max(0,
            FORMATION_TRAVEL - (elapsed - candidate.born)) / FORMATION_TRAVEL;
          const score = dx * dx + dy * dy + 2 * phaseGap + settling;
          if (score < best) { source = candidate; best = score; }
        }
      }
      if (source) {
        const location = formationPosition(source, true);
        pixel.fromX = location.x;
        pixel.fromY = location.y;
      } else {
        const tangent = pixel.directions ? pixel.directions[1] : pixel.entry;
        pixel.fromX = pixel.x - tangent.x * 2.5;
        pixel.fromY = pixel.y - tangent.y * 2.5;
      }
    }
    const target = pixel.directions ? displaced(pixel, elapsed) : pixel;
    const progress = Math.max(0, Math.min(1,
      (elapsed - pixel.born) / FORMATION_TRAVEL));
    const arrival = 1 - (1 - progress) ** 3;
    return { x: Math.round(pixel.fromX + (target.x - pixel.fromX) * arrival),
      y: Math.round(pixel.fromY + (target.y - pixel.fromY) * arrival) };
  }

  function drawFrame(animate) {
    if (animate) updateWalkers();
    frameImage.data.fill(0);
    for (const pixel of fieldPixels) {
      const location = formationPosition(pixel, animate);
      if (location) paintPixel(location.x + JULIA_OFFSET, location.y + JULIA_OFFSET,
        pixel.tone, pixel.alpha);
    }
    for (const point of boundary) {
      if (point.detached) continue;
      const location = formationPosition(point, animate);
      if (location) paintPixel(location.x + JULIA_OFFSET, location.y + JULIA_OFFSET,
        point.tone, point.alpha);
    }
    drawWalkers(animate);
    context.putImageData(frameImage, 0, 0);
  }

  function drawWalkers(animate) {
    if (animate) {
      for (const walker of walkers) {
        for (const point of walker.trail) {
          const fade = window.PixelWalkers.fade(elapsed - point.born, TRAIL_TIME);
          paintPixel(point.x, point.y, walker.tone, Math.round(walker.alpha * 0.8 * fade));
        }
        if (walker.active) {
          const fade = window.PixelWalkers.fade(elapsed - walker.born, walker.lifetime);
          paintPixel(walker.x, walker.y, walker.tone, Math.round(walker.alpha * fade));
        }
      }
    }
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
  function syncMotionPreference() {
    stopAnimation();
    if (hidden) return;
    drawFrame(!reducedMotion.matches);
    startAnimation();
  }
  function syncVisibility() {
    hidden = document.hidden;
    if (hidden) { stopAnimation(); return; }
    drawFrame(!reducedMotion.matches);
    startAnimation();
  }

  buildJuliaGeometry(); drawFrame(!reducedMotion.matches);
  startAnimation();
  document.addEventListener("visibilitychange", syncVisibility);
  window.addEventListener("pagehide", stopAnimation);
  window.addEventListener("pageshow", syncVisibility);
  reducedMotion.addEventListener("change", syncMotionPreference);
})();
