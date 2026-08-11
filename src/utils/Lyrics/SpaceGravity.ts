type GravityLine = {
  HTMLElement: HTMLElement;
  StartTime: number;
  EndTime: number;
  DotLine?: boolean;
  BGLine?: boolean;
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
  StartX: number;
  StartY: number;
  Spawned: boolean;
};

const EDGE_PADDING = 18;
const MAX_SPEED = 16;

let stage: HTMLElement | null = null;
let lines: GravityLine[] = [];
let bodies: GravityBody[] = [];
let resizeObserver: ResizeObserver | null = null;
let viewport: HTMLElement | null = null;
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

function bounds(): { Width: number; Height: number } | null {
  if (!stage) return null;
  const rect = stage.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return null;
  return { Width: rect.width, Height: rect.height };
}

function clampBody(body: GravityBody, width: number, height: number): void {
  const minX = EDGE_PADDING + body.Radius;
  const maxX = Math.max(minX, width - EDGE_PADDING - body.Radius);
  const minY = EDGE_PADDING + body.Radius;
  const maxY = Math.max(minY, height - EDGE_PADDING - body.Radius);
  body.X = Math.min(maxX, Math.max(minX, body.X));
  body.Y = Math.min(maxY, Math.max(minY, body.Y));
}

function renderBody(body: GravityBody): void {
  body.Element.style.translate = `${body.X}px ${body.Y}px`;
  body.Element.style.rotate = `${body.Angle}deg`;
}

function refreshBounds(): void {
  const size = bounds();
  if (!size) return;
  for (const body of bodies) {
    const rect = body.Element.getBoundingClientRect();
    body.Radius = Math.max(14, Math.max(rect.width, rect.height) / 2);
    if (!body.Spawned) continue;
    clampBody(body, size.Width, size.Height);
    renderBody(body);
  }
}

function syncStageHeight(): void {
  if (!stage || !viewport) return;
  const height = viewport.clientHeight;
  if (height > 0) stage.style.height = `${height}px`;
}

function setVisibleLines(position: number): Set<GravityLine> {
  const visible = new Set<GravityLine>();
  const leadLines = lines.filter((line) => !line.DotLine && !line.BGLine);
  const activeLead = leadLines.find((line) => position >= line.StartTime && position < line.EndTime);
  const nextLead = leadLines.find((line) => line.StartTime > position);

  if (activeLead) visible.add(activeLead);
  if (nextLead) visible.add(nextLead);

  for (const line of lines) {
    const active = position >= line.StartTime && position < line.EndTime;
    if (active && line.BGLine) visible.add(line);
    line.HTMLElement.classList.toggle("SpaceGravityCurrent", active && !line.DotLine);
    line.HTMLElement.classList.toggle("SpaceGravityNext", line === nextLead && line !== activeLead);
    line.HTMLElement.classList.toggle("SpaceGravityDot", active && Boolean(line.DotLine));
    line.HTMLElement.classList.toggle(
      "SpaceGravityHidden",
      !visible.has(line) && !(active && Boolean(line.DotLine))
    );
  }

  return visible;
}

function spawnBody(body: GravityBody, role: "Current" | "Next" | "Background", width: number, height: number): void {
  if (body.Spawned) return;
  const lineY = role === "Current" ? height * 0.43 : role === "Next" ? height * 0.61 : height * 0.56;
  body.X = body.StartX;
  body.Y = lineY + body.StartY;
  body.Angle = 0;
  clampBody(body, width, height);
  body.Spawned = true;
  renderBody(body);
}

export function mountSpaceGravity(
  nextStage: HTMLElement,
  nextLines: GravityLine[],
  nextViewport: HTMLElement
): void {
  destroySpaceGravity();
  stage = nextStage;
  viewport = nextViewport;
  lines = nextLines;
  updateReducedMotion();
  syncStageHeight();

  const size = bounds();
  if (!size) return;

  let index = 0;
  for (const line of lines) {
    if (line.DotLine) continue;
    const elements = Array.from(line.HTMLElement.children).filter(
      (element): element is HTMLElement => element.nodeType === 1 && element.classList.contains("SpaceGravityWord")
    );
    for (const element of elements) {
      const seed = hash(`${line.StartTime}:${line.EndTime}:${element.textContent ?? ""}:${index}`);
      const speed = 4.4 + random(seed + 3) * 5.6;
      const direction = random(seed + 4) * Math.PI * 2;
      const body: GravityBody = {
        Element: element,
        Line: line,
        X: 0,
        Y: 0,
        VX: Math.cos(direction) * speed,
        VY: Math.sin(direction) * speed,
        Angle: 0,
        AngularVelocity: (random(seed + 2) * 2 - 1) * 19,
        Radius: 24,
        StartX: Number(element.dataset.spaceGravityX ?? 0),
        StartY: Number(element.dataset.spaceGravityY ?? 0),
        Spawned: false,
      };
      bodies.push(body);
      index += 1;
    }
  }

  requestAnimationFrame(() => refreshBounds());
  resizeObserver = new ResizeObserver(() => {
    syncStageHeight();
    refreshBounds();
  });
  resizeObserver.observe(nextStage);
  resizeObserver.observe(nextViewport);
}

export function tickSpaceGravity(position: number): void {
  if (!stage || !bodies.length) return;
  const size = bounds();
  if (!size) return;

  const now = performance.now();
  const delta = Math.min(0.05, Math.max(0, (now - lastTick) / 1000));
  lastTick = now;
  const visibleLines = setVisibleLines(position);
  const activeBodies = bodies.filter((body) => visibleLines.has(body.Line));

  for (const body of activeBodies) {
    const role = body.Line.BGLine
      ? "Background"
      : body.Line.HTMLElement.classList.contains("SpaceGravityCurrent")
        ? "Current"
        : "Next";
    spawnBody(body, role, size.Width, size.Height);
  }

  if (reducedMotion) return;

  for (const body of activeBodies) {
    const speed = Math.hypot(body.VX, body.VY);
    if (speed > MAX_SPEED) {
      body.VX = (body.VX / speed) * MAX_SPEED;
      body.VY = (body.VY / speed) * MAX_SPEED;
    }

    body.X += body.VX * delta;
    body.Y += body.VY * delta;
    body.Angle += body.AngularVelocity * delta;

    const minX = EDGE_PADDING + body.Radius;
    const maxX = Math.max(minX, size.Width - EDGE_PADDING - body.Radius);
    const minY = EDGE_PADDING + body.Radius;
    const maxY = Math.max(minY, size.Height - EDGE_PADDING - body.Radius);
    if (body.X <= minX || body.X >= maxX) body.VX *= -1;
    if (body.Y <= minY || body.Y >= maxY) body.VY *= -1;
    clampBody(body, size.Width, size.Height);
    renderBody(body);
  }
}

export function destroySpaceGravity(): void {
  resizeObserver?.disconnect();
  resizeObserver = null;
  stage = null;
  viewport = null;
  lines = [];
  bodies = [];
  lastTick = performance.now();
}
