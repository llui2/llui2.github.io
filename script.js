// Shared HTML, Markdown, note navigation, and math loaders.
document.documentElement.classList.add("js");

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
