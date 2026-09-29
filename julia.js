// A small, transparent Julia field for the homepage only.
(function () {
  const canvas = document.querySelector(".julia-canvas");
  const context = canvas && canvas.getContext("2d", { alpha: true });
  if (!context) return;

  const accent = getComputedStyle(document.documentElement)
    .getPropertyValue("--accent").trim();
  const color = /^#[0-9a-f]{6}$/i.test(accent) ? accent : "#fc4c02";
  const rgb = [1, 3, 5].map((at) => parseInt(color.slice(at, at + 2), 16));
  const pixelSize = 4;
  const maxIterations = 120;
  const sceneScale = 1.65 / 900;
  let queued = false;

  function draw() {
    queued = false;
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.ceil(bounds.width / pixelSize));
    const height = Math.max(1, Math.ceil(bounds.height / pixelSize));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const image = context.createImageData(width, height);
    // Tie the fractal to the same centered page column as the text. The
    // complex-plane scale stays fixed as the viewport grows or shrinks.
    const textLeft = document.querySelector("main").getBoundingClientRect().left;
    const textTop = parseFloat(getComputedStyle(document.body).paddingTop);
    const branchX = textLeft + 700;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let real = (x * pixelSize - branchX) * sceneScale - 0.7;
        let imaginary = (y * pixelSize - textTop) * sceneScale - 0.7;
        let iterations = 0;
        while (real * real + imaginary * imaginary < 16 &&
               iterations < maxIterations) {
          const nextReal = real * real - imaginary * imaginary - 0.5251993;
          imaginary = 2 * real * imaginary - 0.5251993;
          real = nextReal;
          iterations += 1;
        }

        // Leave the filled interior and broad escape cloud transparent. Show
        // only the detailed, slowly escaping boundary in the accent color.
        if (iterations < 16 || iterations === maxIterations) continue;
        const alpha = Math.min(220, 70 + (iterations - 16) * 4);
        const offset = (y * width + x) * 4;
        image.data[offset] = rgb[0];
        image.data[offset + 1] = rgb[1];
        image.data[offset + 2] = rgb[2];
        image.data[offset + 3] = alpha;
      }
    }
    context.putImageData(image, 0, 0);
  }

  function queueDraw() {
    if (!queued) {
      queued = true;
      requestAnimationFrame(draw);
    }
  }

  window.addEventListener("resize", queueDraw);
  queueDraw();
})();
