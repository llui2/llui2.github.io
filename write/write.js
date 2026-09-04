// Write page notes:
// This file controls the font-size slider and counts words while the user types.
// The text is not saved: loading the page starts with an empty editor.
(function () {
  // Grab the few HTML elements that this page needs to update.
  const editor = document.getElementById("writeEditor");
  const fontSizeSlider = document.getElementById("fontSize");
  const fontSizeValue = document.getElementById("fontSizeValue");
  const wordCountDisplay = document.getElementById("wordCount");
  const wordCountLabel = document.getElementById("wordCountLabel");
  // Keep the starting size in one place so the slider and editor agree.
  const DEFAULT_FONT_SIZE = 16;

  // Storage is retained for the old draft key, although drafts are cleared
  // on load. Keeping the name here makes that decision easy to change.
  const STORAGE_KEYS = {
    draft: "write_draft",
  };

  function updateRangeProgress() {
    // The CSS slider uses --range-progress to color the filled part of the bar.
    const min = Number(fontSizeSlider.min);
    const max = Number(fontSizeSlider.max);
    const value = Number(fontSizeSlider.value);
    const progress = max > min ? ((value - min) / (max - min)) * 100 : 0;

    fontSizeSlider.style.setProperty("--range-progress", progress + "%");
  }

  // Reset the editor's page settings when the write page opens.
  function loadSettings() {
    // Clear any saved draft and old font-size value so every visit starts clean.
    localStorage.removeItem(STORAGE_KEYS.draft);
    localStorage.removeItem("write_fontSize");

    fontSizeSlider.value = String(DEFAULT_FONT_SIZE);
    fontSizeValue.textContent = DEFAULT_FONT_SIZE + "px";
    editor.style.fontSize = DEFAULT_FONT_SIZE + "px";

    updateRangeProgress();

    updateWordCount();
  }

  // Turn the editor text into words. Unicode letters and numbers are included,
  // so this also works for accented and non-English text.
  function tokenizeWords(text) {
    if (!text || !text.trim()) {
      return [];
    }
    // A word is a continuous run of letters or numbers.
    return text.match(/[\p{L}\p{N}]+/gu) || [];
  }

  // Recalculate the only statistic shown below the editor: the word count.
  function updateAllStats() {
    const text = editor.value;
    const words = tokenizeWords(text);
    const wordCount = words.length;

    // The label changes from "words" to "word" for exactly one word.
    wordCountDisplay.textContent = wordCount;
    wordCountLabel.textContent = wordCount === 1 ? "word" : "words";
  }

  // Keep this wrapper because older page code calls this name.
  function updateWordCount() {
    updateAllStats();
  }

  // Recount immediately after every edit.
  editor.addEventListener("input", function () {
    updateWordCount();
  });

  fontSizeSlider.addEventListener("input", function () {
    // Apply the slider value live, without waiting for the user to release it.
    const size = fontSizeSlider.value;
    fontSizeValue.textContent = size + "px";
    editor.style.fontSize = size + "px";
    updateRangeProgress();
  });

  // Set the initial size and count when the script is ready.
  loadSettings();
})();
