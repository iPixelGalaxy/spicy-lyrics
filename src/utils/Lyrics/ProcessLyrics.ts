import cyrillicToLatin from "cyrillic-romanization";
import { franc } from "franc-all";
import Kuroshiro from "kuroshiro";
import langs from "langs";
import { RetrievePackage } from "../ImportPackage.ts";
import * as KuromojiAnalyzer from "./KuromojiAnalyzer.ts";
import { PageContainer } from "../../components/Pages/PageView.ts";
import Defaults from "../../components/Global/Defaults.ts";
import { gibberishifyLine, processWord, applyPalatalization, clearMissedWords, logMissedWords } from "./GibberishTransform.ts";

// Constants
const RomajiConverter = new Kuroshiro();
const RomajiPromise = RomajiConverter.init(KuromojiAnalyzer);

const KoreanTextTest =
  /[\uac00-\ud7af]|[\u1100-\u11ff]|[\u3130-\u318f]|[\ua960-\ua97f]|[\ud7b0-\ud7ff]/;
const ChineseTextText = /([\u4E00-\u9FFF])/;
const JapaneseTextText = /([ぁ-んァ-ン])/;

// Cyrillic (basic + supplements + extended)
const CyrillicTextTest = /[\u0400-\u04FF\u0500-\u052F\u2DE0-\u2DFF\uA640-\uA69F]{2,}/;

// Greek (Basic + Extended)
const GreekTextTest = /[\u0370-\u03FF\u1F00-\u1FFF]/;

// Load Packages
RetrievePackage("pinyin", "4.0.0", "mjs")
  .catch(() => {});

RetrievePackage("aromanize", "1.0.0", "js")
  .catch(() => {});

RetrievePackage("GreekRomanization", "1.0.0", "js")
  .catch(() => {});

type RomanizationBranch = "Japanese" | "Chinese" | "Korean" | "Cyrillic" | "Greek";

type RomanizationPackages = {
  aromanize?: any;
  pinyin?: any;
  greekRomanization?: any;
};

const romanizationBranchFromFranc = (
  primaryLanguage: string,
  iso2Language: string | undefined
): RomanizationBranch | undefined => {
  if (primaryLanguage === "jpn") return "Japanese";
  if (primaryLanguage === "cmn") return "Chinese";
  if (primaryLanguage === "kor") return "Korean";
  if (
    primaryLanguage === "bel" ||
    primaryLanguage === "bul" ||
    primaryLanguage === "kaz" ||
    iso2Language === "ky" ||
    primaryLanguage === "mkd" ||
    iso2Language === "mn" ||
    primaryLanguage === "rus" ||
    primaryLanguage === "srp" ||
    primaryLanguage === "tgk" ||
    primaryLanguage === "ukr"
  ) {
    return "Cyrillic";
  }
  if (primaryLanguage === "ell") return "Greek";
  return undefined;
};

const preloadRomanizationPackages = async (
  branch: RomanizationBranch
): Promise<RomanizationPackages> => {
  const packages: RomanizationPackages = {};
  if (branch === "Japanese") {
    await RomajiPromise;
  } else if (branch === "Chinese") {
    packages.pinyin = await RetrievePackage("pinyin", "4.0.0", "mjs");
    while (!packages.pinyin) {
      await new Promise((r) => setTimeout(r, 50));
    }
  } else if (branch === "Korean") {
    packages.aromanize = await RetrievePackage("aromanize", "1.0.0", "js");
    while (!packages.aromanize) {
      await new Promise((r) => setTimeout(r, 50));
    }
  } else if (branch === "Greek") {
    packages.greekRomanization = await RetrievePackage("GreekRomanization", "1.0.0", "js");
    while (!packages.greekRomanization) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }
  return packages;
};

export type RomanizeOptions = {
  skipTextTests?: boolean;
  packages?: RomanizationPackages;
};

type ProcessLyricsOptions = {
  updatePageState?: boolean;
};

const RomanizeKorean = async (
  lyricMetadata: any,
  primaryLanguage: string,
  preloadedAromanize: any | undefined,
  skipTextTests: boolean
) => {
  const aromanize =
    preloadedAromanize ?? (await RetrievePackage("aromanize", "1.0.0", "js"));
  while (!aromanize) {
    await new Promise((r) => setTimeout(r, 50));
  }
  if (primaryLanguage === "kor" || (!skipTextTests && KoreanTextTest.test(lyricMetadata.Text))) {
    lyricMetadata.RomanizedText = aromanize.default(
      lyricMetadata.Text,
      "RevisedRomanizationTransliteration"
    );
  }
};

const RomanizeChinese = async (
  lyricMetadata: any,
  primaryLanguage: string,
  preloadedPinyin: any | undefined,
  skipTextTests: boolean
) => {
  const pinyin = preloadedPinyin ?? (await RetrievePackage("pinyin", "4.0.0", "mjs"));
  while (!pinyin) {
    await new Promise((r) => setTimeout(r, 50));
  }
  if (primaryLanguage === "cmn" || (!skipTextTests && ChineseTextText.test(lyricMetadata.Text))) {
    const result = pinyin.pinyin(lyricMetadata.Text, {
      segment: false,
      group: true,
    });

    lyricMetadata.RomanizedText = result.join("-");
  }
};

const RomanizeJapanese = async (
  lyricMetadata: any,
  primaryLanguage: string,
  skipTextTests: boolean
) => {
  if (primaryLanguage === "jpn" || (!skipTextTests && JapaneseTextText.test(lyricMetadata.Text))) {
    await RomajiPromise;

    const result = await RomajiConverter.convert(lyricMetadata.Text, {
      to: "romaji",
      mode: "spaced",
    });

    lyricMetadata.RomanizedText = result;
  }
};

const RomanizeCyrillic = async (
  lyricMetadata: any,
  primaryLanguage: string,
  iso2Lang: string,
  skipTextTests: boolean
) => {
  if (
    primaryLanguage === "bel" ||
    primaryLanguage === "bul" ||
    primaryLanguage === "kaz" ||
    iso2Lang === "ky" ||
    primaryLanguage === "mkd" ||
    iso2Lang === "mn" ||
    primaryLanguage === "rus" ||
    primaryLanguage === "srp" ||
    primaryLanguage === "tgk" ||
    primaryLanguage === "ukr" ||
    (!skipTextTests && CyrillicTextTest.test(lyricMetadata.Text))
  ) {
    const result = cyrillicToLatin(lyricMetadata.Text);
    if (result != null) {
      lyricMetadata.RomanizedText = result;
    }
  }
};

const RomanizeGreek = async (
  lyricMetadata: any,
  primaryLanguage: string,
  preloadedGreekRomanization: any | undefined,
  skipTextTests: boolean
) => {
  const greekRomanization =
    preloadedGreekRomanization ?? (await RetrievePackage("GreekRomanization", "1.0.0", "js"));
  while (!greekRomanization) {
    await new Promise((r) => setTimeout(r, 50));
  }
  if (primaryLanguage === "ell" || (!skipTextTests && GreekTextTest.test(lyricMetadata.Text))) {
    const result = greekRomanization.default(lyricMetadata.Text);
    if (result != null) {
      lyricMetadata.RomanizedText = result;
    }
  }
};

const Romanize = async (
  lyricMetadata: any,
  rootInformation: any,
  options?: RomanizeOptions
): Promise<string | undefined> => {
  const primaryLanguage = rootInformation.Language;
  const iso2Language = rootInformation.LanguageISO2;
  const skipTextTests = options?.skipTextTests === true;
  const packages = options?.packages;

  if (primaryLanguage === "jpn" || (!skipTextTests && JapaneseTextText.test(lyricMetadata.Text))) {
    await RomanizeJapanese(lyricMetadata, primaryLanguage, skipTextTests);
    rootInformation.IncludesRomanization = true;
    return "Japanese";
  } else if (primaryLanguage === "cmn" || (!skipTextTests && ChineseTextText.test(lyricMetadata.Text))) {
    await RomanizeChinese(lyricMetadata, primaryLanguage, packages?.pinyin, skipTextTests);
    rootInformation.IncludesRomanization = true;
    return "Chinese";
  } else if (primaryLanguage === "kor" || (!skipTextTests && KoreanTextTest.test(lyricMetadata.Text))) {
    await RomanizeKorean(lyricMetadata, primaryLanguage, packages?.aromanize, skipTextTests);
    rootInformation.IncludesRomanization = true;
    return "Korean";
  } else if (
    primaryLanguage === "bel" ||
    primaryLanguage === "bul" ||
    primaryLanguage === "kaz" ||
    iso2Language === "ky" ||
    primaryLanguage === "mkd" ||
    iso2Language === "mn" ||
    primaryLanguage === "rus" ||
    primaryLanguage === "srp" ||
    primaryLanguage === "tgk" ||
    primaryLanguage === "ukr" ||
    (!skipTextTests && CyrillicTextTest.test(lyricMetadata.Text))
  ) {
    await RomanizeCyrillic(lyricMetadata, primaryLanguage, iso2Language, skipTextTests);
    rootInformation.IncludesRomanization = true;
    return "Cyrillic";
  } else if (primaryLanguage === "ell" || (!skipTextTests && GreekTextTest.test(lyricMetadata.Text))) {
    await RomanizeGreek(lyricMetadata, primaryLanguage, packages?.greekRomanization, skipTextTests);
    rootInformation.IncludesRomanization = true;
    return "Greek";
  } else {
    rootInformation.IncludesRomanization = false;
    return undefined;
  }
};

function distributeJoinedText(text: string, groups: any[], getLength: (group: any) => number): string[] {
  if (!groups.length) return [];

  const lengths = groups.map((group) => Math.max(1, getLength(group)));
  const totalLength = lengths.reduce((sum: number, len: number) => sum + len, 0);
  const sliceLengths = new Array(groups.length).fill(0);

  if (text.length >= groups.length) {
    sliceLengths.fill(1);

    const remainingChars = text.length - groups.length;
    if (remainingChars > 0) {
      let consumedWeight = 0;
      let assignedExtra = 0;

      for (let i = 0; i < lengths.length; i++) {
        const isLast = i === lengths.length - 1;

        if (isLast) {
          sliceLengths[i] += remainingChars - assignedExtra;
          break;
        }

        consumedWeight += lengths[i];

        const targetAssignedExtra = Math.round((remainingChars * consumedWeight) / totalLength);
        const extraForThisGroup = Math.max(0, targetAssignedExtra - assignedExtra);

        sliceLengths[i] += extraForThisGroup;
        assignedExtra += extraForThisGroup;
      }
    }
  } else {
    for (let i = 0; i < text.length; i++) {
      sliceLengths[i] = 1;
    }
  }

  const parts: string[] = [];
  let cursor = 0;
  for (const sliceLen of sliceLengths) {
    parts.push(text.slice(cursor, cursor + sliceLen));
    cursor += sliceLen;
  }

  if (parts.length > 0 && cursor < text.length) {
    parts[parts.length - 1] += text.slice(cursor);
  }

  return parts;
}

function getSyllableWeightText(text: string): string {
  return (text ?? "")
    .toLowerCase()
    .replace(/[.,!?;:'"()\[\]{}\-—–…@#$%^&*~`]/g, "")
    .replace(/\s/g, "");
}

/**
 * Group syllables into words using IsPartOfWord, then gibberishify each word
 * independently and distribute its gibberish only across its own syllables.
 * This ensures gibberish word boundaries always align with syllable word boundaries.
 */
function distributeLineByWord(syllables: any[]): void {
  if (!syllables.length) return;

  const debug = Defaults.DeveloperMode;

  // Step 1: Group syllables into words.
  // IsPartOfWord=true means this syllable is NOT the last in its word.
  const wordGroups: { syllables: any[]; originalWord: string }[] = [];
  let currentGroup: any[] = [];

  for (const syl of syllables) {
    currentGroup.push(syl);
    if (!syl.IsPartOfWord) {
      // This syllable ends the word — finalize the group
      const word = currentGroup.map((s: any) => s.Text ?? "").join("");
      wordGroups.push({ syllables: currentGroup, originalWord: word });
      currentGroup = [];
    }
  }
  // If there are leftover syllables (shouldn't happen, but safety)
  if (currentGroup.length > 0) {
    const word = currentGroup.map((s: any) => s.Text ?? "").join("");
    wordGroups.push({ syllables: currentGroup, originalWord: word });
  }

  if (debug) {
    console.log(`[Wenomecha/Split] ── DISTRIBUTING BY WORD ──`);
    console.log(`[Wenomecha/Split] ${wordGroups.length} word groups from ${syllables.length} syllables:`);
    wordGroups.forEach((wg, wi) => {
      const sylDesc = wg.syllables.map((s: any) => `"${s.Text}"`).join(" + ");
      console.log(`  Word[${wi}] "${wg.originalWord}" = ${sylDesc} (${wg.syllables.length} syl)`);
    });
  }

  // Step 2: Gibberishify each word
  const originalWords = wordGroups.map((wg) => wg.originalWord);
  const gibberishWords = wordGroups.map((wg) => processWord(wg.originalWord).text);

  // Step 3: Palatalization — blend t/d + y across word boundaries
  applyPalatalization(originalWords, gibberishWords);

  // Step 4: Distribute each word's gibberish across its syllables
  for (let wi = 0; wi < wordGroups.length; wi++) {
    const wg = wordGroups[wi];
    const gibberish = gibberishWords[wi];

    if (debug) {
      console.log(`[Wenomecha/Split]   Word[${wi}] "${wg.originalWord}" → "${gibberish}"`);
    }

    if (wg.syllables.length === 1) {
      // Single syllable word — just assign directly
      wg.syllables[0].GibberishText = gibberish;
    } else {
      // Multi-syllable word — distribute gibberish proportionally across syllables
      const parts = distributeJoinedText(
        gibberish,
        wg.syllables,
        (s) => getSyllableWeightText(s.Text ?? "").length
      );
      wg.syllables.forEach((syl: any, si: number) => {
        syl.GibberishText = parts[si] ?? "";
      });
    }

    if (debug) {
      wg.syllables.forEach((syl: any, si: number) => {
        console.log(`    [${si}] "${syl.Text}" → "${syl.GibberishText}"`);
      });
    }
  }

  if (debug) {
    console.log(`[Wenomecha/Split] ── Final: ${syllables.map((s: any) => `"${s.GibberishText}"`).join(" ")} ──`);
  }
}

export const ProcessLyrics = async (lyrics: any, options?: ProcessLyricsOptions) => {
  const romanizationPromises: Promise<string | undefined>[] = [];
  let romanizeOptions: RomanizeOptions | undefined;

  if (lyrics.Type === "Static") {
    {
      let textToProcess = lyrics.Lines[0].Text;
      for (let index = 1; index < lyrics.Lines.length; index += 1) {
        textToProcess += `\n${lyrics.Lines[index].Text}`;
      }

      const language = franc(textToProcess);
      const languageISO2 = langs.where("3", language)?.["1"];

      lyrics.Language = language;
      lyrics.LanguageISO2 = languageISO2;

      const branch = romanizationBranchFromFranc(language, languageISO2);
      if (branch !== undefined) {
        romanizeOptions = {
          skipTextTests: true,
          packages: await preloadRomanizationPackages(branch),
        };
      }
    }

    for (const lyricMetadata of lyrics.Lines) {
      romanizationPromises.push(Romanize(lyricMetadata, lyrics, romanizeOptions));
    }
  } else if (lyrics.Type === "Line") {
    {
      const lines = [];
      for (const vocalGroup of lyrics.Content) {
        if (vocalGroup.Type === "Vocal") {
          lines.push(vocalGroup.Text);
        }
      }
      const textToProcess = lines.join("\n");

      const language = franc(textToProcess);
      const languageISO2 = langs.where("3", language)?.["1"];

      lyrics.Language = language;
      lyrics.LanguageISO2 = languageISO2;

      const branch = romanizationBranchFromFranc(language, languageISO2);
      if (branch !== undefined) {
        romanizeOptions = {
          skipTextTests: true,
          packages: await preloadRomanizationPackages(branch),
        };
      }
    }

    for (const vocalGroup of lyrics.Content) {
      if (vocalGroup.Type === "Vocal") {
        romanizationPromises.push(Romanize(vocalGroup, lyrics, romanizeOptions));
      }
    }
  } else if (lyrics.Type === "Syllable") {
    {
      const lines = [];
      for (const vocalGroup of lyrics.Content) {
        if (vocalGroup.Type === "Vocal") {
          let text = vocalGroup.Lead.Syllables[0].Text;
          for (let index = 1; index < vocalGroup.Lead.Syllables.length; index += 1) {
            const syllable = vocalGroup.Lead.Syllables[index];
            text += `${syllable.IsPartOfWord ? "" : " "}${syllable.Text}`;
          }

          lines.push(text);
        }
      }
      const textToProcess = lines.join("\n");

      const language = franc(textToProcess);
      const languageISO2 = langs.where("3", language)?.["1"];

      lyrics.Language = language;
      lyrics.LanguageISO2 = languageISO2;

      const branch = romanizationBranchFromFranc(language, languageISO2);
      if (branch !== undefined) {
        romanizeOptions = {
          skipTextTests: true,
          packages: await preloadRomanizationPackages(branch),
        };
      }
    }

    for (const vocalGroup of lyrics.Content) {
      if (vocalGroup.Type === "Vocal") {
        for (const syllable of vocalGroup.Lead.Syllables) {
          romanizationPromises.push(Romanize(syllable, lyrics, romanizeOptions));
        }

        if (vocalGroup.Background !== undefined) {
          for (const syllable of vocalGroup.Background[0].Syllables) {
            romanizationPromises.push(Romanize(syllable, lyrics, romanizeOptions));
          }
        }
      }
    }
  }

  await Promise.all(romanizationPromises);
  if (options?.updatePageState !== false) {
    if (lyrics.IncludesRomanization === true) {
      PageContainer?.classList.add("Lyrics_RomanizationAvailable");
    } else {
      PageContainer?.classList.remove("Lyrics_RomanizationAvailable");
    }
  }

  // ── Meme Format (Gibberish) ────────────────────────────────────────────
  ApplyMemeFormat(lyrics);
};

/**
 * Apply meme format transformations (Gibberish mode) to lyrics data.
 * Extracted as a separate export so it can run on cached lyrics too,
 * without re-running the full romanization pipeline.
 */
export function ApplyMemeFormat(lyrics: any): void {
  if (Defaults.MemeFormat !== "Gibberish") return;

  clearMissedWords();

  if (lyrics.Type === "Static") {
    for (const lyricMetadata of lyrics.Lines) {
      lyricMetadata.GibberishText = gibberishifyLine(lyricMetadata.Text);
    }
  } else if (lyrics.Type === "Line") {
    for (const vocalGroup of lyrics.Content) {
      if (vocalGroup.Type === "Vocal") {
        vocalGroup.GibberishText = gibberishifyLine(vocalGroup.Text);
      }
    }
  } else if (lyrics.Type === "Syllable") {
    const debug = Defaults.DeveloperMode;
    let syllableLineCount = 0;
    for (const vocalGroup of lyrics.Content) {
      if (vocalGroup.Type === "Vocal") {
        syllableLineCount++;

        if (debug) {
          let lineText = vocalGroup.Lead.Syllables[0]?.Text ?? "";
          for (let i = 1; i < vocalGroup.Lead.Syllables.length; i++) {
            const syl = vocalGroup.Lead.Syllables[i];
            lineText += `${syl.IsPartOfWord ? "" : " "}${syl.Text}`;
          }
          console.log(`[Wenomecha/Syllable] ═══ Line ${syllableLineCount}: "${lineText}" ═══`);
        }

        // Distribute gibberish per-word across syllables
        distributeLineByWord(vocalGroup.Lead.Syllables);

        // Set the line-level GibberishText (joined from syllables)
        vocalGroup.Lead.GibberishText = vocalGroup.Lead.Syllables
          .map((s: any) => s.GibberishText ?? "").join("");

        if (vocalGroup.Background !== undefined) {
          for (const bg of vocalGroup.Background) {
            distributeLineByWord(bg.Syllables);
            bg.GibberishText = bg.Syllables
              .map((s: any) => s.GibberishText ?? "").join("");
          }
        }
      }
    }
  }

  logMissedWords();
}
