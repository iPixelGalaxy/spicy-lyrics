import cyrillicToLatin from "cyrillic-romanization";
import { franc } from "franc-all";
import Kuroshiro from "kuroshiro";
import langs from "langs";
import { RetrievePackage } from "../ImportPackage.ts";
import * as KuromojiAnalyzer from "./KuromojiAnalyzer.ts";
import { PageContainer } from "../../components/Pages/PageView.ts";
import Defaults from "../../components/Global/Defaults.ts";
import { gibberishifyLine } from "./GibberishTransform.ts";

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

function distributeLine(gibberishLine: string, syllables: any[]): string {
  if (!syllables.length) return gibberishLine;

  if (!gibberishLine) {
    for (const syllable of syllables) {
      syllable.GibberishText = "";
    }
    return gibberishLine;
  }

  const parts = distributeJoinedText(
    gibberishLine,
    syllables,
    (syllable) => getSyllableWeightText(syllable.Text ?? "").length
  );

  syllables.forEach((syllable: any, index: number) => {
    syllable.GibberishText = parts[index] ?? "";
  });

  return gibberishLine;
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
  console.log(`[Gibberish/ApplyMemeFormat] MemeFormat = "${Defaults.MemeFormat}", lyrics.Type = "${lyrics.Type}"`);
  if (Defaults.MemeFormat !== "Gibberish") return;

  console.log(`[Gibberish/ApplyMemeFormat] ✅ Gibberish mode is ACTIVE, processing ${lyrics.Type} lyrics...`);

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
    let syllableLineCount = 0;
    for (const vocalGroup of lyrics.Content) {
      if (vocalGroup.Type === "Vocal") {
        syllableLineCount++;
        // Build the full line text, gibberish-ify it as one unit
        let lineText = vocalGroup.Lead.Syllables[0]?.Text ?? "";
        for (let i = 1; i < vocalGroup.Lead.Syllables.length; i++) {
          const syl = vocalGroup.Lead.Syllables[i];
          lineText += `${syl.IsPartOfWord ? "" : " "}${syl.Text}`;
        }
        console.log(`[Gibberish/Syllable] Line ${syllableLineCount} original: "${lineText}" (${vocalGroup.Lead.Syllables.length} syllables)`);
        const gibberishLine = gibberishifyLine(lineText);

        // Distribute the gibberish across syllables without crossing word boundaries.
        vocalGroup.Lead.GibberishText = distributeLine(gibberishLine, vocalGroup.Lead.Syllables);
        console.log(`[Gibberish/Syllable] Line ${syllableLineCount} distributed:`, vocalGroup.Lead.Syllables.map((s: any) => `"${s.Text}"→"${s.GibberishText}"`));

        if (vocalGroup.Background !== undefined) {
          for (const bg of vocalGroup.Background) {
            let bgText = bg.Syllables[0]?.Text ?? "";
            for (let i = 1; i < bg.Syllables.length; i++) {
              const syl = bg.Syllables[i];
              bgText += `${syl.IsPartOfWord ? "" : " "}${syl.Text}`;
            }
            const bgGibberish = gibberishifyLine(bgText);
            bg.GibberishText = distributeLine(bgGibberish, bg.Syllables);
          }
        }
      }
    }
  }
}
