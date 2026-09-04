// Site-wide JS notes:
// This file contains two independent helpers used by several pages:
// 1. the animated random-walk background, and
// 2. the loaders for shared HTML, Markdown notes, and optional math.
// Both parts return without errors when their page elements or browser features are absent.
// Optional, non-critical behavior only.
document.documentElement.classList.add("js");

(function () {
  // Disable the background animation when reduced motion is requested.
  const reducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reducedMotion) {
    return;
  }

  // Create one canvas behind the page. It is decorative and hidden from screen readers.
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  canvas.className = "random-walk-canvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);

  // These values control how many walkers appear and how often they move.
  const gridSize = 18;
  const walkerCount = 10;
  const trailLength = 50;
  const stepMs = 200;
  const strokeWidth = 4;
  const accentFallback = { r: 252, g: 76, b: 2 };
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  // Current canvas/grid state. These values change when the page is resized.
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
  const accent = parseAccent();

  // Do not carry an old animation state between page visits.
  try {
    window.sessionStorage.removeItem("llui2RandomWalkState");
  } catch (_error) {
    // Storage may be unavailable in private or restricted browsing modes.
  }

  function parseAccent() {
    // Read the site's accent color from CSS so the animation follows the theme.
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue("--accent")
      .trim()
      .replace("#", "");

    if (/^[0-9a-f]{6}$/i.test(value)) {
      return {
        r: parseInt(value.slice(0, 2), 16),
        g: parseInt(value.slice(2, 4), 16),
        b: parseInt(value.slice(4, 6), 16),
      };
    }

    return accentFallback;
  }

  function wrapIndex(value, limit) {
    // Move past an edge to the opposite edge of the grid.
    return ((value % limit) + limit) % limit;
  }

  function randomGridIndex(limit) {
    // Choose a valid random starting cell.
    return Math.floor(Math.random() * limit);
  }

  function clampGridIndex(value, limit) {
    // Keep a saved/rescaled cell index inside the new grid.
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.max(0, Math.min(limit - 1, value));
  }

  function scaleGridIndex(value, previousLimit, nextLimit) {
    // Preserve a walker's approximate location when the grid changes size.
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
    // Convert a grid cell into a pixel position on the full-page canvas.
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
    // Add the walker's newest position and discard very old trail points.
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
    // Choose one of four directions, wrapping at the horizontal/vertical edges.
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
    // Make a walker at a random cell with an empty trail.
    return {
      column: randomGridIndex(columns),
      row: randomGridIndex(rows),
      path: [],
    };
  }

  function resetWalkers() {
    // Start all background walkers again after a resize or page return.
    walkers = Array.from({ length: walkerCount }, createWalker);
  }

  function measurePage() {
    // Measure the document, not just the viewport. Temporarily hiding the canvas
    // prevents the canvas itself from making the document appear larger.
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
    // Translate every old trail point onto the resized grid.
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
    // Draw one trail. A wrapped jump is split so it does not draw a long line
    // across the whole screen.
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
    // Clear the previous frame and redraw all walker trails in the accent color.
    context.clearRect(0, 0, width, height);
    context.strokeStyle = `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.2)`;
    context.lineWidth = strokeWidth;
    context.lineJoin = "round";
    context.lineCap = "round";

    walkers.forEach(drawWalker);
  }

  function fitCanvas(resetTrails) {
    // Match the canvas to the full page and preserve trails where possible.
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
    // Combine repeated resize requests into one animation-frame update.
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
    // Cancel the next timed walk step if the page is hidden or being left.
    if (walkTimer) {
      window.clearTimeout(walkTimer);
      walkTimer = null;
    }
  }

  function resetWalkDisplay() {
    // Clear old paths and immediately show a fresh set of walkers.
    resetWalkers();
    draw();
  }

  function suspendWalkDisplay() {
    // Hide and pause the background while the page is not visible.
    walkDisplaySuspended = true;
    canvas.style.visibility = "hidden";
    stopWalking();
    resetWalkDisplay();
  }

  function resumeWalkDisplay(resetTrails) {
    // Show the background again, resize it, and restart its timed movement.
    walkDisplaySuspended = false;
    canvas.style.visibility = "";
    fitCanvas(Boolean(resetTrails));
    scheduleWalking();
  }

  function normalizedPathname(pathname) {
    // Treat /page and /page/index.html as the same page for navigation checks.
    return pathname.replace(/\/index\.html$/, "").replace(/\/$/, "");
  }

  function shouldSuspendForNavigation(event) {
    // Only pause for an ordinary same-site page navigation. Modified clicks,
    // downloads, and new-tab links should keep their normal behavior.
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
    // Schedule one future movement unless the animation is already paused.
    if (walkTimer || document.hidden || walkDisplaySuspended) {
      return;
    }

    walkTimer = window.setTimeout(tick, stepMs);
  }

  function tick() {
    // Move every walker once, redraw, and schedule the next step.
    walkTimer = null;

    if (document.hidden || walkDisplaySuspended) {
      return;
    }

    walkers.forEach(stepWalker);
    draw();
    scheduleWalking();
  }

  function beginWalkingAfterLoad() {
    // The first post-load pass knows the final document dimensions.
    queueResize(true);
    scheduleWalking();
  }

  // Start the background and connect it to browser/page lifecycle events.
  fitCanvas(true);
  if (document.readyState === "complete") {
    beginWalkingAfterLoad();
  } else {
    window.addEventListener("load", beginWalkingAfterLoad);
  }

  // Wait briefly after resizing before recalculating the canvas dimensions.
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

  // Pause when the tab is hidden and restart with new trails when visible.
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

  // Pause before navigating so the old page does not keep animating during exit.
  document.addEventListener(
    "click",
    function (event) {
      if (shouldSuspendForNavigation(event)) {
        suspendWalkDisplay();
      }
    },
    true
  );

  // Loaded includes can change page height, so measure again after DOM changes.
  new MutationObserver(function () {
    window.clearTimeout(mutationTimer);
    mutationTimer = window.setTimeout(function () {
      queueResize(false);
    }, 160);
  }).observe(document.body, { childList: true, subtree: true });
})();

(function () {
  // Load shared fragments such as the header and footer into their placeholders.
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

  // Find pages that need Markdown, note navigation, or MathJax.
  const targets = document.querySelectorAll("[data-md]");
  const noteReaders = document.querySelectorAll("[data-notes-reader]");
  const mathTargets = document.querySelectorAll("[data-math]");
  if (!targets.length && !noteReaders.length && !mathTargets.length) {
    return;
  }

  // MathJax is loaded only on pages that actually contain TeX-like notation.
  const mathJaxSource =
    "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js";
  let mathJaxReady = null;

  function hasTexMath(value) {
    // Recognize the three math forms supported by the Markdown renderer.
    return (
      /(^|[^\\])\$[^$\n]+\$/.test(value) ||
      /\$\$[\s\S]+?\$\$/.test(value) ||
      /\\\[[\s\S]+?\\\]/.test(value)
    );
  }

  function ensureMathJax() {
    // Reuse an existing loader promise so multiple math targets load one script.
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
    // Ask MathJax to replace math text with formatted math.
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
    // Markdown is user/content data, so escape HTML before inserting it.
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");
  }

  function renderMarkdown(raw) {
    // Convert the Markdown syntax used by this site into HTML.
    // Code and math are temporarily replaced with tokens so ordinary formatting
    // does not accidentally modify their contents.
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

    const mathBlocks = [];
    content = content.replace(/\$\$\s*([\s\S]*?)\s*\$\$/g, function (
      _match,
      math
    ) {
      const token = `%%MATHBLOCK_${mathBlocks.length}%%`;
      mathBlocks.push(
        `<div class="math-display">$$\n${escapeHtml(math.trim())}\n$$</div>`
      );
      return token;
    });

    const lines = content.split(/\r?\n/);
    let html = "";
    let listOpen = false;
    let paragraph = [];

    function renderLink(label, href) {
      // Add a new-tab target only for external links; local links stay local.
      const cleanHref = href.trim();
      const isExternal = /^https?:\/\//i.test(cleanHref);
      const externalAttrs = isExternal
        ? ' target="_blank" rel="noopener noreferrer"'
        : "";

      return `<a href="${cleanHref}"${externalAttrs}>${label}</a>`;
    }

    function formatInline(text) {
      // Handle the inline syntax used in notes: wiki links, Markdown links,
      // code spans, bold, and italics.
      return text
        .replace(/\[\[([^\]]+)\]\(([^)]+)\)\]/g, function (_match, label, href) {
          return `[${renderLink(label, href)}]`;
        })
        .replace(
          /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
          function (_match, target, label) {
            const slug = slugify(target, "");
            return slug ? renderLink(label || target, `#${slug}`) : _match;
          }
        )
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_match, label, href) {
          return renderLink(label, href);
        })
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>");
    }

    function flushParagraph() {
      // Join consecutive ordinary lines into one paragraph element.
      if (!paragraph.length) {
        return;
      }
      html += `<p>${formatInline(paragraph.join(" "))}</p>`;
      paragraph = [];
    }

    function closeList() {
      // Finish an open list before a heading, paragraph, or blank line.
      if (listOpen) {
        html += "</ul>";
        listOpen = false;
      }
    }

    // Read the document line by line and choose its HTML structure.
    lines.forEach(function (line) {
      if (/%%(?:CODE|MATH)BLOCK_\d+%%/.test(line)) {
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

    // Put protected code/math blocks back where their tokens were.
    codeBlocks.forEach(function (block, index) {
      html = html.replace(`%%CODEBLOCK_${index}%%`, block);
    });

    mathBlocks.forEach(function (block, index) {
      html = html.replace(`%%MATHBLOCK_${index}%%`, block);
    });

    return html;
  }

  function renderMarkdownInto(target, path) {
    // Fetch one Markdown file and replace the target's contents, with a readable
    // fallback message if the file cannot be loaded.
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

  function renderTarget(target) {
    // Render a [data-md] element from its declared file.
    renderMarkdownInto(target, target.getAttribute("data-md"));
  }

  function safeNoteFile(value) {
    // Notes are intentionally limited to simple files in the notes directory.
    const file = String(value || "").trim();
    return /^[a-z0-9._-]+\.md$/i.test(file) ? file : "";
  }

  function noteTitleFromFile(file) {
    // Make a display title when notes.json does not provide one.
    return file
      .replace(/\.md$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\b[a-z]/g, function (letter) {
        return letter.toUpperCase();
      });
  }

  function slugify(value, fallback) {
    // Turn a note title/file name into a stable ID for the URL hash.
    const slug = String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\.md$/i, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return slug || fallback;
  }

  function normalizeNotes(rawNotes) {
    // Clean the notes index, discard invalid entries, and make slugs unique.
    const usedSlugs = {};

    return rawNotes
      .map(function (note, index) {
        const file = safeNoteFile(note && note.file);
        if (!file) {
          return null;
        }

        const title = String(note.title || "").trim() || noteTitleFromFile(file);
        const baseSlug = slugify(note.slug || file, `note-${index + 1}`);
        let slug = baseSlug;
        let slugIndex = 2;

        while (usedSlugs[slug]) {
          slug = `${baseSlug}-${slugIndex}`;
          slugIndex += 1;
        }
        usedSlugs[slug] = true;

        return {
          file: file,
          title: title,
          slug: slug,
          showInSidebar: note.sidebar !== false,
        };
      })
      .filter(Boolean);
  }

  function noteFromLocation(notes) {
    // Read the URL hash to find the note requested by a bookmark or back button.
    let requested = "";
    try {
      requested = decodeURIComponent(window.location.hash.slice(1));
    } catch (_error) {
      requested = "";
    }

    if (!requested) {
      return null;
    }

    return (
      notes.find(function (note) {
        return note.slug === requested || note.file === requested;
      }) || null
    );
  }

  function renderNotesList(list, notes, activateNote) {
    // Build the sidebar links and connect each one to the note switcher.
    if (!list) {
      return;
    }

    list.innerHTML = notes
      .filter(function (note) {
        return note.showInSidebar;
      })
      .map(function (note) {
        return `<li><a href="#${note.slug}" data-note-file="${escapeHtml(
          note.file
        )}">${escapeHtml(note.title)}</a></li>`;
      })
      .join("");

    list.querySelectorAll("[data-note-file]").forEach(function (link) {
      link.addEventListener("click", function (event) {
        const note = notes.find(function (item) {
          return item.file === link.getAttribute("data-note-file");
        });

        if (!note) {
          return;
        }

        event.preventDefault();
        activateNote(note, true);
      });
    });
  }

  function markActiveNote(list, activeNote) {
    // Mark the selected sidebar note for assistive tech.
    if (!list) {
      return;
    }

    list.querySelectorAll("[data-note-file]").forEach(function (link) {
      const isActive = link.getAttribute("data-note-file") === activeNote.file;
      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function renderNotesReader(reader) {
    // Set up a note reader: load its index, select a note, and react to hash changes.
    const source = reader.getAttribute("data-notes-source") || "notes.json";
    const defaultFile = safeNoteFile(reader.getAttribute("data-notes-default"));
    const list = document.querySelector("[data-notes-list]");
    let notes = [];
    let activeNote = null;

    function activateNote(note, updateHash) {
      // Replace the reader contents and optionally update the URL without reloading.
      activeNote = note;
      renderMarkdownInto(reader, note.file);
      markActiveNote(list, note);

      if (updateHash && window.location.hash.slice(1) !== note.slug) {
        window.history.pushState(null, "", `#${note.slug}`);
      }
    }

    // The index supplies the available notes and their display order.
    fetch(source)
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Failed to load notes index");
        }
        return response.json();
      })
      .then(function (rawNotes) {
        notes = normalizeNotes(Array.isArray(rawNotes) ? rawNotes : []);
        if (!notes.length) {
          throw new Error("Notes index is empty");
        }

        renderNotesList(list, notes, activateNote);

        const selected =
          noteFromLocation(notes) ||
          notes.find(function (note) {
            return note.file === defaultFile;
          }) ||
          notes[0];

        activateNote(selected, false);

        window.addEventListener("hashchange", function () {
          const requested = noteFromLocation(notes);
          if (requested && (!activeNote || requested.file !== activeNote.file)) {
            activateNote(requested, false);
          }
        });
      })
      .catch(function () {
        if (defaultFile) {
          renderMarkdownInto(reader, defaultFile);
        }
      });
  }

  targets.forEach(renderTarget);
  noteReaders.forEach(renderNotesReader);
  mathTargets.forEach(typesetMath);
})();
