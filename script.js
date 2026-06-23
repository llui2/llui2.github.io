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
  const strokeWidth = 4;
  const orangeFallback = { r: 252, g: 76, b: 2 };
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  let width = 1;
  let height = 1;
  let columns = 2;
  let rows = 2;
  let dpr = 1;
  let walkers = [];
  let walkTimer = null;
  let resizeTimer = null;
  let mutationTimer = null;
  let resizeQueued = false;
  let walkDisplaySuspended = false;
  const orange = parseOrange();

  try {
    window.sessionStorage.removeItem("llui2RandomWalkState");
  } catch (_error) {
    // Storage can be unavailable in private or locked-down browsing modes.
  }

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

  function wrapIndex(value, limit) {
    return ((value % limit) + limit) % limit;
  }

  function randomGridIndex(limit) {
    return Math.floor(Math.random() * limit);
  }

  function clampGridIndex(value, limit) {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.max(0, Math.min(limit - 1, value));
  }

  function scaleGridIndex(value, previousLimit, nextLimit) {
    if (
      !Number.isFinite(value) ||
      !Number.isFinite(previousLimit) ||
      !Number.isFinite(nextLimit) ||
      previousLimit <= 1 ||
      nextLimit <= 1
    ) {
      return 0;
    }

    return clampGridIndex(
      Math.round((value / (previousLimit - 1)) * (nextLimit - 1)),
      nextLimit
    );
  }

  function gridToPoint(column, row) {
    const edgeRowInset = gridSize;
    const rowSpan = Math.max(0, height - edgeRowInset * 2);

    return {
      x: columns <= 1 ? 0 : (column / (columns - 1)) * width,
      y:
        rows <= 1
          ? edgeRowInset
          : edgeRowInset + (row / (rows - 1)) * rowSpan,
    };
  }

  function pushPoint(walker, wrapX, wrapY) {
    walker.path.push({
      column: walker.column,
      row: walker.row,
      wrapX: wrapX || 0,
      wrapY: wrapY || 0,
    });

    if (walker.path.length > trailLength) {
      walker.path.shift();
    }
  }

  function stepWalker(walker) {
    const direction = directions[Math.floor(Math.random() * directions.length)];
    const rawColumn = walker.column + direction[0];
    const rawRow = walker.row + direction[1];
    const nextColumn = wrapIndex(rawColumn, columns);
    const nextRow = wrapIndex(rawRow, rows);
    const wrapX = nextColumn !== rawColumn ? direction[0] : 0;
    const wrapY = nextRow !== rawRow ? direction[1] : 0;

    walker.column = nextColumn;
    walker.row = nextRow;
    pushPoint(walker, wrapX, wrapY);
  }

  function createWalker() {
    return {
      column: randomGridIndex(columns),
      row: randomGridIndex(rows),
      path: [],
    };
  }

  function resetWalkers() {
    walkers = Array.from({ length: walkerCount }, createWalker);
  }

  function measurePage() {
    const previousWidth = canvas.style.width;
    const previousHeight = canvas.style.height;

    canvas.style.width = "0";
    canvas.style.height = "0";

    const size = {
      width: Math.max(
        1,
        window.innerWidth,
        document.documentElement.scrollWidth,
        document.body.scrollWidth
      ),
      height: Math.max(
        1,
        window.innerHeight,
        document.documentElement.scrollHeight,
        document.body.scrollHeight
      ),
    };

    canvas.style.width = previousWidth;
    canvas.style.height = previousHeight;

    return size;
  }

  function scaleWalkerTrail(walker, previousColumns, previousRows) {
    walker.column = scaleGridIndex(walker.column, previousColumns, columns);
    walker.row = scaleGridIndex(walker.row, previousRows, rows);
    walker.path = walker.path.map(function (point) {
      return {
        column: scaleGridIndex(point.column, previousColumns, columns),
        row: scaleGridIndex(point.row, previousRows, rows),
        wrapX: point.wrapX,
        wrapY: point.wrapY,
      };
    });
  }

  function drawWalker(walker) {
    if (walker.path.length < 2) {
      return;
    }

    const verticalEdgeInset = gridSize;
    const firstPoint = gridToPoint(walker.path[0].column, walker.path[0].row);

    context.beginPath();
    context.moveTo(firstPoint.x, firstPoint.y);

    for (let index = 1; index < walker.path.length; index += 1) {
      const pointData = walker.path[index];
      const previousData = walker.path[index - 1];
      const point = gridToPoint(pointData.column, pointData.row);
      const previous = gridToPoint(previousData.column, previousData.row);

      if (pointData.wrapY) {
        const exitY =
          pointData.wrapY > 0 ? height + verticalEdgeInset : -verticalEdgeInset;
        const entryY =
          pointData.wrapY > 0 ? -verticalEdgeInset : height + verticalEdgeInset;

        context.lineTo(previous.x, exitY);
        context.moveTo(point.x, entryY);
        context.lineTo(point.x, point.y);
        continue;
      }

      if (pointData.wrapX) {
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
    context.lineWidth = strokeWidth;
    context.lineJoin = "round";
    context.lineCap = "round";

    walkers.forEach(drawWalker);
  }

  function fitCanvas(resetTrails) {
    if (walkDisplaySuspended) {
      draw();
      return;
    }

    const size = measurePage();
    const nextWidth = Math.max(gridSize * 2, Math.ceil(size.width));
    const nextHeight = Math.max(gridSize * 2, Math.ceil(size.height));
    const nextColumns = Math.max(2, Math.round(nextWidth / gridSize) + 1);
    const nextRows = Math.max(
      2,
      Math.round(Math.max(gridSize, nextHeight - gridSize * 2) / gridSize) + 1
    );

    if (
      nextWidth === width &&
      nextHeight === height &&
      nextColumns === columns &&
      nextRows === rows &&
      !resetTrails
    ) {
      return;
    }

    const previousColumns = columns;
    const previousRows = rows;

    width = nextWidth;
    height = nextHeight;
    columns = nextColumns;
    rows = nextRows;
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.ceil(width * dpr);
    canvas.height = Math.ceil(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (resetTrails || !walkers.length) {
      resetWalkers();
    } else {
      walkers.forEach(function (walker) {
        scaleWalkerTrail(walker, previousColumns, previousRows);
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

  function resetWalkDisplay() {
    resetWalkers();
    draw();
  }

  function suspendWalkDisplay() {
    walkDisplaySuspended = true;
    canvas.style.visibility = "hidden";
    stopWalking();
    resetWalkDisplay();
  }

  function resumeWalkDisplay(resetTrails) {
    walkDisplaySuspended = false;
    canvas.style.visibility = "";
    fitCanvas(Boolean(resetTrails));
    scheduleWalking();
  }

  function normalizedPathname(pathname) {
    return pathname.replace(/\/index\.html$/, "").replace(/\/$/, "");
  }

  function shouldSuspendForNavigation(event) {
    const link = event.target.closest && event.target.closest("a[href]");

    if (
      !link ||
      event.defaultPrevented ||
      ("button" in event && event.button !== 0) ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      link.hasAttribute("download") ||
      (link.target && link.target.toLowerCase() !== "_self")
    ) {
      return false;
    }

    const url = new URL(link.href, window.location.href);

    return (
      url.origin !== window.location.origin ||
      normalizedPathname(url.pathname) !==
        normalizedPathname(window.location.pathname) ||
      url.search !== window.location.search
    );
  }

  function scheduleWalking() {
    if (walkTimer || document.hidden || walkDisplaySuspended) {
      return;
    }

    walkTimer = window.setTimeout(tick, stepMs);
  }

  function tick() {
    walkTimer = null;

    if (document.hidden || walkDisplaySuspended) {
      return;
    }

    walkers.forEach(stepWalker);
    draw();
    scheduleWalking();
  }

  function beginWalkingAfterLoad() {
    queueResize(true);
    scheduleWalking();
  }

  fitCanvas(true);
  if (document.readyState === "complete") {
    beginWalkingAfterLoad();
  } else {
    window.addEventListener("load", beginWalkingAfterLoad);
  }

  window.addEventListener("resize", function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      queueResize(false);
    }, 120);
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", function () {
      queueResize(false);
    });
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      suspendWalkDisplay();
      return;
    }

    resumeWalkDisplay(true);
  });

  window.addEventListener("pagehide", function () {
    suspendWalkDisplay();
  });

  window.addEventListener("pageshow", function (event) {
    if (!event.persisted) {
      return;
    }

    resumeWalkDisplay(true);
  });

  document.addEventListener(
    "click",
    function (event) {
      if (shouldSuspendForNavigation(event)) {
        suspendWalkDisplay();
      }
    },
    true
  );

  new MutationObserver(function () {
    window.clearTimeout(mutationTimer);
    mutationTimer = window.setTimeout(function () {
      queueResize(false);
    }, 160);
  }).observe(document.body, { childList: true, subtree: true });
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
