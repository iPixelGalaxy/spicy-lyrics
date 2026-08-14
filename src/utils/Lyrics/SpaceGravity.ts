type GravitySyllable = {
  HTMLElement: HTMLElement;
  StartTime: number;
  EndTime: number;
  Dot?: boolean;
};

type GravityLine = {
  HTMLElement: HTMLElement;
  StartTime: number;
  EndTime: number;
  Syllables?: { Lead: GravitySyllable[] };
  DotLine?: boolean;
  BGLine?: boolean;
  SpaceGravityParentLineIndex?: number;
};

type GravityBody = {
  Element: HTMLElement;
  Line: GravityLine;
  StartTime: number;
  EndTime: number;
  Order: number;
  WordIndex: number;
  X: number;
  Y: number;
  VX: number;
  VY: number;
  Angle: number;
  AngularVelocity: number;
  Radius: number;
  Width: number;
  Height: number;
  StartX: number;
  StartY: number;
  NaturalX: number;
  NaturalY: number;
  Role?: GravityRole;
  SelectionEpoch: number;
  Spawned: boolean;
  Visible: boolean;
  EntryFrame?: number;
  ExitUntil?: number;
};

type GravityRole = "Previous" | "Current" | "Next" | "Nearby" | "Instrumental";
type Bounds = { Width: number; Height: number };
type RectBounds = { Left: number; Top: number; Right: number; Bottom: number };
type ObstacleExit = "Left" | "Right" | "Top" | "Bottom";

const EDGE_PADDING = 18;
const COVER_CLEARANCE = 12;
const MAX_SPEED = 16;
const SOFT_AVOID_RADIUS = 96;
const SOFT_AVOID_ACCELERATION = 5;
const UPWARD_ACCELERATION = 0.4;
const MAX_VISIBLE_LEAD_WORDS = 50;
const MAX_VISIBLE_CJK_CHARACTERS_PER_DIRECTION = 25;
const LINE_GAP_CQW = 1;
const LINE_EXIT_DELAY_MS = 200;
const WORD_PRESENCE_FADE_MS = 180;

let stage: HTMLElement | null = null;
let viewport: HTMLElement | null = null;
let footer: HTMLElement | null = null;
let cover: HTMLElement | null = null;
let lines: GravityLine[] = [];
let bodiesByLine = new Map<GravityLine, GravityBody[]>();
let leadLines: GravityLine[] = [];
let lineLayouts = new Map<GravityLine, { Height: number }>();
let splitGroups: Array<{ Group: HTMLElement; Entities: HTMLElement[] }> = [];
let parentLines = new Map<GravityLine, GravityLine>();
let backgroundLinesByParent = new Map<GravityLine, GravityLine[]>();
let dotLines: GravityLine[] = [];
let leadLineIndexes = new Map<GravityLine, number>();
let leadWordStarts = new Map<GravityLine, number>();
let leadWordCounts = new Map<GravityLine, number>();
let leadEntityTexts: string[] = [];
let preparedLines = new Set<GravityLine>();
let activeBodies: GravityBody[] = [];
let exitingBodies = new Set<GravityBody>();
let visibleLines = new Set<GravityLine>();
let pendingLineRemovals = new Map<GravityLine, number>();
let selectionEpoch = 0;
let lastAnchor = Number.NaN;
let lastWordAnchor = Number.NaN;
let lastDotSignature = "";
let finalVocalEnd = Number.NEGATIVE_INFINITY;
let resizeObserver: ResizeObserver | null = null;
let layoutObserver: MutationObserver | null = null;
let coverTrackingFrame: number | null = null;
let coverTrackingUntil = 0;
let stageBounds: Bounds | null = null;
let footerBounds: RectBounds | null = null;
let coverBounds: RectBounds | null = null;
let lastTick = performance.now();
let renderFrame = 0;
let reducedMotion = false;
let layoutDirty = true;
let staticLayoutDirty = true;

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function random(seed: number): number {
  let value = seed + 0x6d2b79f5;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function updateReducedMotion(): void {
  reducedMotion = stage?.ownerDocument.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)")
    .matches ?? false;
}

function updateBounds(refreshBodies = true): void {
  if (!stage || !viewport) return;
  const height = viewport.clientHeight;
  stage.style.height = `${height}px`;
  const width = stage.clientWidth;
  if (width < 1 || height < 1) return;
  stageBounds = { Width: width, Height: height };
  layoutDirty = true;
  staticLayoutDirty = true;
  const stageRect = stage.getBoundingClientRect();
  const nextCover = viewport.closest(".ContentBox")?.querySelector<HTMLElement>(".NowBar .MediaImageContainer") ?? null;
  if (cover !== nextCover) {
    if (cover) resizeObserver?.unobserve(cover);
    cover = nextCover;
    if (cover) resizeObserver?.observe(cover);
  }
  const footerRect = footer?.getBoundingClientRect();
  footerBounds = footerRect && footerRect.width > 0 && footerRect.height > 0
    ? { Left: footerRect.left - stageRect.left, Top: footerRect.top - stageRect.top, Right: footerRect.right - stageRect.left, Bottom: footerRect.bottom - stageRect.top }
    : null;
  const coverRect = cover?.getBoundingClientRect();
  coverBounds = coverRect && coverRect.width > 0 && coverRect.height > 0
    ? { Left: coverRect.left - stageRect.left - COVER_CLEARANCE, Top: coverRect.top - stageRect.top - COVER_CLEARANCE, Right: coverRect.right - stageRect.left + COVER_CLEARANCE, Bottom: coverRect.bottom - stageRect.top + COVER_CLEARANCE }
    : null;
  if (!refreshBodies) return;
  for (const body of activeBodies) {
    body.Width = body.Element.offsetWidth;
    body.Height = body.Element.offsetHeight;
    body.Radius = Math.max(14, Math.hypot(body.Width, body.Height) / 2);
    if (!body.Spawned) continue;
    resolveBodyConstraints(body, width, height);
    renderBody(body);
  }
}

function constrainToStage(body: GravityBody, width: number, height: number): boolean {
  const minX = EDGE_PADDING + body.Radius;
  const maxX = Math.max(minX, width - EDGE_PADDING - body.Radius);
  const minY = EDGE_PADDING + body.Radius;
  const maxY = Math.max(minY, height - EDGE_PADDING - body.Radius);
  let changed = false;
  if (body.X < minX) { body.X = minX; body.VX = Math.abs(body.VX); changed = true; }
  else if (body.X > maxX) { body.X = maxX; body.VX = -Math.abs(body.VX); changed = true; }
  if (body.Y < minY) { body.Y = minY; body.VY = Math.abs(body.VY); changed = true; }
  else if (body.Y > maxY) { body.Y = maxY; body.VY = -Math.abs(body.VY); changed = true; }
  return changed;
}

function renderBody(body: GravityBody): void {
  body.Element.style.transform = `translate3d(${body.X - body.Width / 2}px, ${body.Y - body.Height / 2}px, 0) rotate(${body.Angle}deg)`;
}

function resolveRectangleCollision(body: GravityBody, obstacle: RectBounds | null, width: number, height: number, exits: ObstacleExit[]): boolean {
  if (!obstacle) return false;
  const nearestX = Math.min(obstacle.Right, Math.max(obstacle.Left, body.X));
  const nearestY = Math.min(obstacle.Bottom, Math.max(obstacle.Top, body.Y));
  if (Math.hypot(body.X - nearestX, body.Y - nearestY) >= body.Radius) return false;
  const minX = EDGE_PADDING + body.Radius;
  const maxX = Math.max(minX, width - EDGE_PADDING - body.Radius);
  const minY = EDGE_PADDING + body.Radius;
  const maxY = Math.max(minY, height - EDGE_PADDING - body.Radius);
  const candidates = [
    { Exit: "Left" as const, X: obstacle.Left - body.Radius, Y: body.Y },
    { Exit: "Right" as const, X: obstacle.Right + body.Radius, Y: body.Y },
    { Exit: "Top" as const, X: body.X, Y: obstacle.Top - body.Radius },
    { Exit: "Bottom" as const, X: body.X, Y: obstacle.Bottom + body.Radius },
  ].filter((candidate) => exits.includes(candidate.Exit) && candidate.X >= minX && candidate.X <= maxX && candidate.Y >= minY && candidate.Y <= maxY);
  if (candidates.length === 0) return false;
  const candidate = candidates.reduce((nearest, next) => Math.hypot(next.X - body.X, next.Y - body.Y) < Math.hypot(nearest.X - body.X, nearest.Y - body.Y) ? next : nearest);
  body.X = candidate.X;
  body.Y = candidate.Y;
  if (candidate.Exit === "Left") body.VX = -Math.abs(body.VX);
  else if (candidate.Exit === "Right") body.VX = Math.abs(body.VX);
  else if (candidate.Exit === "Top") body.VY = -Math.abs(body.VY);
  else body.VY = Math.abs(body.VY);
  return true;
}

function resolveBodyConstraints(body: GravityBody, width: number, height: number): void {
  for (let pass = 0; pass < 4; pass += 1) {
    const clamped = constrainToStage(body, width, height);
    const coverResolved = resolveRectangleCollision(body, coverBounds, width, height, ["Left", "Right", "Top", "Bottom"]);
    const footerResolved = resolveRectangleCollision(body, footerBounds, width, height, ["Left", "Right", "Top"]);
    if (!clamped && !coverResolved && !footerResolved) return;
  }
  constrainToStage(body, width, height);
}

function trackCoverTransition(): void {
  coverTrackingUntil = Math.max(coverTrackingUntil, performance.now() + 450);
  if (coverTrackingFrame !== null) return;
  const updateCoverBounds = (): void => {
    updateBounds(false);
    if (!stageBounds) { coverTrackingFrame = null; return; }
    for (const body of activeBodies) {
      if (!body.Spawned) continue;
      const x = body.X;
      const y = body.Y;
      resolveBodyConstraints(body, stageBounds.Width, stageBounds.Height);
      if (body.X !== x || body.Y !== y) renderBody(body);
    }
    if (performance.now() < coverTrackingUntil) coverTrackingFrame = requestAnimationFrame(updateCoverBounds);
    else coverTrackingFrame = null;
  };
  coverTrackingFrame = requestAnimationFrame(updateCoverBounds);
}

function endsWithDash(element: Element): boolean {
  return /[-‐‑‒–—―]$/u.test(element.textContent?.trim() ?? "");
}

function startsWithDash(element: Element): boolean {
  return /^[-‐‑‒–—―]/u.test(element.textContent?.trim() ?? "");
}

function splitDashedGroup(group: HTMLElement): HTMLElement[] {
  const parts = Array.from(group.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
  if (parts.length < 2) return [group];
  const boundaries = parts.slice(0, -1).some((part, index) => endsWithDash(part) || startsWithDash(parts[index + 1]));
  if (!boundaries) return [group];
  const entities: HTMLElement[] = [];
  let entity = document.createElement("span");
  entity.classList.add("SpaceGravityEntity");
  for (const [index, part] of parts.entries()) {
    entity.appendChild(part);
    if (index < parts.length - 1 && (endsWithDash(part) || startsWithDash(parts[index + 1]))) {
      entities.push(entity);
      entity = document.createElement("span");
      entity.classList.add("SpaceGravityEntity");
    }
  }
  entities.push(entity);
  group.replaceWith(...entities);
  splitGroups.push({ Group: group, Entities: entities });
  return entities;
}

function getEntities(line: GravityLine): HTMLElement[] {
  return Array.from(line.HTMLElement.children)
    .filter((child): child is HTMLElement => child instanceof HTMLElement)
    .flatMap((child) => child.classList.contains("word-group") ? splitDashedGroup(child) : [child]);
}

function getEntityTexts(line: GravityLine): string[] {
  const children = Array.from(line.HTMLElement.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
  const texts = children.flatMap((child) => {
    if (!child.classList.contains("word-group")) return [child.textContent ?? ""];
    const parts = Array.from(child.children).filter((part): part is HTMLElement => part instanceof HTMLElement);
    if (parts.length < 2) return [child.textContent ?? ""];
    const boundaries = parts.slice(0, -1).some((part, index) => endsWithDash(part) || startsWithDash(parts[index + 1]));
    if (!boundaries) return [child.textContent ?? ""];
    const entities: string[] = [];
    let entityText = "";
    for (const [index, part] of parts.entries()) {
      entityText += part.textContent ?? "";
      if (index < parts.length - 1 && (endsWithDash(part) || startsWithDash(parts[index + 1]))) {
        entities.push(entityText);
        entityText = "";
      }
    }
    entities.push(entityText);
    return entities;
  });
  return texts.length > 0 ? texts : [""];
}

function isCjkEntity(text: string): boolean {
  return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(text);
}

function getDisplayCharacterCount(text: string): number {
  return Math.max(1, Array.from(text.replace(/\s/g, "")).length);
}

function prepareLines(nextLines: GravityLine[]): void {
  if (!stage || nextLines.length === 0) return;
  const records: Array<{ Line: GravityLine; Child: HTMLElement; X: number; Y: number; Index: number }> = [];
  for (const line of nextLines) {
    line.HTMLElement.classList.add("SpaceGravityLine", "SpaceGravityMeasure");
    stage.appendChild(line.HTMLElement);
  }

  // Finish all structural writes before reading layout. Interleaving wrapper
  // insertion with offsetWidth reads made a long song toggle force layout once
  // per word.
  const entitiesByLine = new Map<GravityLine, HTMLElement[]>();
  for (const line of nextLines) entitiesByLine.set(line, getEntities(line));
  for (const line of nextLines) {
    lineLayouts.set(line, { Height: line.HTMLElement.offsetHeight });
    for (const [index, child] of (entitiesByLine.get(line) ?? []).entries()) {
      records.push({ Line: line, Child: child, X: line.HTMLElement.offsetLeft + child.offsetLeft, Y: child.offsetTop, Index: index });
    }
  }

  const wrappers: Array<{ Record: typeof records[number]; Element: HTMLElement }> = [];
  for (const record of records) {
    const bodyElement = document.createElement("span");
    bodyElement.classList.add("SpaceGravityWord", "SpaceGravityUnspawned");
    bodyElement.style.left = "0px";
    bodyElement.style.top = "0px";
    if (!record.Line.DotLine) bodyElement.dataset.spaceGravitySeekTime = `${record.Line.StartTime}`;
    record.Line.HTMLElement.replaceChild(bodyElement, record.Child);
    bodyElement.appendChild(record.Child);
    wrappers.push({ Record: record, Element: bodyElement });
  }

  let order = 0;
  for (const { Record: record, Element: bodyElement } of wrappers) {
    const syllables = record.Line.Syllables?.Lead.filter((syllable) => record.Child === syllable.HTMLElement || record.Child.contains(syllable.HTMLElement)) ?? [];
    const startTime = syllables.length ? Math.min(...syllables.map((syllable) => syllable.StartTime)) : record.Line.StartTime;
    const endTime = syllables.length ? Math.max(...syllables.map((syllable) => syllable.EndTime)) : record.Line.EndTime;
    if (!record.Line.DotLine) bodyElement.dataset.spaceGravitySeekTime = `${startTime}`;
    const seed = hash(`${record.Line.StartTime}:${record.Line.EndTime}:${record.Child.textContent ?? ""}:${record.Index}`);
    const speed = 4.4 + random(seed + 3) * 5.6;
    const direction = random(seed + 4) * Math.PI * 2;
    const body: GravityBody = { Element: bodyElement, Line: record.Line, StartTime: startTime, EndTime: endTime, Order: order++, WordIndex: (leadWordStarts.get(record.Line) ?? 0) + record.Index, X: 0, Y: 0, VX: Math.cos(direction) * speed, VY: Math.sin(direction) * speed, Angle: 0, AngularVelocity: (random(seed + 2) * 2 - 1) * 19, Radius: 24, Width: 48, Height: 48, StartX: record.X, StartY: record.Y, NaturalX: 0, NaturalY: 0, SelectionEpoch: 0, Spawned: false, Visible: false };
    body.Width = bodyElement.offsetWidth;
    body.Height = bodyElement.offsetHeight;
    body.Radius = Math.max(14, Math.hypot(body.Width, body.Height) / 2);
    const lineBodies = bodiesByLine.get(record.Line) ?? [];
    lineBodies.push(body);
    bodiesByLine.set(record.Line, lineBodies);
  }
  for (const line of nextLines) {
    line.HTMLElement.classList.remove("SpaceGravityMeasure");
    line.HTMLElement.remove();
    preparedLines.add(line);
  }
}

function getAnchorIndex(position: number): number {
  if (leadLines.length === 0) return -1;
  let low = 0;
  let high = leadLines.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (leadLines[middle].StartTime <= position) low = middle + 1;
    else high = middle;
  }
  const previous = low - 1;
  if (previous >= 0 && leadLines[previous].EndTime > position) return previous;
  return low < leadLines.length ? low : leadLines.length - 1;
}

function getRole(body: GravityBody, position: number, activeLeadLine: GravityLine | undefined): GravityRole {
  if (body.Line.DotLine) return "Instrumental";
  if (position >= finalVocalEnd) return "Previous";
  if (body.Line.BGLine) {
    if (position < body.StartTime) return "Next";
    if (position < body.EndTime) return "Current";
    return "Previous";
  }
  const displayLine = body.Line.BGLine ? parentLines.get(body.Line) : body.Line;
  if (displayLine === activeLeadLine) return "Current";
  if (displayLine && position < displayLine.StartTime) return "Next";
  return "Previous";
}

function applyBodyRole(body: GravityBody, role: GravityRole | undefined): void {
  if (body.Role === role) return;
  body.Role = role;
  body.Element.classList.toggle("SpaceGravityCurrent", role === "Current" || role === "Instrumental");
  body.Element.classList.toggle("SpaceGravityNext", role === "Next");
  body.Element.classList.toggle("SpaceGravityNearby", role === "Previous");
  body.Element.classList.toggle("SpaceGravityDot", role === "Instrumental");
}

function resetBody(body: GravityBody): void {
  body.Visible = false;
  body.Spawned = false;
  body.Angle = 0;
  body.EntryFrame = undefined;
  body.ExitUntil = undefined;
  body.Element.classList.remove("SpaceGravityExiting");
  body.Element.classList.add("SpaceGravityUnspawned");
  applyBodyRole(body, undefined);
}

function beginBodyExit(body: GravityBody, now: number): void {
  if (reducedMotion || !body.Spawned) {
    resetBody(body);
    return;
  }
  body.Visible = false;
  body.EntryFrame = undefined;
  body.ExitUntil = now + WORD_PRESENCE_FADE_MS;
  body.Element.classList.remove("SpaceGravityUnspawned");
  body.Element.classList.add("SpaceGravityExiting");
  exitingBodies.add(body);
}

function restoreBody(body: GravityBody): void {
  body.ExitUntil = undefined;
  exitingBodies.delete(body);
  body.Element.classList.remove("SpaceGravityExiting");
}

function cancelLineRemoval(line: GravityLine): void {
  const timer = pendingLineRemovals.get(line);
  if (timer === undefined) return;
  line.HTMLElement.ownerDocument.defaultView?.clearTimeout(timer);
  pendingLineRemovals.delete(line);
}

function scheduleLineRemoval(line: GravityLine): void {
  if (Array.from(exitingBodies).some((body) => body.Line === line)) return;
  line.HTMLElement.classList.remove("SpaceGravityVisible");
  if (pendingLineRemovals.has(line)) return;
  const timer = line.HTMLElement.ownerDocument.defaultView?.setTimeout(() => {
    pendingLineRemovals.delete(line);
    if (!visibleLines.has(line)) line.HTMLElement.remove();
  }, LINE_EXIT_DELAY_MS);
  if (timer !== undefined) pendingLineRemovals.set(line, timer);
}

function getActiveLeadLine(position: number, anchor: number): GravityLine | undefined {
  const candidate = leadLines[anchor];
  return candidate && position >= candidate.StartTime && position < candidate.EndTime ? candidate : undefined;
}

function getAnchorBody(position: number, line: GravityLine): GravityBody | undefined {
  const bodies = bodiesByLine.get(line) ?? [];
  return bodies.find((body) => position >= body.StartTime && position < body.EndTime)
    ?? bodies.find((body) => position < body.StartTime)
    ?? bodies.at(-1);
}

function getLeadWindow(firstWord: number, lastWord: number): GravityLine[] {
  return leadLines.filter((line) => {
    const first = leadWordStarts.get(line) ?? 0;
    const last = first + (leadWordCounts.get(line) ?? 0) - 1;
    return first <= lastWord && last >= firstWord;
  });
}

function getLeadWordRange(anchor: number): { First: number; Last: number } | undefined {
  const total = Array.from(leadWordCounts.values()).reduce((sum, count) => sum + count, 0);
  if (total === 0 || Number.isNaN(anchor)) return undefined;
  if (isCjkEntity(leadEntityTexts[anchor] ?? "")) {
    let first = anchor;
    let last = anchor;
    let beforeCharacters = 0;
    let afterCharacters = 0;
    while (first > 0) {
      const count = getDisplayCharacterCount(leadEntityTexts[first - 1] ?? "");
      if (beforeCharacters + count > MAX_VISIBLE_CJK_CHARACTERS_PER_DIRECTION) break;
      beforeCharacters += count;
      first -= 1;
    }
    while (last < total - 1) {
      const count = getDisplayCharacterCount(leadEntityTexts[last + 1] ?? "");
      if (afterCharacters + count > MAX_VISIBLE_CJK_CHARACTERS_PER_DIRECTION) break;
      afterCharacters += count;
      last += 1;
    }
    return { First: first, Last: last };
  }
  const count = Math.min(MAX_VISIBLE_LEAD_WORDS, total);
  const first = Math.max(0, Math.min(anchor - Math.floor((count - 1) / 2), total - count));
  return { First: first, Last: first + count - 1 };
}

function getActiveDotLine(position: number): GravityLine | undefined {
  let low = 0;
  let high = dotLines.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (dotLines[middle].StartTime <= position) low = middle + 1;
    else high = middle;
  }
  const candidate = dotLines[low - 1];
  return candidate && position < candidate.EndTime ? candidate : undefined;
}

function getNaturalLineTop(line: GravityLine, activeLine: GravityLine | undefined, height: number): number {
  const displayLine = line.BGLine ? parentLines.get(line) : line;
  const ordinal = displayLine ? leadLineIndexes.get(displayLine) : undefined;
  const activeOrdinal = activeLine ? leadLineIndexes.get(activeLine) : undefined;
  if (ordinal === undefined || activeOrdinal === undefined) return height * 0.5;
  let top = (height - (lineLayouts.get(activeLine)?.Height ?? 0)) / 2;
  if (ordinal < activeOrdinal) {
    for (let index = activeOrdinal - 1; index >= ordinal; index -= 1) {
      top -= (lineLayouts.get(leadLines[index])?.Height ?? 0) + height * LINE_GAP_CQW / 100;
    }
  } else {
    for (let index = activeOrdinal; index < ordinal; index += 1) {
      top += (lineLayouts.get(leadLines[index])?.Height ?? 0) + height * LINE_GAP_CQW / 100;
    }
  }
  return top;
}

function getSpawnLineTop(line: GravityLine, height: number): number {
  return (height - (lineLayouts.get(line)?.Height ?? 0)) / 2;
}

function updateVisibleBodies(position: number): void {
  const anchor = getAnchorIndex(position);
  const activeDotLine = getActiveDotLine(position);
  const dotSignature = activeDotLine ? `${activeDotLine.StartTime}` : "";
  const anchorLine = leadLines[anchor];
  if (anchorLine && !preparedLines.has(anchorLine)) prepareLines([anchorLine]);
  const wordAnchor = anchorLine ? getAnchorBody(position, anchorLine)?.WordIndex ?? Number.NaN : Number.NaN;
  if (!layoutDirty && anchor === lastAnchor && wordAnchor === lastWordAnchor && dotSignature === lastDotSignature) return;
  lastAnchor = anchor;
  lastWordAnchor = wordAnchor;
  lastDotSignature = dotSignature;
  selectionEpoch += 1;
  const activeLine = getActiveLeadLine(position, anchor);
  const wordRange = getLeadWordRange(wordAnchor);
  const leadWindow = wordRange ? getLeadWindow(wordRange.First, wordRange.Last) : [];
  const selectedParents = new Set<GravityLine>();
  for (const line of leadWindow) selectedParents.add(line);
  const entering = Array.from(selectedParents).filter((line) => !preparedLines.has(line));
  for (const parent of selectedParents) for (const line of backgroundLinesByParent.get(parent) ?? []) if (!preparedLines.has(line)) entering.push(line);
  if (activeDotLine && !preparedLines.has(activeDotLine)) entering.push(activeDotLine);
  prepareLines(entering);
  const nextBodies: GravityBody[] = [];
  const nextLines = new Set<GravityLine>();
  if (wordRange) for (const line of leadWindow) nextBodies.push(...(bodiesByLine.get(line) ?? []).filter((body) => body.WordIndex >= wordRange.First && body.WordIndex <= wordRange.Last));
  for (const parent of selectedParents) for (const line of backgroundLinesByParent.get(parent) ?? []) nextBodies.push(...(bodiesByLine.get(line) ?? []));
  if (activeDotLine) nextBodies.push(...(bodiesByLine.get(activeDotLine) ?? []));
  for (const body of nextBodies) body.SelectionEpoch = selectionEpoch;
  const now = performance.now();
  for (const body of activeBodies) if (body.SelectionEpoch !== selectionEpoch) beginBodyExit(body, now);
  activeBodies = nextBodies;
  for (const body of activeBodies) {
    restoreBody(body);
    body.Visible = true;
    nextLines.add(body.Line);
    body.NaturalX = body.StartX + body.Width / 2;
    body.NaturalY = getNaturalLineTop(body.Line, activeLine, stageBounds!.Height) + body.StartY + body.Height / 2;
    if (!body.Spawned) body.NaturalY = getSpawnLineTop(body.Line, stageBounds!.Height) + body.StartY + body.Height / 2;
    applyBodyRole(body, getRole(body, position, activeLine));
  }
  for (const line of visibleLines) if (!nextLines.has(line)) scheduleLineRemoval(line);
  for (const line of nextLines) {
    cancelLineRemoval(line);
    line.HTMLElement.classList.add("SpaceGravityVisible");
    if (!line.HTMLElement.isConnected) stage?.appendChild(line.HTMLElement);
  }
  visibleLines = nextLines;
  layoutDirty = false;
  staticLayoutDirty = true;
}

function updateBodyRoles(position: number): void {
  const activeLine = getActiveLeadLine(position, lastAnchor);
  for (const body of activeBodies) applyBodyRole(body, getRole(body, position, activeLine));
}

function spawnBody(body: GravityBody, width: number, height: number): void {
  if (body.Spawned) return;
  body.X = body.NaturalX + (Math.random() * 2 - 1) * body.Width * 1.35;
  body.Y = body.NaturalY + (Math.random() * 2 - 1) * body.Height * 1.35;
  body.Angle = 0;
  resolveBodyConstraints(body, width, height);
  body.Spawned = true;
  renderBody(body);
  if (reducedMotion) {
    body.Element.classList.remove("SpaceGravityUnspawned");
    return;
  }
  body.EntryFrame = renderFrame;
}

function settleBodyPresence(now: number): void {
  for (const body of activeBodies) {
    if (body.EntryFrame === undefined || body.EntryFrame >= renderFrame) continue;
    body.EntryFrame = undefined;
    body.Element.classList.remove("SpaceGravityUnspawned");
  }
  for (const body of exitingBodies) {
    if ((body.ExitUntil ?? Number.POSITIVE_INFINITY) > now) continue;
    exitingBodies.delete(body);
    resetBody(body);
    if (!visibleLines.has(body.Line)) scheduleLineRemoval(body.Line);
  }
}

function applyStaticLayout(width: number, height: number): void {
  const grouped = new Map<GravityLine, GravityBody[]>();
  for (const body of activeBodies) {
    const group = grouped.get(body.Line) ?? [];
    group.push(body);
    grouped.set(body.Line, group);
  }
  const groups = Array.from(grouped.values());
  const totalHeight = groups.reduce((sum, group) => sum + Math.max(...group.map((body) => body.Height)), 0) + Math.max(0, groups.length - 1) * 12;
  let y = Math.max(EDGE_PADDING, (height - totalHeight) / 2);
  for (const group of groups) {
    const groupHeight = Math.max(...group.map((body) => body.Height));
    const groupWidth = group.reduce((sum, body) => sum + body.Width, 0) + Math.max(0, group.length - 1) * 6;
    let x = Math.max(EDGE_PADDING, (width - groupWidth) / 2);
    for (const body of group) {
      body.X = x + body.Width / 2;
      body.Y = y + groupHeight / 2;
      body.Angle = 0;
      resolveBodyConstraints(body, width, height);
      renderBody(body);
      x += body.Width + 6;
    }
    y += groupHeight + 12;
  }
}

function applySoftAvoidance(delta: number): void {
  const buckets = new Map<number, GravityBody[]>();
  for (const body of activeBodies) {
    const cellX = Math.floor(body.X / SOFT_AVOID_RADIUS);
    const cellY = Math.floor(body.Y / SOFT_AVOID_RADIUS);
    for (let x = cellX - 1; x <= cellX + 1; x += 1) for (let y = cellY - 1; y <= cellY + 1; y += 1) for (const other of buckets.get(x * 65536 + y) ?? []) {
      const dx = body.X - other.X;
      const dy = body.Y - other.Y;
      const distance = Math.hypot(dx, dy) || 0.001;
      if (distance >= SOFT_AVOID_RADIUS) continue;
      const nudge = ((SOFT_AVOID_RADIUS - distance) / SOFT_AVOID_RADIUS) * SOFT_AVOID_ACCELERATION * delta;
      body.VX += dx / distance * nudge;
      body.VY += dy / distance * nudge;
      other.VX -= dx / distance * nudge;
      other.VY -= dy / distance * nudge;
    }
    const key = cellX * 65536 + cellY;
    const bucket = buckets.get(key) ?? [];
    bucket.push(body);
    buckets.set(key, bucket);
  }
}

export function mountSpaceGravity(nextStage: HTMLElement, nextLines: GravityLine[], nextViewport: HTMLElement, nextFooter: HTMLElement): void {
  destroySpaceGravity();
  stage = nextStage;
  viewport = nextViewport;
  footer = nextFooter;
  lines = nextLines;
  finalVocalEnd = lines
    .filter((line) => !line.DotLine)
    .reduce((end, line) => Math.max(end, ...(line.Syllables?.Lead.filter((word) => !word.Dot).map((word) => word.EndTime) ?? [line.EndTime])), Number.NEGATIVE_INFINITY);
  leadLines = lines.filter((line) => !line.BGLine && !line.DotLine);
  let wordStart = 0;
  leadEntityTexts = [];
  for (const [index, line] of leadLines.entries()) {
    leadLineIndexes.set(line, index);
    leadWordStarts.set(line, wordStart);
    const entityTexts = getEntityTexts(line);
    const count = entityTexts.length;
    leadWordCounts.set(line, count);
    leadEntityTexts.push(...entityTexts);
    wordStart += count;
  }
  for (const line of lines) {
    if (!line.BGLine || line.SpaceGravityParentLineIndex === undefined) continue;
    const parent = lines[line.SpaceGravityParentLineIndex];
    if (!parent) continue;
    parentLines.set(line, parent);
    const backgrounds = backgroundLinesByParent.get(parent) ?? [];
    backgrounds.push(line);
    backgroundLinesByParent.set(parent, backgrounds);
  }
  dotLines = lines.filter((line) => line.DotLine).sort((a, b) => a.StartTime - b.StartTime);
  updateReducedMotion();
  resizeObserver = new ResizeObserver(() => updateBounds());
  resizeObserver.observe(nextStage);
  resizeObserver.observe(nextViewport);
  resizeObserver.observe(nextFooter);
  updateBounds();
  const layoutRoot = nextViewport.closest(".ContentBox")?.parentElement;
  if (layoutRoot) {
    layoutObserver = new MutationObserver((records) => {
      if (records.some((record) => (record.target as HTMLElement).id === "SpicyLyricsPage" || (record.target as HTMLElement).classList.contains("NowBar"))) {
        updateBounds();
        trackCoverTransition();
      }
    });
    layoutObserver.observe(layoutRoot, { attributes: true, attributeFilter: ["class"], subtree: true });
  }
}

export function tickSpaceGravity(position: number): void {
  if (!stage || !stageBounds) return;
  renderFrame += 1;
  updateVisibleBodies(position);
  updateBodyRoles(position);
  for (const body of activeBodies) spawnBody(body, stageBounds.Width, stageBounds.Height);
  const now = performance.now();
  settleBodyPresence(now);
  const delta = Math.min(0.05, Math.max(0, (now - lastTick) / 1000));
  lastTick = now;
  if (reducedMotion) {
    if (staticLayoutDirty) {
      applyStaticLayout(stageBounds.Width, stageBounds.Height);
      staticLayoutDirty = false;
    }
    return;
  }
  applySoftAvoidance(delta);
  for (const body of activeBodies) {
    const speed = Math.hypot(body.VX, body.VY);
    if (speed > MAX_SPEED) { body.VX = body.VX / speed * MAX_SPEED; body.VY = body.VY / speed * MAX_SPEED; }
    body.VY -= UPWARD_ACCELERATION * Math.max(0, (body.Y / stageBounds.Height - 0.45) / 0.55) * delta;
    body.X += body.VX * delta;
    body.Y += body.VY * delta;
    body.Angle += body.AngularVelocity * delta;
    resolveBodyConstraints(body, stageBounds.Width, stageBounds.Height);
    renderBody(body);
  }
}

/**
 * Undo gravity-only DOM changes and return lines for the normal virtualizer.
 * Lyrics nodes, timing objects, and credits stay intact.
 */
export function restoreSpaceGravity(): GravityLine[] {
  const restoredLines = lines;

  for (const bodies of bodiesByLine.values()) {
    for (const body of bodies) {
      if (!body.Element.parentElement) continue;
      body.Element.replaceWith(...Array.from(body.Element.childNodes));
    }
  }

  for (const { Group, Entities } of splitGroups) {
    const first = Entities[0];
    if (!first?.parentElement) continue;
    const children = Entities.flatMap((entity) => Array.from(entity.childNodes));
    Group.replaceChildren(...children);
    first.replaceWith(Group);
    for (const entity of Entities.slice(1)) entity.remove();
  }

  for (const line of restoredLines) {
    line.HTMLElement.classList.remove(
      "SpaceGravityLine",
      "SpaceGravityMeasure",
      "SpaceGravityVisible",
      "SpaceGravityHidden"
    );
  }

  destroySpaceGravity();
  return restoredLines;
}

export function destroySpaceGravity(): void {
  resizeObserver?.disconnect();
  resizeObserver = null;
  layoutObserver?.disconnect();
  layoutObserver = null;
  if (coverTrackingFrame !== null) cancelAnimationFrame(coverTrackingFrame);
  for (const [line, timer] of pendingLineRemovals) line.HTMLElement.ownerDocument.defaultView?.clearTimeout(timer);
  pendingLineRemovals = new Map();
  coverTrackingFrame = null;
  coverTrackingUntil = 0;
  stage = null;
  viewport = null;
  footer = null;
  cover = null;
  lines = [];
  bodiesByLine = new Map();
  leadLines = [];
  lineLayouts = new Map();
  splitGroups = [];
  parentLines = new Map();
  backgroundLinesByParent = new Map();
  dotLines = [];
  leadLineIndexes = new Map();
  leadWordStarts = new Map();
  leadWordCounts = new Map();
  leadEntityTexts = [];
  preparedLines = new Set();
  activeBodies = [];
  exitingBodies = new Set();
  visibleLines = new Set();
  selectionEpoch = 0;
  lastAnchor = Number.NaN;
  lastWordAnchor = Number.NaN;
  lastDotSignature = "";
  finalVocalEnd = Number.NEGATIVE_INFINITY;
  layoutDirty = true;
  staticLayoutDirty = true;
  stageBounds = null;
  footerBounds = null;
  coverBounds = null;
  lastTick = performance.now();
  renderFrame = 0;
}
