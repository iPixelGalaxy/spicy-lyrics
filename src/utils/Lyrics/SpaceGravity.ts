type GravityLine = {
  HTMLElement: HTMLElement;
  StartTime: number;
  EndTime: number;
  DotLine?: boolean;
  BGLine?: boolean;
  ActivationStartTime?: number;
  ActivationEndTime?: number;
};

type LineLayout = {
  Height: number;
};

type GravityBody = {
  Element: HTMLElement;
  Line: GravityLine;
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
  Spawned: boolean;
};

type GravityRole = "Previous" | "Current" | "Next" | "Nearby" | "Background" | "Instrumental";

type VisibleLine = {
  Role: GravityRole;
};

type Bounds = { Width: number; Height: number };
type RectBounds = { Left: number; Top: number; Right: number; Bottom: number };
type ObstacleExit = "Left" | "Right" | "Top" | "Bottom";

const EDGE_PADDING = 18;
const COVER_CLEARANCE = 12;
const LINE_GAP_CQW = 1;
const BACKGROUND_LINE_GAP_CQW = 0.2;
const MAX_SPEED = 16;
const SOFT_AVOID_RADIUS = 96;
const SOFT_AVOID_ACCELERATION = 5;
const UPWARD_ACCELERATION = 0.4;
const PREVIOUS_LINE_COUNT = 2;
const NEXT_LINE_COUNT = 4;

let stage: HTMLElement | null = null;
let viewport: HTMLElement | null = null;
let footer: HTMLElement | null = null;
let cover: HTMLElement | null = null;
let lines: GravityLine[] = [];
let leadLines: GravityLine[] = [];
let transientLines: GravityLine[] = [];
let bodiesByLine = new Map<GravityLine, GravityBody[]>();
let lineLayouts = new Map<GravityLine, LineLayout>();
let preparedLines = new Set<GravityLine>();
let visibleLines = new Map<GravityLine, VisibleLine>();
let activeBodies: GravityBody[] = [];
let activeTransientLines = new Set<GravityLine>();
let transientCursor = 0;
let lastPosition = Number.NEGATIVE_INFINITY;
let resizeObserver: ResizeObserver | null = null;
let layoutObserver: MutationObserver | null = null;
let coverTrackingFrame: number | null = null;
let coverTrackingUntil = 0;
let stageBounds: Bounds | null = null;
let footerBounds: RectBounds | null = null;
let coverBounds: RectBounds | null = null;
let lastTick = performance.now();
let reducedMotion = false;

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
  const stageRect = stage.getBoundingClientRect();
  const contentBox = viewport.closest(".ContentBox");
  const nextCover = contentBox?.querySelector<HTMLElement>(".NowBar .MediaImageContainer") ?? null;
  if (cover !== nextCover) {
    if (cover) resizeObserver?.unobserve(cover);
    cover = nextCover;
    if (cover) resizeObserver?.observe(cover);
  }

  const footerRect = footer?.getBoundingClientRect();
  footerBounds =
    footerRect && footerRect.width > 0 && footerRect.height > 0
      ? {
          Left: footerRect.left - stageRect.left,
          Top: footerRect.top - stageRect.top,
          Right: footerRect.right - stageRect.left,
          Bottom: footerRect.bottom - stageRect.top,
        }
      : null;
  const coverRect = cover?.getBoundingClientRect();
  coverBounds =
    coverRect && coverRect.width > 0 && coverRect.height > 0
      ? {
          Left: coverRect.left - stageRect.left - COVER_CLEARANCE,
          Top: coverRect.top - stageRect.top - COVER_CLEARANCE,
          Right: coverRect.right - stageRect.left + COVER_CLEARANCE,
          Bottom: coverRect.bottom - stageRect.top + COVER_CLEARANCE,
        }
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
  if (body.X < minX) {
    body.X = minX;
    body.VX = Math.abs(body.VX);
    changed = true;
  } else if (body.X > maxX) {
    body.X = maxX;
    body.VX = -Math.abs(body.VX);
    changed = true;
  }
  if (body.Y < minY) {
    body.Y = minY;
    body.VY = Math.abs(body.VY);
    changed = true;
  } else if (body.Y > maxY) {
    body.Y = maxY;
    body.VY = -Math.abs(body.VY);
    changed = true;
  }
  return changed;
}

function renderBody(body: GravityBody): void {
  body.Element.style.translate = `${body.X - body.Width / 2}px ${body.Y - body.Height / 2}px`;
  body.Element.style.rotate = `${body.Angle}deg`;
}

function resolveRectangleCollision(
  body: GravityBody,
  obstacle: RectBounds | null,
  width: number,
  height: number,
  exits: ObstacleExit[]
): boolean {
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
  ].filter((candidate) =>
    exits.includes(candidate.Exit) &&
    candidate.X >= minX && candidate.X <= maxX && candidate.Y >= minY && candidate.Y <= maxY
  );
  if (candidates.length === 0) return false;

  const candidate = candidates.reduce((nearestCandidate, nextCandidate) =>
    Math.hypot(nextCandidate.X - body.X, nextCandidate.Y - body.Y) <
      Math.hypot(nearestCandidate.X - body.X, nearestCandidate.Y - body.Y)
      ? nextCandidate
      : nearestCandidate
  );
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
    if (!stageBounds) {
      coverTrackingFrame = null;
      return;
    }
    for (const body of activeBodies) {
      if (!body.Spawned) continue;
      const x = body.X;
      const y = body.Y;
      resolveBodyConstraints(body, stageBounds.Width, stageBounds.Height);
      if (body.X !== x || body.Y !== y) renderBody(body);
    }
    if (performance.now() < coverTrackingUntil) {
      coverTrackingFrame = requestAnimationFrame(updateCoverBounds);
      return;
    }
    coverTrackingFrame = null;
  };
  coverTrackingFrame = requestAnimationFrame(updateCoverBounds);
}

function upperBoundByStart(source: GravityLine[], position: number): number {
  let low = 0;
  let high = source.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (source[middle].StartTime <= position) low = middle + 1;
    else high = middle;
  }
  return low;
}

function getLeadAnchor(position: number): number {
  const before = upperBoundByStart(leadLines, position) - 1;
  if (before >= 0 && position < leadLines[before].EndTime) return before;
  return before + 1 < leadLines.length ? before + 1 : -1;
}

function getPreviousLead(line: GravityLine): GravityLine | undefined {
  let index = upperBoundByStart(leadLines, line.StartTime) - 1;
  while (index >= 0) {
    const candidate = leadLines[index];
    if (candidate.EndTime <= line.StartTime) return candidate;
    index -= 1;
  }
  return undefined;
}

function getActivationStart(line: GravityLine): number {
  return line.ActivationStartTime ?? line.StartTime;
}

function getActivationEnd(line: GravityLine): number {
  return line.ActivationEndTime ?? line.EndTime;
}

function upperBoundByActivation(source: GravityLine[], position: number): number {
  let low = 0;
  let high = source.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (getActivationStart(source[middle]) <= position) low = middle + 1;
    else high = middle;
  }
  return low;
}

function updateActiveTransientLines(position: number): void {
  if (position < lastPosition) {
    transientCursor = upperBoundByActivation(transientLines, position);
    activeTransientLines = new Set(
      transientLines.slice(0, transientCursor).filter((line) => getActivationEnd(line) > position)
    );
    return;
  }

  while (
    transientCursor < transientLines.length &&
    getActivationStart(transientLines[transientCursor]) <= position
  ) {
    const line = transientLines[transientCursor];
    if (getActivationEnd(line) > position) activeTransientLines.add(line);
    transientCursor += 1;
  }

  for (const line of activeTransientLines) {
    if (getActivationEnd(line) <= position) activeTransientLines.delete(line);
  }
}

function getVisibleLines(position: number): Map<GravityLine, VisibleLine> {
  updateActiveTransientLines(position);
  const nextVisible = new Map<GravityLine, VisibleLine>();
  const anchor = getLeadAnchor(position);

  if (anchor >= 0) {
    for (let offset = -PREVIOUS_LINE_COUNT; offset <= NEXT_LINE_COUNT; offset += 1) {
      const line = leadLines[anchor + offset];
      if (!line) continue;
      const active = position >= line.StartTime && position < line.EndTime;
      nextVisible.set(line, {
        Role: active ? "Current" : offset === (active ? 1 : 0) ? "Next" : offset < 0 ? "Previous" : "Nearby",
      });
    }
  }

  for (const line of activeTransientLines) {
    nextVisible.set(line, {
      Role: line.DotLine ? "Instrumental" : "Background",
    });

    if (line.DotLine) {
      const previous = getPreviousLead(line);
      if (previous && !nextVisible.has(previous)) {
        nextVisible.set(previous, { Role: "Previous" });
      }
    }
  }

  return nextVisible;
}

function applyLineRole(line: GravityLine, state: VisibleLine | undefined): void {
  const element = line.HTMLElement;
  element.classList.toggle(
    "SpaceGravityCurrent",
    state?.Role === "Current" || state?.Role === "Background" || state?.Role === "Instrumental"
  );
  element.classList.toggle("SpaceGravityNext", state?.Role === "Next");
  element.classList.toggle("SpaceGravityNearby", state?.Role === "Previous" || state?.Role === "Nearby");
  element.classList.toggle("SpaceGravityDot", state?.Role === "Instrumental");
  element.classList.toggle("SpaceGravityHidden", !state);
}

function prepareLines(nextLines: GravityLine[]): void {
  if (!stage || nextLines.length === 0) return;

  const records: Array<{ Line: GravityLine; Child: HTMLElement; X: number; Y: number; Index: number }> = [];
  for (const line of nextLines) {
    line.HTMLElement.classList.add("SpaceGravityLine", "SpaceGravityMeasure");
    stage.appendChild(line.HTMLElement);
  }

  // Keep writes and layout reads separate. This turns one forced layout per word
  // into one layout for the entering gravity window.
  for (const line of nextLines) {
    lineLayouts.set(line, { Height: line.HTMLElement.offsetHeight });
    for (const [index, child] of Array.from(line.HTMLElement.children).entries()) {
      if (child.nodeType !== 1) continue;
      const element = child as HTMLElement;
      records.push({
        Line: line,
        Child: element,
        X: line.HTMLElement.offsetLeft + element.offsetLeft,
        Y: element.offsetTop,
        Index: index,
      });
    }
  }

  const newBodies: GravityBody[] = [];
  for (const record of records) {
    const body = document.createElement("span");
    body.classList.add("SpaceGravityWord", "SpaceGravityUnspawned");
    body.style.left = "0px";
    body.style.top = "0px";
    record.Line.HTMLElement.replaceChild(body, record.Child);
    body.appendChild(record.Child);

    const seed = hash(
      `${record.Line.StartTime}:${record.Line.EndTime}:${record.Child.textContent ?? ""}:${record.Index}`
    );
    const speed = 4.4 + random(seed + 3) * 5.6;
    const direction = random(seed + 4) * Math.PI * 2;
    const gravityBody: GravityBody = {
      Element: body,
      Line: record.Line,
      X: 0,
      Y: 0,
      VX: Math.cos(direction) * speed,
      VY: Math.sin(direction) * speed,
      Angle: 0,
      AngularVelocity: (random(seed + 2) * 2 - 1) * 19,
      Radius: 24,
      Width: 48,
      Height: 48,
      StartX: record.X,
      StartY: record.Y,
      Spawned: false,
    };
    const lineBodies = bodiesByLine.get(record.Line) ?? [];
    lineBodies.push(gravityBody);
    bodiesByLine.set(record.Line, lineBodies);
    newBodies.push(gravityBody);
  }

  for (const body of newBodies) {
    body.Width = body.Element.offsetWidth;
    body.Height = body.Element.offsetHeight;
    body.Radius = Math.max(14, Math.hypot(body.Width, body.Height) / 2);
  }

  for (const line of nextLines) {
    line.HTMLElement.classList.remove("SpaceGravityMeasure");
    preparedLines.add(line);
  }
}

function getLineGap(width: number, background = false): number {
  return width * (background ? BACKGROUND_LINE_GAP_CQW : LINE_GAP_CQW) / 100;
}

function getSpawnTops(anchor: number, width: number, height: number): Map<GravityLine, number> {
  const tops = new Map<GravityLine, number>();
  const firstIndex = Math.max(0, anchor - PREVIOUS_LINE_COUNT);
  const lastIndex = Math.min(leadLines.length - 1, anchor + NEXT_LINE_COUNT);
  if (anchor < 0 || firstIndex > lastIndex) return tops;

  const linesToSpawn = leadLines.slice(firstIndex, lastIndex + 1);
  const naturalTops = new Map<GravityLine, number>();
  let naturalTop = 0;
  for (const [index, line] of linesToSpawn.entries()) {
    naturalTops.set(line, naturalTop);
    naturalTop += lineLayouts.get(line)?.Height ?? 0;
    if (index < linesToSpawn.length - 1) naturalTop += getLineGap(width);
  }

  const top = EDGE_PADDING;
  const bottom = Math.max(top, Math.min(height - EDGE_PADDING, (footerBounds?.Top ?? height) - EDGE_PADDING));
  const lastLine = linesToSpawn.at(-1)!;
  const lastTop = naturalTops.get(lastLine) ?? 0;
  const lastHeight = lineLayouts.get(lastLine)?.Height ?? 0;
  const scale = lastTop > 0 ? Math.min(1, Math.max(0, bottom - top - lastHeight) / lastTop) : 1;
  for (const line of linesToSpawn) {
    tops.set(line, top + (naturalTops.get(line) ?? 0) * scale);
  }
  return tops;
}

function getBackgroundSpawnTop(line: GravityLine, width: number, tops: Map<GravityLine, number>): number | undefined {
  const documentIndex = lines.indexOf(line);
  for (let index = documentIndex - 1; index >= 0; index -= 1) {
    const previous = lines[index];
    const top = tops.get(previous);
    if (top === undefined) continue;
    return top + (lineLayouts.get(previous)?.Height ?? 0) + getLineGap(width, true);
  }
  return undefined;
}

function updateVisibleWindow(nextVisible: Map<GravityLine, VisibleLine>): void {
  if (!stage) return;
  const entering: GravityLine[] = [];

  for (const line of visibleLines.keys()) {
    if (nextVisible.has(line)) continue;
    applyLineRole(line, undefined);
    line.HTMLElement.remove();
  }

  for (const line of nextVisible.keys()) {
    if (!visibleLines.has(line) && !preparedLines.has(line)) entering.push(line);
  }
  prepareLines(entering);

  for (const [line, state] of nextVisible) {
    if (!line.HTMLElement.isConnected) stage.appendChild(line.HTMLElement);
    applyLineRole(line, state);
  }

  visibleLines = nextVisible;
  activeBodies = [];
  for (const line of visibleLines.keys()) {
    activeBodies.push(...(bodiesByLine.get(line) ?? []));
  }
}

function getInstrumentalSpawn(body: GravityBody, width: number, height: number): { X: number; Y: number } {
  const previous = getPreviousLead(body.Line);
  const previousBodies = previous ? bodiesByLine.get(previous) : undefined;
  const spawned = previousBodies?.filter((candidate) => candidate.Spawned) ?? [];
  if (spawned.length > 0) {
    return {
      X: spawned.reduce((sum, candidate) => sum + candidate.X, 0) / spawned.length,
      Y: spawned.reduce((sum, candidate) => sum + candidate.Y, 0) / spawned.length,
    };
  }
  return { X: width * 0.5, Y: height * 0.48 };
}

function spawnBody(
  body: GravityBody,
  visibleLine: VisibleLine,
  width: number,
  height: number,
  spawnTops: Map<GravityLine, number>
): void {
  if (body.Spawned) return;
  const lineY = visibleLine.Role === "Background"
    ? getBackgroundSpawnTop(body.Line, width, spawnTops)
    : spawnTops.get(body.Line);
  const instrumentalSpawn =
    visibleLine.Role === "Instrumental" ? getInstrumentalSpawn(body, width, height) : undefined;
  if (!instrumentalSpawn && lineY === undefined) return;
  body.X = instrumentalSpawn?.X ?? body.StartX + body.Width / 2;
  body.Y = instrumentalSpawn?.Y ?? lineY! + body.StartY + body.Height / 2;
  body.Angle = 0;
  resolveBodyConstraints(body, width, height);
  body.Spawned = true;
  body.Element.classList.remove("SpaceGravityUnspawned");
  renderBody(body);
}

function applySoftAvoidance(delta: number): void {
  const buckets = new Map<string, GravityBody[]>();
  for (const body of activeBodies) {
    const cellX = Math.floor(body.X / SOFT_AVOID_RADIUS);
    const cellY = Math.floor(body.Y / SOFT_AVOID_RADIUS);
    for (let x = cellX - 1; x <= cellX + 1; x += 1) {
      for (let y = cellY - 1; y <= cellY + 1; y += 1) {
        for (const other of buckets.get(`${x}:${y}`) ?? []) {
          const dx = body.X - other.X;
          const dy = body.Y - other.Y;
          const distance = Math.hypot(dx, dy) || 0.001;
          if (distance >= SOFT_AVOID_RADIUS) continue;
          const nudge =
            ((SOFT_AVOID_RADIUS - distance) / SOFT_AVOID_RADIUS) * SOFT_AVOID_ACCELERATION * delta;
          const nx = dx / distance;
          const ny = dy / distance;
          body.VX += nx * nudge;
          body.VY += ny * nudge;
          other.VX -= nx * nudge;
          other.VY -= ny * nudge;
        }
      }
    }
    const key = `${cellX}:${cellY}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(body);
    buckets.set(key, bucket);
  }
}

export function mountSpaceGravity(
  nextStage: HTMLElement,
  nextLines: GravityLine[],
  nextViewport: HTMLElement,
  nextFooter: HTMLElement,
  initialPosition: number
): void {
  destroySpaceGravity();
  stage = nextStage;
  viewport = nextViewport;
  footer = nextFooter;
  lines = nextLines;
  leadLines = lines.filter((line) => !line.DotLine && !line.BGLine).sort((a, b) => a.StartTime - b.StartTime);
  transientLines = lines.filter((line) => line.DotLine || line.BGLine).sort(
    (a, b) => getActivationStart(a) - getActivationStart(b)
  );
  updateReducedMotion();

  resizeObserver = new ResizeObserver(() => updateBounds());
  resizeObserver.observe(nextStage);
  resizeObserver.observe(nextViewport);
  resizeObserver.observe(nextFooter);
  updateBounds();
  const layoutRoot = nextViewport.closest(".ContentBox")?.parentElement;
  if (layoutRoot) {
    layoutObserver = new MutationObserver((records) => {
      if (
        records.some((record) => {
          const target = record.target as HTMLElement;
          return target.id === "SpicyLyricsPage" || target.classList.contains("NowBar");
        })
      ) {
        updateBounds();
        trackCoverTransition();
      }
    });
    layoutObserver.observe(layoutRoot, { attributes: true, attributeFilter: ["class"], subtree: true });
  }
  tickSpaceGravity(initialPosition);
}

export function tickSpaceGravity(position: number): void {
  if (!stage || !stageBounds) return;
  const nextVisible = getVisibleLines(position);
  updateVisibleWindow(nextVisible);
  const spawnTops = getSpawnTops(getLeadAnchor(position), stageBounds.Width, stageBounds.Height);

  for (const body of activeBodies) {
    const visibleLine = visibleLines.get(body.Line);
    if (visibleLine?.Role === "Instrumental") continue;
    if (visibleLine) spawnBody(body, visibleLine, stageBounds.Width, stageBounds.Height, spawnTops);
  }
  for (const body of activeBodies) {
    const visibleLine = visibleLines.get(body.Line);
    if (visibleLine?.Role !== "Instrumental") continue;
    spawnBody(body, visibleLine, stageBounds.Width, stageBounds.Height, spawnTops);
  }

  const now = performance.now();
  const delta = Math.min(0.05, Math.max(0, (now - lastTick) / 1000));
  lastTick = now;
  lastPosition = position;
  if (reducedMotion) return;

  applySoftAvoidance(delta);
  for (const body of activeBodies) {
    const speed = Math.hypot(body.VX, body.VY);
    if (speed > MAX_SPEED) {
      body.VX = (body.VX / speed) * MAX_SPEED;
      body.VY = (body.VY / speed) * MAX_SPEED;
    }

    const lowerHalf = Math.max(0, (body.Y / stageBounds.Height - 0.45) / 0.55);
    body.VY -= UPWARD_ACCELERATION * lowerHalf * delta;
    body.X += body.VX * delta;
    body.Y += body.VY * delta;
    body.Angle += body.AngularVelocity * delta;

    resolveBodyConstraints(body, stageBounds.Width, stageBounds.Height);
    renderBody(body);
  }
}

export function destroySpaceGravity(): void {
  resizeObserver?.disconnect();
  resizeObserver = null;
  layoutObserver?.disconnect();
  layoutObserver = null;
  if (coverTrackingFrame !== null) cancelAnimationFrame(coverTrackingFrame);
  coverTrackingFrame = null;
  coverTrackingUntil = 0;
  stage = null;
  viewport = null;
  footer = null;
  cover = null;
  lines = [];
  leadLines = [];
  transientLines = [];
  bodiesByLine = new Map();
  lineLayouts = new Map();
  preparedLines = new Set();
  visibleLines = new Map();
  activeBodies = [];
  activeTransientLines = new Set();
  transientCursor = 0;
  lastPosition = Number.NEGATIVE_INFINITY;
  stageBounds = null;
  footerBounds = null;
  coverBounds = null;
  lastTick = performance.now();
}
