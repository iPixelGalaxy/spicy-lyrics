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
  Visible: boolean;
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
const WORD_WINDOW = 25;

let stage: HTMLElement | null = null;
let viewport: HTMLElement | null = null;
let footer: HTMLElement | null = null;
let cover: HTMLElement | null = null;
let lines: GravityLine[] = [];
let bodiesByLine = new Map<GravityLine, GravityBody[]>();
let leadBodies: GravityBody[] = [];
let activeBodies: GravityBody[] = [];
let visibleLines = new Set<GravityLine>();
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
  body.Element.style.translate = `${body.X - body.Width / 2}px ${body.Y - body.Height / 2}px`;
  body.Element.style.rotate = `${body.Angle}deg`;
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
  return entities;
}

function getEntities(line: GravityLine): HTMLElement[] {
  return Array.from(line.HTMLElement.children)
    .filter((child): child is HTMLElement => child instanceof HTMLElement)
    .flatMap((child) => child.classList.contains("word-group") ? splitDashedGroup(child) : [child]);
}

function prepareLines(): void {
  if (!stage) return;
  const records: Array<{ Line: GravityLine; Child: HTMLElement; X: number; Y: number; Index: number }> = [];
  for (const line of lines) {
    line.HTMLElement.classList.add("SpaceGravityLine", "SpaceGravityMeasure");
    stage.appendChild(line.HTMLElement);
  }
  for (const line of lines) {
    for (const [index, child] of getEntities(line).entries()) {
      records.push({ Line: line, Child: child, X: line.HTMLElement.offsetLeft + child.offsetLeft, Y: child.offsetTop, Index: index });
    }
  }
  let order = 0;
  for (const record of records) {
    const syllables = record.Line.Syllables?.Lead.filter((syllable) => record.Child === syllable.HTMLElement || record.Child.contains(syllable.HTMLElement)) ?? [];
    const startTime = syllables.length ? Math.min(...syllables.map((syllable) => syllable.StartTime)) : record.Line.StartTime;
    const endTime = syllables.length ? Math.max(...syllables.map((syllable) => syllable.EndTime)) : record.Line.EndTime;
    const bodyElement = document.createElement("span");
    bodyElement.classList.add("SpaceGravityWord", "SpaceGravityUnspawned");
    bodyElement.style.left = "0px";
    bodyElement.style.top = "0px";
    if (!record.Line.DotLine) bodyElement.dataset.spaceGravitySeekTime = `${startTime}`;
    record.Line.HTMLElement.replaceChild(bodyElement, record.Child);
    bodyElement.appendChild(record.Child);
    const seed = hash(`${record.Line.StartTime}:${record.Line.EndTime}:${record.Child.textContent ?? ""}:${record.Index}`);
    const speed = 4.4 + random(seed + 3) * 5.6;
    const direction = random(seed + 4) * Math.PI * 2;
    const body: GravityBody = { Element: bodyElement, Line: record.Line, StartTime: startTime, EndTime: endTime, Order: order++, X: 0, Y: 0, VX: Math.cos(direction) * speed, VY: Math.sin(direction) * speed, Angle: 0, AngularVelocity: (random(seed + 2) * 2 - 1) * 19, Radius: 24, Width: 48, Height: 48, StartX: record.X, StartY: record.Y, Spawned: false, Visible: false };
    body.Width = bodyElement.offsetWidth;
    body.Height = bodyElement.offsetHeight;
    body.Radius = Math.max(14, Math.hypot(body.Width, body.Height) / 2);
    const lineBodies = bodiesByLine.get(record.Line) ?? [];
    lineBodies.push(body);
    bodiesByLine.set(record.Line, lineBodies);
    if (!record.Line.BGLine && !record.Line.DotLine) leadBodies.push(body);
  }
  leadBodies.sort((a, b) => a.StartTime - b.StartTime || a.Order - b.Order);
  for (const line of lines) {
    line.HTMLElement.classList.remove("SpaceGravityMeasure");
    line.HTMLElement.remove();
  }
}

function getAnchorIndex(position: number): number {
  if (leadBodies.length === 0) return -1;
  let next = leadBodies.findIndex((body) => body.StartTime > position);
  if (next === -1) return leadBodies.length - 1;
  for (let index = next - 1; index >= 0; index -= 1) {
    if (leadBodies[index].EndTime > position) return index;
  }
  return next;
}

function getRole(body: GravityBody, position: number): GravityRole {
  if (body.Line.DotLine) return "Instrumental";
  if (position < body.StartTime) return "Next";
  if (position < body.EndTime) return "Current";
  return "Previous";
}

function applyBodyRole(body: GravityBody, role: GravityRole | undefined): void {
  for (const name of ["SpaceGravityCurrent", "SpaceGravityNext", "SpaceGravityNearby", "SpaceGravityDot"]) body.Element.classList.remove(name);
  if (role === "Current" || role === "Instrumental") body.Element.classList.add("SpaceGravityCurrent");
  if (role === "Next") body.Element.classList.add("SpaceGravityNext");
  if (role === "Previous") body.Element.classList.add("SpaceGravityNearby");
  if (role === "Instrumental") body.Element.classList.add("SpaceGravityDot");
}

function resetBody(body: GravityBody): void {
  body.Visible = false;
  body.Spawned = false;
  body.Angle = 0;
  body.Element.classList.add("SpaceGravityUnspawned");
  applyBodyRole(body, undefined);
}

function updateVisibleBodies(position: number): void {
  const anchor = getAnchorIndex(position);
  const selected = new Set<GravityBody>();
  if (anchor >= 0) {
    for (let index = Math.max(0, anchor - WORD_WINDOW); index <= Math.min(leadBodies.length - 1, anchor + WORD_WINDOW); index += 1) selected.add(leadBodies[index]);
  }
  const selectedParentIndexes = new Set(Array.from(selected, (body) => lines.indexOf(body.Line)));
  for (const line of lines) {
    if (!line.BGLine || line.SpaceGravityParentLineIndex === undefined || !selectedParentIndexes.has(line.SpaceGravityParentLineIndex)) continue;
    for (const body of bodiesByLine.get(line) ?? []) selected.add(body);
  }
  for (const line of lines) {
    if (!line.DotLine || position < line.StartTime || position >= line.EndTime) continue;
    for (const body of bodiesByLine.get(line) ?? []) selected.add(body);
  }
  for (const bodies of bodiesByLine.values()) for (const body of bodies) if (!selected.has(body) && body.Visible) resetBody(body);
  activeBodies = Array.from(selected);
  const nextLines = new Set(activeBodies.map((body) => body.Line));
  for (const line of visibleLines) {
    if (nextLines.has(line)) continue;
    line.HTMLElement.classList.remove("SpaceGravityVisible");
    line.HTMLElement.remove();
  }
  for (const line of nextLines) {
    line.HTMLElement.classList.add("SpaceGravityVisible");
    if (!line.HTMLElement.isConnected) stage?.appendChild(line.HTMLElement);
  }
  visibleLines = nextLines;
  for (const body of activeBodies) {
    body.Visible = true;
    applyBodyRole(body, getRole(body, position));
  }
}

function spawnBody(body: GravityBody, width: number, height: number): void {
  if (body.Spawned) return;
  body.X = width / 2;
  body.Y = height / 2;
  body.Angle = 0;
  resolveBodyConstraints(body, width, height);
  body.Spawned = true;
  body.Element.classList.remove("SpaceGravityUnspawned");
  renderBody(body);
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
  const buckets = new Map<string, GravityBody[]>();
  for (const body of activeBodies) {
    const cellX = Math.floor(body.X / SOFT_AVOID_RADIUS);
    const cellY = Math.floor(body.Y / SOFT_AVOID_RADIUS);
    for (let x = cellX - 1; x <= cellX + 1; x += 1) for (let y = cellY - 1; y <= cellY + 1; y += 1) for (const other of buckets.get(`${x}:${y}`) ?? []) {
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
    const key = `${cellX}:${cellY}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(body);
    buckets.set(key, bucket);
  }
}

export function mountSpaceGravity(nextStage: HTMLElement, nextLines: GravityLine[], nextViewport: HTMLElement, nextFooter: HTMLElement, initialPosition: number): void {
  destroySpaceGravity();
  stage = nextStage;
  viewport = nextViewport;
  footer = nextFooter;
  lines = nextLines;
  updateReducedMotion();
  resizeObserver = new ResizeObserver(() => updateBounds());
  resizeObserver.observe(nextStage);
  resizeObserver.observe(nextViewport);
  resizeObserver.observe(nextFooter);
  updateBounds();
  prepareLines();
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
  tickSpaceGravity(initialPosition);
}

export function tickSpaceGravity(position: number): void {
  if (!stage || !stageBounds) return;
  updateVisibleBodies(position);
  for (const body of activeBodies) spawnBody(body, stageBounds.Width, stageBounds.Height);
  const now = performance.now();
  const delta = Math.min(0.05, Math.max(0, (now - lastTick) / 1000));
  lastTick = now;
  if (reducedMotion) { applyStaticLayout(stageBounds.Width, stageBounds.Height); return; }
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
  bodiesByLine = new Map();
  leadBodies = [];
  activeBodies = [];
  visibleLines = new Set();
  stageBounds = null;
  footerBounds = null;
  coverBounds = null;
  lastTick = performance.now();
}
