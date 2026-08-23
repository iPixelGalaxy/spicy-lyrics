import YAML from "yaml";

export interface LyricsfileWord {
  text: string;
  start_ms: number;
  end_ms?: number;
  background?: boolean;
  role?: string;
  singer?: string | number;
  [key: string]: any;
}

export interface LyricsfileLine {
  text: string;
  start_ms: number;
  end_ms?: number;
  words?: LyricsfileWord[];
  singer?: string | number;
  voice?: string | number;
  agent?: string | number;
  artist?: string;
  side?: string;
  opposite_aligned?: boolean;
  oppositeAligned?: boolean;
  background?: boolean;
  role?: string;
  [key: string]: any;
}

export interface LyricsfileMetadata {
  title?: string;
  artist?: string;
  album?: string;
  duration_ms?: number;
  offset_ms?: number;
  language?: string;
  instrumental?: boolean;
  songwriters?: string | string[];
  writers?: string | string[];
  lyricists?: string | string[];
  composers?: string | string[];
  [key: string]: any;
}

export interface LyricsfileDocument {
  version?: string;
  metadata?: LyricsfileMetadata;
  lines?: LyricsfileLine[];
  plain?: string;
}

const CJK_REGEX = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]/;

function extractSongwriters(metadata?: LyricsfileMetadata): string[] {
  if (!metadata) return [];
  const raw =
    metadata.songwriters ??
    metadata.writers ??
    metadata.lyricists ??
    metadata.composers;

  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Checks if a given text is likely a YAML Lyricsfile format.
 */
export function isLyricsfile(content: string): boolean {
  if (typeof content !== "string") return false;
  const trimmed = content.trim();
  if (!trimmed || trimmed.startsWith("<") || (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
    return false;
  }

  // Version 1.x pattern
  if (/^version:\s*['"]?1(?:\.\d+)?['"]?/m.test(trimmed)) {
    if (
      /\bmetadata:\s*$/m.test(trimmed) ||
      /\blines:\s*$/m.test(trimmed) ||
      /\bplain:\s*(?:\||>|['"]|$)/m.test(trimmed)
    ) {
      return true;
    }
  }

  // Pattern with start_ms and lines or words
  if (/\bstart_ms:\s*\d+/m.test(trimmed) && (/\blines:\s*$/m.test(trimmed) || /\bwords:\s*$/m.test(trimmed))) {
    return true;
  }

  // Explicit metadata with title/artist and lines
  if (/\bmetadata:\s*$/m.test(trimmed) && /\b(title|artist):\s*/m.test(trimmed) && /\blines:\s*$/m.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Parses a YAML Lyricsfile document into Spicy Lyrics internal format.
 */
export function parseLyricsfileToLyrics(content: string | LyricsfileDocument): any {
  let doc: LyricsfileDocument;

  if (typeof content === "string") {
    try {
      doc = YAML.parse(content) as LyricsfileDocument;
    } catch (err: any) {
      throw new Error(`Invalid YAML in Lyricsfile: ${err?.message || err}`);
    }
  } else if (typeof content === "object" && content !== null) {
    doc = content;
  } else {
    throw new Error("Invalid input: expected Lyricsfile YAML string or object");
  }

  if (!doc || typeof doc !== "object") {
    throw new Error("Invalid Lyricsfile: top-level YAML mapping expected");
  }

  const metadata = doc.metadata || {};
  const songwriters = extractSongwriters(metadata);
  const isInstrumental = metadata.instrumental === true;

  if (isInstrumental) {
    return {
      Type: "Static",
      ...(songwriters.length > 0 ? { SongWriters: songwriters } : {}),
      Lines: [{ Text: "♪ Instrumental ♪" }],
    };
  }

  const rawLines = Array.isArray(doc.lines) ? doc.lines : [];

  if (rawLines.length === 0) {
    if (typeof doc.plain === "string" && doc.plain.trim()) {
      const staticLines = doc.plain
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((text) => ({ Text: text }));

      if (staticLines.length > 0) {
        return {
          Type: "Static",
          ...(songwriters.length > 0 ? { SongWriters: songwriters } : {}),
          Lines: staticLines,
        };
      }
    }

    throw new Error("Lyricsfile contains neither synchronized lines nor plain text");
  }

  // Sort lines by start_ms
  const sortedLines = [...rawLines].sort((a, b) => (a.start_ms ?? 0) - (b.start_ms ?? 0));

  const hasWordSync = sortedLines.some(
    (line) => Array.isArray(line.words) && line.words.length > 0
  );

  if (hasWordSync) {
    return buildSyllableLyrics(sortedLines, songwriters);
  }

  return buildLineLyrics(sortedLines, songwriters);
}

function getSingerIdentifier(line: LyricsfileLine): string | number | undefined {
  if (line.singer !== undefined && line.singer !== null) return line.singer;
  if (line.voice !== undefined && line.voice !== null) return line.voice;
  if (line.agent !== undefined && line.agent !== null) return line.agent;
  if (line.vocal !== undefined && line.vocal !== null) return line.vocal;
  if (line.vocalist !== undefined && line.vocalist !== null) return line.vocalist;
  if (line.artist !== undefined && line.artist !== null) return line.artist;
  if (line.side !== undefined && line.side !== null) return String(line.side);

  if (Array.isArray(line.words) && line.words.length > 0) {
    const w = line.words[0];
    if (w.singer !== undefined && w.singer !== null) return w.singer;
    if (w.voice !== undefined && w.voice !== null) return w.voice;
    if (w.agent !== undefined && w.agent !== null) return w.agent;
    if (w.side !== undefined && w.side !== null) return String(w.side);
  }

  return undefined;
}

function isOppositeSinger(
  line: LyricsfileLine,
  singerMap?: Map<string | number, boolean>
): boolean {
  if (line.opposite_aligned === true || line.oppositeAligned === true) return true;
  if (line.side === "right" || line.side === "secondary") return true;

  if (
    Array.isArray(line.words) &&
    line.words.some(
      (w) =>
        w.opposite_aligned === true ||
        w.oppositeAligned === true ||
        w.side === "right" ||
        w.side === "secondary"
    )
  ) {
    return true;
  }

  const singer = getSingerIdentifier(line);
  if (singer !== undefined && singer !== null) {
    if (singerMap && singerMap.has(singer)) {
      return singerMap.get(singer) === true;
    }
    const str = String(singer).toLowerCase().trim();
    return (
      str === "2" ||
      str === "v2" ||
      str === "v2000" ||
      str === "right" ||
      str === "secondary" ||
      str.includes("v2") ||
      str.includes("secondary") ||
      str.includes("right") ||
      str.endsWith("2")
    );
  }

  return false;
}

function buildSingerMap(lines: LyricsfileLine[]): Map<string | number, boolean> {
  const map = new Map<string | number, boolean>();
  const seenSingers: Array<string | number> = [];

  for (const line of lines) {
    const singer = getSingerIdentifier(line);
    if (singer !== undefined && singer !== null && !seenSingers.includes(singer)) {
      seenSingers.push(singer);
    }
  }

  if (seenSingers.length > 1) {
    seenSingers.forEach((singer, index) => {
      const explicitOpposite = isOppositeSinger({ singer } as LyricsfileLine);
      map.set(singer, explicitOpposite || index === 1);
    });
  }

  return map;
}

function computeLineAlignments(lines: LyricsfileLine[]): boolean[] {
  const singerMap = buildSingerMap(lines);
  const hasExplicitSingers =
    singerMap.size > 1 ||
    lines.some(
      (l) =>
        l.opposite_aligned !== undefined ||
        l.oppositeAligned !== undefined ||
        l.side !== undefined ||
        l.singer !== undefined ||
        l.voice !== undefined ||
        l.agent !== undefined ||
        l.vocal !== undefined ||
        l.vocalist !== undefined ||
        (Array.isArray(l.words) &&
          l.words.some(
            (w) =>
              w.opposite_aligned !== undefined ||
              w.oppositeAligned !== undefined ||
              w.side !== undefined ||
              w.singer !== undefined ||
              w.voice !== undefined ||
              w.agent !== undefined
          ))
    );

  if (hasExplicitSingers) {
    return lines.map((line) => isOppositeSinger(line, singerMap));
  }

  // Two-voice stream allocator based on temporal overlap
  const alignments: boolean[] = new Array(lines.length).fill(false);
  let voice0End = -Infinity;
  let voice1End = -Infinity;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const start = line.start_ms ?? 0;
    const end = line.end_ms ?? (start + 3000);

    const overlapsVoice0 = start < voice0End - 50;
    const overlapsVoice1 = start < voice1End - 50;

    if (overlapsVoice0 && !overlapsVoice1) {
      alignments[i] = true;
      voice1End = Math.max(voice1End, end);
    } else if (!overlapsVoice0 && overlapsVoice1) {
      alignments[i] = false;
      voice0End = Math.max(voice0End, end);
    } else if (overlapsVoice0 && overlapsVoice1) {
      alignments[i] = true;
      voice1End = Math.max(voice1End, end);
    } else {
      alignments[i] = false;
      voice0End = Math.max(voice0End, end);
    }
  }

  return alignments;
}

function isBackgroundEntry(item: { background?: boolean; role?: string; text?: string }): boolean {
  if (item.background === true) return true;
  const role = (item.role || "").toLowerCase().trim();
  if (role === "background" || role === "x-bg" || role === "bg" || role === "x-background") return true;
  return false;
}

const BG_BRACKET_REGEX = /^[([{\uFF08【](.*)[)\]}\uFF09】]$/;

function buildSyllableLyrics(lines: LyricsfileLine[], songwriters: string[]) {
  const alignments = computeLineAlignments(lines);
  const content: any[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const lineStartSec = (line.start_ms ?? 0) / 1000;
    const nextLineStartSec = lines[lineIndex + 1] ? (lines[lineIndex + 1].start_ms ?? 0) / 1000 : null;

    let lineEndSec: number;
    if (line.end_ms !== undefined && line.end_ms !== null) {
      lineEndSec = line.end_ms / 1000;
    } else if (Array.isArray(line.words) && line.words.length > 0) {
      const maxWordEnd = Math.max(
        ...line.words.map((w) => (w.end_ms !== undefined && w.end_ms !== null ? w.end_ms : w.start_ms ?? line.start_ms ?? 0))
      );
      lineEndSec = maxWordEnd / 1000;
    } else if (nextLineStartSec !== null && nextLineStartSec > lineStartSec) {
      lineEndSec = nextLineStartSec;
    } else {
      lineEndSec = lineStartSec + 3;
    }

    if (lineEndSec < lineStartSec) {
      lineEndSec = lineStartSec;
    }

    const oppositeAligned = alignments[lineIndex] ?? false;
    const isLineWholeBg = isBackgroundEntry(line) || BG_BRACKET_REGEX.test((line.text || "").trim());

    let syllables: Array<{
      Text: string;
      StartTime: number;
      EndTime: number;
      IsPartOfWord: boolean;
    }> = [];

    const backgroundGroups: Array<{
      StartTime: number;
      EndTime: number;
      Syllables: Array<{
        Text: string;
        StartTime: number;
        EndTime: number;
        IsPartOfWord: boolean;
      }>;
      OppositeAligned?: boolean;
    }> = [];

    if (Array.isArray(line.words) && line.words.length > 0) {
      const sortedWords = [...line.words].sort((a, b) => (a.start_ms ?? 0) - (b.start_ms ?? 0));
      const leadWords: any[] = [];
      let currentBgWordList: any[] = [];

      sortedWords.forEach((word) => {
        const isWordBg = isLineWholeBg || isBackgroundEntry(word) || /^[([{\uFF08【]/.test(word.text || "");
        if (isWordBg) {
          currentBgWordList.push(word);
        } else {
          if (currentBgWordList.length > 0) {
            const bgSyllables = mapWordsToSyllables(currentBgWordList, lineStartSec, lineEndSec);
            if (bgSyllables.length > 0) {
              backgroundGroups.push({
                StartTime: bgSyllables[0].StartTime,
                EndTime: bgSyllables[bgSyllables.length - 1].EndTime,
                Syllables: bgSyllables,
                ...(oppositeAligned ? { OppositeAligned: true } : {}),
              });
            }
            currentBgWordList = [];
          }
          leadWords.push(word);
        }
      });

      if (currentBgWordList.length > 0) {
        const bgSyllables = mapWordsToSyllables(currentBgWordList, lineStartSec, lineEndSec);
        if (bgSyllables.length > 0) {
          backgroundGroups.push({
            StartTime: bgSyllables[0].StartTime,
            EndTime: bgSyllables[bgSyllables.length - 1].EndTime,
            Syllables: bgSyllables,
            ...(oppositeAligned ? { OppositeAligned: true } : {}),
          });
        }
      }

      syllables = mapWordsToSyllables(leadWords, lineStartSec, lineEndSec);
    } else {
      const cleanText = (line.text ?? "").trim();
      const strippedText = cleanText.replace(/^[([{\uFF08【]\s*/, "").replace(/\s*[)\]}\uFF09】]$/, "");

      if (isLineWholeBg) {
        backgroundGroups.push({
          StartTime: lineStartSec,
          EndTime: lineEndSec,
          Syllables: [
            {
              Text: strippedText || cleanText,
              StartTime: lineStartSec,
              EndTime: lineEndSec,
              IsPartOfWord: false,
            },
          ],
          ...(oppositeAligned ? { OppositeAligned: true } : {}),
        });
      } else {
        syllables = [
          {
            Text: cleanText,
            StartTime: lineStartSec,
            EndTime: lineEndSec,
            IsPartOfWord: false,
          },
        ];
      }
    }

    // If this line is pure background and we have a preceding vocal line, merge into its background
    if (syllables.length === 0 && backgroundGroups.length > 0 && content.length > 0) {
      const prev = content[content.length - 1];
      if (prev?.Type === "Vocal") {
        prev.Background = [...(prev.Background ?? []), ...backgroundGroups];
        continue;
      }
    }

    content.push({
      Type: "Vocal",
      OppositeAligned: oppositeAligned,
      Lead: {
        StartTime: syllables[0]?.StartTime ?? lineStartSec,
        EndTime: syllables[syllables.length - 1]?.EndTime ?? lineEndSec,
        Syllables: syllables.length > 0 ? syllables : (backgroundGroups[0]?.Syllables ?? []),
      },
      ...(backgroundGroups.length > 0 && syllables.length > 0 ? { Background: backgroundGroups } : {}),
    });
  }

  return {
    Type: "Syllable",
    ...(songwriters.length > 0 ? { SongWriters: songwriters } : {}),
    StartTime: content[0]?.Lead?.StartTime ?? 0,
    Content: content,
  };
}

function mapWordsToSyllables(
  wordsArr: LyricsfileWord[],
  lineStartSec: number,
  lineEndSec: number
): Array<{
  Text: string;
  StartTime: number;
  EndTime: number;
  IsPartOfWord: boolean;
}> {
  return wordsArr.map((word, wordIndex) => {
    const rawText = word.text ?? "";
    const wordStartSec = (word.start_ms ?? 0) / 1000;
    const nextWord = wordsArr[wordIndex + 1];

    let wordEndSec: number;
    if (word.end_ms !== undefined && word.end_ms !== null) {
      wordEndSec = word.end_ms / 1000;
    } else if (nextWord && (nextWord.start_ms ?? 0) > (word.start_ms ?? 0)) {
      wordEndSec = (nextWord.start_ms ?? 0) / 1000;
    } else {
      wordEndSec = Math.max(wordStartSec + 0.25, lineEndSec);
    }

    if (wordEndSec < wordStartSec) {
      wordEndSec = wordStartSec;
    }

    const isLastWord = wordIndex === wordsArr.length - 1;
    const hasTrailingSpace = /\s$/.test(rawText);
    const hasLeadingSpace = /^\s/.test(rawText);
    const nextHasLeadingSpace = nextWord ? /^\s/.test(nextWord.text ?? "") : false;

    let isPartOfWord = false;
    if (isLastWord) {
      isPartOfWord = false;
    } else if (hasTrailingSpace || hasLeadingSpace || nextHasLeadingSpace) {
      isPartOfWord = false;
    } else if (CJK_REGEX.test(rawText)) {
      isPartOfWord = false;
    } else {
      isPartOfWord = true;
    }

    const cleanText = rawText
      .replace(/^[([{\uFF08【]\s*/, "")
      .replace(/\s*[)\]}\uFF09】]$/, "")
      .trim();

    return {
      Text: cleanText || rawText.trim(),
      StartTime: wordStartSec,
      EndTime: wordEndSec,
      IsPartOfWord: isPartOfWord,
    };
  });
}

function buildLineLyrics(lines: LyricsfileLine[], songwriters: string[]) {
  const alignments = computeLineAlignments(lines);

  const content = lines.map((line, index, arr) => {
    const lineStartSec = (line.start_ms ?? 0) / 1000;
    const nextLine = arr[index + 1];

    let lineEndSec: number;
    if (line.end_ms !== undefined && line.end_ms !== null) {
      lineEndSec = line.end_ms / 1000;
    } else if (nextLine && (nextLine.start_ms ?? 0) > (line.start_ms ?? 0)) {
      lineEndSec = (nextLine.start_ms ?? 0) / 1000;
    } else {
      lineEndSec = lineStartSec + 3;
    }

    if (lineEndSec < lineStartSec) {
      lineEndSec = lineStartSec;
    }

    const oppositeAligned = alignments[index] ?? false;

    return {
      Type: "Vocal",
      Text: line.text ?? "",
      StartTime: lineStartSec,
      EndTime: lineEndSec,
      OppositeAligned: oppositeAligned,
    };
  });

  return {
    Type: "Line",
    ...(songwriters.length > 0 ? { SongWriters: songwriters } : {}),
    StartTime: content[0]?.StartTime ?? 0,
    Content: content,
  };
}

export default parseLyricsfileToLyrics;

