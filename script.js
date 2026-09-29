// Shared HTML, Markdown, note navigation, and math loaders.
document.documentElement.classList.add("js");

// Small shared rules for Julia-born and standalone pixel walkers.
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
  function fade(age, lifetime) {
    return Math.max(0, 1 - age / lifetime) ** 2;
  }
  function keepTrail(trail, now, lifetime) {
    return trail.filter((point) => now - point.born < lifetime);
  }
  return { direction, fade, keepTrail };
})();

(function () {
  if (document.body.classList.contains("home-page")) return;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return;
  canvas.className = "random-walk-canvas";
  canvas.setAttribute("aria-hidden", "true");

  const SIZE = 5, FPS = 12, STEP_TIME = 0.18;
  const TRAIL_TIME = 42, COUNT = 15;
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  const hex = /^#[0-9a-f]{6}$/i.test(accent) ? accent : "#fc4c02";
  const orange = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const tones = [orange, ...[0.22, 0.42, 0.6].map((amount) =>
    orange.map((value) => Math.round(value + (255 - value) * amount)))];
  let columns = 0, rows = 0, frameImage, walkers = [];
  let elapsed = 0, lastFrame = 0, frameRequest = 0, resizeTimer = 0;

  function newWalker() {
    const x = Math.floor(Math.random() * columns);
    const y = Math.floor(Math.random() * rows);
    const previous = window.PixelWalkers.direction();
    return { x, y, tone: Math.floor(Math.random() * tones.length),
      previous, run: 0,
      born: elapsed, lifetime: 18 + Math.random() * 6, nextStep: elapsed + STEP_TIME,
      trail: [{ x, y, born: elapsed }] };
  }

  function resize() {
    resizeTimer = 0;
    const previousColumns = columns, previousRows = rows;
    const width = Math.max(window.innerWidth, document.documentElement.scrollWidth);
    const height = Math.max(window.innerHeight, document.documentElement.scrollHeight);
    const nextColumns = Math.max(1, Math.ceil(width / SIZE));
    const nextRows = Math.max(1, Math.ceil(height / SIZE));
    if (nextColumns === columns && nextRows === rows) return;
    columns = nextColumns; rows = nextRows;
    canvas.style.width = `${columns * SIZE}px`;
    canvas.style.height = `${rows * SIZE}px`;
    canvas.width = columns; canvas.height = rows;
    context.imageSmoothingEnabled = false;
    frameImage = context.createImageData(columns, rows);
    if (previousColumns && previousRows) {
      const mapX = (x) => Math.min(columns - 1, Math.round(x * columns / previousColumns));
      const mapY = (y) => Math.min(rows - 1, Math.round(y * rows / previousRows));
      for (const walker of walkers) {
        walker.x = mapX(walker.x); walker.y = mapY(walker.y);
        for (const point of walker.trail) {
          point.x = mapX(point.x); point.y = mapY(point.y);
        }
      }
    }
    while (walkers.length < COUNT) walkers.push(newWalker());
    draw();
  }

  function paint(x, y, tone, alpha) {
    if (x < 0 || x >= columns || y < 0 || y >= rows || alpha <= 0) return;
    const at = (y * columns + x) * 4;
    if (alpha <= frameImage.data[at + 3]) return;
    const color = tones[tone];
    frameImage.data[at] = color[0];
    frameImage.data[at + 1] = color[1];
    frameImage.data[at + 2] = color[2];
    frameImage.data[at + 3] = alpha;
  }

  function draw() {
    if (!frameImage) return;
    frameImage.data.fill(0);
    for (const walker of walkers) {
      for (const point of walker.trail) {
        const alpha = Math.round(85 * window.PixelWalkers.fade(elapsed - point.born, TRAIL_TIME));
        paint(point.x, point.y, walker.tone, alpha);
      }
      if (elapsed - walker.born < walker.lifetime) {
        paint(walker.x, walker.y, walker.tone, 100);
      }
    }
    context.putImageData(frameImage, 0, 0);
  }

  function update() {
    for (const walker of walkers) {
      while (elapsed >= walker.nextStep && elapsed - walker.born < walker.lifetime) {
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
        walker.trail.push({ x: walker.x, y: walker.y, born: walker.nextStep });
        walker.nextStep += STEP_TIME;
      }
      walker.trail = window.PixelWalkers.keepTrail(walker.trail, elapsed, TRAIL_TIME);
    }
    walkers = walkers.filter((walker) => walker.trail.length);
    const active = walkers.filter((walker) => elapsed - walker.born < walker.lifetime).length;
    for (let i = active; i < COUNT; i += 1) walkers.push(newWalker());
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
    if (!frameRequest && !document.hidden && !reducedMotion.matches) {
      frameRequest = requestAnimationFrame(tick);
    }
  }
  function stop() {
    if (frameRequest) cancelAnimationFrame(frameRequest);
    frameRequest = 0; lastFrame = 0;
  }
  function queueResize() {
    if (reducedMotion.matches) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 180);
  }
  if (!reducedMotion.matches) {
    document.body.prepend(canvas);
    resize(); start();
  }
  window.addEventListener("resize", queueResize);
  window.addEventListener("load", queueResize);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop(); else { queueResize(); start(); }
  });
  window.addEventListener("pagehide", stop);
  window.addEventListener("pageshow", start);
  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) { stop(); canvas.remove(); }
    else { document.body.prepend(canvas); resize(); start(); }
  });
  new MutationObserver(queueResize).observe(document.body, { childList: true, subtree: true });
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
