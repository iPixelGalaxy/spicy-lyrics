type GravitySyllable = {
  HTMLElement: HTMLElement;
  StartTime: number;
  EndTime: number;
  Dot?: boolean;
  Letters?: GravitySyllable[];
};

type SplitElement = {
  Original: HTMLElement;
  Entities: HTMLElement[];
  RestoreChildren?: boolean;
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
  SpeedMultiplier: number;
  Angle: number;
  AngularVelocity: number;
  BounceCount: number;
  Radius: number;
  BaseRadius: number;
  Scale: number;
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
type WindowPosition = { X: number; Y: number };
type RectBounds = { Left: number; Top: number; Right: number; Bottom: number };
type ObstacleExit = "Left" | "Right" | "Top" | "Bottom";
type CollisionAxis = "X" | "Y";

const EDGE_PADDING = 18;
const COVER_CLEARANCE = 12;
const WORD_VISUAL_OVERHANG = 0.3;
const MAX_SPEED = 16;
const WPM_SPEED_THRESHOLD = 60;
const WPM_SPEED_MAX = 180;
const MAX_WPM_SPEED_MULTIPLIER = 1.75;
const HIGH_SPEED_DRAG = 0.6;
const WINDOW_VELOCITY_SMOOTHING = 0.18;
const WINDOW_IMPULSE = 1.1;
const BOUNCE_RESTITUTION = 0.82;
const MAX_BOUNCE_RESTITUTION = 2.4;
const MAX_BOUNCE_SPEED = MAX_SPEED * MAX_BOUNCE_RESTITUTION;
const SOFT_SEPARATION_GAP = 10;
const SOFT_SEPARATION_ACCELERATION = 5;
const UPWARD_ACCELERATION = 0.4;
const ANGULAR_DAMPING = 0.18;
const MIN_VISIBLE_LEAD_WORDS = 12;
const MAX_VISIBLE_LEAD_WORDS = 120;
const VISIBLE_WORD_AREA = 33_334;
const LINE_GAP_CQW = 1;
const LINE_EXIT_DELAY_MS = 200;
const WORD_PRESENCE_FADE_MS = 180;

let stage: HTMLElement | null = null;
let viewport: HTMLElement | null = null;
let footer: HTMLElement | null = null;
let cover: HTMLElement | null = null;
let nowBarHeader: HTMLElement | null = null;
let viewControls: HTMLElement | null = null;
let lines: GravityLine[] = [];
let bodiesByLine = new Map<GravityLine, GravityBody[]>();
let leadLines: GravityLine[] = [];
let lineLayouts = new Map<GravityLine, { Height: number }>();
let splitGroups: Array<{ Group: HTMLElement; Entities: HTMLElement[] }> = [];
let splitElements: SplitElement[] = [];
let parentLines = new Map<GravityLine, GravityLine>();
let backgroundLinesByParent = new Map<GravityLine, GravityLine[]>();
let dotLines: GravityLine[] = [];
let leadLineIndexes = new Map<GravityLine, number>();
let leadWordStarts = new Map<GravityLine, number>();
let leadWordCounts = new Map<GravityLine, number>();
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
let nowBarHeaderBounds: RectBounds | null = null;
let viewControlsBounds: RectBounds | null = null;
let windowPosition: WindowPosition | null = null;
let windowVelocity: WindowPosition = { X: 0, Y: 0 };
let windowPositionDocument: Document | null = null;
let windowPositionVisibilityListener: (() => void) | null = null;
let lastTick = performance.now();
let renderFrame = 0;
let reducedMotion = false;
let layoutDirty = true;
let staticLayoutDirty = true;
let visibleLeadWordCount = MIN_VISIBLE_LEAD_WORDS;

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

function getLineWordsPerMinute(line: GravityLine): number {
  const starts = [...new Set((line.Syllables?.Lead ?? [])
    .filter((syllable) => !syllable.Dot)
    .map((syllable) => syllable.StartTime))]
    .sort((left, right) => left - right);
  if (starts.length < 2) return 0;
  const duration = starts.at(-1)! - starts[0];
  return duration > 0 ? (starts.length - 1) * 60_000 / duration : 0;
}

function getWpmSpeedMultiplier(wordsPerMinute: number): number {
  if (!Number.isFinite(wordsPerMinute) || wordsPerMinute <= WPM_SPEED_THRESHOLD) return 1;
  const progress = Math.min(1, (wordsPerMinute - WPM_SPEED_THRESHOLD) / (WPM_SPEED_MAX - WPM_SPEED_THRESHOLD));
  return 1 + progress * (MAX_WPM_SPEED_MULTIPLIER - 1);
}

function bounce(body: GravityBody, axis: CollisionAxis, direction: -1 | 1, bouncedAxes: Set<CollisionAxis>): void {
  const velocity = axis === "X" ? body.VX : body.VY;
  if (!Number.isFinite(velocity)) {
    if (axis === "X") body.VX = 0;
    else body.VY = 0;
    return;
  }
  if (velocity * direction >= 0) return;
  // A narrow gap can hit opposite constraints in one solve. Stop there rather
  // than amplifying a rebound back and forth between them.
  if (bouncedAxes.has(axis)) {
    if (axis === "X") body.VX = 0;
    else body.VY = 0;
    return;
  }
  bouncedAxes.add(axis);
  // Keep ordinary bounces near existing restitution. Rare hits launch hard.
  const strength = BOUNCE_RESTITUTION + random(hash(`${body.Line.StartTime}:${body.Order}:${body.BounceCount++}`)) ** 2 * (MAX_BOUNCE_RESTITUTION - BOUNCE_RESTITUTION);
  const reboundSpeed = Math.min(MAX_BOUNCE_SPEED * body.SpeedMultiplier, Math.abs(velocity) * strength);
  if (axis === "X") body.VX = direction * reboundSpeed;
  else body.VY = direction * reboundSpeed;
}

function recoverInvalidBodyMotion(body: GravityBody): void {
  const positionValid = Number.isFinite(body.X) && Number.isFinite(body.Y);
  const velocityValid = Number.isFinite(body.VX) && Number.isFinite(body.VY);
  const rotationValid = Number.isFinite(body.Angle) && Number.isFinite(body.AngularVelocity);
  if (positionValid && velocityValid && rotationValid) return;

  const seed = hash(`${body.Line.StartTime}:${body.Order}:${body.BounceCount}:recovery`);
  const speed = (4.4 + random(seed) * 5.6) * body.SpeedMultiplier;
  const direction = random(seed + 1) * Math.PI * 2;
  if (!positionValid) {
    body.X = Number.isFinite(body.NaturalX) ? body.NaturalX : 0;
    body.Y = Number.isFinite(body.NaturalY) ? body.NaturalY : 0;
  }
  if (!velocityValid) {
    body.VX = Math.cos(direction) * speed;
    body.VY = Math.sin(direction) * speed;
  }
  if (!rotationValid) {
    body.Angle = 0;
    body.AngularVelocity = (random(seed + 2) * 2 - 1) * 19;
  }
}

function updateReducedMotion(): void {
  reducedMotion = stage?.ownerDocument.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)")
    .matches ?? false;
}

function getWindowPosition(): WindowPosition | null {
  const ownerWindow = stage?.ownerDocument.defaultView;
  if (!ownerWindow || !Number.isFinite(ownerWindow.screenX) || !Number.isFinite(ownerWindow.screenY)) return null;
  return { X: ownerWindow.screenX, Y: ownerWindow.screenY };
}

function resetWindowMotion(): void {
  windowPosition = getWindowPosition();
  windowVelocity = { X: 0, Y: 0 };
}

function applyWindowGravity(delta: number): void {
  const nextPosition = getWindowPosition();
  if (!nextPosition) return;
  const previousPosition = windowPosition;
  windowPosition = nextPosition;
  if (!previousPosition || reducedMotion || stage?.ownerDocument.visibilityState !== "visible") return;
  const sampledX = (nextPosition.X - previousPosition.X) / Math.max(delta, 0.001);
  const sampledY = (nextPosition.Y - previousPosition.Y) / Math.max(delta, 0.001);
  windowVelocity.X += (sampledX - windowVelocity.X) * WINDOW_VELOCITY_SMOOTHING;
  windowVelocity.Y += (sampledY - windowVelocity.Y) * WINDOW_VELOCITY_SMOOTHING;
  if (windowVelocity.X === 0 && windowVelocity.Y === 0) return;

  for (const body of activeBodies) {
    if (!body.Spawned) continue;
    body.VX -= windowVelocity.X * WINDOW_IMPULSE * delta;
    body.VY -= windowVelocity.Y * WINDOW_IMPULSE * delta;
  }
  for (const body of exitingBodies) {
    if (!body.Spawned) continue;
    body.VX -= windowVelocity.X * WINDOW_IMPULSE * delta;
    body.VY -= windowVelocity.Y * WINDOW_IMPULSE * delta;
  }
}

function updateBounds(refreshBodies = true): void {
  if (!stage || !viewport) return;
  const previousBounds = stageBounds;
  const height = viewport.clientHeight;
  stage.style.height = `${height}px`;
  const width = stage.clientWidth;
  if (width < 1 || height < 1) return;
  stageBounds = { Width: width, Height: height };
  const resized = previousBounds !== null && (previousBounds.Width !== width || previousBounds.Height !== height);
  const scaleX = previousBounds ? width / previousBounds.Width : 1;
  const scaleY = previousBounds ? height / previousBounds.Height : 1;
  layoutDirty = true;
  staticLayoutDirty = true;
  updateObstacleBounds();
  if (previousBounds === null || resized) visibleLeadWordCount = calculateVisibleLeadWordCount(width, height);
  if (resized) resetWindowMotion();
  if (!refreshBodies) return;
  for (const body of activeBodies) {
    if (resized && body.Spawned) {
      body.X *= scaleX;
      body.Y *= scaleY;
    }
    measureBody(body);
    if (!body.Spawned) continue;
    resolveBodyConstraints(body, width, height);
    renderBody(body);
  }
  for (const body of exitingBodies) {
    if (resized && body.Spawned) {
      body.X *= scaleX;
      body.Y *= scaleY;
    }
    measureBody(body);
    if (!body.Spawned) continue;
    resolveBodyConstraints(body, width, height);
    renderBody(body);
  }
}

function measureBody(body: GravityBody): void {
  body.Width = body.Element.offsetWidth;
  body.Height = body.Element.offsetHeight;
  body.BaseRadius = Math.max(14, Math.hypot(body.Width, body.Height) / 2 + body.Height * WORD_VISUAL_OVERHANG);
  body.Radius = body.BaseRadius * body.Scale;
}

function getRelativeBounds(rect: DOMRect | undefined, stageRect: DOMRect): RectBounds | null {
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;
  return { Left: rect.left - stageRect.left, Top: rect.top - stageRect.top, Right: rect.right - stageRect.left, Bottom: rect.bottom - stageRect.top };
}

function boundsEqual(left: RectBounds | null, right: RectBounds | null): boolean {
  if (left === null || right === null) return left === right;
  return Math.abs(left.Left - right.Left) < 0.01 && Math.abs(left.Top - right.Top) < 0.01 && Math.abs(left.Right - right.Right) < 0.01 && Math.abs(left.Bottom - right.Bottom) < 0.01;
}

function boundsContain(outer: RectBounds | null, inner: RectBounds | null): boolean {
  if (!outer || !inner) return false;
  return outer.Left <= inner.Left && outer.Top <= inner.Top && outer.Right >= inner.Right && outer.Bottom >= inner.Bottom;
}

function updateCoverElement(): void {
  const nextCover = viewport?.closest(".ContentBox")?.querySelector<HTMLElement>(".NowBar .MediaImageContainer") ?? null;
  if (cover === nextCover) return;
  if (cover) resizeObserver?.unobserve(cover);
  cover = nextCover;
  if (cover) resizeObserver?.observe(cover);
}

function updateUiElements(): void {
  const contentBox = viewport?.closest(".ContentBox");
  const nextNowBarHeader = contentBox?.querySelector<HTMLElement>(".NowBar.Active .Header") ?? null;
  const nextViewControls = contentBox?.querySelector<HTMLElement>(".ViewControls") ?? null;

  if (nowBarHeader !== nextNowBarHeader) {
    if (nowBarHeader) resizeObserver?.unobserve(nowBarHeader);
    nowBarHeader = nextNowBarHeader;
    if (nowBarHeader) resizeObserver?.observe(nowBarHeader);
  }

  if (viewControls !== nextViewControls) {
    if (viewControls) resizeObserver?.unobserve(viewControls);
    viewControls = nextViewControls;
    if (viewControls) resizeObserver?.observe(viewControls);
  }
}

function updateObstacleBounds(): boolean {
  if (!stage) return false;
  updateCoverElement();
  updateUiElements();
  const stageRect = stage.getBoundingClientRect();
  const nextFooterBounds = getRelativeBounds(footer?.getBoundingClientRect(), stageRect);
  const nextCoverBounds = getRelativeBounds(cover?.getBoundingClientRect(), stageRect);
  const nextNowBarHeaderBounds = getRelativeBounds(nowBarHeader?.getBoundingClientRect(), stageRect);
  const rawViewControlsBounds = getRelativeBounds(viewControls?.getBoundingClientRect(), stageRect);
  const nextViewControlsBounds = boundsContain(nextNowBarHeaderBounds, rawViewControlsBounds)
    ? null
    : rawViewControlsBounds;
  const changed =
    !boundsEqual(footerBounds, nextFooterBounds) ||
    !boundsEqual(coverBounds, nextCoverBounds) ||
    !boundsEqual(nowBarHeaderBounds, nextNowBarHeaderBounds) ||
    !boundsEqual(viewControlsBounds, nextViewControlsBounds);
  footerBounds = nextFooterBounds;
  coverBounds = nextCoverBounds;
  nowBarHeaderBounds = nextNowBarHeaderBounds;
  viewControlsBounds = nextViewControlsBounds;
  return changed;
}

function syncObstacleBounds(): void {
  if (!stageBounds || !updateObstacleBounds()) return;
  const bodies = new Set([...activeBodies, ...exitingBodies]);
  for (const body of bodies) {
    if (!body.Spawned) continue;
    resolveBodyConstraints(body, stageBounds.Width, stageBounds.Height);
    renderBody(body);
  }
}

function setBodyScale(body: GravityBody, scale: number): void {
  body.Scale = scale;
  body.Radius = body.BaseRadius * scale;
}

function constrainToStage(body: GravityBody, width: number, height: number, bouncedAxes: Set<CollisionAxis>, padding = EDGE_PADDING): boolean {
  const minX = padding + body.Radius;
  const maxX = Math.max(minX, width - padding - body.Radius);
  const minY = padding + body.Radius;
  const maxY = Math.max(minY, height - padding - body.Radius);
  let changed = false;
  if (body.X < minX) { body.X = minX; bounce(body, "X", 1, bouncedAxes); changed = true; }
  else if (body.X > maxX) { body.X = maxX; bounce(body, "X", -1, bouncedAxes); changed = true; }
  if (body.Y < minY) { body.Y = minY; bounce(body, "Y", 1, bouncedAxes); changed = true; }
  else if (body.Y > maxY) { body.Y = maxY; bounce(body, "Y", -1, bouncedAxes); changed = true; }
  return changed;
}

function renderBody(body: GravityBody): void {
  body.Element.style.transform = `translate3d(${body.X - body.Width / 2}px, ${body.Y - body.Height / 2}px, 0) rotate(${body.Angle}deg) scale(${body.Scale})`;
}

function expandBounds(bounds: RectBounds | null, amount: number): RectBounds | null {
  if (!bounds) return null;
  return {
    Left: bounds.Left - amount,
    Top: bounds.Top - amount,
    Right: bounds.Right + amount,
    Bottom: bounds.Bottom + amount,
  };
}

function intersectsRectangle(body: GravityBody, obstacle: RectBounds | null): boolean {
  if (!obstacle) return false;
  const nearestX = Math.min(obstacle.Right, Math.max(obstacle.Left, body.X));
  const nearestY = Math.min(obstacle.Bottom, Math.max(obstacle.Top, body.Y));
  return Math.hypot(body.X - nearestX, body.Y - nearestY) < body.Radius;
}

function resolveRectangleCollision(body: GravityBody, obstacle: RectBounds | null, width: number, height: number, exits: ObstacleExit[], bouncedAxes: Set<CollisionAxis>, padding = EDGE_PADDING): boolean {
  if (!intersectsRectangle(body, obstacle) || !obstacle) return false;
  const minX = padding + body.Radius;
  const maxX = Math.max(minX, width - padding - body.Radius);
  const minY = padding + body.Radius;
  const maxY = Math.max(minY, height - padding - body.Radius);
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
  if (candidate.Exit === "Left") bounce(body, "X", -1, bouncedAxes);
  else if (candidate.Exit === "Right") bounce(body, "X", 1, bouncedAxes);
  else if (candidate.Exit === "Top") bounce(body, "Y", -1, bouncedAxes);
  else if (candidate.Exit === "Bottom") bounce(body, "Y", 1, bouncedAxes);
  return true;
}

function fitBodyAroundCover(body: GravityBody, width: number, height: number): void {
  const obstacle = coverBounds;
  if (!obstacle || obstacle.Right <= 0 || obstacle.Left >= width || obstacle.Bottom <= 0 || obstacle.Top >= height) {
    setBodyScale(body, 1);
    return;
  }
  const freeSpans = [
    Math.max(0, Math.min(width, obstacle.Left)),
    Math.max(0, width - Math.max(0, obstacle.Right)),
    Math.max(0, Math.min(height, obstacle.Top)),
    Math.max(0, height - Math.max(0, obstacle.Bottom)),
  ];
  const maximumRadius = Math.max(
    Math.min(freeSpans[0] / 2, height / 2),
    Math.min(freeSpans[1] / 2, height / 2),
    Math.min(freeSpans[2] / 2, width / 2),
    Math.min(freeSpans[3] / 2, width / 2),
  );
  setBodyScale(body, Math.min(1, maximumRadius / body.BaseRadius));
}

function resolveBodyConstraints(body: GravityBody, width: number, height: number): void {
  fitBodyAroundCover(body, width, height);
  const paddedCover = expandBounds(coverBounds, COVER_CLEARANCE);
  const paddedNowBarHeader = expandBounds(nowBarHeaderBounds, COVER_CLEARANCE);
  const paddedViewControls = expandBounds(viewControlsBounds, COVER_CLEARANCE);
  const bouncedAxes = new Set<CollisionAxis>();
  for (let pass = 0; pass < 4; pass += 1) {
    const clamped = constrainToStage(body, width, height, bouncedAxes);
    const coverResolved = resolveRectangleCollision(body, paddedCover, width, height, ["Left", "Right", "Top", "Bottom"], bouncedAxes);
    const nowBarHeaderResolved = resolveRectangleCollision(body, paddedNowBarHeader, width, height, ["Left", "Right", "Top", "Bottom"], bouncedAxes);
    const viewControlsResolved = resolveRectangleCollision(body, paddedViewControls, width, height, ["Left", "Right", "Top", "Bottom"], bouncedAxes);
    const footerResolved = resolveRectangleCollision(body, footerBounds, width, height, ["Left", "Right", "Top"], bouncedAxes);
    if (!clamped && !coverResolved && !nowBarHeaderResolved && !viewControlsResolved && !footerResolved) return;
  }
  if (!intersectsRectangle(body, coverBounds) && !intersectsRectangle(body, nowBarHeaderBounds) && !intersectsRectangle(body, viewControlsBounds)) {
    constrainToStage(body, width, height, bouncedAxes);
    return;
  }
  // Tight layouts may not fit both normal margins. Keep cover and viewport
  // hard boundaries, then use the scale selected from their largest free strip.
  for (let pass = 0; pass < 4; pass += 1) {
    const clamped = constrainToStage(body, width, height, bouncedAxes, 0);
    const coverResolved = resolveRectangleCollision(body, coverBounds, width, height, ["Left", "Right", "Top", "Bottom"], bouncedAxes, 0);
    const nowBarHeaderResolved = resolveRectangleCollision(body, nowBarHeaderBounds, width, height, ["Left", "Right", "Top", "Bottom"], bouncedAxes, 0);
    const viewControlsResolved = resolveRectangleCollision(body, viewControlsBounds, width, height, ["Left", "Right", "Top", "Bottom"], bouncedAxes, 0);
    const footerResolved = resolveRectangleCollision(body, footerBounds, width, height, ["Left", "Right", "Top"], bouncedAxes);
    if (!clamped && !coverResolved && !nowBarHeaderResolved && !viewControlsResolved && !footerResolved) break;
  }
  constrainToStage(body, width, height, bouncedAxes, 0);
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
      const scale = body.Scale;
      resolveBodyConstraints(body, stageBounds.Width, stageBounds.Height);
      if (body.X !== x || body.Y !== y || body.Scale !== scale) renderBody(body);
    }
    for (const body of exitingBodies) {
      if (!body.Spawned) continue;
      const x = body.X;
      const y = body.Y;
      const scale = body.Scale;
      resolveBodyConstraints(body, stageBounds.Width, stageBounds.Height);
      if (body.X !== x || body.Y !== y || body.Scale !== scale) renderBody(body);
    }
    if (performance.now() < coverTrackingUntil) coverTrackingFrame = requestAnimationFrame(updateCoverBounds);
    else coverTrackingFrame = null;
  };
  coverTrackingFrame = requestAnimationFrame(updateCoverBounds);
}

function getCjkSegmentationLocale(text: string): "ja" | "ko" | "zh" {
  if (/\p{Script=Hangul}/u.test(text)) return "ko";
  if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(text)) return "ja";
  return "zh";
}

function splitGraphemes(text: string): string[] {
  if (typeof Intl.Segmenter === "function") {
    return Array.from(
      new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text),
      ({ segment }) => segment
    );
  }
  return Array.from(text);
}

function getGravitySegments(text: string): string[] {
  if (!isCjkEntity(text)) return [text];
  const segments = typeof Intl.Segmenter === "function"
    ? Array.from(
        new Intl.Segmenter(getCjkSegmentationLocale(text), { granularity: "word" }).segment(text),
        ({ segment }) => segment
      )
    : [];
  return segments.filter((segment) => segment.trim()).length > 1 ? segments : splitGraphemes(text);
}

function hasAuthoredSyllableSplits(line: GravityLine): boolean {
  return (line.Syllables?.Lead.filter((syllable) => !syllable.Dot).length ?? 0) > 1;
}

function splitWordGroup(group: HTMLElement): HTMLElement[] {
  const parts = Array.from(group.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
  if (parts.length < 2) return [group];
  group.replaceWith(...parts);
  splitGroups.push({ Group: group, Entities: parts });
  return parts;
}

function getElementTiming(line: GravityLine, element: HTMLElement): { StartTime: number; EndTime: number } {
  const syllables = (line.Syllables?.Lead ?? [])
    .flatMap((syllable) => [syllable, ...(syllable.Letters ?? [])])
    .filter((syllable) =>
      syllable.HTMLElement === element ||
      syllable.HTMLElement.contains(element) ||
      element.contains(syllable.HTMLElement)
    );
  if (syllables.length === 0) return { StartTime: line.StartTime, EndTime: line.EndTime };
  return {
    StartTime: Math.min(...syllables.map((syllable) => syllable.StartTime)),
    EndTime: Math.max(...syllables.map((syllable) => syllable.EndTime)),
  };
}

function splitCjkElement(line: GravityLine, element: HTMLElement): HTMLElement[] {
  const segments = getGravitySegments(element.textContent ?? "");
  if (segments.length < 2) return [element];
  const letters = Array.from(element.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
  if (element.classList.contains("letterGroup") && letters.length > 0) {
    let letterIndex = 0;
    const entities = segments.map((segment) => {
      const entity = document.createElement("span");
      entity.classList.add("SpaceGravityEntity");
      const count = Math.max(1, splitGraphemes(segment).length);
      entity.append(...letters.slice(letterIndex, letterIndex + count));
      letterIndex += count;
      return entity;
    }).filter((entity) => entity.childNodes.length > 0);
    if (letterIndex < letters.length && entities.length > 0) entities.at(-1)!.append(...letters.slice(letterIndex));
    if (entities.length === 0) return [element];
    element.replaceWith(...entities);
    splitElements.push({ Original: element, Entities: entities, RestoreChildren: true });
    return entities;
  }
  const { StartTime, EndTime } = getElementTiming(line, element);
  const weights = segments.map((segment) => Math.max(1, splitGraphemes(segment).length));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let consumedWeight = 0;
  const entities = segments.map((segment, index) => {
    const entity = element.cloneNode(false) as HTMLElement;
    entity.textContent = segment;
    const startTime = StartTime + (EndTime - StartTime) * consumedWeight / totalWeight;
    consumedWeight += weights[index];
    const endTime = index === segments.length - 1
      ? EndTime
      : StartTime + (EndTime - StartTime) * consumedWeight / totalWeight;
    entity.dataset.spaceGravityStartTime = `${startTime}`;
    entity.dataset.spaceGravityEndTime = `${endTime}`;
    return entity;
  });
  element.replaceWith(...entities);
  splitElements.push({ Original: element, Entities: entities });
  return entities;
}

function getEntities(line: GravityLine): HTMLElement[] {
  const preserveAuthoredSplits = hasAuthoredSyllableSplits(line);
  return Array.from(line.HTMLElement.children)
    .filter((child): child is HTMLElement => child instanceof HTMLElement)
    .flatMap((child) => child.classList.contains("word-group") ? splitWordGroup(child) : [child])
    .flatMap((child) => preserveAuthoredSplits ? [child] : splitCjkElement(line, child));
}

function getEntityTexts(line: GravityLine): string[] {
  const preserveAuthoredSplits = hasAuthoredSyllableSplits(line);
  const children = Array.from(line.HTMLElement.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
  const texts = children.flatMap((child) => {
    if (!child.classList.contains("word-group")) {
      const text = child.textContent ?? "";
      return preserveAuthoredSplits ? [text] : getGravitySegments(text);
    }
    const parts = Array.from(child.children).filter((part): part is HTMLElement => part instanceof HTMLElement);
    if (preserveAuthoredSplits) return parts.length < 2 ? [child.textContent ?? ""] : parts.map((part) => part.textContent ?? "");
    return parts.length < 2
      ? getGravitySegments(child.textContent ?? "")
      : parts.flatMap((part) => getGravitySegments(part.textContent ?? ""));
  });
  return texts.length > 0 ? texts : [""];
}

function isCjkEntity(text: string): boolean {
  return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(text);
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

  const lineSpeedMultipliers = new Map<GravityLine, number>();
  for (const line of nextLines) {
    lineSpeedMultipliers.set(line, getWpmSpeedMultiplier(getLineWordsPerMinute(line)));
  }

  let order = 0;
  for (const { Record: record, Element: bodyElement } of wrappers) {
    const splitStartTime = Number(record.Child.dataset.spaceGravityStartTime);
    const splitEndTime = Number(record.Child.dataset.spaceGravityEndTime);
    const timing = getElementTiming(record.Line, record.Child);
    const startTime = Number.isFinite(splitStartTime) ? splitStartTime : timing.StartTime;
    const endTime = Number.isFinite(splitEndTime) ? splitEndTime : timing.EndTime;
    if (!record.Line.DotLine) bodyElement.dataset.spaceGravitySeekTime = `${startTime}`;
    const seed = hash(`${record.Line.StartTime}:${record.Line.EndTime}:${record.Child.textContent ?? ""}:${record.Index}`);
    const speedMultiplier = lineSpeedMultipliers.get(record.Line) ?? 1;
    const speed = (4.4 + random(seed + 3) * 5.6) * speedMultiplier;
    const direction = random(seed + 4) * Math.PI * 2;
    const body: GravityBody = { Element: bodyElement, Line: record.Line, StartTime: startTime, EndTime: endTime, Order: order++, WordIndex: (leadWordStarts.get(record.Line) ?? 0) + record.Index, X: 0, Y: 0, VX: Math.cos(direction) * speed, VY: Math.sin(direction) * speed, SpeedMultiplier: speedMultiplier, Angle: 0, AngularVelocity: (random(seed + 2) * 2 - 1) * 19, BounceCount: 0, Radius: 24, BaseRadius: 24, Scale: 1, Width: 48, Height: 48, StartX: record.X, StartY: record.Y, NaturalX: 0, NaturalY: 0, SelectionEpoch: 0, Spawned: false, Visible: false };
    measureBody(body);
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

function getRole(body: GravityBody, position: number): GravityRole {
  if (body.Line.DotLine) return "Instrumental";
  if (position >= finalVocalEnd) return "Previous";
  if (body.Line.BGLine) {
    if (position < body.StartTime) return "Next";
    if (position < body.EndTime) return "Current";
    return "Previous";
  }
  if (position >= body.Line.StartTime && position < body.Line.EndTime) return "Current";
  if (position < body.Line.StartTime) return "Next";
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

function getStageOverlapArea(bounds: RectBounds | null, width: number, height: number): number {
  if (!bounds) return 0;
  const overlapWidth = Math.max(0, Math.min(width, bounds.Right) - Math.max(0, bounds.Left));
  const overlapHeight = Math.max(0, Math.min(height, bounds.Bottom) - Math.max(0, bounds.Top));
  return overlapWidth * overlapHeight;
}

function calculateVisibleLeadWordCount(width: number, height: number): number {
  const occupiedArea =
    getStageOverlapArea(coverBounds, width, height) +
    getStageOverlapArea(footerBounds, width, height);
  const availableArea = Math.max(0, width * height - occupiedArea);
  return Math.min(
    MAX_VISIBLE_LEAD_WORDS,
    Math.max(MIN_VISIBLE_LEAD_WORDS, Math.ceil(availableArea / VISIBLE_WORD_AREA))
  );
}

function getLeadWordRange(anchor: number): { First: number; Last: number } | undefined {
  const total = Array.from(leadWordCounts.values()).reduce((sum, count) => sum + count, 0);
  if (total === 0 || Number.isNaN(anchor)) return undefined;
  const count = Math.min(visibleLeadWordCount, total);
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
  if (anchorLine) selectedParents.add(anchorLine);
  const entering = Array.from(selectedParents).filter((line) => !preparedLines.has(line));
  for (const parent of selectedParents) for (const line of backgroundLinesByParent.get(parent) ?? []) if (!preparedLines.has(line)) entering.push(line);
  if (activeDotLine && !preparedLines.has(activeDotLine)) entering.push(activeDotLine);
  prepareLines(entering);
  const nextBodies: GravityBody[] = [];
  const nextLines = new Set<GravityLine>();
  if (wordRange) for (const line of leadWindow) nextBodies.push(...(bodiesByLine.get(line) ?? []).filter((body) =>
    line === anchorLine || (body.WordIndex >= wordRange.First && body.WordIndex <= wordRange.Last)
  ));
  if (anchorLine && !leadWindow.includes(anchorLine)) nextBodies.push(...(bodiesByLine.get(anchorLine) ?? []));
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
    applyBodyRole(body, getRole(body, position));
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
  for (const body of activeBodies) applyBodyRole(body, getRole(body, position));
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
  for (let index = 0; index < activeBodies.length; index += 1) for (let otherIndex = 0; otherIndex < index; otherIndex += 1) {
    const body = activeBodies[index];
    const other = activeBodies[otherIndex];
    const dx = body.X - other.X;
    const dy = body.Y - other.Y;
    const distance = Math.hypot(dx, dy) || 0.001;
    const influence = body.Radius + other.Radius + SOFT_SEPARATION_GAP;
    if (distance >= influence) continue;
    const nudge = ((influence - distance) / influence) * SOFT_SEPARATION_ACCELERATION * delta;
    body.VX += dx / distance * nudge;
    body.VY += dy / distance * nudge;
    other.VX -= dx / distance * nudge;
    other.VY -= dy / distance * nudge;
  }
}

export function mountSpaceGravity(nextStage: HTMLElement, nextLines: GravityLine[], nextViewport: HTMLElement, nextFooter: HTMLElement): void {
  destroySpaceGravity();
  stage = nextStage;
  viewport = nextViewport;
  footer = nextFooter;
  lines = nextLines;
  // A Gravity rebuild (for example after romanization changes) restores the
  // previously visible lines before mounting again. Remove that normal-flow
  // DOM now; prepareLines reattaches only the selected floating bodies.
  for (const line of lines) line.HTMLElement.remove();
  finalVocalEnd = lines
    .filter((line) => !line.DotLine)
    .reduce((end, line) => Math.max(end, ...(line.Syllables?.Lead.filter((word) => !word.Dot).map((word) => word.EndTime) ?? [line.EndTime])), Number.NEGATIVE_INFINITY);
  leadLines = lines.filter((line) => !line.BGLine && !line.DotLine);
  let wordStart = 0;
  for (const [index, line] of leadLines.entries()) {
    leadLineIndexes.set(line, index);
    leadWordStarts.set(line, wordStart);
    const entityTexts = getEntityTexts(line);
    const count = entityTexts.length;
    leadWordCounts.set(line, count);
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
  windowPositionDocument = nextStage.ownerDocument;
  windowPositionVisibilityListener = () => resetWindowMotion();
  windowPositionDocument.addEventListener("visibilitychange", windowPositionVisibilityListener);
  resizeObserver = new ResizeObserver(() => updateBounds());
  resizeObserver.observe(nextStage);
  resizeObserver.observe(nextViewport);
  resizeObserver.observe(nextFooter);
  updateBounds();
  resetWindowMotion();
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
  if (!stage || !viewport || !stageBounds) return;
  if (stage.clientWidth !== stageBounds.Width || viewport.clientHeight !== stageBounds.Height) updateBounds();
  else syncObstacleBounds();
  renderFrame += 1;
  updateVisibleBodies(position);
  updateBodyRoles(position);
  for (const body of activeBodies) spawnBody(body, stageBounds.Width, stageBounds.Height);
  const now = performance.now();
  settleBodyPresence(now);
  const delta = Math.min(0.05, Math.max(0, (now - lastTick) / 1000));
  lastTick = now;
  for (const body of activeBodies) recoverInvalidBodyMotion(body);
  applyWindowGravity(delta);
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
    const maxSpeed = MAX_SPEED * body.SpeedMultiplier;
    if (speed > maxSpeed) {
      const drag = Math.exp(-HIGH_SPEED_DRAG * delta);
      const nextSpeed = maxSpeed + (speed - maxSpeed) * drag;
      body.VX = body.VX / speed * nextSpeed;
      body.VY = body.VY / speed * nextSpeed;
    }
    body.VY -= UPWARD_ACCELERATION * Math.max(0, (body.Y / stageBounds.Height - 0.45) / 0.55) * delta;
    body.X += body.VX * delta;
    body.Y += body.VY * delta;
    body.AngularVelocity *= Math.exp(-ANGULAR_DAMPING * delta);
    body.Angle = ((body.Angle + body.AngularVelocity * delta + 180) % 360 + 360) % 360 - 180;
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

  for (const { Original, Entities, RestoreChildren } of splitElements) {
    const first = Entities[0];
    if (!first?.parentElement) continue;
    if (RestoreChildren) {
      first.before(Original);
      Original.replaceChildren(...Entities.flatMap((entity) => Array.from(entity.childNodes)));
      for (const entity of Entities) entity.remove();
    } else {
      first.replaceWith(Original);
      for (const entity of Entities.slice(1)) entity.remove();
    }
  }

  for (const { Group, Entities } of splitGroups) {
    const first = Entities[0];
    if (!first?.parentElement) continue;
    first.before(Group);
    Group.replaceChildren(...Entities);
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
  if (windowPositionDocument && windowPositionVisibilityListener) {
    windowPositionDocument.removeEventListener("visibilitychange", windowPositionVisibilityListener);
  }
  windowPositionDocument = null;
  windowPositionVisibilityListener = null;
  if (coverTrackingFrame !== null) cancelAnimationFrame(coverTrackingFrame);
  for (const [line, timer] of pendingLineRemovals) line.HTMLElement.ownerDocument.defaultView?.clearTimeout(timer);
  pendingLineRemovals = new Map();
  coverTrackingFrame = null;
  coverTrackingUntil = 0;
  stage = null;
  viewport = null;
  footer = null;
  cover = null;
  nowBarHeader = null;
  viewControls = null;
  lines = [];
  bodiesByLine = new Map();
  leadLines = [];
  lineLayouts = new Map();
  splitGroups = [];
  splitElements = [];
  parentLines = new Map();
  backgroundLinesByParent = new Map();
  dotLines = [];
  leadLineIndexes = new Map();
  leadWordStarts = new Map();
  leadWordCounts = new Map();
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
  visibleLeadWordCount = MIN_VISIBLE_LEAD_WORDS;
  stageBounds = null;
  footerBounds = null;
  coverBounds = null;
  nowBarHeaderBounds = null;
  viewControlsBounds = null;
  windowPosition = null;
  windowVelocity = { X: 0, Y: 0 };
  lastTick = performance.now();
  renderFrame = 0;
}
