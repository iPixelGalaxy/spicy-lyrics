type SyllableEntry = {
  Text: string;
  RomanizedText?: string;
  StartTime: number;
  EndTime: number;
  IsPartOfWord: boolean;
};

type BackgroundEntry = {
  StartTime: number;
  EndTime: number;
  Syllables: SyllableEntry[];
};

type ParsedLine = {
  leadText: string;
  leadRomanizedText?: string;
  leadSyllables: SyllableEntry[];
  background: BackgroundEntry[];
  startTime: number;
  endTime: number;
  oppositeAligned: boolean;
};

const WRITER_KEY_MATCH = /(songwriter|writers?|written[\s_-]*by|lyricist|composer)/i;
const LEADING_BG_BRACKET = /^[([{]\s*/;
const TRAILING_BG_BRACKET = /\s*[)\]}]$/;

function getAttr(element: Element | null, ...names: string[]): string | null {
  if (!element) return null;

  for (const name of names) {
    const direct = element.getAttribute(name);
    if (direct !== null) return direct;
  }

  for (const attr of Array.from(element.attributes)) {
    if (names.includes(attr.name) || names.includes(attr.localName)) {
      return attr.value;
    }
  }

  return null;
}

function findElements(root: ParentNode, ...tagNames: string[]): Element[] {
  const normalized = tagNames.map((name) => name.toLowerCase());
  return Array.from(root.querySelectorAll("*")).filter((element) => {
    const tagName = element.tagName.toLowerCase();
    const localName = element.localName.toLowerCase();
    return normalized.includes(tagName) || normalized.includes(localName);
  });
}

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;

  const time = value.trim();
  if (!time) return null;

  const hmsMatch = time.match(
    /^(?:(\d{2,3}):)?(\d{1,2}):(\d{1,2})(?:[.:](\d+))?$/
  );
  if (hmsMatch) {
    const hours = Number.parseInt(hmsMatch[1] ?? "0", 10);
    const minutes = Number.parseInt(hmsMatch[2], 10);
    const seconds = Number.parseInt(hmsMatch[3], 10);
    const fraction = hmsMatch[4] ? Number.parseFloat(`0.${hmsMatch[4]}`) : 0;
    return (hours * 60 + minutes) * 60 + seconds + fraction;
  }

  const secondsMatch = time.match(/^(\d+(?:\.\d+)?)(s)?$/);
  if (secondsMatch) {
    return Number.parseFloat(secondsMatch[1]);
  }

  const millisecondsMatch = time.match(/^(\d+(?:\.\d+)?)ms$/);
  if (millisecondsMatch) {
    return Number.parseFloat(millisecondsMatch[1]) / 1000;
  }

  return null;
}

function getNodeText(node: ChildNode): string {
  return node.textContent ?? "";
}

function isSkippableWhitespace(node: ChildNode): boolean {
  if (node.nodeType !== Node.TEXT_NODE) return false;

  const text = node.textContent ?? "";
  if (text.trim()) return false;

  // Preserve inline spaces between timed spans; only drop formatting whitespace.
  return /[\r\n\t]/.test(text);
}

function getNextMeaningfulNode(nodes: ChildNode[], index: number): ChildNode | null {
  for (let i = index + 1; i < nodes.length; i += 1) {
    const node = nodes[i];
    if (isSkippableWhitespace(node)) continue;
    return node;
  }
  return null;
}

function hasExplicitSpaceBeforeNextMeaningfulNode(
  nodes: ChildNode[],
  index: number
): boolean {
  for (let i = index + 1; i < nodes.length; i += 1) {
    const node = nodes[i];
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (/[ ]/.test(text)) return true;
      if (isSkippableWhitespace(node)) continue;
    }

    if (!isSkippableWhitespace(node)) {
      return false;
    }
  }

  return false;
}

function isPartOfWord(nodes: ChildNode[], index: number): boolean {
  const current = nodes[index];
  const next = getNextMeaningfulNode(nodes, index);
  if (!current || !next) return false;

  const currentText = getNodeText(current).trim();
  const nextText = getNodeText(next).trim();

  if (!currentText || !nextText) return false;
  if (hasExplicitSpaceBeforeNextMeaningfulNode(nodes, index)) return false;

  return true;
}

function readITunesMetadata(root: Element) {
  const translations = new Map<string, string>();
  const transliterations = new Map<string, string>();
  const transliterationPieces = new Map<string, string[]>();

  for (const node of findElements(root, "itunesmetadata")) {
    for (const text of findElements(node, "text")) {
      const key = getAttr(text, "for");
      if (!key) continue;

      const parent = text.parentElement?.tagName;
      const textValue = text.textContent?.trim() ?? "";

      if (parent === "translations" && textValue) {
        translations.set(key, textValue);
      }

      if (parent === "transliterations") {
        if (textValue) {
          transliterations.set(key, textValue);
        }

        const pieces = Array.from(text.children)
          .filter((child) => child.tagName === "span")
          .map((child) => child.textContent?.trim() ?? "")
          .filter(Boolean);

        if (pieces.length > 0) {
          transliterationPieces.set(key, pieces);
        }
      }
    }
  }

  return { translations, transliterations, transliterationPieces };
}

function parseSongwriters(root: Element): string[] {
  const writers = new Map<string, string>();

  const addWriterParts = (value: string) => {
    for (const part of value
      .split(/[;,]/)
      .map((entry) => entry.trim())
      .filter(Boolean)) {
      const normalized = part.toLowerCase();
      if (!writers.has(normalized)) {
        writers.set(normalized, part);
      }
    }
  };

  for (const meta of findElements(root, "amll:meta", "meta")) {
    const key =
      getAttr(meta, "key", "name", "property", "type") ??
      meta.parentElement?.tagName ??
      "";
    const rawValue =
      getAttr(meta, "value", "content") ??
      meta.textContent?.trim() ??
      "";

    if (!key || !rawValue || !WRITER_KEY_MATCH.test(key)) continue;

    addWriterParts(rawValue);
  }

  for (const node of findElements(root, "songwriter", "songwriters", "writer", "writers", "composer", "lyricist")) {
    if (node.children.length > 0) continue;

    const text = node.textContent?.trim() ?? "";
    if (!text) continue;
    addWriterParts(text);
  }

  return Array.from(writers.values());
}

function parseAgents(root: Element): Map<string, boolean> {
  const agents = new Map<string, boolean>();

  for (const agent of findElements(root, "ttm:agent", "agent")) {
    const id = getAttr(agent, "xml:id", "id");
    if (!id) continue;
    agents.set(id, id === "v2" || id === "v2000");
  }

  return agents;
}

function collectPlainText(nodes: ChildNode[]): string {
  return nodes
    .map((node) => getNodeText(node))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function buildTextFromSyllables(syllables: SyllableEntry[]): string {
  let text = "";

  syllables.forEach((syllable, index) => {
    text += syllable.Text;
    if (index < syllables.length - 1 && !syllable.IsPartOfWord) {
      text += " ";
    }
  });

  return text.trim();
}

function applyRomanizedPieces(
  syllables: SyllableEntry[],
  pieces: string[] | undefined
): void {
  if (!pieces || pieces.length === 0 || syllables.length === 0) return;

  const finalPieces = [...pieces];
  if (finalPieces.length > syllables.length) {
    const overflow = finalPieces.splice(syllables.length - 1).join(" ");
    finalPieces.push(overflow);
  }

  syllables.forEach((syllable, index) => {
    if (index < finalPieces.length && finalPieces[index]) {
      syllable.RomanizedText = finalPieces[index];
    }
  });
}

function parseSyllableNodes(nodes: ChildNode[], lineStart: number, lineEnd: number): SyllableEntry[] {
  const syllables: SyllableEntry[] = [];

  nodes.forEach((node, index) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const element = node as Element;
    if (element.tagName !== "span") return;

    const text = element.textContent ?? "";
    if (!text.trim()) return;

    const role = getAttr(element, "ttm:role", "role");
    if (role === "x-translation" || role === "x-roman") return;

    const startTime = parseTimestamp(getAttr(element, "begin")) ?? lineStart;
    const endTime = parseTimestamp(getAttr(element, "end")) ?? lineEnd;

    syllables.push({
      Text: text.trim(),
      StartTime: startTime,
      EndTime: endTime,
      IsPartOfWord: isPartOfWord(nodes, index),
    });
  });

  return syllables;
}

function parseBackground(element: Element, lineStart: number, lineEnd: number): BackgroundEntry | null {
  const childNodes = Array.from(element.childNodes).filter((node) => !isSkippableWhitespace(node));
  const syllables = parseSyllableNodes(childNodes, lineStart, lineEnd);
  if (syllables.length === 0) return null;

  syllables[0].Text = syllables[0].Text.replace(LEADING_BG_BRACKET, "");
  const lastSyllable = syllables[syllables.length - 1];
  lastSyllable.Text = lastSyllable.Text.replace(TRAILING_BG_BRACKET, "");

  return {
    StartTime: syllables[0].StartTime,
    EndTime: syllables[syllables.length - 1].EndTime,
    Syllables: syllables,
  };
}

function parseParagraph(
  paragraph: Element,
  div: Element | null,
  body: Element,
  oppositeAgents: Map<string, boolean>,
  transliterations: Map<string, string>,
  transliterationPieces: Map<string, string[]>
): ParsedLine | null {
  const paragraphStart = parseTimestamp(getAttr(paragraph, "begin")) ?? 0;
  const paragraphEnd = parseTimestamp(getAttr(paragraph, "end")) ?? paragraphStart;
  const agentId =
    getAttr(paragraph, "ttm:agent", "agent") ??
    getAttr(div, "ttm:agent", "agent") ??
    getAttr(body, "ttm:agent", "agent");
  const oppositeAligned = agentId ? oppositeAgents.get(agentId) === true : false;
  const lineKey = getAttr(paragraph, "itunes:key");

  let leadRomanizedText = lineKey ? transliterations.get(lineKey) : undefined;

  const childNodes = Array.from(paragraph.childNodes).filter((node) => !isSkippableWhitespace(node));
  const leadSyllables: SyllableEntry[] = [];
  const plainNodes: ChildNode[] = [];
  const background: BackgroundEntry[] = [];

  childNodes.forEach((node, index) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if ((node.textContent ?? "").trim()) {
        plainNodes.push(node);
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const element = node as Element;
    if (element.tagName !== "span") {
      plainNodes.push(node);
      return;
    }

    const role = getAttr(element, "ttm:role", "role");
    const text = element.textContent?.trim() ?? "";

    if (role === "x-translation") {
      return;
    }

    if (role === "x-roman") {
      if (!leadRomanizedText && text) leadRomanizedText = text;
      return;
    }

    if (role === "x-bg") {
      const bg = parseBackground(element, paragraphStart, paragraphEnd);
      if (bg) background.push(bg);
      return;
    }

    const startTime = parseTimestamp(getAttr(element, "begin"));
    const endTime = parseTimestamp(getAttr(element, "end"));

    if (startTime !== null || endTime !== null) {
      leadSyllables.push({
        Text: text,
        StartTime: startTime ?? paragraphStart,
        EndTime: endTime ?? paragraphEnd,
        IsPartOfWord: isPartOfWord(childNodes, index),
      });
      return;
    }

    plainNodes.push(node);
  });

  applyRomanizedPieces(leadSyllables, lineKey ? transliterationPieces.get(lineKey) : undefined);

  const leadText = leadSyllables.length > 0
    ? buildTextFromSyllables(leadSyllables)
    : collectPlainText(plainNodes);
  if (!leadText && background.length === 0) return null;

  const timedEntries = leadSyllables.length > 0
    ? leadSyllables.map((syllable) => ({
      StartTime: syllable.StartTime,
      EndTime: syllable.EndTime,
    }))
    : background.flatMap((group) =>
      group.Syllables.map((syllable) => ({
        StartTime: syllable.StartTime,
        EndTime: syllable.EndTime,
      }))
    );

  const lineStart = timedEntries.length > 0
    ? Math.min(...timedEntries.map((entry) => entry.StartTime))
    : paragraphStart;
  const lineEnd = timedEntries.length > 0
    ? Math.max(...timedEntries.map((entry) => entry.EndTime))
    : paragraphEnd;

  return {
    leadText,
    leadRomanizedText,
    leadSyllables,
    background,
    startTime: lineStart,
    endTime: lineEnd,
    oppositeAligned,
  };
}

function buildStaticLyrics(lines: ParsedLine[], songwriters: string[]) {
  return {
    Type: "Static",
    ...(songwriters.length > 0 ? { SongWriters: songwriters } : {}),
    Lines: lines
      .map((line) => ({
        Text: line.leadText,
        ...(line.leadRomanizedText ? { RomanizedText: line.leadRomanizedText } : {}),
      }))
      .filter((line) => line.Text),
  };
}

function buildLineLyrics(lines: ParsedLine[], songwriters: string[]) {
  return {
    Type: "Line",
    ...(songwriters.length > 0 ? { SongWriters: songwriters } : {}),
    StartTime: lines[0]?.startTime ?? 0,
    Content: lines
      .map((line) => ({
        Type: "Vocal",
        Text: line.leadText,
        ...(line.leadRomanizedText ? { RomanizedText: line.leadRomanizedText } : {}),
        StartTime: line.startTime,
        EndTime: line.endTime,
        OppositeAligned: line.oppositeAligned,
      }))
      .filter((line) => line.Text),
  };
}

function buildSyllableLyrics(lines: ParsedLine[], songwriters: string[]) {
  return {
    Type: "Syllable",
    ...(songwriters.length > 0 ? { SongWriters: songwriters } : {}),
    StartTime: lines[0]?.startTime ?? 0,
    Content: lines.map((line) => {
      const leadSyllables = line.leadSyllables.length > 0
        ? line.leadSyllables
        : [{
          Text: line.leadText,
          ...(line.leadRomanizedText ? { RomanizedText: line.leadRomanizedText } : {}),
          StartTime: line.startTime,
          EndTime: line.endTime,
          IsPartOfWord: false,
        }];

      return {
        Type: "Vocal",
        OppositeAligned: line.oppositeAligned,
        Lead: {
          StartTime: line.startTime,
          EndTime: line.endTime,
          Syllables: leadSyllables,
        },
        ...(line.background.length > 0 ? { Background: line.background } : {}),
      };
    }),
  };
}

export default function parseTTMLToLyrics(ttml: string) {
  const document = new DOMParser().parseFromString(ttml, "text/xml");
  const parserError = document.querySelector("parsererror");
  if (parserError) {
    throw new Error(parserError.textContent?.trim() || "Invalid TTML");
  }

  const tt = document.documentElement;
  if (!tt || tt.tagName !== "tt") {
    throw new Error("Invalid TTML: missing <tt> root element");
  }

  const songwriters = parseSongwriters(tt);
  const oppositeAgents = parseAgents(tt);
  const { transliterations, transliterationPieces } = readITunesMetadata(tt);

  const body = Array.from(tt.children).find((child) => child.tagName === "body");
  if (!body) {
    throw new Error("Invalid TTML: missing <body>");
  }

  const parsedLines: ParsedLine[] = [];
  const divs = Array.from(body.children).filter((child) => child.tagName === "div");
  const containers = divs.length > 0 ? divs : [body];

  for (const div of containers) {
    const paragraphs = Array.from(div.children).filter((child) => child.tagName === "p");
    for (const paragraph of paragraphs) {
      const parsed = parseParagraph(
        paragraph,
        div === body ? null : div,
        body,
        oppositeAgents,
        transliterations,
        transliterationPieces
      );
      if (parsed) {
        parsedLines.push(parsed);
      }
    }
  }

  if (parsedLines.length === 0) {
    throw new Error("No lyric lines found in TTML");
  }

  const hasSyllableTimings = parsedLines.some(
    (line) => line.leadSyllables.length > 0 || line.background.length > 0
  );
  const hasLineTimings = parsedLines.some((line) => line.startTime > 0 || line.endTime > 0);

  if (hasSyllableTimings) {
    return buildSyllableLyrics(parsedLines, songwriters);
  }

  if (hasLineTimings) {
    return buildLineLyrics(parsedLines, songwriters);
  }

  return buildStaticLyrics(parsedLines, songwriters);
}
