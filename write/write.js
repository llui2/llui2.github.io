(function () {
  const editor = document.getElementById("writeEditor");
  const fontSizeSlider = document.getElementById("fontSize");
  const fontSizeValue = document.getElementById("fontSizeValue");
  const fontFamilySelect = document.getElementById("fontFamily");
  const wordCountDisplay = document.getElementById("wordCount");
  const wordCountLabel = document.getElementById("wordCountLabel");
  const densityList = document.getElementById("densityList");
  const zipfChart = document.getElementById("zipfChart");
  const zipfTooltip = document.getElementById("zipfTooltip");
  const DEFAULT_FONT_SIZE = 16;
  let currentWordData = [];
  let chartPoints = [];

  const STORAGE_KEYS = {
    draft: "write_draft",
    fontFamily: "write_fontFamily",
  };

  function updateRangeProgress() {
    const min = Number(fontSizeSlider.min);
    const max = Number(fontSizeSlider.max);
    const value = Number(fontSizeSlider.value);
    const progress = max > min ? ((value - min) / (max - min)) * 100 : 0;

    fontSizeSlider.style.setProperty("--range-progress", progress + "%");
  }

  // Restore saved settings (not content)
  function loadSettings() {
    // Clear any saved draft on page load
    localStorage.removeItem(STORAGE_KEYS.draft);
    localStorage.removeItem("write_fontSize");

    fontSizeSlider.value = String(DEFAULT_FONT_SIZE);
    fontSizeValue.textContent = DEFAULT_FONT_SIZE + "px";
    editor.style.fontSize = DEFAULT_FONT_SIZE + "px";

    updateRangeProgress();

    const savedFontFamily = localStorage.getItem(STORAGE_KEYS.fontFamily);
    if (savedFontFamily !== null) {
      fontFamilySelect.value = savedFontFamily;
      applyFontFamily(savedFontFamily);
    } else {
      applyFontFamily("system");
    }

    updateWordCount();
  }

  // Apply font family to editor
  function applyFontFamily(family) {
    const fontMap = {
      system:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      serif: 'Georgia, "Times New Roman", Times, serif',
      mono: '"Courier New", Courier, monospace',
    };
    editor.style.fontFamily = fontMap[family] || fontMap.system;
  }

  // Tokenize text into words
  function tokenizeWords(text) {
    if (!text || !text.trim()) {
      return [];
    }
    // Match sequences of letters/numbers (Unicode-aware)
    return text.match(/[\p{L}\p{N}]+/gu) || [];
  }

  // Calculate all word frequencies (no limit, show all)
  function calculateWordFrequencies(words) {
    if (words.length === 0) return [];

    // Count frequency (case-insensitive)
    const frequency = {};
    words.forEach(function (word) {
      const lower = word.toLowerCase();
      frequency[lower] = (frequency[lower] || 0) + 1;
    });

    const frequencies = Object.keys(frequency).map(function (word) {
      const count = frequency[word];
      return { word, count };
    });

    // Sort by count descending, then alphabetically for stable ranks.
    return frequencies.sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
  }

  function formatPowerOfTen(exponent) {
    const superscripts = {
      "-": "⁻",
      "0": "⁰",
      "1": "¹",
      "2": "²",
      "3": "³",
      "4": "⁴",
      "5": "⁵",
      "6": "⁶",
      "7": "⁷",
      "8": "⁸",
      "9": "⁹",
    };
    const power = String(exponent).split("").map(character => superscripts[character]).join("");
    return "10" + power;
  }

  function drawZipfChart(items) {
    const context = zipfChart.getContext("2d");
    const bounds = zipfChart.getBoundingClientRect();
    const width = Math.max(280, bounds.width);
    const height = Math.max(260, bounds.height);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    zipfChart.width = Math.round(width * pixelRatio);
    zipfChart.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    chartPoints = [];
    zipfTooltip.hidden = true;

    const style = getComputedStyle(document.documentElement);
    const foreground = style.getPropertyValue("--fg").trim();
    const dim = style.getPropertyValue("--dim").trim();
    const accent = style.getPropertyValue("--accent").trim();
    const padding = { top: 22, right: 18, bottom: 54, left: 62 };
    const axisLength = Math.min(
      width - padding.left - padding.right,
      height - padding.top - padding.bottom
    );
    const plotLeft = padding.left + Math.max(0, (width - padding.left - padding.right - axisLength) / 2);
    const plotTop = padding.top;
    const rankExponent = items.length > 0 ? Math.max(1, Math.ceil(Math.log10(items.length))) : 2;
    const frequencyExponent = items.length > 0 ? Math.max(1, Math.ceil(Math.log10(items[0].count))) : 2;
    const xPosition = rank => plotLeft + (Math.log10(rank) / rankExponent) * axisLength;
    const yPosition = count => plotTop + axisLength - (Math.log10(count) / frequencyExponent) * axisLength;

    context.font = '11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    context.lineWidth = 1;

    context.strokeStyle = foreground;
    context.fillStyle = dim;
    context.textAlign = "center";
    context.textBaseline = "top";
    for (let exponent = 0; exponent <= rankExponent; exponent += 1) {
      const value = Math.pow(10, exponent);
      const x = xPosition(value);
      context.beginPath();
      context.moveTo(x, plotTop + axisLength);
      context.lineTo(x, plotTop + axisLength + 8);
      context.stroke();
      context.fillText(formatPowerOfTen(exponent), x, plotTop + axisLength + 12);
    }

    context.textAlign = "right";
    context.textBaseline = "middle";
    for (let exponent = 0; exponent <= frequencyExponent; exponent += 1) {
      const value = Math.pow(10, exponent);
      const y = yPosition(value);
      context.beginPath();
      context.moveTo(plotLeft - 8, y);
      context.lineTo(plotLeft, y);
      context.stroke();
      context.fillText(formatPowerOfTen(exponent), plotLeft - 12, y);
    }

    context.strokeStyle = dim;
    for (let exponent = 0; exponent < rankExponent; exponent += 1) {
      for (let multiplier = 2; multiplier < 10; multiplier += 1) {
        const x = xPosition(multiplier * Math.pow(10, exponent));
        context.beginPath();
        context.moveTo(x, plotTop + axisLength);
        context.lineTo(x, plotTop + axisLength + 4);
        context.stroke();
      }
    }
    for (let exponent = 0; exponent < frequencyExponent; exponent += 1) {
      for (let multiplier = 2; multiplier < 10; multiplier += 1) {
        const y = yPosition(multiplier * Math.pow(10, exponent));
        context.beginPath();
        context.moveTo(plotLeft - 4, y);
        context.lineTo(plotLeft, y);
        context.stroke();
      }
    }

    context.strokeStyle = foreground;
    context.beginPath();
    context.moveTo(plotLeft, plotTop);
    context.lineTo(plotLeft, plotTop + axisLength);
    context.lineTo(plotLeft + axisLength, plotTop + axisLength);
    context.stroke();

    context.fillStyle = dim;
    context.textAlign = "center";
    context.textBaseline = "bottom";
    context.fillText("rank", plotLeft + axisLength / 2, height - 4);
    context.save();
    context.translate(14, plotTop + axisLength / 2);
    context.rotate(-Math.PI / 2);
    context.fillText("frequency", 0, 0);
    context.restore();

    context.fillStyle = accent;
    items.forEach(function (item, index) {
      const x = xPosition(index + 1);
      const y = yPosition(item.count);
      const radius = items.length > 150 ? 2.2 : 3.2;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
      chartPoints.push({ x, y, radius: Math.max(7, radius), item, rank: index + 1 });
    });

    if (items.length > 0) {
      zipfChart.setAttribute("aria-label", "Zipf plot with " + items.length + " unique words.");
    } else {
      zipfChart.setAttribute("aria-label", "Empty Zipf plot showing logarithmic rank and frequency axes.");
    }
  }

  function updateZipfTooltip(event) {
    if (chartPoints.length === 0) return;
    const bounds = zipfChart.getBoundingClientRect();
    const mouseX = event.clientX - bounds.left;
    const mouseY = event.clientY - bounds.top;
    let nearest = null;
    let nearestDistance = Infinity;

    chartPoints.forEach(function (point) {
      const distance = Math.hypot(point.x - mouseX, point.y - mouseY);
      if (distance < nearestDistance) {
        nearest = point;
        nearestDistance = distance;
      }
    });

    if (!nearest || nearestDistance > 14) {
      zipfTooltip.hidden = true;
      return;
    }

    zipfTooltip.textContent =
      nearest.item.word +
      "  ·  rank " +
      nearest.rank +
      "  ·  frequency " +
      nearest.item.count;
    zipfTooltip.hidden = false;
    zipfTooltip.style.left = Math.min(mouseX + 12, bounds.width - zipfTooltip.offsetWidth - 8) + "px";
    zipfTooltip.style.top = Math.max(8, mouseY - 40) + "px";
  }

  // Update all statistics
  function updateAllStats() {
    const text = editor.value;
    const words = tokenizeWords(text);
    const wordCount = words.length;

    // Word count
    wordCountDisplay.textContent = wordCount;
    wordCountLabel.textContent = wordCount === 1 ? "word" : "words";

    // All words by frequency
    const allWords = calculateWordFrequencies(words);
    currentWordData = allWords;
    drawZipfChart(allWords);
    if (allWords.length > 0) {
      densityList.innerHTML = '';
      allWords.forEach(function (item, index) {
        const row = document.createElement('tr');
        
        const wordCell = document.createElement('td');
        wordCell.className = 'density-word';
        wordCell.textContent = item.word;
        wordCell.title = item.word; // Show full word on hover
        
        const rankCell = document.createElement('td');
        rankCell.className = 'rank-value';
        rankCell.textContent = index + 1;
        
        const countCell = document.createElement('td');
        countCell.className = 'density-count';
        countCell.textContent = item.count;
        
        row.appendChild(wordCell);
        row.appendChild(rankCell);
        row.appendChild(countCell);
        densityList.appendChild(row);
      });
    } else {
      densityList.innerHTML = '<tr><td colspan="3" class="no-words">No words yet</td></tr>';
    }
  }

  // Update word count display (legacy function name for compatibility)
  function updateWordCount() {
    updateAllStats();
  }

  // Event listeners
  editor.addEventListener("input", function () {
    updateWordCount();
  });

  zipfChart.addEventListener("mousemove", updateZipfTooltip);
  zipfChart.addEventListener("mouseleave", function () {
    zipfTooltip.hidden = true;
  });

  fontSizeSlider.addEventListener("input", function () {
    const size = fontSizeSlider.value;
    fontSizeValue.textContent = size + "px";
    editor.style.fontSize = size + "px";
    updateRangeProgress();
  });

  fontFamilySelect.addEventListener("change", function () {
    const family = fontFamilySelect.value;
    applyFontFamily(family);
    localStorage.setItem(STORAGE_KEYS.fontFamily, family);
  });

  if ("ResizeObserver" in window) {
    const chartResizeObserver = new ResizeObserver(function () {
      drawZipfChart(currentWordData);
    });
    chartResizeObserver.observe(zipfChart);
  } else {
    window.addEventListener("resize", function () {
      drawZipfChart(currentWordData);
    });
  }

  // Initialize on page load
  loadSettings();
})();
