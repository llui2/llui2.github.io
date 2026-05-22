(function () {
  const svg = document.getElementById("researchGraph");

  if (!svg) {
    return;
  }

  const svgNs = "http://www.w3.org/2000/svg";
  const edgeGap = 2.5;
  const dragThreshold = 4;
  const dragMargin = 260;
  const maxDiskRadius = 0.9;
  const maxVelocity = 0.012;
  const reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const nodes = [
    {
      id: "cycle",
      type: "paper",
      label: "cycle holonomy",
      year: "2026",
      href: "https://arxiv.org/abs/2604.19682",
      h: 0.36,
      theta: -2.25,
      radius: 15,
      depth: 0,
    },
    {
      id: "remote",
      type: "reference",
      label: "remote symmetries",
      year: "2013",
      href: "https://doi.org/10.1103/PhysRevLett.110.174102",
      h: 0.94,
      theta: -2.68,
      radius: 9,
      depth: 1,
    },
    {
      id: "remote-analysis",
      type: "topic",
      label: "remote analysis",
      year: "2013",
      href: "https://doi.org/10.1063/1.4824312",
      h: 1.34,
      theta: -2.34,
      radius: 7,
      depth: 2,
    },
    {
      id: "master-stability",
      type: "topic",
      label: "master stability",
      year: "1998",
      href: "https://doi.org/10.1103/PhysRevLett.80.2109",
      h: 1.52,
      theta: -2.14,
      radius: 6,
      depth: 3,
    },
    {
      id: "sakaguchi",
      type: "topic",
      label: "Sakaguchi-Kuramoto",
      year: "1986",
      href: "https://doi.org/10.1143/PTP.76.576",
      h: 0.98,
      theta: -2.02,
      radius: 8,
      depth: 1,
    },
    {
      id: "magnetic-laplacian",
      type: "reference",
      label: "magnetic Laplacian",
      year: "1994",
      href: "https://doi.org/10.1007/BF02101702",
      h: 0.98,
      theta: -1.58,
      radius: 9,
      depth: 1,
    },
    {
      id: "spectral-sheaves",
      type: "topic",
      label: "spectral sheaves",
      year: "2019",
      href: "https://doi.org/10.1007/s41468-019-00038-7",
      h: 1.48,
      theta: -1.18,
      radius: 6,
      depth: 2,
    },
    {
      id: "indirect",
      type: "paper",
      label: "indirect diffusion",
      year: "2025",
      href: "https://doi.org/10.1038/s42005-025-02403-8",
      h: 0.34,
      theta: -0.56,
      radius: 15,
      depth: 0,
    },
    {
      id: "estrada",
      type: "reference",
      label: "path Laplacians",
      year: "2012",
      href: "https://doi.org/10.1016/j.laa.2011.11.032",
      h: 0.94,
      theta: -0.28,
      radius: 9,
      depth: 1,
    },
    {
      id: "fractional-dynamics",
      type: "topic",
      label: "fractional dynamics",
      year: "2014",
      href: "https://doi.org/10.1103/PhysRevE.90.032809",
      h: 1.18,
      theta: -0.72,
      radius: 8,
      depth: 1,
    },
    {
      id: "super",
      type: "paper",
      label: "super-diffusion",
      year: "2024",
      href: "https://doi.org/10.1016/j.chaos.2024.115265",
      h: 0.36,
      theta: 1.52,
      radius: 15,
      depth: 0,
    },
    {
      id: "gomez",
      type: "reference",
      label: "multiplex diffusion",
      year: "2013",
      href: "https://doi.org/10.1103/PhysRevLett.110.028701",
      h: 0.98,
      theta: 0.72,
      radius: 9,
      depth: 1,
    },
    {
      id: "supra-laplacian",
      type: "topic",
      label: "supra-Laplacian",
      year: "2013",
      href: "https://doi.org/10.1103/PhysRevE.88.032807",
      h: 1.34,
      theta: 0.52,
      radius: 7,
      depth: 2,
    },
    {
      id: "multilayer-tensor",
      type: "topic",
      label: "multilayer tensor",
      year: "2013",
      href: "https://doi.org/10.1103/PhysRevX.3.041022",
      h: 1.38,
      theta: 0.92,
      radius: 7,
      depth: 2,
    },
    {
      id: "layer-dissimilarity",
      type: "topic",
      label: "layer dissimilarity",
      year: "2017",
      href: "https://doi.org/10.1103/PhysRevE.95.052312",
      h: 1.1,
      theta: 2.15,
      radius: 7,
      depth: 1,
    },
    {
      id: "diffusive-behavior",
      type: "topic",
      label: "diffusive behavior",
      year: "2019",
      href: "https://doi.org/10.1088/1367-2630/ab060c",
      h: 1.52,
      theta: 1.78,
      radius: 6,
      depth: 2,
    },
  ];
  const edges = [
    { source: "cycle", target: "remote", distance: 0.82 },
    { source: "remote", target: "remote-analysis", distance: 0.7 },
    { source: "remote-analysis", target: "master-stability", distance: 0.58 },
    { source: "cycle", target: "sakaguchi", distance: 0.74 },
    { source: "cycle", target: "magnetic-laplacian", distance: 0.86 },
    { source: "magnetic-laplacian", target: "spectral-sheaves", distance: 0.68 },
    { source: "indirect", target: "super", distance: 0.82 },
    { source: "indirect", target: "estrada", distance: 0.84 },
    { source: "indirect", target: "fractional-dynamics", distance: 0.78 },
    { source: "super", target: "gomez", distance: 0.84 },
    { source: "gomez", target: "supra-laplacian", distance: 0.66 },
    { source: "gomez", target: "multilayer-tensor", distance: 0.72 },
    { source: "super", target: "layer-dissimilarity", distance: 0.76 },
    { source: "layer-dissimilarity", target: "diffusive-behavior", distance: 0.62 },
    { source: "gomez", target: "diffusive-behavior", distance: 0.88 },
  ];

  const nodesById = {};
  let width = 1;
  let height = 1;
  let centerX = 0;
  let centerY = 0;
  let diskRadius = 1;
  let activeNode = null;
  let activePointerId = null;

  function createElement(name, attributes) {
    const element = document.createElementNS(svgNs, name);
    Object.keys(attributes || {}).forEach(function (key) {
      element.setAttribute(key, attributes[key]);
    });
    return element;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function tanh(value) {
    if (Math.tanh) {
      return Math.tanh(value);
    }

    const positive = Math.exp(value);
    const negative = Math.exp(-value);
    return (positive - negative) / (positive + negative);
  }

  function atanh(value) {
    if (Math.atanh) {
      return Math.atanh(value);
    }

    const bounded = clamp(value, -0.9999, 0.9999);
    return Math.log((1 + bounded) / (1 - bounded)) / 2;
  }

  function length(point) {
    return Math.sqrt(point.x * point.x + point.y * point.y);
  }

  function dot(a, b) {
    return a.x * b.x + a.y * b.y;
  }

  function hyperbolicPolar(h, theta) {
    const rho = tanh(h / 2);
    return {
      x: rho * Math.cos(theta),
      y: rho * Math.sin(theta),
    };
  }

  function mobiusAdd(a, b) {
    const aa = dot(a, a);
    const bb = dot(b, b);
    const ab = dot(a, b);
    const denominator = 1 + 2 * ab + aa * bb || 1;

    return {
      x: ((1 + 2 * ab + bb) * a.x + (1 - aa) * b.x) / denominator,
      y: ((1 + 2 * ab + bb) * a.y + (1 - aa) * b.y) / denominator,
    };
  }

  function mobiusScale(t, point) {
    const norm = length(point);

    if (norm < 0.00001) {
      return { x: 0, y: 0 };
    }

    const scaled = tanh(t * atanh(clamp(norm, 0, 0.9999))) / norm;
    return {
      x: point.x * scaled,
      y: point.y * scaled,
    };
  }

  function geodesicLerp(a, b, t) {
    return mobiusAdd(a, mobiusScale(t, mobiusAdd({ x: -a.x, y: -a.y }, b)));
  }

  function hyperbolicDistance(a, b) {
    return 2 * atanh(clamp(length(mobiusAdd({ x: -a.x, y: -a.y }, b)), 0, 0.9999));
  }

  function constrainToDisk(point) {
    const pointLength = length(point);

    if (pointLength <= maxDiskRadius) {
      return point;
    }

    return {
      x: (point.x / pointLength) * maxDiskRadius,
      y: (point.y / pointLength) * maxDiskRadius,
    };
  }

  function diskToScreen(point) {
    return {
      x: centerX + point.x * diskRadius,
      y: centerY + point.y * diskRadius,
    };
  }

  function screenToDisk(point) {
    return constrainToDisk({
      x: (point.x - centerX) / diskRadius,
      y: (point.y - centerY) / diskRadius,
    });
  }

  function clientPoint(event) {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(svg.getScreenCTM().inverse());
  }

  function openNode(node) {
    window.open(node.href, "_blank", "noopener,noreferrer");
  }

  function outsideDragRange(event) {
    const rect = svg.getBoundingClientRect();

    return (
      event.clientX < rect.left - dragMargin ||
      event.clientX > rect.right + dragMargin ||
      event.clientY < rect.top - dragMargin ||
      event.clientY > rect.bottom + dragMargin
    );
  }

  function releaseDrag() {
    if (!activeNode) {
      return;
    }

    activeNode.element.classList.remove("is-dragging");
    activeNode = null;
    activePointerId = null;
  }

  function renderNode(node) {
    const group = createElement("g", {
      class:
        "research-graph-link research-graph-link-" +
        node.type +
        " research-graph-depth-" +
        node.depth,
      "aria-label": node.label + " " + node.type,
      role: "link",
      tabindex: "0",
    });
    const hit = createElement("circle", {
      class: "research-graph-hit",
      r: Math.max(node.radius + 18, 31),
    });
    const circle = createElement("circle", {
      class: "research-graph-node research-graph-node-" + node.type,
      r: node.radius,
    });
    const labelClass =
      "research-graph-label research-graph-label-" +
      node.type +
      (node.type === "paper" ? "" : " is-hidden");
    const label = createElement("text", {
      class: labelClass,
    });
    const labelLine = createElement("tspan", { dy: "0" });
    const yearLine = createElement("tspan", {
      class: "research-graph-year",
      dy: "1.35em",
    });

    labelLine.textContent = node.label;
    yearLine.textContent = node.year;
    label.appendChild(labelLine);
    label.appendChild(yearLine);
    group.appendChild(hit);
    group.appendChild(circle);
    group.appendChild(label);
    svg.appendChild(group);

    node.element = group;
    node.labelElement = label;
    node.labelLine = labelLine;
    node.yearLine = yearLine;

    group.addEventListener("click", function () {
      if (!node.dragged) {
        openNode(node);
      }
    });
    group.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openNode(node);
      }
    });
    group.addEventListener("pointerdown", function (event) {
      event.preventDefault();
      const point = clientPoint(event);
      const screen = diskToScreen(node.position);
      activeNode = node;
      activePointerId = event.pointerId;
      node.dragged = false;
      node.dragStartX = event.clientX;
      node.dragStartY = event.clientY;
      node.dragOffsetX = point.x - screen.x;
      node.dragOffsetY = point.y - screen.y;
      group.classList.add("is-dragging");
      if (group.setPointerCapture) {
        group.setPointerCapture(event.pointerId);
      }
    });
    group.addEventListener("pointermove", function (event) {
      if (activeNode !== node) {
        return;
      }

      event.preventDefault();

      if (outsideDragRange(event)) {
        releaseDrag();
        return;
      }

      const point = clientPoint(event);
      const dx = event.clientX - node.dragStartX;
      const dy = event.clientY - node.dragStartY;
      node.dragged = node.dragged || Math.sqrt(dx * dx + dy * dy) > dragThreshold;
      node.position = screenToDisk({
        x: point.x - node.dragOffsetX,
        y: point.y - node.dragOffsetY,
      });
      node.velocity = { x: 0, y: 0 };
      draw();
    });
    group.addEventListener("pointerup", releaseDrag);
    group.addEventListener("pointercancel", releaseDrag);
    group.addEventListener("lostpointercapture", releaseDrag);
  }

  function renderEdge(edge) {
    const path = createElement("path", {
      class: "research-graph-edge",
      "data-source": edge.source.id,
      "data-target": edge.target.id,
    });

    svg.appendChild(path);
    return path;
  }

  function addForce(node, force) {
    if (node === activeNode) {
      return;
    }

    node.force.x += force.x;
    node.force.y += force.y;
  }

  function applyRadialForces() {
    nodes.forEach(function (node) {
      const rho = length(node.position);
      const target = node.targetRho;
      const angle = rho < 0.00001 ? node.theta : Math.atan2(node.position.y, node.position.x);
      const pull = (target - rho) * 0.02;

      addForce(node, {
        x: Math.cos(angle) * pull,
        y: Math.sin(angle) * pull,
      });
    });
  }

  function applyEdgeForces() {
    edgeElements.forEach(function (edge) {
      const source = edge.source;
      const target = edge.target;
      const dx = target.position.x - source.position.x;
      const dy = target.position.y - source.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      const distanceError =
        hyperbolicDistance(source.position, target.position) - edge.distance;
      const force = distanceError * 0.004;

      addForce(source, {
        x: (dx / distance) * force,
        y: (dy / distance) * force,
      });
      addForce(target, {
        x: (-dx / distance) * force,
        y: (-dy / distance) * force,
      });
    });
  }

  function applySeparationForces() {
    for (let a = 0; a < nodes.length; a += 1) {
      for (let b = a + 1; b < nodes.length; b += 1) {
        const first = nodes[a];
        const second = nodes[b];
        const firstScreen = diskToScreen(first.position);
        const secondScreen = diskToScreen(second.position);
        const dx = secondScreen.x - firstScreen.x || 0.01;
        const dy = secondScreen.y - firstScreen.y || 0.01;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const firstDeep = first.depth >= 3;
        const secondDeep = second.depth >= 3;
        let minimum = 66;

        if (first.type === "paper" && second.type === "paper") {
          minimum = 128;
        } else if (first.type === "paper" || second.type === "paper") {
          minimum = 96;
        } else if (firstDeep && secondDeep) {
          minimum = 44;
        } else if (firstDeep || secondDeep) {
          minimum = 54;
        }

        if (distance >= minimum) {
          continue;
        }

        const push = ((minimum - distance) / diskRadius) * 0.022;
        addForce(first, {
          x: (-dx / distance) * push,
          y: (-dy / distance) * push,
        });
        addForce(second, {
          x: (dx / distance) * push,
          y: (dy / distance) * push,
        });
      }
    }
  }

  function applyViewportForces() {
    const padding = 28;

    nodes.forEach(function (node) {
      const screen = diskToScreen(node.position);
      let x = 0;
      let y = 0;

      if (screen.x < padding) {
        x = (padding - screen.x) / diskRadius;
      } else if (screen.x > width - padding) {
        x = (width - padding - screen.x) / diskRadius;
      }

      if (screen.y < padding) {
        y = (padding - screen.y) / diskRadius;
      } else if (screen.y > height - padding) {
        y = (height - padding - screen.y) / diskRadius;
      }

      addForce(node, {
        x: x * 0.015,
        y: y * 0.03,
      });
    });
  }

  function moveNodes() {
    nodes.forEach(function (node) {
      if (node === activeNode) {
        return;
      }

      node.velocity.x = clamp((node.velocity.x + node.force.x) * 0.78, -maxVelocity, maxVelocity);
      node.velocity.y = clamp((node.velocity.y + node.force.y) * 0.78, -maxVelocity, maxVelocity);
      node.position = constrainToDisk({
        x: node.position.x + node.velocity.x,
        y: node.position.y + node.velocity.y,
      });
    });
  }

  function labelSize(node) {
    return {
      width: Math.max(node.label.length * 7.3, node.year.length * 6.2) + 4,
      height: 28,
    };
  }

  function overlapArea(a, b) {
    const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    return x * y;
  }

  function labelCandidates(node, screen, size) {
    const gap = node.radius + 14;
    const outwardX = screen.x >= centerX ? gap : -size.width - gap;
    const outwardY = screen.y >= centerY ? 14 : -size.height - 8;

    return [
      { left: screen.x + outwardX, top: screen.y + outwardY },
      { left: screen.x + gap, top: screen.y - size.height - 8 },
      { left: screen.x - size.width - gap, top: screen.y - size.height - 8 },
      { left: screen.x + gap, top: screen.y + 14 },
      { left: screen.x - size.width - gap, top: screen.y + 14 },
      { left: screen.x - size.width / 2, top: screen.y - node.radius - size.height - 12 },
      { left: screen.x - size.width / 2, top: screen.y + node.radius + 12 },
    ];
  }

  function chooseLabelPositions() {
    const placed = [];
    const order = nodes.slice().sort(function (a, b) {
      return a.type === b.type ? 0 : a.type === "paper" ? -1 : 1;
    });

    order.forEach(function (node) {
      const screen = diskToScreen(node.position);
      const size = labelSize(node);
      let best = null;
      let bestScore = Infinity;

      labelCandidates(node, screen, size).forEach(function (candidate, index) {
        const rect = {
          left: candidate.left,
          top: candidate.top,
          right: candidate.left + size.width,
          bottom: candidate.top + size.height,
        };
        const outside =
          Math.max(0, 10 - rect.left) +
          Math.max(0, rect.right - (width - 10)) +
          Math.max(0, 10 - rect.top) +
          Math.max(0, rect.bottom - (height - 10));
        const overlap = placed.reduce(function (sum, other) {
          return sum + overlapArea(rect, other);
        }, 0);
        const score = outside * 30 + overlap * 3 + index;

        if (score < bestScore) {
          bestScore = score;
          best = rect;
        }
      });

      node.labelX = best.left - screen.x;
      node.labelY = best.top + 11 - screen.y;
      placed.push(best);
    });
  }

  function edgePath(edge) {
    const source = edge.source;
    const target = edge.target;
    const sourceScreen = diskToScreen(source.position);
    const targetScreen = diskToScreen(target.position);
    let startT = clippedStartT(source, target, sourceScreen);
    let endT = clippedEndT(source, target, targetScreen);
    const segments = 18;
    let path = "";

    if (startT > endT) {
      startT = 0.48;
      endT = 0.52;
    }

    for (let index = 0; index <= segments; index += 1) {
      const t = startT + ((endT - startT) * index) / segments;
      const point = diskToScreen(geodesicLerp(source.position, target.position, t));
      path +=
        (index === 0 ? "M " : " L ") +
        point.x.toFixed(1) +
        " " +
        point.y.toFixed(1);
    }

    return path;
  }

  function clippedStartT(source, target, sourceScreen) {
    let low = 0;
    let high = 1;
    const targetDistance = source.radius + edgeGap;

    for (let index = 0; index < 14; index += 1) {
      const middle = (low + high) / 2;
      const point = diskToScreen(geodesicLerp(source.position, target.position, middle));
      const distance = Math.sqrt(
        Math.pow(point.x - sourceScreen.x, 2) +
          Math.pow(point.y - sourceScreen.y, 2)
      );

      if (distance < targetDistance) {
        low = middle;
      } else {
        high = middle;
      }
    }

    return high;
  }

  function clippedEndT(source, target, targetScreen) {
    let low = 0;
    let high = 1;
    const targetDistance = target.radius + edgeGap;

    for (let index = 0; index < 14; index += 1) {
      const middle = (low + high) / 2;
      const point = diskToScreen(geodesicLerp(source.position, target.position, middle));
      const distance = Math.sqrt(
        Math.pow(point.x - targetScreen.x, 2) +
          Math.pow(point.y - targetScreen.y, 2)
      );

      if (distance > targetDistance) {
        low = middle;
      } else {
        high = middle;
      }
    }

    return low;
  }

  function resize() {
    const rect = svg.getBoundingClientRect();
    width = Math.max(rect.width, 320);
    height = Math.max(rect.height, 300);
    centerX = width / 2;
    centerY = height / 2;
    diskRadius = Math.max(width * 0.52, height * 1.15);
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    boundary.setAttribute("cx", centerX.toFixed(1));
    boundary.setAttribute("cy", centerY.toFixed(1));
    boundary.setAttribute("r", diskRadius.toFixed(1));
    draw();
  }

  function draw() {
    chooseLabelPositions();

    edgeElements.forEach(function (edge) {
      edge.element.setAttribute("d", edgePath(edge));
    });

    nodes.forEach(function (node) {
      const screen = diskToScreen(node.position);
      node.element.setAttribute(
        "transform",
        "translate(" + screen.x.toFixed(1) + " " + screen.y.toFixed(1) + ")"
      );
      node.labelElement.setAttribute("x", node.labelX.toFixed(1));
      node.labelElement.setAttribute("y", node.labelY.toFixed(1));
      node.labelLine.setAttribute("x", node.labelX.toFixed(1));
      node.yearLine.setAttribute("x", node.labelX.toFixed(1));
    });
  }

  function tick() {
    nodes.forEach(function (node) {
      node.force = { x: 0, y: 0 };
    });
    applyRadialForces();
    applyEdgeForces();
    applySeparationForces();
    applyViewportForces();
    moveNodes();
    draw();
    window.requestAnimationFrame(tick);
  }

  nodes.forEach(function (node) {
    node.targetRho = tanh(node.h / 2);
    node.position = hyperbolicPolar(node.h, node.theta);
    node.velocity = { x: 0, y: 0 };
    node.force = { x: 0, y: 0 };
    nodesById[node.id] = node;
  });

  const boundary = createElement("circle", {
    class: "research-graph-boundary",
  });
  svg.appendChild(boundary);

  const edgeElements = edges.map(function (edge) {
    const graphEdge = {
      source: nodesById[edge.source],
      target: nodesById[edge.target],
      distance: edge.distance,
      element: null,
    };

    graphEdge.element = renderEdge(graphEdge);
    return graphEdge;
  });

  nodes.forEach(renderNode);
  resize();
  window.addEventListener("resize", resize);
  document.addEventListener("pointermove", function (event) {
    if (!activeNode || event.pointerId !== activePointerId) {
      return;
    }

    if (outsideDragRange(event)) {
      releaseDrag();
    }
  });
  document.addEventListener("pointerup", releaseDrag);
  document.addEventListener("pointercancel", releaseDrag);
  window.addEventListener("blur", releaseDrag);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      releaseDrag();
    }
  });

  if (!reduceMotion) {
    window.requestAnimationFrame(tick);
  }
})();
