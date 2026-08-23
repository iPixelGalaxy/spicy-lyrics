import YAML from "yaml";

export interface LyricsfileWord {
  text: string;
  start_ms: number;
  end_ms?: number;
}

export interface LyricsfileLine {
  text: string;
  start_ms: number;
  end_ms?: number;
  words?: LyricsfileWord[];
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

function buildSyllableLyrics(lines: LyricsfileLine[], songwriters: string[]) {
  const content = lines.map((line, lineIndex, arr) => {
    const lineStartSec = (line.start_ms ?? 0) / 1000;
    const nextLineStartSec = arr[lineIndex + 1] ? (arr[lineIndex + 1].start_ms ?? 0) / 1000 : null;

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

    // Ensure lineEndSec >= lineStartSec
    if (lineEndSec < lineStartSec) {
      lineEndSec = lineStartSec;
    }

    let syllables: Array<{
      Text: string;
      StartTime: number;
      EndTime: number;
      IsPartOfWord: boolean;
    }> = [];

    if (Array.isArray(line.words) && line.words.length > 0) {
      const sortedWords = [...line.words].sort((a, b) => (a.start_ms ?? 0) - (b.start_ms ?? 0));

      syllables = sortedWords.map((word, wordIndex, wordsArr) => {
        const rawText = word.text ?? "";
        const wordStartSec = (word.start_ms ?? line.start_ms ?? 0) / 1000;
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

        const cleanText = rawText.trim();

        return {
          Text: cleanText || rawText,
          StartTime: wordStartSec,
          EndTime: wordEndSec,
          IsPartOfWord: isPartOfWord,
        };
      });
    } else {
      syllables = [
        {
          Text: line.text ?? "",
          StartTime: lineStartSec,
          EndTime: lineEndSec,
          IsPartOfWord: false,
        },
      ];
    }

    return {
      Type: "Vocal",
      OppositeAligned: false,
      Lead: {
        StartTime: lineStartSec,
        EndTime: lineEndSec,
        Syllables: syllables,
      },
    };
  });

  return {
    Type: "Syllable",
    ...(songwriters.length > 0 ? { SongWriters: songwriters } : {}),
    StartTime: content[0]?.Lead?.StartTime ?? 0,
    Content: content,
  };
}

function buildLineLyrics(lines: LyricsfileLine[], songwriters: string[]) {
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

    return {
      Type: "Vocal",
      Text: line.text ?? "",
      StartTime: lineStartSec,
      EndTime: lineEndSec,
      OppositeAligned: false,
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
