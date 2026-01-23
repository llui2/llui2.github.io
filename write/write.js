(function () {
  const editor = document.getElementById("writeEditor");
  const fontSizeSlider = document.getElementById("fontSize");
  const fontSizeValue = document.getElementById("fontSizeValue");
  const fontFamilySelect = document.getElementById("fontFamily");
  const wordCountDisplay = document.getElementById("wordCount");
  const lexicalVarietyDisplay = document.getElementById("lexicalVariety");
  const avgSentenceLengthDisplay = document.getElementById("avgSentenceLength");
  const maxSentenceLengthDisplay = document.getElementById("maxSentenceLength");
  const totalWordsDisplay = document.getElementById("totalWords");
  const densityList = document.getElementById("densityList");

  const STORAGE_KEYS = {
    draft: "write_draft",
    fontSize: "write_fontSize",
    fontFamily: "write_fontFamily",
  };

  // Restore saved content and settings
  function loadSettings() {
    const savedDraft = localStorage.getItem(STORAGE_KEYS.draft);
    if (savedDraft !== null) {
      editor.value = savedDraft;
    }

    const savedFontSize = localStorage.getItem(STORAGE_KEYS.fontSize);
    if (savedFontSize !== null) {
      fontSizeSlider.value = savedFontSize;
      fontSizeValue.textContent = savedFontSize + "px";
      editor.style.fontSize = savedFontSize + "px";
    } else {
      editor.style.fontSize = "16px";
    }

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

  // Count words in text
  function countWords(text) {
    return tokenizeWords(text).length;
  }

  // Calculate lexical variety (unique words / total words)
  function calculateLexicalVariety(words) {
    if (words.length === 0) return null;
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    return uniqueWords.size / words.length;
  }

  // Split text into sentences
  function splitSentences(text) {
    if (!text || !text.trim()) return [];
    // Split on . ? ! followed by space or end of string
    return text.split(/[.?!]+(?=\s|$)/).filter(s => s.trim().length > 0);
  }

  // Calculate sentence length statistics
  function calculateSentenceStats(text) {
    const sentences = splitSentences(text);
    if (sentences.length === 0) {
      return { avg: null, max: null };
    }

    const lengths = sentences.map(s => countWords(s));
    const sum = lengths.reduce((a, b) => a + b, 0);
    const avg = sum / lengths.length;
    const max = Math.max(...lengths);

    return { avg, max };
  }

  // Calculate all words by density (no limit, show all)
  function calculateAllWordsByDensity(words) {
    if (words.length === 0) return [];

    // Count frequency (case-insensitive)
    const frequency = {};
    words.forEach(function (word) {
      const lower = word.toLowerCase();
      frequency[lower] = (frequency[lower] || 0) + 1;
    });

    // Calculate density as normalized fraction (0-1)
    const totalWords = words.length;
    const densities = Object.keys(frequency).map(function (word) {
      const count = frequency[word];
      const density = count / totalWords;
      return { word, count, density };
    });

    // Sort by count/density descending (no limit)
    return densities.sort((a, b) => b.count - a.count);
  }

  // Update all statistics
  function updateAllStats() {
    const text = editor.value;
    const words = tokenizeWords(text);
    const wordCount = words.length;

    // Word count (both displays)
    wordCountDisplay.textContent = wordCount;
    totalWordsDisplay.textContent = wordCount;

    // Lexical variety
    const variety = calculateLexicalVariety(words);
    if (variety !== null) {
      lexicalVarietyDisplay.textContent = variety.toPrecision(2);
    } else {
      lexicalVarietyDisplay.textContent = '—';
    }

    // Sentence statistics
    const sentenceStats = calculateSentenceStats(text);
    if (sentenceStats.avg !== null) {
      avgSentenceLengthDisplay.textContent = sentenceStats.avg.toFixed(1);
      maxSentenceLengthDisplay.textContent = sentenceStats.max;
    } else {
      avgSentenceLengthDisplay.textContent = '—';
      maxSentenceLengthDisplay.textContent = '—';
    }

    // All words by density
    const allWords = calculateAllWordsByDensity(words);
    if (allWords.length > 0) {
      densityList.innerHTML = '';
      allWords.forEach(function (item) {
        const row = document.createElement('tr');
        
        const wordCell = document.createElement('td');
        wordCell.className = 'density-word';
        wordCell.textContent = item.word;
        wordCell.title = item.word; // Show full word on hover
        
        const densityCell = document.createElement('td');
        densityCell.className = 'density-value';
        densityCell.textContent = item.density.toFixed(3);
        
        const countCell = document.createElement('td');
        countCell.className = 'density-count';
        countCell.textContent = item.count;
        
        row.appendChild(wordCell);
        row.appendChild(densityCell);
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

  // Save content to localStorage
  function saveDraft() {
    localStorage.setItem(STORAGE_KEYS.draft, editor.value);
  }

  // Event listeners
  editor.addEventListener("input", function () {
    updateWordCount();
    saveDraft();
  });

  fontSizeSlider.addEventListener("input", function () {
    const size = fontSizeSlider.value;
    fontSizeValue.textContent = size + "px";
    editor.style.fontSize = size + "px";
    localStorage.setItem(STORAGE_KEYS.fontSize, size);
  });

  fontFamilySelect.addEventListener("change", function () {
    const family = fontFamilySelect.value;
    applyFontFamily(family);
    localStorage.setItem(STORAGE_KEYS.fontFamily, family);
  });

  // Initialize on page load
  loadSettings();
})();
