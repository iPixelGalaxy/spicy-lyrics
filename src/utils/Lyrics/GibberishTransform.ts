/**
 * Gibberish Mode — "Wenomecha" Style Lyrics Transform
 *
 * Converts English (and any Latin-script) lyrics into phonetically-smashed
 * gibberish that looks like how a non-English speaker might transcribe what
 * they hear. Words get dictionary-matched first, then phonetically mangled
 * per-word, then joined together without spaces.
 */

import Defaults from "../../components/Global/Defaults.ts";
import { WordReplacements } from "./Gibberish/Dictionary.ts";


// Tracks words that weren't found in the dictionary (fell back to phonetic rules)
const _missedWords: Set<string> = new Set();

/** Clear the missed-words tracker (call before processing a song). */
export function clearMissedWords(): void {
  _missedWords.clear();
}

/** Log all words that weren't in the dictionary (always logs, no DevMode gate). */
export function logMissedWords(): void {
  if (_missedWords.size === 0) return;
  const sorted = [..._missedWords].sort();
  console.log(`[Wenomecha] Words not in dictionary (${sorted.length}): ${sorted.join(", ")}`);
}

// ── Per-word phonetic rules (fallback for words NOT in dictionary) ─────
// Applied to each word BEFORE joining. Uses $ anchors and patterns
// that need word boundaries.
const PerWordPhoneticRules: [RegExp, string][] = [
  // Multi-char patterns
  [/ough/g, "o"],
  [/augh/g, "af"],
  [/ight/g, "ai"],
  [/ould/g, "u"],
  [/tion/g, "shun"],
  [/sion/g, "shun"],
  [/cious/g, "shus"],
  [/tious/g, "shus"],
  [/ious/g, "yus"],
  [/eous/g, "yus"],
  [/ture/g, "cha"],
  [/sure/g, "sha"],

  // Digraphs & silent combos
  [/wh/g, "w"],
  [/ck/g, "k"],
  [/ph/g, "f"],
  [/gh/g, ""],
  [/kn/g, "n"],
  [/wr/g, "r"],
  [/mb$/g, "m"],
  [/mn/g, "n"],

  // th → t
  [/th/g, "t"],

  // Ending patterns
  [/ness$/g, "nes"],
  [/ment$/g, "men"],
  [/able$/g, "abo"],
  [/ible$/g, "ibo"],
  [/ble$/g, "bo"],
  [/ple$/g, "po"],
  [/tle$/g, "to"],
  [/ful$/g, "fo"],
  [/ally$/g, "ali"],
  [/ously$/g, "usli"],
  [/ely$/g, "li"],
  [/ly$/g, "li"],
  [/ery$/g, "ri"],
  [/ary$/g, "ari"],
  [/ory$/g, "ori"],
  [/ity$/g, "iti"],
  [/ety$/g, "eti"],

  // -er, -or, -ar, -re endings → a
  [/ier$/g, "ia"],
  [/er$/g, "a"],
  [/or$/g, "a"],
  [/ar$/g, "a"],
  [/our$/g, "a"],
  [/re$/g, "a"],

  // -ed endings
  [/ied$/g, "id"],
  [/([aeiou])ted$/g, "$1d"],
  [/([aeiou])ded$/g, "$1d"],
  [/([^aeiou])ed$/g, "$1"],

  // -ing
  [/ing$/g, "in"],

  // Vowel digraphs — aggressively reduce
  [/eigh/g, "e"],
  [/ea/g, "e"],
  [/oo/g, "u"],
  [/ee/g, "i"],
  [/ie/g, "i"],
  [/ei/g, "e"],
  [/ou/g, "u"],
  [/oi/g, "oy"],
  [/au/g, "o"],
  [/aw/g, "o"],
  [/ow/g, "o"],
  [/ai/g, "e"],
  [/ay$/g, "e"],

  // Double consonants → single
  [/([bcdfghjklmnpqrstvwxyz])\1/g, "$1"],

  // Trailing silent 'e' after a consonant
  [/([bcdfghjklmnpqrstvwxyz])e$/g, "$1"],
];

/**
 * Palatalization — blends a trailing dental/alveolar plosive (t, d) with a
 * following word that starts with a /j/ sound (y + vowel).
 *
 *   t + y → ch   (e.g., "met you" → "mech" + "u" = "mechu")
 *   d + y → j    (e.g., "did you" → "dij" + "u" = "diju")
 *
 * Checks the ORIGINAL words to detect the blend, then modifies the
 * processed (gibberish) outputs accordingly.
 */
export function applyPalatalization(
  originalWords: string[],
  processedWords: string[],
): void {
  const debug = Defaults.DeveloperMode;

  for (let i = 0; i < originalWords.length - 1; i++) {
    const currentClean = originalWords[i].toLowerCase().replace(/[.,!?;:'"()\[\]{}\-—–…@#$%^&*~`]/g, "");
    const nextClean = originalWords[i + 1].toLowerCase().replace(/[.,!?;:'"()\[\]{}\-—–…@#$%^&*~`]/g, "");

    if (currentClean.length === 0 || nextClean.length === 0) continue;

    const lastChar = currentClean[currentClean.length - 1];
    const isAlveolar = lastChar === "t" || lastChar === "d";
    const nextStartsWithY = /^y[aeiou]/i.test(nextClean);

    if (isAlveolar && nextStartsWithY) {
      const blend = lastChar === "t" ? "ch" : "j";

      if (debug) {
        console.log(`[Wenomecha/Palatal] "${originalWords[i]}" + "${originalWords[i + 1]}" → ${lastChar}+y = ${blend} | "${processedWords[i]}" + "${processedWords[i + 1]}" → "${processedWords[i] + blend}" + "${processedWords[i + 1]}"`);
      }

      // Append the blend sound to the current word
      processedWords[i] = processedWords[i] + blend;
    }
  }
}

/**
 * Strip punctuation, spaces, and lowercase a word.
 */
function cleanWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/[.,!?;:'"()\[\]{}\-—–…@#$%^&*~`\s]/g, "");
}

/**
 * Apply per-word phonetic mangling to a single word.
 * Only used for words NOT matched by the dictionary.
 */
function mangleWord(word: string): string {
  const debug = Defaults.DeveloperMode;
  let result = cleanWord(word);
  if (result.length === 0) return result;

  const before = result;
  for (const [pattern, replacement] of PerWordPhoneticRules) {
    const pre = result;
    result = result.replace(pattern, replacement);
    if (debug && result !== pre) {
      console.log(`[Wenomecha/Mangle]   Rule ${pattern} → "${replacement}" | "${pre}" → "${result}"`);
    }
  }
  if (debug && result === before) {
    console.log(`[Wenomecha/Mangle]   No phonetic rules matched for "${before}"`);
  }

  return result;
}

/**
 * Process a single sub-word (no hyphens): try dictionary first, fall back to phonetic mangling.
 * This prevents dictionary outputs from being double-mangled by phonetic rules.
 */
function processSubWord(word: string): { text: string; source: "dict" | "phonetic" } {
  const debug = Defaults.DeveloperMode;
  let result = word;
  let matched = false;
  const matchedPatterns: string[] = [];

  for (const [pattern, replacement] of WordReplacements) {
    // Reset lastIndex before test (global regexes are stateful)
    pattern.lastIndex = 0;
    if (pattern.test(result)) {
      matched = true;
      pattern.lastIndex = 0;
      result = result.replace(pattern, replacement);
      if (debug) matchedPatterns.push(`${pattern} → "${replacement}"`);
    }
  }

  if (matched) {
    const cleaned = cleanWord(result);
    if (debug) {
      console.log(`[Wenomecha/Word] "${word}" → "${cleaned}" (DICT: ${matchedPatterns.join(", ")})`);
    }
    return { text: cleaned, source: "dict" };
  }

  if (debug) {
    console.log(`[Wenomecha/Word] "${word}" → mangling (no dict match)`);
  }
  const cleaned = cleanWord(word);
  if (cleaned.length > 0) _missedWords.add(cleaned.toLowerCase());
  const mangled = mangleWord(word);
  if (debug) {
    console.log(`[Wenomecha/Word] "${word}" → "${mangled}" (PHONETIC)`);
  }
  return { text: mangled, source: "phonetic" };
}

/**
 * Process a word, splitting on hyphens/dashes so each part gets its own
 * dictionary lookup and phonetic pass.
 */
export function processWord(word: string): { text: string; source: "dict" | "phonetic" } {
  // Split on hyphens/dashes — each part is processed independently
  const parts = word.split(/[-—–]/);
  if (parts.length <= 1) {
    return processSubWord(word);
  }

  const debug = Defaults.DeveloperMode;
  if (debug) {
    console.log(`[Wenomecha/Word] Hyphenated: "${word}" → parts: ${parts.map((p) => `"${p}"`).join(", ")}`);
  }

  let anyDict = false;
  const processed = parts.map((part) => {
    const trimmed = part.trim();
    if (trimmed.length === 0) return { text: "", source: "phonetic" as const };
    const result = processSubWord(trimmed);
    if (result.source === "dict") anyDict = true;
    return result;
  });

  return {
    text: processed.map((p) => p.text).join(""),
    source: anyDict ? "dict" : "phonetic",
  };
}

/**
 * Transform a full line of lyrics into gibberish.
 * Each word is processed individually (dictionary first, then phonetic fallback),
 * then all words are joined together without spaces.
 *
 * Used for Line-synced and Static lyrics.
 */
export function gibberishifyLine(text: string): string {
  if (!text || text.trim().length === 0) return text;
  const debug = Defaults.DeveloperMode;

  if (debug) console.log(`[Wenomecha] ── INPUT: "${text}"`);

  const words = text.split(/\s+/);
  const processed = words.map((w) => processWord(w));
  const processedWords = processed.map((p) => p.text);

  // Palatalization: blend t/d + y across word boundaries
  applyPalatalization(words, processedWords);

  // Join words together (no spaces)
  let result = processedWords.join("");
  if (debug) console.log(`[Wenomecha] Joined: "${result}"`);

  // Final cleanup — collapse double consonants created by joining
  const beforeCleanup = result;
  result = result.replace(/([bcdfghjklmnpqrstvwxyz])\1/g, "$1");
  if (debug && result !== beforeCleanup) {
    console.log(`[Wenomecha] Cleanup: "${beforeCleanup}" → "${result}"`);
  }

  if (debug) {
    console.log(`[Wenomecha] ── OUTPUT: "${result}"`);
    console.log(`[Wenomecha] ── Word map: ${words.map((w, i) => `"${w}"→"${processedWords[i]}"`).join("  ")}`);
    console.log(`[Wenomecha] ──────────────────────────────────`);
  }

  return result;
}

