// Optional, non-critical behavior only.
document.documentElement.classList.add("js");

(function () {
  const reducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reducedMotion) {
    return;
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  canvas.className = "random-walk-canvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);

  const gridSize = 18;
  const walkerCount = 10;
  const trailLength = 50;
  const stepMs = 200;
  const orangeFallback = { r: 255, g: 106, b: 26 };
  const directions = [
    [gridSize, 0],
    [-gridSize, 0],
    [0, gridSize],
    [0, -gridSize],
  ];

  let width = 1;
  let height = 1;
  let dpr = 1;
  let walkers = [];
  let walkTimer = null;
  let resizeTimer = null;
  let mutationTimer = null;
  let resizeQueued = false;
  const orange = parseOrange();

  function parseOrange() {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue("--orange")
      .trim()
      .replace("#", "");

    if (/^[0-9a-f]{6}$/i.test(value)) {
      return {
        r: parseInt(value.slice(0, 2), 16),
        g: parseInt(value.slice(2, 4), 16),
        b: parseInt(value.slice(4, 6), 16),
      };
    }

    return orangeFallback;
  }

  function wrap(value, limit) {
    return ((value % limit) + limit) % limit;
  }

  function randomGridPosition(limit) {
    const cells = Math.max(1, Math.floor(limit / gridSize));
    return Math.floor(Math.random() * cells) * gridSize;
  }

  function pushPoint(walker, wrapped) {
    walker.path.push({ x: walker.x, y: walker.y, wrapped: Boolean(wrapped) });

    if (walker.path.length > trailLength) {
      walker.path.shift();
    }
  }

  function stepWalker(walker) {
    const direction = directions[Math.floor(Math.random() * directions.length)];
    const nextX = wrap(walker.x + direction[0], width);
    const nextY = wrap(walker.y + direction[1], height);
    const wrapped =
      Math.abs(nextX - walker.x) > gridSize * 1.5 ||
      Math.abs(nextY - walker.y) > gridSize * 1.5;

    walker.x = nextX;
    walker.y = nextY;
    pushPoint(walker, wrapped);
  }

  function createWalker() {
    const walker = {
      x: randomGridPosition(width),
      y: randomGridPosition(height),
      path: [],
    };

    pushPoint(walker, false);

    for (let index = 1; index < trailLength; index += 1) {
      stepWalker(walker);
    }

    return walker;
  }

  function measurePage() {
    const previousWidth = canvas.style.width;
    const previousHeight = canvas.style.height;

    canvas.style.width = "0";
    canvas.style.height = "0";

    const size = {
      width: Math.max(
        window.innerWidth,
        document.documentElement.scrollWidth,
        document.body.scrollWidth
      ),
      height: Math.max(
        window.innerHeight,
        document.documentElement.scrollHeight,
        document.body.scrollHeight
      ),
    };

    canvas.style.width = previousWidth;
    canvas.style.height = previousHeight;

    return size;
  }

  function drawWalker(walker) {
    if (walker.path.length < 2) {
      return;
    }

    context.beginPath();
    context.moveTo(walker.path[0].x, walker.path[0].y);

    for (let index = 1; index < walker.path.length; index += 1) {
      const point = walker.path[index];

      if (point.wrapped) {
        context.moveTo(point.x, point.y);
        continue;
      }

      context.lineTo(point.x, point.y);
    }

    context.stroke();
  }

  function draw() {
    context.clearRect(0, 0, width, height);
    context.strokeStyle = `rgba(${orange.r}, ${orange.g}, ${orange.b}, 0.2)`;
    context.lineWidth = 4;
    context.lineJoin = "round";
    context.lineCap = "round";

    walkers.forEach(drawWalker);
  }

  function fitCanvas(resetTrails) {
    const size = measurePage();
    const nextWidth = Math.max(
      gridSize * 2,
      Math.floor(size.width / gridSize) * gridSize
    );
    const nextHeight = Math.max(
      gridSize * 2,
      Math.floor(size.height / gridSize) * gridSize
    );

    if (nextWidth === width && nextHeight === height && !resetTrails) {
      return;
    }

    width = nextWidth;
    height = nextHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.ceil(width * dpr);
    canvas.height = Math.ceil(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (resetTrails || !walkers.length) {
      walkers = Array.from({ length: walkerCount }, createWalker);
    } else {
      walkers.forEach(function (walker) {
        walker.x = wrap(walker.x, width);
        walker.y = wrap(walker.y, height);
        walker.path = [];
        pushPoint(walker, false);
      });
    }

    draw();
  }

  function queueResize(resetTrails) {
    if (resizeQueued) {
      return;
    }

    resizeQueued = true;
    window.requestAnimationFrame(function () {
      resizeQueued = false;
      fitCanvas(Boolean(resetTrails));
    });
  }

  function stopWalking() {
    if (walkTimer) {
      window.clearTimeout(walkTimer);
      walkTimer = null;
    }
  }

  function scheduleWalking() {
    if (walkTimer || document.hidden) {
      return;
    }

    walkTimer = window.setTimeout(tick, stepMs);
  }

  function tick() {
    walkTimer = null;

    if (document.hidden) {
      return;
    }

    walkers.forEach(stepWalker);
    draw();
    scheduleWalking();
  }

  fitCanvas(true);
  window.addEventListener("load", function () {
    queueResize(false);
  });
  window.addEventListener("resize", function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      queueResize(false);
    }, 120);
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      stopWalking();
      return;
    }

    queueResize(false);
    scheduleWalking();
  });

  new MutationObserver(function () {
    window.clearTimeout(mutationTimer);
    mutationTimer = window.setTimeout(function () {
      queueResize(false);
    }, 160);
  }).observe(document.body, { childList: true, subtree: true });

  scheduleWalking();
})();

(function () {
  const reducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const currentPath = window.location.pathname
    .replace(/\/index\.html$/, "")
    .replace(/\/$/, "");
  const isAboutPage = currentPath === "/about" || currentPath.endsWith("/about");
  const exitHandoffKey = "llui2AboutBirdExit";
  const exitHandoff = readExitHandoff();

  if (reducedMotion || (!isAboutPage && !exitHandoff)) {
    return;
  }

  const viewportArea = window.innerWidth * window.innerHeight;
  const particleCount = Math.min(
    380,
    Math.max(190, Math.round(viewportArea / 3400))
  );
  const neighborRadius = 116;
  const neighborRadiusSq = neighborRadius * neighborRadius;
  const separationRadius = 31;
  const separationRadiusSq = separationRadius * separationRadius;
  const gridCellSize = neighborRadius;
  const maxNeighborChecks = particleCount > 320 ? 10 : 12;
  const enterFlightMs = 5200;
  const roamFlightMs = 7200;
  const exitFadeMs = 1650;
  const depthSortInterval = 1;
  const depthRangeInterval = 1;
  const leaderCurveStrength = 0.64;
  const trajectoryMargin = 24;
  const entryDistance = 120;
  const curveFadePortion = 0.12;
  const depthScale = 260;
  const depthRangePadding = 0.08;
  const minDepthRange = 0.48;
  const pointerRepelRadius = 190;
  const pointerRepelRadiusSq = pointerRepelRadius * pointerRepelRadius;
  const pointerRepelStrength = 3.1;
  const pointerDepthStrength = 0.22;
  const layer = document.createElement("div");
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const pointer = {
    x: 0,
    y: 0,
    clientX: 0,
    clientY: 0,
    active: false,
  };
  let canvasWidth = 0;
  let canvasHeight = 0;
  let pageWidth = window.innerWidth;
  let pageHeight = window.innerHeight;
  let pixelRatio = 1;
  let animationFrame = null;
  let activeSwarm = null;
  let lastFrame = 0;
  let swarmStart = 0;
  let swarmFrame = 0;
  let exiting = false;

  if (!context) {
    return;
  }

  layer.className = "cursor-trail-layer";
  layer.setAttribute("aria-hidden", "true");
  canvas.className = "cursor-swarm-canvas";

  layer.appendChild(canvas);
  document.body.appendChild(layer);
  resizeSwarmCanvas();

  window.addEventListener("resize", resizeSwarmCanvas, { passive: true });
  window.addEventListener("load", resizeSwarmCanvas);

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalize(x, y) {
    const length = Math.hypot(x, y) || 1;

    return { x: x / length, y: y / length };
  }

  function normalize3(x, y, z) {
    const length = Math.hypot(x, y, z) || 1;

    return { x: x / length, y: y / length, z: z / length };
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function readExitHandoff() {
    try {
      const raw = window.sessionStorage.getItem(exitHandoffKey);

      if (!raw) {
        return null;
      }

      window.sessionStorage.removeItem(exitHandoffKey);

      const handoff = JSON.parse(raw);

      if (
        !handoff ||
        Date.now() - handoff.time > 3000 ||
        !Array.isArray(handoff.particles) ||
        !handoff.particles.length
      ) {
        return null;
      }

      return handoff;
    } catch (_error) {
      return null;
    }
  }

  function writeExitHandoff(swarm) {
    try {
      const particles = swarm.particles.map(function (particle) {
        return {
          x: particle.x,
          y: particle.y,
          z: particle.z,
          vx: particle.vx,
          vy: particle.vy,
          vz: particle.vz,
          speed: particle.speed,
          opacity: particle.opacity,
          phase: particle.phase,
          size: particle.size,
          visualDepth: particle.visualDepth,
          fadeDelay: particle.fadeDelay,
          fadeStartOpacity: particle.fadeStartOpacity,
        };
      });

      window.sessionStorage.setItem(
        exitHandoffKey,
        JSON.stringify({
          time: Date.now(),
          scrollX: getScrollX(),
          scrollY: getScrollY(),
          leader: swarm.leader,
          finalTarget: swarm.finalTarget,
          particles: particles,
        })
      );
    } catch (_error) {
      // Navigation should never depend on animation state.
    }
  }

  function resizeSwarmCanvas() {
    pixelRatio = Math.min(window.devicePixelRatio || 1, 1.25);
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;
    pageWidth = Math.max(
      window.innerWidth,
      document.documentElement.scrollWidth,
      document.body.scrollWidth
    );
    pageHeight = Math.max(
      window.innerHeight,
      document.documentElement.scrollHeight,
      document.body.scrollHeight
    );
    canvas.width = Math.ceil(canvasWidth * pixelRatio);
    canvas.height = Math.ceil(canvasHeight * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  function clearSwarmCanvas() {
    context.clearRect(0, 0, canvasWidth, canvasHeight);
  }

  function getScrollX() {
    return window.scrollX || document.documentElement.scrollLeft || 0;
  }

  function getScrollY() {
    return window.scrollY || document.documentElement.scrollTop || 0;
  }

  function currentViewport() {
    const left = getScrollX();
    const top = getScrollY();

    return {
      left: left,
      top: top,
      right: left + window.innerWidth,
      bottom: top + window.innerHeight,
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  function handlePointerMove(event) {
    if (event.pointerType === "touch") {
      return;
    }

    pointer.clientX = event.clientX;
    pointer.clientY = event.clientY;
    syncPointerToPage();
    pointer.active = true;
  }

  function syncPointerToPage() {
    pointer.x = pointer.clientX + getScrollX();
    pointer.y = pointer.clientY + getScrollY();
  }

  function clearPointer() {
    pointer.active = false;
  }

  function easeInOutSine(value) {
    return -(Math.cos(Math.PI * value) - 1) / 2;
  }

  function smoothStep(value) {
    return value * value * (3 - 2 * value);
  }

  function mix(from, to, amount) {
    return from + (to - from) * amount;
  }

  function catmullRomPoint(previous, start, target, next, progress) {
    const progress2 = progress * progress;
    const progress3 = progress2 * progress;

    return {
      x:
        0.5 *
        (2 * start.x +
          (-previous.x + target.x) * progress +
          (2 * previous.x - 5 * start.x + 4 * target.x - next.x) *
            progress2 +
          (-previous.x + 3 * start.x - 3 * target.x + next.x) * progress3),
      y:
        0.5 *
        (2 * start.y +
          (-previous.y + target.y) * progress +
          (2 * previous.y - 5 * start.y + 4 * target.y - next.y) *
            progress2 +
          (-previous.y + 3 * start.y - 3 * target.y + next.y) * progress3),
      z:
        0.5 *
        (2 * start.z +
          (-previous.z + target.z) * progress +
          (2 * previous.z - 5 * start.z + 4 * target.z - next.z) *
            progress2 +
          (-previous.z + 3 * start.z - 3 * target.z + next.z) * progress3),
    };
  }

  function curveEnvelope(progress) {
    const endpointDistance = Math.min(progress, 1 - progress);
    return smoothStep(clamp(endpointDistance / curveFadePortion, 0, 1));
  }

  function randomEntryPoint() {
    const viewport = currentViewport();
    const corners = [
      { x: viewport.left - entryDistance, y: viewport.top - entryDistance },
      { x: viewport.right + entryDistance, y: viewport.top - entryDistance },
      { x: viewport.left - entryDistance, y: viewport.bottom + entryDistance },
      {
        x: viewport.right + entryDistance,
        y: viewport.bottom + entryDistance,
      },
    ];

    return corners[Math.floor(Math.random() * corners.length)];
  }

  function randomRoamPoint(previous) {
    const viewport = currentViewport();
    const margin = Math.min(
      Math.max(90, Math.min(window.innerWidth, window.innerHeight) * 0.14),
      170
    );
    const minX = clamp(viewport.left + margin, trajectoryMargin, pageWidth);
    const maxX = clamp(
      viewport.right - margin,
      minX,
      Math.max(minX, pageWidth - trajectoryMargin)
    );
    const minY = clamp(viewport.top + margin, trajectoryMargin, pageHeight);
    const maxY = clamp(
      viewport.bottom - margin,
      minY,
      Math.max(minY, pageHeight - trajectoryMargin)
    );
    let point = null;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      point = {
        x: randomBetween(minX, maxX),
        y: randomBetween(minY, maxY),
        z: randomBetween(-0.82, 0.92),
      };

      if (
        !previous ||
        Math.hypot(point.x - previous.x, point.y - previous.y) >
          Math.min(window.innerWidth, window.innerHeight) * 0.34
      ) {
        break;
      }
    }

    return point;
  }

  function createLeaderPath(start, target) {
    const distance = Math.hypot(target.x - start.x, target.y - start.y);
    const deltaX = target.x - start.x;
    const deltaY = target.y - start.y;
    const tangent = normalize(deltaX, deltaY);
    const normalX = -tangent.y;
    const normalY = tangent.x;
    const side = Math.random() < 0.5 ? -1 : 1;
    const viewportBend = Math.min(window.innerWidth, window.innerHeight) * 0.42;
    const bend = Math.min(460, viewportBend, distance * leaderCurveStrength);

    function waypoint(progress, bendAmount, depthAmount) {
      const tangentSlip = randomBetween(-90, 90);

      return {
        x: clamp(
          start.x +
            deltaX * progress +
            normalX * bendAmount +
            tangent.x * tangentSlip,
          trajectoryMargin,
          pageWidth - trajectoryMargin
        ),
        y: clamp(
          start.y +
            deltaY * progress +
            normalY * bendAmount +
            tangent.y * tangentSlip,
          trajectoryMargin,
          pageHeight - trajectoryMargin
        ),
        z: clamp(
          start.z + (target.z - start.z) * progress + depthAmount,
          -1,
          1
        ),
      };
    }

    return {
      amplitude: Math.min(180, distance * 0.12) * randomBetween(0.7, 1.08),
      waypoints: [
        start,
        waypoint(
          randomBetween(0.18, 0.3),
          bend * randomBetween(0.74, 1.1) * side,
          randomBetween(-0.12, 0.28)
        ),
        waypoint(
          randomBetween(0.43, 0.57),
          -bend * randomBetween(0.9, 1.25) * side,
          randomBetween(0.16, 0.48)
        ),
        waypoint(
          randomBetween(0.7, 0.84),
          bend * randomBetween(0.58, 0.98) * side,
          randomBetween(-0.04, 0.34)
        ),
        target,
      ],
      phase: Math.random() * Math.PI * 2,
      phase2: Math.random() * Math.PI * 2,
      depthPhase: Math.random() * Math.PI * 2,
      flutterWaves: randomBetween(1.4, 2.35),
      depthWaves: randomBetween(1.2, 2.1),
    };
  }

  function leaderPosition(swarm, progress) {
    const path = swarm.path;
    const waypoints = path.waypoints;
    const scaled = easeInOutSine(progress) * (waypoints.length - 1);
    const segment = Math.min(waypoints.length - 2, Math.floor(scaled));
    const localProgress = smoothStep(scaled - segment);
    const previous = waypoints[Math.max(0, segment - 1)];
    const start = waypoints[segment];
    const target = waypoints[segment + 1];
    const next = waypoints[Math.min(waypoints.length - 1, segment + 2)];
    const base = catmullRomPoint(previous, start, target, next, localProgress);
    const tangent = normalize(target.x - previous.x, target.y - previous.y);
    const normalX = -tangent.y;
    const normalY = tangent.x;
    const endpointFade = curveEnvelope(progress);
    const lateralFlutter =
      Math.sin(progress * Math.PI * 2 * path.flutterWaves + path.phase) *
      endpointFade *
      path.amplitude;
    const forwardFlutter =
      Math.cos(
        progress * Math.PI * 2 * (path.flutterWaves * 0.62) + path.phase2
      ) *
      endpointFade *
      path.amplitude *
      0.24;
    const rawX = base.x + normalX * lateralFlutter + tangent.x * forwardFlutter;
    const rawY = base.y + normalY * lateralFlutter + tangent.y * forwardFlutter;
    const insidePull = endpointFade * 0.8;
    const clampedX = clamp(
      rawX,
      trajectoryMargin,
      pageWidth - trajectoryMargin
    );
    const clampedY = clamp(
      rawY,
      trajectoryMargin,
      pageHeight - trajectoryMargin
    );

    return {
      x: mix(rawX, clampedX, insidePull),
      y: mix(rawY, clampedY, insidePull),
      z: clamp(
        base.z +
          Math.abs(
            Math.sin(progress * Math.PI * path.depthWaves + path.depthPhase)
          ) *
            endpointFade *
            1.08,
        -1,
        1
      ),
    };
  }

  function depthToBirdColor(depth) {
    const amount = smoothStep(clamp(depth, 0, 1));
    const shade = Math.round(mix(24, 215, amount));

    return { r: shade, g: shade, b: shade };
  }

  function updateDepthRange(swarm, dt, frameIndex) {
    if (swarm.depthRange && frameIndex % depthRangeInterval !== 0) {
      return swarm.depthRange;
    }

    const depths = swarm.depths || (swarm.depths = []);
    depths.length = 0;

    for (let index = 0; index < swarm.particles.length; index += 1) {
      const particle = swarm.particles[index];

      if (!particle.arrived || particle.opacity > 0.04) {
        depths.push(particle.z);
      }
    }

    if (!depths.length) {
      return swarm.depthRange || { min: -1, max: 1, span: 2 };
    }

    depths.sort(function (first, second) {
      return first - second;
    });

    const lower = depths[Math.floor((depths.length - 1) * 0.08)];
    const upper = depths[Math.ceil((depths.length - 1) * 0.92)];
    let nextMin = lower - depthRangePadding;
    let nextMax = upper + depthRangePadding;
    const span = nextMax - nextMin;

    if (span < minDepthRange) {
      const center = (nextMin + nextMax) / 2;

      nextMin = center - minDepthRange / 2;
      nextMax = center + minDepthRange / 2;
    }

    if (!swarm.depthRange) {
      swarm.depthRange = { min: nextMin, max: nextMax, span: nextMax - nextMin };
    } else {
      const smoothing = clamp(0.045 * dt, 0.025, 0.12);

      swarm.depthRange.min = mix(swarm.depthRange.min, nextMin, smoothing);
      swarm.depthRange.max = mix(swarm.depthRange.max, nextMax, smoothing);
      swarm.depthRange.span = Math.max(
        minDepthRange,
        swarm.depthRange.max - swarm.depthRange.min
      );
    }

    return swarm.depthRange;
  }

  function hideSwarm() {
    layer.classList.remove("is-visible");
    clearSwarmCanvas();
  }

  function resetTrail() {
    activeSwarm = null;
    hideSwarm();

    if (animationFrame) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  }

  function requestSwarmFrame() {
    if (animationFrame || document.hidden) {
      return;
    }

    animationFrame = window.requestAnimationFrame(renderSwarm);
  }

  function handleSwarmVisibility() {
    if (document.hidden) {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }

      return;
    }

    if (activeSwarm) {
      lastFrame = performance.now();
      requestSwarmFrame();
    }
  }

  function createParticle(start, target) {
    const spread = randomBetween(34, 122);
    const angle = Math.random() * Math.PI * 2;
    const startX = start.x + Math.cos(angle) * spread;
    const startY = start.y + Math.sin(angle) * spread;
    const startZ = clamp(start.z + randomBetween(-0.22, 0.18), -1, 1);
    const targetDirection = normalize3(
      target.x - startX,
      target.y - startY,
      (target.z - startZ) * depthScale
    );
    const heading =
      Math.atan2(targetDirection.y, targetDirection.x) +
      randomBetween(-0.7, 0.7);
    const depthJitter = randomBetween(-0.42, 0.42);
    const initialVelocity = normalize3(
      Math.cos(heading),
      Math.sin(heading),
      targetDirection.z + depthJitter
    );
    const speed = randomBetween(5.4, 9.2);

    return {
      x: startX,
      y: startY,
      z: startZ,
      vx: initialVelocity.x,
      vy: initialVelocity.y,
      vz: initialVelocity.z,
      speed: speed,
      opacity: 0,
      phase: Math.random() * Math.PI * 2,
      size: randomBetween(2.8, 5.4),
      visualDepth: clamp((startZ + 1) / 2, 0, 1),
      arrived: false,
    };
  }

  function createSwarm(start, target) {
    const distance = Math.hypot(target.x - start.x, target.y - start.y);
    const pathStart = {
      x: start.x,
      y: start.y,
      z: randomBetween(-0.9, -0.35),
    };
    const particles = Array.from({ length: particleCount }, function () {
      return createParticle(pathStart, target);
    });

    return {
      mode: "enter",
      start: pathStart,
      finalTarget: target,
      flightMs: Math.max(enterFlightMs, distance * 5.6),
      leader: { x: pathStart.x, y: pathStart.y, z: pathStart.z },
      path: createLeaderPath(pathStart, target),
      particles: particles,
      drawOrder: particles.slice(),
      depths: [],
      grid: new Map(),
    };
  }

  function beginSegment(swarm, target, mode, flightMs, now) {
    const start = {
      x: swarm.leader.x,
      y: swarm.leader.y,
      z: swarm.leader.z,
    };
    const distance = Math.hypot(target.x - start.x, target.y - start.y);

    swarm.mode = mode;
    swarm.start = start;
    swarm.finalTarget = target;
    swarm.flightMs =
      mode === "exit" ? flightMs : Math.max(flightMs, distance * 5.4);
    swarm.path = createLeaderPath(start, target);
    swarm.particles.forEach(function (particle) {
      particle.arrived = false;
    });

    swarmStart = now;
  }

  function prepareParticlesToFade(swarm) {
    swarm.particles.forEach(function (particle) {
      particle.arrived = false;
      particle.fadeDelay =
        particle.fadeDelay == null ? randomBetween(0, 180) : particle.fadeDelay;
      particle.fadeStartOpacity =
        particle.fadeStartOpacity == null
          ? clamp(particle.opacity == null ? 0.88 : particle.opacity, 0, 0.9)
          : particle.fadeStartOpacity;
    });
  }

  function beginFadeOut(swarm, now) {
    swarm.mode = "exit";
    swarm.start = {
      x: swarm.leader.x,
      y: swarm.leader.y,
      z: swarm.leader.z,
    };
    swarm.finalTarget = swarm.finalTarget || swarm.start;
    swarm.flightMs = exitFadeMs;
    prepareParticlesToFade(swarm);

    swarmStart = now;
    swarmFrame = 0;
  }

  function beginRoamSegment(swarm, now) {
    beginSegment(swarm, randomRoamPoint(swarm.leader), "roam", roamFlightMs, now);
  }

  function startAmbientSwarm() {
    const start = randomEntryPoint();
    const target = randomRoamPoint(start);

    activeSwarm = createSwarm(start, target);
    swarmStart = performance.now();
    lastFrame = swarmStart;
    swarmFrame = 0;
    layer.classList.add("is-visible");

    requestSwarmFrame();
  }

  function startExitHandoff(handoff) {
    const handoffOffsetX = getScrollX() - (handoff.scrollX || 0);
    const handoffOffsetY = getScrollY() - (handoff.scrollY || 0);
    const leader = handoff.leader
      ? {
          x: handoff.leader.x + handoffOffsetX,
          y: handoff.leader.y + handoffOffsetY,
          z: handoff.leader.z,
        }
      : {
          x: getScrollX() + window.innerWidth / 2,
          y: getScrollY() + window.innerHeight / 2,
          z: 0,
        };
    const target = handoff.finalTarget
      ? {
          x: handoff.finalTarget.x + handoffOffsetX,
          y: handoff.finalTarget.y + handoffOffsetY,
          z: handoff.finalTarget.z,
        }
      : randomRoamPoint(leader);
    const particles = handoff.particles.map(function (particle) {
      return {
        x: particle.x + handoffOffsetX,
        y: particle.y + handoffOffsetY,
        z: particle.z,
        vx: particle.vx,
        vy: particle.vy,
        vz: particle.vz,
        speed: Math.max(particle.speed || 5.8, 5.8),
        opacity: particle.opacity == null ? 0.88 : particle.opacity,
        phase: particle.phase || Math.random() * Math.PI * 2,
        size: particle.size || randomBetween(2.8, 5.4),
        visualDepth:
          particle.visualDepth == null
            ? clamp((particle.z + 1) / 2, 0, 1)
            : particle.visualDepth,
        fadeDelay: particle.fadeDelay,
        fadeStartOpacity: particle.fadeStartOpacity,
        arrived: false,
      };
    });

    activeSwarm = {
      mode: "exit",
      start: leader,
      finalTarget: target,
      flightMs: exitFadeMs,
      leader: leader,
      particles: particles,
      drawOrder: particles.slice(),
      depths: [],
      grid: new Map(),
    };

    swarmStart = performance.now();
    beginFadeOut(activeSwarm, swarmStart);
    lastFrame = swarmStart;
    swarmFrame = 0;
    layer.classList.add("is-visible");

    requestSwarmFrame();
  }

  function beginExit() {
    if (exiting || !activeSwarm) {
      return;
    }

    exiting = true;
    beginFadeOut(activeSwarm, performance.now());
    writeExitHandoff(activeSwarm);
  }

  function particleGridKey(cellX, cellY) {
    return cellX * 8192 + cellY;
  }

  function buildParticleGrid(swarm) {
    const particles = swarm.particles;

    swarm.grid.clear();

    for (let index = 0; index < particles.length; index += 1) {
      const particle = particles[index];
      const cellX = Math.floor(particle.x / gridCellSize);
      const cellY = Math.floor(particle.y / gridCellSize);
      const key = particleGridKey(cellX, cellY);
      let bucket = swarm.grid.get(key);

      if (!bucket) {
        bucket = [];
        swarm.grid.set(key, bucket);
      }

      bucket.push(index);
    }
  }

  function updateParticle(
    particle,
    particleIndex,
    swarm,
    target,
    dt,
    elapsed
  ) {
    const exitMode = swarm.mode === "exit";
    if (exitMode) {
      if (particle.fadeDelay == null) {
        particle.fadeDelay = randomBetween(0, 180);
      }

      if (particle.fadeStartOpacity == null) {
        particle.fadeStartOpacity = clamp(
          particle.opacity == null ? 0.88 : particle.opacity,
          0,
          0.9
        );
      }

      const fadeProgress = clamp(
        (elapsed - particle.fadeDelay) / exitFadeMs,
        0,
        1
      );

      if (fadeProgress >= 1) {
        particle.arrived = true;
        particle.opacity = 0;
        return;
      }

      particle.arrived = false;
    }

    const particleTarget = target;
    const toTarget = normalize3(
      particleTarget.x - particle.x,
      particleTarget.y - particle.y,
      (particleTarget.z - particle.z) * depthScale
    );
    let alignX = 0;
    let alignY = 0;
    let alignZ = 0;
    let separationX = 0;
    let separationY = 0;
    let separationZ = 0;
    let cohesionX = 0;
    let cohesionY = 0;
    let cohesionZ = 0;
    let neighborCount = 0;
    const cellX = Math.floor(particle.x / gridCellSize);
    const cellY = Math.floor(particle.y / gridCellSize);
    const particles = swarm.particles;

    neighborSearch:
    for (let offsetCellX = -1; offsetCellX <= 1; offsetCellX += 1) {
      for (let offsetCellY = -1; offsetCellY <= 1; offsetCellY += 1) {
        const bucket = swarm.grid.get(
          particleGridKey(cellX + offsetCellX, cellY + offsetCellY)
        );

        if (!bucket) {
          continue;
        }

        for (let bucketIndex = 0; bucketIndex < bucket.length; bucketIndex += 1) {
          if (neighborCount >= maxNeighborChecks) {
            break neighborSearch;
          }

          const neighborIndex = bucket[bucketIndex];

          if (neighborIndex === particleIndex) {
            continue;
          }

          const neighbor = particles[neighborIndex];
          const offsetX = neighbor.x - particle.x;
          const offsetY = neighbor.y - particle.y;
          const offsetZ = (neighbor.z - particle.z) * depthScale;
          const distanceSq =
            offsetX * offsetX + offsetY * offsetY + offsetZ * offsetZ;

          if (distanceSq > neighborRadiusSq || distanceSq === 0) {
            continue;
          }

          alignX += neighbor.vx;
          alignY += neighbor.vy;
          alignZ += neighbor.vz;
          cohesionX += offsetX;
          cohesionY += offsetY;
          cohesionZ += offsetZ;
          neighborCount += 1;

          if (distanceSq < separationRadiusSq) {
            const distance = Math.sqrt(distanceSq);

            separationX -= offsetX / distance;
            separationY -= offsetY / distance;
            separationZ -= offsetZ / distance;
          }
        }
      }
    }

    if (neighborCount) {
      alignX /= neighborCount;
      alignY /= neighborCount;
      alignZ /= neighborCount;
      const cohesion = normalize3(
        cohesionX / neighborCount,
        cohesionY / neighborCount,
        cohesionZ / neighborCount
      );
      cohesionX = cohesion.x;
      cohesionY = cohesion.y;
      cohesionZ = cohesion.z;
    } else {
      alignX = particle.vx;
      alignY = particle.vy;
      alignZ = particle.vz;
      cohesionX = 0;
      cohesionY = 0;
      cohesionZ = 0;
    }

    const noiseAngle =
      Math.sin(elapsed * 0.004 + particle.x * 0.018 + particle.phase) * 1.6 +
      Math.cos(elapsed * 0.0025 + particle.y * 0.015) * 0.9;
    const swirl = normalize(
      -(particleTarget.y - particle.y),
      particleTarget.x - particle.x
    );
    const swirlStrength = Math.sin(elapsed * 0.0017 + particle.phase) * 0.34;
    const depthNoise = Math.sin(elapsed * 0.0023 + particle.phase * 1.7) * 0.18;
    let pointerRepelX = 0;
    let pointerRepelY = 0;
    let pointerRepelZ = 0;
    let pointerInfluence = 0;

    if (pointer.active) {
      let pointerOffsetX = particle.x - pointer.x;
      let pointerOffsetY = particle.y - pointer.y;
      let pointerDistanceSq =
        pointerOffsetX * pointerOffsetX + pointerOffsetY * pointerOffsetY;

      if (pointerDistanceSq < pointerRepelRadiusSq) {
        let pointerDistance = Math.sqrt(pointerDistanceSq);

        if (pointerDistance < 1) {
          pointerOffsetX = Math.cos(particle.phase);
          pointerOffsetY = Math.sin(particle.phase);
          pointerDistance = 1;
        }

        const falloff = 1 - pointerDistance / pointerRepelRadius;

        pointerInfluence = falloff * falloff;
        pointerRepelX = (pointerOffsetX / pointerDistance) * pointerInfluence;
        pointerRepelY = (pointerOffsetY / pointerDistance) * pointerInfluence;
        pointerRepelZ =
          Math.sin(elapsed * 0.006 + particle.phase) *
          pointerDepthStrength *
          pointerInfluence;
      }
    }

    const enterMode = swarm.mode === "enter";
    const pathWeight = exitMode ? 0.24 : enterMode ? 0.82 : 0.58;
    const alignWeight = exitMode ? 1.08 : 1.14;
    const separationWeight = exitMode ? 0.94 : 1.08;
    const noiseWeight = exitMode ? 0.14 : 0.18;
    const desired = normalize3(
      alignX * alignWeight +
        toTarget.x * pathWeight +
        cohesionX * 0.04 +
        separationX * separationWeight +
        swirl.x * swirlStrength * 0.28 +
        pointerRepelX * pointerRepelStrength +
        Math.cos(noiseAngle) * noiseWeight,
      alignY * alignWeight +
        toTarget.y * pathWeight +
        cohesionY * 0.04 +
        separationY * separationWeight +
        swirl.y * swirlStrength * 0.28 +
        pointerRepelY * pointerRepelStrength +
        Math.sin(noiseAngle) * noiseWeight,
      alignZ * 0.98 +
        toTarget.z * 0.54 +
        cohesionZ * 0.04 +
        separationZ * 0.74 +
        pointerRepelZ +
        depthNoise
    );
    const turn = particle.arrived ? 0.04 : exitMode ? 0.085 : 0.105;
    const nextDirection = normalize3(
      particle.vx * (1 - turn) + desired.x * turn,
      particle.vy * (1 - turn) + desired.y * turn,
      particle.vz * (1 - turn) + desired.z * turn
    );
    const targetDistance = Math.hypot(
      particleTarget.x - particle.x,
      particleTarget.y - particle.y,
      (particleTarget.z - particle.z) * depthScale
    );
    const arrivalScale = exitMode ? 1 : clamp(targetDistance / 260, 0.3, 1);
    const speed =
      particle.speed *
      arrivalScale *
      (exitMode ? 0.92 : 1) *
      (1 + pointerInfluence * 0.7) *
      dt;

    particle.vx = nextDirection.x;
    particle.vy = nextDirection.y;
    particle.vz = nextDirection.z;

    if (!particle.arrived) {
      particle.x += particle.vx * speed;
      particle.y += particle.vy * speed;
      particle.z = clamp(
        particle.z + (particle.vz * speed) / depthScale,
        -1,
        1
      );
    }

    if (exitMode) {
      const fadeProgress = clamp(
        (elapsed - particle.fadeDelay) / exitFadeMs,
        0,
        1
      );

      particle.opacity =
        particle.fadeStartOpacity * (1 - smoothStep(fadeProgress));
      particle.arrived = fadeProgress >= 1;
    } else if (particle.arrived) {
      particle.opacity += (0 - particle.opacity) * 0.08 * dt;
    } else {
      particle.opacity += (0.88 - particle.opacity) * 0.12 * dt;
    }
  }

  function drawSwarm(swarm, dt, frameIndex) {
    clearSwarmCanvas();

    if (frameIndex === 1 || frameIndex % depthSortInterval === 0) {
      swarm.drawOrder.sort(function (first, second) {
        return second.z - first.z;
      });
    }

    const scrollX = getScrollX();
    const scrollY = getScrollY();
    const depthRange = updateDepthRange(swarm, dt, frameIndex);
    const depthSmoothing = clamp(0.07 * dt, 0.035, 0.18);

    for (let index = 0; index < swarm.drawOrder.length; index += 1) {
      const particle = swarm.drawOrder[index];
      const opacity = clamp(particle.opacity, 0, 0.9);

      if (opacity <= 0.01) {
        continue;
      }

      const targetDepth = clamp(
        (particle.z - depthRange.min) / depthRange.span,
        0.05,
        0.95
      );
      const depthAmount =
        particle.visualDepth == null
          ? targetDepth
          : mix(particle.visualDepth, targetDepth, depthSmoothing);
      const color = depthToBirdColor(depthAmount);
      const perspectiveSize = particle.size * (1.22 - depthAmount * 0.38);
      const drawX = particle.x - scrollX;
      const drawY = particle.y - scrollY;

      if (
        drawX < -perspectiveSize ||
        drawX > canvasWidth + perspectiveSize ||
        drawY < -perspectiveSize ||
        drawY > canvasHeight + perspectiveSize
      ) {
        particle.visualDepth = depthAmount;
        continue;
      }

      particle.visualDepth = depthAmount;
      context.globalAlpha = opacity;
      context.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
      context.beginPath();
      context.arc(drawX, drawY, perspectiveSize / 2, 0, Math.PI * 2);
      context.fill();
    }

    context.globalAlpha = 1;
  }

  function renderSwarm(now) {
    animationFrame = null;

    const swarm = activeSwarm;

    if (!swarm) {
      return;
    }

    if (document.hidden) {
      return;
    }

    const dt = clamp((now - lastFrame) / 16.67, 0.5, 2);
    let elapsed = now - swarmStart;

    if (elapsed >= swarm.flightMs && swarm.mode !== "exit") {
      beginRoamSegment(swarm, now);
      elapsed = 0;
    }

    const leaderProgress = clamp(elapsed / swarm.flightMs, 0, 1);
    const target =
      swarm.mode === "exit"
        ? swarm.finalTarget || swarm.leader
        : leaderPosition(swarm, leaderProgress);
    let visibleParticles = 0;

    swarm.leader = target;
    lastFrame = now;

    if (pointer.active) {
      syncPointerToPage();
    }

    buildParticleGrid(swarm);

    for (let index = 0; index < swarm.particles.length; index += 1) {
      const particle = swarm.particles[index];

      updateParticle(particle, index, swarm, target, dt, elapsed);

      if (
        swarm.mode === "exit"
          ? particle.opacity > 0.02
          : !particle.arrived || particle.opacity > 0.02
      ) {
        visibleParticles += 1;
      }
    }

    swarmFrame += 1;
    drawSwarm(swarm, dt, swarmFrame);

    if (swarm.mode === "exit" && !visibleParticles) {
      activeSwarm = null;
      hideSwarm();

      return;
    }

    requestSwarmFrame();
  }

  function normalizedPathname(pathname) {
    return pathname.replace(/\/index\.html$/, "").replace(/\/$/, "");
  }

  function handleNavigation(event) {
    const link = event.target.closest && event.target.closest("a[href]");

    if (
      !link ||
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      link.target ||
      link.hasAttribute("download")
    ) {
      return;
    }

    const url = new URL(link.href, window.location.href);

    if (url.origin !== window.location.origin) {
      return;
    }

    if (normalizedPathname(url.pathname) === currentPath) {
      return;
    }

    beginExit();
  }

  window.addEventListener("pagehide", resetTrail);
  window.addEventListener("pointermove", handlePointerMove, { passive: true });
  window.addEventListener("pointerleave", clearPointer, { passive: true });
  window.addEventListener("pointercancel", clearPointer, { passive: true });
  window.addEventListener("blur", clearPointer);
  document.addEventListener("visibilitychange", handleSwarmVisibility);

  if (exitHandoff && !isAboutPage) {
    startExitHandoff(exitHandoff);
  } else {
    document.addEventListener("click", handleNavigation, true);
    startAmbientSwarm();
  }
})();

(function () {
  const includes = document.querySelectorAll("[data-include]");
  if (includes.length) {
    includes.forEach(function (node) {
      const path = node.getAttribute("data-include");
      if (!path) {
        return;
      }
      fetch(path)
        .then(function (response) {
          if (!response.ok) {
            throw new Error("Failed to load include");
          }
          return response.text();
        })
        .then(function (html) {
          node.outerHTML = html;
        })
        .catch(function () {
          node.outerHTML = "";
        });
    });
  }

  const targets = document.querySelectorAll("[data-md]");
  if (!targets.length) {
    return;
  }

  const mathJaxSource =
    "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js";
  let mathJaxReady = null;

  function hasTexMath(value) {
    return /(^|[^\\])\$[^$\n]+\$/.test(value) || /\$\$[\s\S]+?\$\$/.test(value);
  }

  function ensureMathJax() {
    if (window.MathJax && window.MathJax.typesetPromise) {
      return Promise.resolve(window.MathJax);
    }

    if (mathJaxReady) {
      return mathJaxReady;
    }

    window.MathJax = window.MathJax || {};
    window.MathJax.tex = Object.assign({}, window.MathJax.tex, {
      inlineMath: [["$", "$"], ["\\(", "\\)"]],
      displayMath: [["$$", "$$"], ["\\[", "\\]"]],
      processEscapes: true,
    });
    window.MathJax.options = Object.assign({}, window.MathJax.options, {
      skipHtmlTags: ["script", "noscript", "style", "textarea", "pre", "code"],
    });

    mathJaxReady = new Promise(function (resolve, reject) {
      const script = document.createElement("script");
      script.src = mathJaxSource;
      script.async = true;
      script.onload = function () {
        resolve(window.MathJax);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });

    return mathJaxReady;
  }

  function typesetMath(target) {
    if (!hasTexMath(target.textContent || "")) {
      return;
    }

    ensureMathJax()
      .then(function (MathJax) {
        if (MathJax.typesetPromise) {
          return MathJax.typesetPromise([target]);
        }
      })
      .catch(function () {
        // Markdown remains readable if the math renderer is unavailable.
      });
  }

  function escapeHtml(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");
  }

  function renderMarkdown(raw) {
    const codeBlocks = [];
    let content = raw.replace(/```(\w+)?\n([\s\S]*?)```/g, function (
      _match,
      lang,
      code
    ) {
      const token = `%%CODEBLOCK_${codeBlocks.length}%%`;
      const safeCode = escapeHtml(code.trimEnd());
      const className = lang ? ` class="language-${lang}"` : "";
      codeBlocks.push(`<pre><code${className}>${safeCode}</code></pre>`);
      return token;
    });

    const lines = content.split(/\r?\n/);
    let html = "";
    let listOpen = false;
    let paragraph = [];

    function renderLink(label, href) {
      const cleanHref = href.trim();
      const isExternal = /^https?:\/\//i.test(cleanHref);
      const externalAttrs = isExternal
        ? ' target="_blank" rel="noopener noreferrer"'
        : "";

      return `<a href="${cleanHref}"${externalAttrs}>${label}</a>`;
    }

    function formatInline(text) {
      return text
        .replace(/\[\[([^\]]+)\]\(([^)]+)\)\]/g, function (_match, label, href) {
          return `[${renderLink(label, href)}]`;
        })
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_match, label, href) {
          return renderLink(label, href);
        })
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>");
    }

    function flushParagraph() {
      if (!paragraph.length) {
        return;
      }
      html += `<p>${formatInline(paragraph.join(" "))}</p>`;
      paragraph = [];
    }

    function closeList() {
      if (listOpen) {
        html += "</ul>";
        listOpen = false;
      }
    }

    lines.forEach(function (line) {
      if (line.includes("%%CODEBLOCK_")) {
        flushParagraph();
        closeList();
        html += line;
        return;
      }

      const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
      if (headingMatch) {
        flushParagraph();
        closeList();
        const level = headingMatch[1].length;
        html += `<h${level}>${formatInline(escapeHtml(headingMatch[2]))}</h${level}>`;
        return;
      }

      const listMatch = line.match(/^\s*-\s+(.*)$/);
      if (listMatch) {
        flushParagraph();
        if (!listOpen) {
          html += "<ul>";
          listOpen = true;
        }
        html += `<li>${formatInline(escapeHtml(listMatch[1]))}</li>`;
        return;
      }

      if (!line.trim()) {
        flushParagraph();
        closeList();
        return;
      }

      paragraph.push(escapeHtml(line.trim()));
    });

    flushParagraph();
    closeList();

    codeBlocks.forEach(function (block, index) {
      html = html.replace(`%%CODEBLOCK_${index}%%`, block);
    });

    return html;
  }

  function renderTarget(target) {
    const path = target.getAttribute("data-md");
    const fallback =
      "<p>Notes failed to load. Check the Markdown file path.</p>";

    fetch(path)
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Failed to load markdown");
        }
        return response.text();
      })
      .then(function (text) {
        target.innerHTML = renderMarkdown(text) || fallback;
        typesetMath(target);
      })
      .catch(function () {
        target.innerHTML = fallback;
      });
  }

  targets.forEach(renderTarget);
})();
