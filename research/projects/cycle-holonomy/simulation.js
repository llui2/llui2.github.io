// Cycle-holonomy simulation notes:
// This page shows seven coupled oscillators on two connected motifs. The top
// canvas shows their phases around the nodes; the lower canvas tracks how far
// the evolving state moves from a reference solution. The slider changes alpha,
// and the shuffle button starts from a random state.
(function () {
  "use strict";

  // This script is also loaded on pages without the simulation.
  const root = document.querySelector("[data-holonomy-simulation]");
  if (!root) {
    return;
  }

  // Find the controls and the two drawing surfaces inside this simulation only.
  const alphaInput = root.querySelector("#holonomyAlpha");
  const shuffleButton = root.querySelector("[data-simulation-shuffle]");
  const motifCanvas = root.querySelector(".holonomy-motif-canvas");
  const plotCanvas = root.querySelector(".holonomy-plot-canvas");

  if (!alphaInput || !shuffleButton || !motifCanvas || !plotCanvas) {
    return;
  }

  const motifContext = motifCanvas.getContext("2d");
  const plotContext = plotCanvas.getContext("2d");

  if (!motifContext || !plotContext) {
    return;
  }

  // Model/display settings. alpha is the phase-lag value controlled by the slider.
  // criticalAlpha is the transition value discussed on the page; the other
  // values control the initial disturbance and plot.
  const criticalAlpha = 1.0164;
  const initialPerturbation = 1e-5;
  const twoPi = Math.PI * 2;
  const timeWindow = 60;
  const sampleInterval = 0.15;
  const maxHistorySamples = Math.ceil((timeWindow + 1) / sampleInterval) + 3;
  const plotMax = 2;
  // The graph has a triangle sharing one node with a five-node cycle.
  const edges = [
    [0, 1],
    [1, 2],
    [2, 0],
    [0, 3],
    [3, 4],
    [4, 5],
    [5, 6],
    [6, 0],
  ];
  // Convert the edge list into a neighbor list so each node knows who affects it.
  const neighbors = Array.from({ length: 7 }, function () {
    return [];
  });

  edges.forEach(function (edge) {
    neighbors[edge[0]].push(edge[1]);
    neighbors[edge[1]].push(edge[0]);
  });

  // Live simulation state:
  // phases = the seven node angles; referencePhases = the balanced comparison state.
  // history = recorded plot samples; time/sampleClock track simulation progress.
  let phases = [];
  let referencePhases = [];
  let history = [];
  let time = 0;
  let lastFrame = 0;
  let sampleClock = 0;
  let previousAlpha = Number(alphaInput.value);
  let frameRequest = 0;

  function cssColor(name, fallback) {
    // Read a site color from CSS, using the fallback if it is missing.
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    return value || fallback;
  }

  function resizeCanvas(canvas, context) {
    // Match the drawing buffer to the displayed size, including high-DPI screens.
    const bounds = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(bounds.width * ratio));
    const height = Math.max(1, Math.round(bounds.height * ratio));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { width: bounds.width, height: bounds.height };
  }

  function wrapPhase(value) {
    // Keep an angle in the interval from -pi to pi.
    return ((value + Math.PI) % twoPi + twoPi) % twoPi - Math.PI;
  }

  function lockedBranch(alpha) {
    // Find the balanced/reference phases for the chosen alpha. We move through
    // smaller alpha values and use Newton's method at each step so the solution
    // follows the same branch instead of jumping to a different solution.
    const continuationSteps = Math.max(1, Math.ceil(alpha / 0.01));
    let x = 0;
    let y = 0;

    for (let step = 1; step <= continuationSteps; step += 1) {
      const currentAlpha = (alpha * step) / continuationSteps;

      // Apply twelve Newton updates at each continuation step.
      for (let iteration = 0; iteration < 12; iteration += 1) {
        const f1 =
          Math.sin(y + currentAlpha) -
          2 * Math.sin(x) * Math.cos(currentAlpha) -
          Math.sin(currentAlpha);
        const f2 =
          2 * Math.sin(x - currentAlpha) +
          2 * Math.sin(y - currentAlpha) +
          Math.sin(x + currentAlpha) +
          Math.sin(currentAlpha);
        const j11 = -2 * Math.cos(x) * Math.cos(currentAlpha);
        const j12 = Math.cos(y + currentAlpha);
        const j21 =
          2 * Math.cos(x - currentAlpha) + Math.cos(x + currentAlpha);
        const j22 = 2 * Math.cos(y - currentAlpha);
        // The Jacobian describes how the two equations change with x and y.
        const determinant = j11 * j22 - j12 * j21;

        if (Math.abs(determinant) < 1e-12) {
          break;
        }

        const deltaX = (-f1 * j22 + j12 * f2) / determinant;
        const deltaY = (j21 * f1 - j11 * f2) / determinant;
        x += deltaX;
        y += deltaY;

        if (Math.hypot(deltaX, deltaY) < 1e-12) {
          break;
        }
      }
    }

    return { x: x, y: y, z: x + y };
  }

  function resetSimulation() {
    // Rebuild the reference state, add the tiny transverse disturbance, and
    // clear the time series whenever the simulation starts over.
    const alpha = Number(alphaInput.value);
    updateReferenceBranch(alpha);
    phases = referencePhases.slice();
    seedTransverseMode();
    history = [];
    time = 0;
    sampleClock = 0;
    lastFrame = 0;
    recordSample();
    draw();
  }

  function updateReferenceBranch(alpha) {
    // The two independent phase values x and y determine the seven-node pattern.
    const branch = lockedBranch(alpha);
    referencePhases = [
      0,
      branch.x,
      branch.x,
      branch.y,
      branch.z,
      branch.z,
      branch.y,
    ];
  }

  function seedTransverseMode() {
    // Add a small disturbance in the mode that becomes visible near critical alpha.
    const xi1 = initialPerturbation;
    // Unstable pentagonal eigenvector at alpha_c: xi2 / xi1 ≈ 0.309.
    const xi2 = 0.309 * xi1;

    phases[3] = wrapPhase(phases[3] + xi1);
    phases[4] = wrapPhase(phases[4] + xi2);
    phases[5] = wrapPhase(phases[5] - xi2);
    phases[6] = wrapPhase(phases[6] - xi1);
  }

  function derivatives(values, alpha) {
    // Return each oscillator's instantaneous angular velocity from its neighbors.
    return values.map(function (phase, node) {
      return neighbors[node].reduce(function (velocity, neighbor) {
        return velocity + Math.sin(values[neighbor] - phase - alpha);
      }, 0);
    });
  }

  function integrate(alpha, dt) {
    // Advance the ODE with RK4, using four estimates per step.
    const k1 = derivatives(phases, alpha);
    const middle = phases.map(function (phase, index) {
      return phase + k1[index] * dt * 0.5;
    });
    const k2 = derivatives(middle, alpha);
    const nextMiddle = phases.map(function (phase, index) {
      return phase + k2[index] * dt * 0.5;
    });
    const k3 = derivatives(nextMiddle, alpha);
    const end = phases.map(function (phase, index) {
      return phase + k3[index] * dt;
    });
    const k4 = derivatives(end, alpha);

    phases = phases.map(function (phase, index) {
      return wrapPhase(
        phase +
          (dt / 6) *
            (k1[index] + 2 * k2[index] + 2 * k3[index] + k4[index])
      );
    });
    time += dt;
  }

  function branchResiduals() {
    // Compare the live phases with the reference while ignoring one shared
    // rotation of all phases (which does not change the relative pattern).
    const offsets = phases.map(function (phase, index) {
      return wrapPhase(phase - referencePhases[index]);
    });
    const meanCosine = offsets.reduce(function (sum, offset) {
      return sum + Math.cos(offset);
    }, 0);
    const meanSine = offsets.reduce(function (sum, offset) {
      return sum + Math.sin(offset);
    }, 0);
    const collectiveRotation = Math.atan2(meanSine, meanCosine);

    return offsets.map(function (offset) {
      return wrapPhase(offset - collectiveRotation);
    });
  }

  function branchDeviation() {
    // Reduce the residuals to one RMS distance for the lower plot.
    const residuals = branchResiduals();
    const squaredDistance = residuals.reduce(function (sum, residual) {
      return sum + residual * residual;
    }, 0);

    return Math.sqrt(squaredDistance / residuals.length);
  }

  function recordSample() {
    // Save one plot point and discard samples older than the visible time window.
    const deviation = branchDeviation();
    history.push({
      time: time,
      deviation: deviation,
    });

    const firstVisibleTime = Math.max(0, time - timeWindow - 1);
    while (
      history.length > 2 &&
      (history[1].time < firstVisibleTime || history.length > maxHistorySamples)
    ) {
      history.shift();
    }
  }

  function nodePositions(width, height) {
    // Place the shared triangle and five-cycle motif in the upper canvas.
    const padding = 30;
    const availableHeight = Math.max(1, height - padding * 2);
    const side = Math.min(width * 0.3, availableHeight / 2.55);
    const pentagonRadius = side / (2 * Math.sin(Math.PI / 5));
    const centerX = width * 0.5;
    const motifHeight =
      (Math.sqrt(3) / 2) * side +
      pentagonRadius * (1 + Math.sin((3 * Math.PI) / 10));
    const sharedY =
      padding +
      (availableHeight - motifHeight) * 0.5 +
      (Math.sqrt(3) / 2) * side;
    const positions = [
      { x: centerX, y: sharedY },
      {
        x: centerX - side * 0.5,
        y: sharedY - (Math.sqrt(3) / 2) * side,
      },
      {
        x: centerX + side * 0.5,
        y: sharedY - (Math.sqrt(3) / 2) * side,
      },
    ];

    for (let index = 1; index <= 4; index += 1) {
      const angle = -Math.PI / 2 - index * (twoPi / 5);
      positions.push({
        x: centerX + Math.cos(angle) * pentagonRadius,
        y: sharedY + pentagonRadius + Math.sin(angle) * pentagonRadius,
      });
    }

    return positions;
  }

  function phaseColor(phase) {
    // Map an angle to a color around the hue circle.
    const hue = (((phase / twoPi) * 360) % 360 + 360) % 360;
    return "hsl(" + hue.toFixed(1) + " 94% 62%)";
  }

  function drawMotif() {
    // Draw graph edges and a colored marker at each node's phase angle.
    const size = resizeCanvas(motifCanvas, motifContext);
    const positions = nodePositions(size.width, size.height);
    const structureColor = "#a8d9bd";
    const radius = Math.max(12, Math.min(size.width, size.height) * 0.05);
    const alpha = Number(alphaInput.value);

    motifContext.clearRect(0, 0, size.width, size.height);
    motifContext.lineCap = "round";

    edges.forEach(function (edge) {
      const start = positions[edge[0]];
      const end = positions[edge[1]];
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const distance = Math.hypot(dx, dy) || 1;
      const unitX = dx / distance;
      const unitY = dy / distance;
      // Larger phase mismatch makes the connecting edge more visible.
      const mismatch = Math.abs(
        Math.sin((phases[edge[1]] - phases[edge[0]] - alpha) * 0.5)
      );
      motifContext.beginPath();
      motifContext.moveTo(start.x + unitX * radius, start.y + unitY * radius);
      motifContext.lineTo(end.x - unitX * radius, end.y - unitY * radius);
      motifContext.strokeStyle = structureColor;
      motifContext.globalAlpha = 0.22 + mismatch * 0.48;
      motifContext.lineWidth = 2.6;
      motifContext.stroke();
    });
    motifContext.globalAlpha = 1;

    positions.forEach(function (position, index) {
      const phase = phases[index];
      const markerOrbit = radius;
      const markerRadius = Math.max(4.5, radius * 0.34);
      const color = phaseColor(phase);

      motifContext.beginPath();
      motifContext.arc(position.x, position.y, radius, 0, twoPi);
      motifContext.strokeStyle = structureColor;
      motifContext.lineWidth = 2.8;
      motifContext.stroke();

      motifContext.beginPath();
      motifContext.arc(
        position.x + Math.cos(phase) * markerOrbit,
        position.y - Math.sin(phase) * markerOrbit,
        markerRadius,
        0,
        twoPi
      );
      motifContext.fillStyle = color;
      motifContext.fill();
    });
  }

  function drawSeries(values, color, bounds, startTime) {
    // Draw one clipped line series from time/value samples.
    if (values.length < 2) {
      return;
    }

    plotContext.save();
    plotContext.beginPath();
    plotContext.rect(
      bounds.left - 2,
      bounds.top - 2,
      bounds.right - bounds.left + 4,
      bounds.bottom - bounds.top + 4
    );
    plotContext.clip();
    plotContext.beginPath();
    values.forEach(function (sample, index) {
      const x =
        bounds.left +
        ((sample.time - startTime) / timeWindow) *
          (bounds.right - bounds.left);
      const y =
        bounds.bottom -
        sample.value * (bounds.bottom - bounds.top);
      if (index === 0) {
        plotContext.moveTo(x, y);
      } else {
        plotContext.lineTo(x, y);
      }
    });
    plotContext.strokeStyle = color;
    plotContext.lineWidth = 2;
    plotContext.stroke();
    plotContext.restore();
  }

  function drawPlot() {
    // Draw axes, labels, and the deviation history below the oscillator motif.
    const size = resizeCanvas(plotCanvas, plotContext);
    const accent = cssColor("--accent", "#fc4c02");
    const foreground = cssColor("--fg", "#0f1222");
    const dim = cssColor("--dim", "#5a5f73");
    const bounds = {
      left: 66,
      right: size.width - 12,
      top: 16,
      bottom: size.height - 31,
    };
    const startTime = Math.max(0, time - timeWindow);

    plotContext.clearRect(0, 0, size.width, size.height);
    plotContext.font = "13px ui-monospace, SFMono-Regular, Menlo, monospace";
    plotContext.textBaseline = "middle";

    [0, 1, 2].forEach(function (value) {
      const y = bounds.bottom - (value / plotMax) * (bounds.bottom - bounds.top);
      plotContext.beginPath();
      plotContext.moveTo(bounds.left - 3, y);
      plotContext.lineTo(bounds.left, y);
      plotContext.strokeStyle = foreground;
      plotContext.lineWidth = 1;
      plotContext.stroke();
      plotContext.fillStyle = dim;
      plotContext.textAlign = "right";
      plotContext.fillText(String(value), bounds.left - 8, y);
    });

    plotContext.beginPath();
    plotContext.moveTo(bounds.left, bounds.top);
    plotContext.lineTo(bounds.left, bounds.bottom);
    plotContext.lineTo(bounds.right, bounds.bottom);
    plotContext.strokeStyle = foreground;
    plotContext.lineWidth = 1;
    plotContext.stroke();

    // Include the current state so the line reaches the live animation frame.
    const plotSamples = history.slice();
    const latestSample = plotSamples[plotSamples.length - 1];
    if (!latestSample || latestSample.time < time) {
      // Use the same live phase state that drawMotif() has just rendered.
      plotSamples.push({ time: time, deviation: branchDeviation() });
    }
    const visible = plotSamples.filter(function (sample) {
      return sample.time >= startTime;
    });
    drawSeries(
      visible.map(function (sample) {
        return {
          time: sample.time,
          value: Math.max(0, Math.min(1, sample.deviation / plotMax)),
        };
      }),
      accent,
      bounds,
      startTime
    );

    plotContext.fillStyle = foreground;
    plotContext.textAlign = "center";
    plotContext.fillText("time  t", (bounds.left + bounds.right) * 0.5, size.height - 7);
    plotContext.save();
    plotContext.translate(10, (bounds.top + bounds.bottom) * 0.5);
    plotContext.rotate(-Math.PI / 2);
    plotContext.fillText("distance from reference branch", 0, 0);
    plotContext.restore();
  }

  function draw() {
    // Redraw both canvases from the current simulation state.
    drawMotif();
    drawPlot();
  }

  function updateAlphaProgress() {
    // Color the slider track up to the current alpha value.
    const alpha = Number(alphaInput.value);
    const min = Number(alphaInput.min);
    const max = Number(alphaInput.max);
    const progress = max > min ? ((alpha - min) / (max - min)) * 100 : 0;
    alphaInput.style.setProperty("--range-progress", progress + "%");
  }

  function animate(timestamp) {
    // Convert real elapsed time into simulation time, then request another frame.
    const elapsed = lastFrame ? Math.min((timestamp - lastFrame) / 1000, 0.05) : 0;
    lastFrame = timestamp;

    if (elapsed > 0) {
      const alpha = Number(alphaInput.value);
      // Speed up playback above alpha_c without changing the underlying equation.
      const playbackRate = alpha > criticalAlpha ? 4.5 : 3;
      let remaining = elapsed * playbackRate;
      while (remaining > 0) {
        const step = Math.min(0.012, remaining);
        integrate(alpha, step);
        sampleClock += step;
        if (sampleClock >= sampleInterval) {
          recordSample();
          sampleClock -= sampleInterval;
        }
        remaining -= step;
      }
    }

    draw();
    frameRequest = window.requestAnimationFrame(animate);
  }

  // Slider changes update the reference branch and seed the unstable mode when
  // crossing the critical value from below.
  alphaInput.addEventListener("input", function () {
    const alpha = Number(alphaInput.value);
    updateAlphaProgress();
    updateReferenceBranch(alpha);
    if (previousAlpha < criticalAlpha && alpha >= criticalAlpha) {
      seedTransverseMode();
    }
    previousAlpha = alpha;
  });

  // Randomize all phases while keeping the same graph and current alpha.
  shuffleButton.addEventListener("click", function () {
    phases = phases.map(function () {
      return Math.random() * twoPi - Math.PI;
    });
    draw();
  });

  // Redraw after resizing and reset frame timing when the tab becomes visible.
  window.addEventListener("resize", draw);
  document.addEventListener("visibilitychange", function () {
    lastFrame = 0;
  });

  // Initial draw, followed by the continuous animation loop.
  updateAlphaProgress();
  resetSimulation();
  frameRequest = window.requestAnimationFrame(animate);

  // Stop requesting frames after the page is left.
  window.addEventListener("pagehide", function () {
    window.cancelAnimationFrame(frameRequest);
  });
})();
