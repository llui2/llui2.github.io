// Shared HTML, Markdown, note navigation, and math loaders.
document.documentElement.classList.add("js");
const initialContentLoads = [];

// Cardinal movement for persistent pixel walkers.
window.PixelWalkers = (function () {
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  function direction(outX = 0, outY = 0, beta = 0, previous = null,
    run = 0, allowed = () => true, spread = false) {
    // The occasional memory reset and long-run softening prevent straight rays.
    const reset = previous && Math.random() < 0.06;
    const softening = Math.min(0.6, Math.max(0, run - 3) * 0.12);
    const weights = directions.map(([dx, dy]) => {
      if (!allowed(dx, dy)) return 0;
      let persistence = 1;
      if (previous && !reset) {
        const dot = dx * previous[0] + dy * previous[1];
        const base = spread ?
          (dot > 0 ? 0.5 : dot < 0 ? 0.07 : 0.215) :
          (dot > 0 ? 0.45 : dot < 0 ? 0.1 : 0.225);
        persistence = base * (1 - softening) + 0.25 * softening;
      }
      return persistence * Math.exp(beta * (dx * outX + dy * outY));
    });
    let draw = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
    for (let i = 0; i < directions.length; i += 1) {
      draw -= weights[i];
      if (draw < 0) return directions[i];
    }
    return directions.find(([dx, dy]) => allowed(dx, dy)) || directions[3];
  }
  return { direction };
})();

(function () {
  if (document.body.classList.contains("home-page")) return;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const main = document.querySelector("main");
  if (!main) return;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return;
  canvas.className = "random-walk-canvas";
  canvas.setAttribute("aria-hidden", "true");

  const SIZE = 5, FPS = 12, STEP_TIME = 0.18;
  const FIELD_WIDTH = 3000;
  const FIELD_TOP = 800, FIELD_LEFT = 980;
  const columns = FIELD_WIDTH / SIZE;
  // Keep a long, fixed-length path: each new step removes the oldest tail cell.
  const MAX_TRAIL_POINTS = 200, COUNT = 15;
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  const hex = /^#[0-9a-f]{6}$/i.test(accent) ? accent : "#fc4c02";
  const orange = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  let rows = 0, frameImage, walkers = [];
  let elapsed = 0, lastFrame = 0, frameRequest = 0;

  function spawnBounds() {
    const rect = main.getBoundingClientRect();
    const pageHeight = Math.max(window.innerHeight,
      document.body.offsetHeight);
    const left = Math.max(0, FIELD_LEFT - rect.left);
    const right = Math.min(FIELD_WIDTH,
      FIELD_LEFT - rect.left + document.documentElement.clientWidth);
    const top = Math.max(0, FIELD_TOP - rect.top - window.scrollY);
    const bottom = FIELD_TOP - rect.top - window.scrollY + pageHeight;
    return { left, right, top, bottom };
  }

  function newWalker(index, bounds) {
    // Stratify the actual page area; jitter keeps reloads varied without clumps.
    const width = bounds.right - bounds.left;
    const height = bounds.bottom - bounds.top;
    const gridColumns = width > height ? 5 : 3;
    const gridRows = COUNT / gridColumns;
    const column = index % gridColumns;
    const row = Math.floor(index / gridColumns);
    const x = Math.floor((bounds.left +
      (column + 0.2 + Math.random() * 0.6) * width / gridColumns) / SIZE);
    const y = Math.floor((bounds.top +
      (row + 0.2 + Math.random() * 0.6) * height / gridRows) / SIZE);
    const previous = window.PixelWalkers.direction();
    return { x, y,
      previous, run: 0,
      nextStep: elapsed + STEP_TIME, trail: [{ x, y }] };
  }

  function extendForContent() {
    const bounds = spawnBounds();
    const requiredRows = Math.ceil(Math.max(FIELD_TOP + main.offsetHeight + 100,
      bounds.bottom + 100) / SIZE);
    if (requiredRows <= rows && frameImage) return;
    rows = Math.max(rows, requiredRows);
    canvas.height = rows;
    canvas.style.height = `${rows * SIZE}px`;
    context.imageSmoothingEnabled = false;
    frameImage = context.createImageData(columns, rows);
    while (walkers.length < COUNT) walkers.push(newWalker(walkers.length, bounds));
    draw();
  }

  function paint(x, y, alpha) {
    if (x < 0 || x >= columns || y < 0 || y >= rows || alpha <= 0) return;
    const at = (y * columns + x) * 4;
    if (alpha <= frameImage.data[at + 3]) return;
    frameImage.data[at] = orange[0];
    frameImage.data[at + 1] = orange[1];
    frameImage.data[at + 2] = orange[2];
    frameImage.data[at + 3] = alpha;
  }

  function draw() {
    if (!frameImage) return;
    frameImage.data.fill(0);
    for (const walker of walkers) {
      for (let i = 0; i < walker.trail.length; i += 1) {
        const point = walker.trail[i];
        // Shade by distance behind the head, rather than the walker's lifetime.
        const progress = 1 - (walker.trail.length - 1 - i) / (MAX_TRAIL_POINTS - 1);
        const alpha = Math.round(12 + 73 * progress ** 2);
        paint(point.x, point.y, alpha);
      }
      paint(walker.x, walker.y, 100);
    }
    context.putImageData(frameImage, 0, 0);
  }

  function update() {
    for (const walker of walkers) {
      while (elapsed >= walker.nextStep) {
        const direction = window.PixelWalkers.direction(0, 0, 0,
          walker.previous, walker.run,
          (dx, dy) => walker.x + dx >= 0 && walker.x + dx < columns &&
            walker.y + dy >= 0 && walker.y + dy < rows, true);
        const [dx, dy] = direction;
        walker.run = dx === walker.previous[0] && dy === walker.previous[1] ?
          walker.run + 1 : 1;
        walker.previous = direction;
        walker.x += dx;
        walker.y += dy;
        walker.trail.push({ x: walker.x, y: walker.y });
        walker.nextStep += STEP_TIME;
      }
      if (walker.trail.length > MAX_TRAIL_POINTS) {
        walker.trail.splice(0, walker.trail.length - MAX_TRAIL_POINTS);
      }
    }
  }

  function tick(now) {
    frameRequest = 0;
    if (document.hidden || reducedMotion.matches) return;
    const interval = 1000 / FPS;
    if (lastFrame && now - lastFrame < interval) { start(); return; }
    elapsed += lastFrame ? Math.min(0.2, (now - lastFrame) / 1000) : interval / 1000;
    lastFrame = now;
    update(); draw(); start();
  }
  function start() {
    if (ready && !frameRequest && !document.hidden && !reducedMotion.matches) {
      frameRequest = requestAnimationFrame(tick);
    }
  }
  function stop() {
    if (frameRequest) cancelAnimationFrame(frameRequest);
    frameRequest = 0; lastFrame = 0;
  }
  canvas.width = columns;
  canvas.style.width = `${FIELD_WIDTH}px`;
  let ready = false;
  const contentObserver = new ResizeObserver(() => {
    if (ready) extendForContent();
  });
  contentObserver.observe(main);
  // The shared loaders register their requests later in this script.
  Promise.resolve().then(async () => {
    let loaded = 0;
    while (loaded < initialContentLoads.length) {
      const batch = initialContentLoads.slice(loaded);
      loaded += batch.length;
      await Promise.allSettled(batch);
    }
  }).then(() => {
    ready = true;
    if (!reducedMotion.matches) {
      main.prepend(canvas);
      extendForContent(); start();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop(); else if (ready) { extendForContent(); start(); }
  });
  window.addEventListener("pagehide", stop);
  window.addEventListener("pageshow", start);
  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) { stop(); canvas.remove(); }
    else if (ready) { main.prepend(canvas); extendForContent(); start(); }
  });
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
      initialContentLoads.push(fetch(path)
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
        }));
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

    initialContentLoads.push(fetch(path)
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
      }));
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
    initialContentLoads.push(fetch(source)
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
      }));
  }

  targets.forEach(renderTarget);
  noteReaders.forEach(renderNotesReader);
  mathTargets.forEach(typesetMath);
})();
