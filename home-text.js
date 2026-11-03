// Let the lower homepage text flow around the Julia set’s settled outline.
(function () {
  const canvas = document.querySelector('.julia-canvas');
  const content = document.querySelector('.home-main .markdown');
  if (!canvas || !content || !window.CSS || !CSS.supports('shape-outside', 'polygon(0 0, 100% 0, 100% 100%)')) return;

  // Leftmost visible cell in each row of the original settled fractal.
  // A margin below covers its small animated displacements.
  const outline = [460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,214,213,213,213,212,211,210,210,209,208,207,206,205,203,200,199,198,198,197,197,196,195,195,193,192,166,164,163,111,111,111,111,111,111,110,110,109,109,108,108,108,107,106,105,103,101,99,99,98,98,97,96,95,87,82,81,81,81,81,81,80,80,79,79,78,76,74,74,74,73,73,72,72,72,72,75,80,82,83,84,93,95,96,97,98,98,99,99,100,101,102,103,103,104,105,106,124,126,128,129,131,132,133,134,134,135,136,136,136,137,137,137,137,137,138,138,138,138,138,138,139,139,140,141,142,143,144,144,145,145,145,146,146,146,147,148,148,149,149,150,189,190,191,193,194,195,197,199,200,202,204,206,207,208,209,210,211,212,212,213,213,213,214,214,214,214,214,214,214,214,214,214,214,214,214,214,214,214,214,214,214,214,214,214,214,214,214,216,219,222,223,224,225,226,227,228,229,229,230,230,230,231,231,231,232,234,235,237,237,239,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460,460];
  const exclusion = document.createElement('span');
  exclusion.className = 'home-fractal-exclusion';
  exclusion.setAttribute('aria-hidden', 'true');
  let lastShape = '';

  function attach() {
    const paragraphs = content.querySelectorAll(':scope > p');
    if (!paragraphs.length || exclusion.isConnected) return;
    paragraphs[0].before(exclusion);
    update();
  }

  function update() {
    if (document.hidden || !exclusion.isConnected || !canvas.width || !canvas.height) return;
    const paragraphs = content.querySelectorAll(':scope > p');
    if (!paragraphs.length) return;
    const area = content.getBoundingClientRect();
    const start = exclusion.getBoundingClientRect().top;
    const end = paragraphs[paragraphs.length - 1].getBoundingClientRect().bottom;
    const height = Math.max(1, Math.ceil(end - start));
    const width = area.width;
    if (!width) return;
    exclusion.style.height = height + 'px';

    const canvasRect = canvas.getBoundingClientRect();
    const step = 12;
    const boundary = [];
    for (let y = 0; y < height; y += step) {
      let left = width;
      // Sample the settled outline above and below each band; the extra margin
      // covers the fractal's animated movement without shifting text on reload.
      for (let dy = -step - 10; dy <= step * 2 + 10; dy += 5) {
        const py = Math.floor((start + y + dy - canvasRect.top) * outline.length / canvasRect.height);
        if (py < 0 || py >= outline.length || outline[py] === 460) continue;
        const x = canvasRect.left + outline[py] * canvasRect.width / 460 - area.left;
        left = Math.min(left, Math.max(0, x - 28));
      }
      boundary.push([left, y], [left, Math.min(height, y + step)]);
    }
    const points = [`${width}px 0px`, `${width}px ${height}px`]
      .concat(boundary.reverse().map(([x, y]) => `${x}px ${y}px`));
    const shape = `polygon(${points.join(',')})`;
    if (shape !== lastShape) {
      exclusion.style.shapeOutside = shape;
      lastShape = shape;
    }
  }

  new MutationObserver(attach).observe(content, { childList: true });
  attach();
  window.addEventListener('resize', update);
  document.addEventListener('visibilitychange', update);
  new ResizeObserver(update).observe(content);
})();
