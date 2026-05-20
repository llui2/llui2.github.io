// Optional, non-critical behavior only.
document.documentElement.classList.add("js");

(function () {
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
  let lastStep = 0;
  let resizeTimer = null;
  let resizeQueued = false;

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
    const orange = parseOrange();

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

  function tick(timestamp) {
    if (timestamp - lastStep >= stepMs) {
      walkers.forEach(stepWalker);
      draw();
      lastStep = timestamp;
    }

    window.requestAnimationFrame(tick);
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

  new MutationObserver(function () {
    queueResize(false);
  }).observe(document.body, { childList: true, subtree: true });

  if (
    !window.matchMedia ||
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    window.requestAnimationFrame(tick);
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
