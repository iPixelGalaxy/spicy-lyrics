import type {
  AudioAnalysisData,
  Beat,
  Segment as AudioSegment,
} from "../../components/DynamicBG/BackgroundAnimationController.ts";

type LineLyricsEntry = {
  Type?: "Vocal" | string;
  Text: string;
  StartTime?: number;
  EndTime?: number;
  RomanizedText?: string;
  GibberishText?: string;
  OppositeAligned?: boolean;
};

type StaticLyricsEntry = {
  Text: string;
  RomanizedText?: string;
  GibberishText?: string;
  OppositeAligned?: boolean;
};

type GeneratedWord = {
  Text: string;
  StartTime: number;
  EndTime: number;
  IsPartOfWord: boolean;
  RomanizedText?: string;
  GibberishText?: string;
};

type GeneratedBackground = {
  StartTime: number;
  EndTime: number;
  Syllables: GeneratedWord[];
};

type GeneratedLine = {
  Type: "Vocal";
  OppositeAligned?: boolean;
  Lead: {
    StartTime: number;
    EndTime: number;
    Syllables: GeneratedWord[];
  };
  Background?: GeneratedBackground[];
};

type Segment = {
  kind: "lead" | "background";
  text: string;
};

type WordUnit = {
  text: string;
  isPartOfWord: boolean;
};

type PreparedStaticLine = {
  line: StaticLyricsEntry;
  blankLinesBefore: number;
};

const BRACKETED_SEGMENT_REGEX = /(\[[^[\]]+\]|\([^()]+\)|\{[^{}]+\})/g;
const BRACKETED_SEGMENT_TEST = /^(\[[^[\]]+\]|\([^()]+\)|\{[^{}]+\})$/;
const SUSPICIOUS_LINE_END_EPSILON = 0.05;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeText(text: string | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function getTextWeight(text: string): number {
  const compact = text
    .replace(/[.,!?;:'"()[\]{}\-—–…@#$%^&*~`]/g, "")
    .replace(/\s/g, "");

  return Math.max(1, compact.length || text.trim().length);
}

function parseSegments(text: string | undefined): Segment[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const segments: Segment[] = [];
  const parts = normalized.split(BRACKETED_SEGMENT_REGEX);

  parts.forEach((part) => {
    const piece = normalizeText(part);
    if (!piece) return;

    if (BRACKETED_SEGMENT_TEST.test(piece)) {
      const inner = normalizeText(piece.slice(1, -1));
      if (inner) {
        segments.push({
          kind: "background",
          text: inner,
        });
      }
      return;
    }

    segments.push({
      kind: "lead",
      text: piece,
    });
  });

  return segments.length > 0
    ? segments
    : [
        {
          kind: "lead",
          text: normalized,
        },
      ];
}

function splitTokenIntoWordUnits(token: string): WordUnit[] {
  const normalized = token.trim();
  if (!normalized) return [];

  const parts = normalized.split("-");
  if (parts.length === 1) {
    return [
      {
        text: normalized,
        isPartOfWord: false,
      },
    ];
  }

  const units: WordUnit[] = [];

  parts.forEach((part, index) => {
    const piece = part.trim();
    if (!piece) return;

    units.push({
      text: index < parts.length - 1 ? `${piece}-` : piece,
      isPartOfWord: index < parts.length - 1,
    });
  });

  return units.length > 0
    ? units
    : [
        {
          text: normalized,
          isPartOfWord: false,
        },
      ];
}

function splitWords(text: string): WordUnit[] {
  return normalizeText(text)
    .split(/\s+/)
    .flatMap((token) => splitTokenIntoWordUnits(token))
    .filter((unit) => !!unit.text);
}

function splitWordTexts(text: string): string[] {
  return splitWords(text).map((unit) => unit.text);
}

function capitalizeLeadingLetter(text: string | undefined): string | undefined {
  if (!text) return text;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const isAlphabetic = char.toLowerCase() !== char.toUpperCase();
    if (!isAlphabetic) {
      continue;
    }

    if (char === char.toLowerCase()) {
      return `${text.slice(0, index)}${char.toUpperCase()}${text.slice(index + 1)}`;
    }

    if (char === char.toUpperCase()) {
      return text;
    }
  }

  return text;
}

function capitalizeFirstGeneratedWord(words: GeneratedWord[]) {
  if (!words.length) return;

  words[0].Text = capitalizeLeadingLetter(words[0].Text) ?? words[0].Text;

  if (words[0].RomanizedText !== undefined) {
    words[0].RomanizedText = capitalizeLeadingLetter(words[0].RomanizedText);
  }

  if (words[0].GibberishText !== undefined) {
    words[0].GibberishText = capitalizeLeadingLetter(words[0].GibberishText);
  }
}

function distributeRanges(
  startTime: number,
  endTime: number,
  weights: number[]
): Array<{ start: number; end: number }> {
  if (!weights.length) return [];

  const safeStart = Number.isFinite(startTime) ? startTime : 0;
  const safeEnd = Number.isFinite(endTime) ? Math.max(safeStart, endTime) : safeStart;
  const duration = safeEnd - safeStart;
  const totalWeight = weights.reduce((sum, weight) => sum + Math.max(1, weight), 0);

  let consumedWeight = 0;
  let cursor = safeStart;

  return weights.map((weight, index) => {
    const segmentStart = cursor;

    if (index === weights.length - 1 || duration <= 0 || totalWeight <= 0) {
      return {
        start: segmentStart,
        end: safeEnd,
      };
    }

    consumedWeight += Math.max(1, weight);
    const segmentEnd = safeStart + (duration * consumedWeight) / totalWeight;
    cursor = segmentEnd;

    return {
      start: segmentStart,
      end: segmentEnd,
    };
  });
}

function distributeTextByWeight(text: string, baseWords: string[]): string[] {
  if (!baseWords.length) return [];

  const normalized = normalizeText(text);
  if (!normalized) {
    return new Array(baseWords.length).fill("");
  }

  if (baseWords.length === 1) {
    return [normalized];
  }

  const weights = baseWords.map((word) => getTextWeight(word));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const sliceLengths = new Array(baseWords.length).fill(0);

  if (normalized.length >= baseWords.length) {
    sliceLengths.fill(1);

    const remainingChars = normalized.length - baseWords.length;
    let consumedWeight = 0;
    let assignedExtra = 0;

    for (let index = 0; index < weights.length; index += 1) {
      const isLast = index === weights.length - 1;

      if (isLast) {
        sliceLengths[index] += remainingChars - assignedExtra;
        break;
      }

      consumedWeight += weights[index];

      const targetAssignedExtra = Math.round((remainingChars * consumedWeight) / totalWeight);
      const extraForThisGroup = Math.max(0, targetAssignedExtra - assignedExtra);

      sliceLengths[index] += extraForThisGroup;
      assignedExtra += extraForThisGroup;
    }
  } else {
    for (let index = 0; index < normalized.length; index += 1) {
      sliceLengths[index] = 1;
    }
  }

  const parts: string[] = [];
  let cursor = 0;

  sliceLengths.forEach((sliceLength) => {
    parts.push(normalized.slice(cursor, cursor + sliceLength).trim());
    cursor += sliceLength;
  });

  if (parts.length > 0 && cursor < normalized.length) {
    parts[parts.length - 1] = `${parts[parts.length - 1]}${normalized.slice(cursor)}`.trim();
  }

  return parts;
}

function getTransformedWords(text: string | undefined, baseWords: string[]): string[] | null {
  if (!text) return null;

  const normalized = normalizeText(text);
  if (!normalized) return new Array(baseWords.length).fill("");

  const transformedWords = splitWordTexts(normalized);
  if (transformedWords.length === baseWords.length) {
    return transformedWords;
  }

  return distributeTextByWeight(normalized, baseWords);
}

function assignWordText(
  words: GeneratedWord[],
  key: "RomanizedText" | "GibberishText",
  transformedText: string | undefined
) {
  if (!words.length || !transformedText) return;

  const transformedWords = getTransformedWords(
    transformedText,
    words.map((word) => word.Text)
  );

  if (!transformedWords) return;

  words.forEach((word, index) => {
    const value = transformedWords[index];
    if (value !== undefined) {
      word[key] = value;
    }
  });
}

function buildWords(text: string, startTime: number, endTime: number): GeneratedWord[] {
  const wordUnits = splitWords(text);
  if (!wordUnits.length) return [];

  const ranges = distributeRanges(
    startTime,
    endTime,
    wordUnits.map((wordUnit) => getTextWeight(wordUnit.text))
  );

  return wordUnits.map((wordUnit, index) => ({
    Text: wordUnit.text,
    StartTime: ranges[index]?.start ?? startTime,
    EndTime: ranges[index]?.end ?? endTime,
    IsPartOfWord: wordUnit.isPartOfWord,
  }));
}

function getAlignedSegmentTexts(
  baseSegments: Segment[],
  transformedText: string | undefined
): string[] | null {
  if (!transformedText) return null;

  const transformedSegments = parseSegments(transformedText);
  if (transformedSegments.length !== baseSegments.length) {
    return null;
  }

  const isAligned = transformedSegments.every(
    (segment, index) => segment.kind === baseSegments[index]?.kind
  );

  if (!isAligned) return null;

  return transformedSegments.map((segment) => segment.text);
}

function createFallbackLead(
  line: LineLyricsEntry,
  romanizedText?: string,
  gibberishText?: string
): GeneratedLine | null {
  const lineStart = Number.isFinite(line.StartTime) ? (line.StartTime as number) : 0;
  const lineEnd = Number.isFinite(line.EndTime)
    ? Math.max(lineStart, line.EndTime as number)
    : lineStart;
  const leadWords = buildWords(line.Text, lineStart, lineEnd);

  if (!leadWords.length) return null;

  assignWordText(leadWords, "RomanizedText", romanizedText);
  assignWordText(leadWords, "GibberishText", gibberishText);

  return {
    Type: "Vocal",
    OppositeAligned: line.OppositeAligned ?? false,
    Lead: {
      StartTime: lineStart,
      EndTime: lineEnd,
      Syllables: leadWords,
    },
  };
}

function isBackgroundOnlySegments(segments: Segment[]): boolean {
  return segments.length > 0 && segments.every((segment) => segment.kind === "background");
}

function getSafeLineStartTime(line: LineLyricsEntry | undefined): number | null {
  if (!line || !Number.isFinite(line.StartTime)) return null;
  return line.StartTime as number;
}

function getSafeLineEndTime(line: LineLyricsEntry | undefined): number | null {
  if (!line || !Number.isFinite(line.EndTime)) return null;
  return line.EndTime as number;
}

function hasMeaningfulGap(
  previousLine: LineLyricsEntry | undefined,
  currentLine: LineLyricsEntry,
  nextLine: LineLyricsEntry | undefined
): boolean {
  const currentStart = getSafeLineStartTime(currentLine);
  const currentEnd = getSafeLineEndTime(currentLine);
  const previousEnd = getSafeLineEndTime(previousLine);
  const nextStart = getSafeLineStartTime(nextLine);

  if (
    previousEnd !== null &&
    currentStart !== null &&
    currentStart - previousEnd > 0.35
  ) {
    return true;
  }

  if (
    currentEnd !== null &&
    nextStart !== null &&
    nextStart - currentEnd > 0.35
  ) {
    return true;
  }

  return false;
}

function shouldKeepBackgroundOnlyLineAsLead(
  lines: LineLyricsEntry[],
  index: number,
  segments: Segment[]
): boolean {
  if (!isBackgroundOnlySegments(segments)) {
    return false;
  }

  const previousSegments = index > 0 ? parseSegments(lines[index - 1]?.Text) : [];
  const nextSegments =
    index < lines.length - 1 ? parseSegments(lines[index + 1]?.Text) : [];

  const repeatedBackgroundOnly =
    isBackgroundOnlySegments(previousSegments) ||
    isBackgroundOnlySegments(nextSegments);

  if (repeatedBackgroundOnly) {
    return true;
  }

  return hasMeaningfulGap(lines[index - 1], lines[index], lines[index + 1]);
}

function joinGeneratedWords(words: GeneratedWord[]): string {
  return words.reduce((joinedText, word, index) => {
    if (index === 0) return word.Text;
    return word.IsPartOfWord ? `${joinedText}${word.Text}` : `${joinedText} ${word.Text}`;
  }, "");
}

function isVocableLikeLine(text: string): boolean {
  const normalized = normalizeText(text).toLowerCase();
  if (!normalized) return false;

  const wordTexts = splitWordTexts(normalized);
  if (wordTexts.length === 0 || wordTexts.length > 5) {
    return false;
  }

  const simpleWordCount = normalized.split(/\s+/).filter(Boolean).length;
  const hasMultipleHyphens = (normalized.match(/-/g) ?? []).length >= 2;
  const hasRepeatedShortVocable = wordTexts.every((word) => {
    const stripped = word.replace(/[^a-z]/g, "");
    return (
      stripped.length >= 1 &&
      stripped.length <= 5 &&
      /^(oh|ooh|oooh|whoa|woah|ah|aah|ha|hey|yeah|ya|na|la|da|dum|doo|wo)$/.test(stripped)
    );
  });

  return hasRepeatedShortVocable && (hasMultipleHyphens || simpleWordCount <= 3);
}

function getQuietnessScore(loudness: number | undefined): number {
  if (loudness === undefined || Number.isNaN(loudness)) {
    return 0;
  }

  return Math.max(0, Math.min(1, (-loudness - 10) / 25));
}

function getSegmentBoundaryPauseStrength(
  analysis: AudioAnalysisData,
  boundaryTime: number
): number {
  const currentSegmentIndex = analysis.segments.findIndex((segment) => {
    const segmentEnd = segment.start + segment.duration;
    return boundaryTime >= segment.start && boundaryTime <= segmentEnd;
  });

  if (currentSegmentIndex === -1) {
    return 0;
  }

  const currentSegment = analysis.segments[currentSegmentIndex];
  const nextSegment = analysis.segments[currentSegmentIndex + 1];
  const currentQuietness = getQuietnessScore(
    currentSegment.loudness_end ?? currentSegment.loudness_max
  );
  const nextQuietness = getQuietnessScore(
    nextSegment?.loudness_start ?? nextSegment?.loudness_max
  );

  return Math.max(currentQuietness, nextQuietness);
}

function getEligibleCommaMatches(
  text: string
): Array<{ beforeText: string; isLastComma: boolean }> {
  const normalized = normalizeText(text);
  if (!normalized.includes(",")) {
    return [];
  }

  const commaMatches = Array.from(normalized.matchAll(/,/g));
  if (commaMatches.length === 0 || commaMatches.length > 2) {
    return [];
  }

  const matches = commaMatches
    .map((match) => {
      const index = match.index ?? -1;
      const beforeText = normalized.slice(0, index).trim();
      const afterText = normalized.slice(index + 1).trim();
      return {
        index,
        beforeText,
        afterText,
      };
    })
    .filter((match) => match.beforeText && match.afterText);

  if (matches.length !== commaMatches.length) {
    return [];
  }

  for (let index = 1; index < matches.length; index += 1) {
    const between = normalized.slice(matches[index - 1].index + 1, matches[index].index);
    if (between.replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length < 2) {
      return [];
    }
  }

  return matches.map(({ beforeText }, index) => ({
    beforeText,
    isLastComma: index === matches.length - 1,
  }));
}

function getStaticCommaWeight(text: string): number {
  return getEligibleCommaMatches(text).reduce((total, match) => {
    return total + (match.isLastComma ? 0.18 : 0.1);
  }, 0);
}

function getBaseSpokenLineDuration(text: string): number {
  const wordUnits = splitWords(text);
  if (!wordUnits.length) return 0.4;

  const totalWeight = wordUnits.reduce(
    (sum, wordUnit) => sum + getTextWeight(wordUnit.text),
    0
  );
  const normalized = normalizeText(text);
  const terminalPause = /[.!?]$/.test(normalized)
    ? 0.12
    : /[,;:]$/.test(normalized)
      ? 0.07
      : 0;

  return Math.max(
    0.4,
    0.18 + wordUnits.length * 0.16 + totalWeight * 0.045 + terminalPause
  );
}

function getEstimatedStaticLineDuration(text: string): number {
  const baseDuration = getBaseSpokenLineDuration(text) + getStaticCommaWeight(text);
  return isVocableLikeLine(text) ? baseDuration * 1.2 : baseDuration;
}

function getStaticGapDuration(
  previousText: string,
  blankLinesBeforeNext: number
): number {
  const normalized = normalizeText(previousText);
  let duration = 0.12;

  if (/[,:;]$/.test(normalized)) {
    duration += 0.08;
  }

  if (/[.!?]$/.test(normalized)) {
    duration += 0.16;
  }

  if (isVocableLikeLine(normalized)) {
    duration += 0.04;
  }

  duration += Math.min(blankLinesBeforeNext, 2) * 0.45;

  return duration;
}

function estimateCommaPauseDuration(
  text: string,
  lineStart: number,
  rawLineEnd: number,
  analysis?: AudioAnalysisData
): number {
  if (!analysis) return 0;

  const commaMatches = getEligibleCommaMatches(text);
  if (!commaMatches.length) {
    return 0;
  }

  const totalWeight = Math.max(1, getTextWeight(text));
  const baseDuration = getBaseSpokenLineDuration(text);
  const rawDuration = rawLineEnd - lineStart;
  const feelsTooLong = rawDuration > baseDuration * 1.55;
  let pauseDuration = 0;

  commaMatches.forEach(({ beforeText, isLastComma }) => {
    const progress = Math.max(0.08, Math.min(0.92, getTextWeight(beforeText) / totalWeight));
    const targetTime = lineStart + (rawLineEnd - lineStart) * progress;
    const boundary = getBestAudioBoundary(
      analysis,
      lineStart,
      rawLineEnd,
      targetTime,
      true
    );

    const lastCommaNearTail = isLastComma && progress >= 0.45;
    const boundaryWindow = isLastComma
      ? feelsTooLong
        ? lastCommaNearTail
          ? 0.42
          : 0.34
        : lastCommaNearTail
          ? 0.3
          : 0.24
      : 0.18;

    if (boundary !== null && Math.abs(boundary - targetTime) <= boundaryWindow) {
      pauseDuration += isLastComma
        ? feelsTooLong
          ? lastCommaNearTail
            ? 0.24
            : 0.18
          : lastCommaNearTail
            ? 0.16
            : 0.12
        : 0.1;
    }
  });

  return Math.min(pauseDuration, feelsTooLong ? 0.34 : 0.24);
}

function estimateSpokenLineDuration(
  text: string,
  lineStart: number,
  rawLineEnd: number,
  analysis?: AudioAnalysisData
): number {
  return (
    getBaseSpokenLineDuration(text) +
    estimateCommaPauseDuration(text, lineStart, rawLineEnd, analysis)
  );
}

function getBoundaryScore(
  boundaryTime: number,
  targetTime: number,
  biasPenalty: number = 0
): number {
  return Math.abs(boundaryTime - targetTime) + biasPenalty;
}

function getBestBoundaryAroundTarget(
  analysis: AudioAnalysisData | undefined,
  targetTime: number,
  minBoundary: number,
  maxBoundary: number,
  preferPauseBoundaries: boolean = false
): number | null {
  if (!analysis || maxBoundary <= minBoundary) {
    return null;
  }

  const paddedStart = Math.max(0, minBoundary - 0.12);
  const paddedEnd = Math.max(paddedStart + 0.2, maxBoundary + 0.08);

  return getBestAudioBoundary(
    analysis,
    paddedStart,
    paddedEnd,
    targetTime,
    preferPauseBoundaries
  );
}

function getBestAudioBoundary(
  analysis: AudioAnalysisData | undefined,
  lineStart: number,
  rawLineEnd: number,
  targetLineEnd: number,
  preferPauseBoundaries: boolean = false
): number | null {
  if (!analysis) return null;

  const minBoundary = lineStart + 0.12;
  const maxBoundary = rawLineEnd - 0.08;
  if (maxBoundary <= minBoundary) {
    return null;
  }

  let bestBoundary: number | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  const considerBoundary = (
    boundaryTime: number,
    penalty: number,
    pauseStrength: number = 0
  ) => {
    if (boundaryTime < minBoundary || boundaryTime > maxBoundary) {
      return;
    }

    const pauseBias = preferPauseBoundaries ? pauseStrength * 0.16 : pauseStrength * 0.08;
    const score = getBoundaryScore(boundaryTime, targetLineEnd, penalty - pauseBias);
    if (score < bestScore) {
      bestScore = score;
      bestBoundary = boundaryTime;
    }
  };

  analysis.segments.forEach((segment: AudioSegment) => {
    const segmentEnd = segment.start + segment.duration;
    const pauseStrength = getSegmentBoundaryPauseStrength(analysis, segmentEnd);
    const penalty = preferPauseBoundaries
      ? pauseStrength >= 0.2
        ? 0
        : 0.22
      : pauseStrength >= 0.2
        ? 0
        : 0.08;

    considerBoundary(segmentEnd, penalty, pauseStrength);
  });

  analysis.beats.forEach((beat: Beat) => {
    const beatEnd = beat.start + beat.duration;
    const pauseStrength = getSegmentBoundaryPauseStrength(analysis, beatEnd);
    const penalty = preferPauseBoundaries
      ? 0.3
      : pauseStrength >= 0.2
        ? 0.1
        : 0.18;

    considerBoundary(beatEnd, penalty, pauseStrength);
  });

  if (bestBoundary === null) {
    return null;
  }

  if (Math.abs(bestBoundary - targetLineEnd) > 0.42) {
    return null;
  }

  return bestBoundary;
}

function getEffectiveLineEnd(
  lines: LineLyricsEntry[],
  index: number,
  line: LineLyricsEntry,
  analysis?: AudioAnalysisData,
  options?: {
    hasBackgroundSegments?: boolean;
  }
): number {
  const lineStart = Number.isFinite(line.StartTime) ? (line.StartTime as number) : 0;
  const rawLineEnd = Number.isFinite(line.EndTime)
    ? Math.max(lineStart, line.EndTime as number)
    : lineStart;
  const nextLineStart = getSafeLineStartTime(lines[index + 1]);

  if (nextLineStart === null) {
    return rawLineEnd;
  }

  if (Math.abs(rawLineEnd - nextLineStart) > SUSPICIOUS_LINE_END_EPSILON) {
    return rawLineEnd;
  }

  const rawDuration = rawLineEnd - lineStart;
  const backgroundMultiplier = options?.hasBackgroundSegments ? 1.2 : 1;
  const isVocableLine = isVocableLikeLine(line.Text);
  const vocableMultiplier = isVocableLine ? 1.65 : 1;
  const predictedDuration = estimateSpokenLineDuration(
    line.Text,
    lineStart,
    rawLineEnd,
    analysis
  ) * backgroundMultiplier * vocableMultiplier;

  const suspiciousThreshold =
    (options?.hasBackgroundSegments ? 1.95 : 1.6) *
    (isVocableLine ? 1.42 : 1);

  if (rawDuration <= predictedDuration * suspiciousThreshold) {
    return rawLineEnd;
  }

  const trimMultiplier = options?.hasBackgroundSegments
    ? 1.1
    : isVocableLine
      ? 1.62
      : 1.22;
  const estimatedLineEnd = Math.min(rawLineEnd, lineStart + predictedDuration * trimMultiplier);
  const audioAssistedLineEnd = getBestAudioBoundary(
    analysis,
    lineStart,
    rawLineEnd,
    estimatedLineEnd
  );

  return audioAssistedLineEnd ?? estimatedLineEnd;
}

function getPreparedStaticLines(lines: StaticLyricsEntry[]): PreparedStaticLine[] {
  const preparedLines: PreparedStaticLine[] = [];
  let blankLinesBefore = 0;

  lines.forEach((line) => {
    if (!normalizeText(line.Text)) {
      blankLinesBefore += 1;
      return;
    }

    preparedLines.push({
      line,
      blankLinesBefore,
    });

    blankLinesBefore = 0;
  });

  return preparedLines;
}

function getTrackDurationSeconds(
  analysis?: AudioAnalysisData | null,
  fallbackDurationSeconds?: number
): number {
  if (analysis?.track?.duration && Number.isFinite(analysis.track.duration)) {
    return analysis.track.duration;
  }

  if (fallbackDurationSeconds && Number.isFinite(fallbackDurationSeconds)) {
    return fallbackDurationSeconds;
  }

  return 0;
}

function getStaticLyricsTimingWindow(
  lineWeights: number[],
  gapWeights: number[],
  analysis?: AudioAnalysisData | null,
  fallbackDurationSeconds?: number,
  leadingBlankLines: number = 0
): { start: number; end: number } | null {
  const trackDuration = getTrackDurationSeconds(analysis, fallbackDurationSeconds);
  if (trackDuration < 8) {
    return null;
  }

  const estimatedLyricsDuration =
    lineWeights.reduce((sum, duration) => sum + duration, 0) +
    gapWeights.reduce((sum, duration) => sum + duration, 0);
  const extraDuration = Math.max(0, trackDuration - estimatedLyricsDuration);
  const maxIntroMargin = Math.min(8, trackDuration * 0.16);
  const maxOutroMargin = Math.min(10, trackDuration * 0.18);
  const introBias = 0.18 + Math.min(leadingBlankLines, 3) * 0.7;
  const introSpread = extraDuration * 0.05;
  const introCap = Math.min(maxIntroMargin, 3.1 + Math.min(leadingBlankLines, 3) * 0.55);

  let start = clamp(introBias + introSpread, 0.12, Math.max(0.18, introCap));
  let end = trackDuration - clamp(0.45 + extraDuration * 0.28, 0.55, maxOutroMargin);

  if (end - start < Math.min(6, trackDuration * 0.4)) {
    start = clamp(trackDuration * 0.04, 0.2, Math.max(0.2, trackDuration * 0.12));
    end = trackDuration - clamp(trackDuration * 0.05, 0.35, Math.max(0.35, trackDuration * 0.14));
  }

  if (analysis) {
    const snappedStart = getBestBoundaryAroundTarget(
      analysis,
      start,
      Math.max(0, start - 0.35),
      Math.min(end - 1.5, start + 0.8 + Math.min(leadingBlankLines, 2) * 0.25),
      false
    );
    const snappedEnd = getBestBoundaryAroundTarget(
      analysis,
      end,
      Math.max(start + 1.5, end - 1.6),
      Math.min(trackDuration, end + 1.8),
      true
    );

    if (snappedStart !== null) {
      start = snappedStart;
    }

    if (snappedEnd !== null) {
      end = snappedEnd;
    }
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 4) {
    return null;
  }

  return { start, end };
}

function buildStaticSyntheticLineLyrics(
  lyrics: any,
  analysis?: AudioAnalysisData | null,
  fallbackDurationSeconds?: number
) {
  if (lyrics?.Type !== "Static" || !Array.isArray(lyrics.Lines) || !analysis) {
    return null;
  }

  const preparedLines = getPreparedStaticLines(lyrics.Lines as StaticLyricsEntry[]);
  if (!preparedLines.length) {
    return null;
  }

  const lineWeights = preparedLines.map((entry) =>
    getEstimatedStaticLineDuration(entry.line.Text)
  );
  const gapWeights = preparedLines.slice(1).map((entry, index) =>
    getStaticGapDuration(preparedLines[index].line.Text, entry.blankLinesBefore)
  );
  const timingWindow = getStaticLyricsTimingWindow(
    lineWeights,
    gapWeights,
    analysis,
    fallbackDurationSeconds,
    preparedLines[0]?.blankLinesBefore ?? 0
  );

  if (!timingWindow) {
    return null;
  }

  const totalWeight =
    lineWeights.reduce((sum, weight) => sum + weight, 0) +
    gapWeights.reduce((sum, weight) => sum + weight, 0);

  if (totalWeight <= 0) {
    return null;
  }

  const scale = (timingWindow.end - timingWindow.start) / totalWeight;
  const syntheticLines: LineLyricsEntry[] = [];
  let cursor = timingWindow.start;

  preparedLines.forEach((entry, index) => {
    const lineText = entry.line.Text;
    const minimumLineDuration = Math.max(
      0.34,
      splitWords(lineText).length * 0.09
    );
    const targetLineDuration = Math.max(minimumLineDuration, lineWeights[index] * scale);
    const isLastLine = index === preparedLines.length - 1;
    const targetLineEnd = isLastLine
      ? timingWindow.end
      : Math.min(timingWindow.end, cursor + targetLineDuration);
    const lineStart = index === 0
      ? getBestBoundaryAroundTarget(
          analysis,
          cursor,
          Math.max(0, cursor - 0.25),
          Math.min(timingWindow.end - minimumLineDuration, cursor + 0.65),
          false
        ) ?? cursor
      : cursor;
    const preferPauseBoundary = /[,:;.!?]$/.test(normalizeText(lineText));
    let lineEnd = getBestAudioBoundary(
      analysis,
      lineStart,
      Math.min(timingWindow.end, targetLineEnd + (preferPauseBoundary ? 0.75 : 0.5)),
      targetLineEnd,
      preferPauseBoundary
    ) ?? targetLineEnd;

    lineEnd = Math.max(lineStart + minimumLineDuration, Math.min(lineEnd, timingWindow.end));

    syntheticLines.push({
      Type: "Vocal",
      Text: lineText,
      RomanizedText: entry.line.RomanizedText,
      GibberishText: entry.line.GibberishText,
      OppositeAligned: entry.line.OppositeAligned,
      StartTime: lineStart,
      EndTime: lineEnd,
    });

    if (isLastLine) {
      return;
    }

    const nextEntry = preparedLines[index + 1];
    const minimumGapDuration = (nextEntry?.blankLinesBefore ?? 0) > 0 ? 0.16 : 0.06;
    const targetNextStart = Math.min(
      timingWindow.end,
      lineEnd + Math.max(minimumGapDuration, gapWeights[index] * scale)
    );
    const nextStart = getBestBoundaryAroundTarget(
      analysis,
      targetNextStart,
      lineEnd + minimumGapDuration,
      Math.min(timingWindow.end, targetNextStart + 0.8),
      true
    ) ?? targetNextStart;

    cursor = Math.max(lineEnd + minimumGapDuration, nextStart);
  });

  return {
    ...lyrics,
    Type: "Line",
    Content: syntheticLines,
  };
}

export function ConvertLineLyricsToExperimentalWordSync(
  lyrics: any,
  analysis?: AudioAnalysisData | null
) {
  if (lyrics?.Type !== "Line" || !Array.isArray(lyrics.Content)) {
    return lyrics;
  }

  const sourceLines = lyrics.Content as LineLyricsEntry[];
  const convertedContent: GeneratedLine[] = [];

  for (let lineIndex = 0; lineIndex < sourceLines.length; lineIndex += 1) {
    const line = sourceLines[lineIndex];
    if (line.Type !== undefined && line.Type !== "Vocal") {
      continue;
    }

    if (!normalizeText(line.Text)) {
      continue;
    }

    const lineStart = Number.isFinite(line.StartTime) ? (line.StartTime as number) : 0;
    const baseSegments = parseSegments(line.Text);
    const hasBackgroundSegments = baseSegments.some(
      (segment) => segment.kind === "background"
    );
    const lineEnd = getEffectiveLineEnd(
      sourceLines,
      lineIndex,
      line,
      analysis ?? undefined,
      {
        hasBackgroundSegments,
      }
    );

    if (!baseSegments.length) {
      const fallback = createFallbackLead(
        {
          ...line,
          EndTime: lineEnd,
        },
        line.RomanizedText,
        line.GibberishText
      );
      if (fallback) convertedContent.push(fallback);
      continue;
    }

    const segmentRanges = distributeRanges(
      lineStart,
      lineEnd,
      baseSegments.map((segment) => getTextWeight(segment.text))
    );

    const romanizedSegments = getAlignedSegmentTexts(baseSegments, line.RomanizedText);
    const gibberishSegments = getAlignedSegmentTexts(baseSegments, line.GibberishText);

    const leadWords: GeneratedWord[] = [];
    const background: GeneratedBackground[] = [];

    baseSegments.forEach((segment, index) => {
      const range = segmentRanges[index] ?? { start: lineStart, end: lineEnd };
      const generatedWords = buildWords(segment.text, range.start, range.end);
      if (!generatedWords.length) return;

      if (romanizedSegments?.[index]) {
        assignWordText(generatedWords, "RomanizedText", romanizedSegments[index]);
      }

      if (gibberishSegments?.[index]) {
        assignWordText(generatedWords, "GibberishText", gibberishSegments[index]);
      }

      if (segment.kind === "background") {
        capitalizeFirstGeneratedWord(generatedWords);
        background.push({
          StartTime: range.start,
          EndTime: range.end,
          Syllables: generatedWords,
        });
        return;
      }

      leadWords.push(...generatedWords);
    });

    if (!romanizedSegments && leadWords.length > 0) {
      assignWordText(leadWords, "RomanizedText", line.RomanizedText);
    }

    if (!gibberishSegments && leadWords.length > 0) {
      assignWordText(leadWords, "GibberishText", line.GibberishText);
    }

    if (leadWords.length > 0) {
      convertedContent.push({
        Type: "Vocal",
        OppositeAligned: line.OppositeAligned ?? false,
        Lead: {
          StartTime: lineStart,
          EndTime: lineEnd,
          Syllables: leadWords,
        },
        ...(background.length > 0 ? { Background: background } : {}),
      });
      continue;
    }

    if (shouldKeepBackgroundOnlyLineAsLead(sourceLines, lineIndex, baseSegments)) {
      const fallbackLead = createFallbackLead(
        {
          ...line,
          Text: background.map((entry) => joinGeneratedWords(entry.Syllables)).join(" "),
          EndTime: lineEnd,
        },
        romanizedSegments?.join(" "),
        gibberishSegments?.join(" ")
      );

      if (fallbackLead) {
        convertedContent.push(fallbackLead);
      }
      continue;
    }

    const previousLine = convertedContent[convertedContent.length - 1];
    if (
      previousLine &&
      (previousLine.OppositeAligned ?? false) === (line.OppositeAligned ?? false) &&
      background.length > 0
    ) {
      previousLine.Background = [...(previousLine.Background ?? []), ...background];
      continue;
    }

    const fallbackLead = createFallbackLead(
      {
        ...line,
        Text: background
          .map((entry) => joinGeneratedWords(entry.Syllables))
          .join(" "),
        EndTime: lineEnd,
      },
      romanizedSegments?.join(" ") ?? line.RomanizedText,
      gibberishSegments?.join(" ") ?? line.GibberishText
    );

    if (fallbackLead) {
      convertedContent.push(fallbackLead);
    }
  }

  return {
    ...lyrics,
    Type: "Syllable",
    Content: convertedContent,
    experimentalWordSync: true,
    experimentalWordSyncSource: lyrics.experimentalWordSyncSource ?? "Line",
  };
}

export function ConvertStaticLyricsToExperimentalWordSync(
  lyrics: any,
  analysis?: AudioAnalysisData | null,
  fallbackDurationSeconds?: number
) {
  const syntheticLineLyrics = buildStaticSyntheticLineLyrics(
    lyrics,
    analysis,
    fallbackDurationSeconds
  );

  if (!syntheticLineLyrics) {
    return lyrics;
  }

  return ConvertLineLyricsToExperimentalWordSync(
    {
      ...syntheticLineLyrics,
      experimentalWordSyncSource: "Static",
    },
    analysis
  );
}
