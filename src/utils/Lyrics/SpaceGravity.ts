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
};

const EDGE_PADDING = 18;
const MAX_SPEED = 80;
const REPEL_RADIUS = 180;
const REPEL_STRENGTH = 9200;

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
      const angle = random(seed + 5) * 360;
      const speed = 22 + random(seed + 3) * 28;
      const direction = random(seed + 4) * Math.PI * 2;
      const body: GravityBody = {
        Element: element,
        Line: line,
        X: EDGE_PADDING + random(seed) * Math.max(1, size.Width - EDGE_PADDING * 2),
        Y: EDGE_PADDING + random(seed + 1) * Math.max(1, size.Height - EDGE_PADDING * 2),
        VX: Math.cos(direction) * speed,
        VY: Math.sin(direction) * speed,
        Angle: angle,
        AngularVelocity: (random(seed + 2) * 2 - 1) * 95,
        Radius: 24,
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

  if (reducedMotion) return;

  for (let left = 0; left < activeBodies.length; left += 1) {
    const a = activeBodies[left];
    for (let right = left + 1; right < activeBodies.length; right += 1) {
      const b = activeBodies[right];
      const dx = b.X - a.X;
      const dy = b.Y - a.Y;
      const distance = Math.hypot(dx, dy) || 0.001;
      if (distance >= REPEL_RADIUS) continue;
      const force = ((REPEL_RADIUS - distance) / REPEL_RADIUS) * REPEL_STRENGTH * delta;
      const nx = dx / distance;
      const ny = dy / distance;
      a.VX -= nx * force;
      a.VY -= ny * force;
      b.VX += nx * force;
      b.VY += ny * force;
    }
  }

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
