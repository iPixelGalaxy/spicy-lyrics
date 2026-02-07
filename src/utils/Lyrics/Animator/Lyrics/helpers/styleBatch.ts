// Cache last written style values to avoid redundant DOM writes
const _styleCache = new WeakMap<HTMLElement, Map<string, string>>();
// Queue for batched style writes
const _styleQueue = new Map<HTMLElement, Map<string, string>>();

export function queueStyle(el: HTMLElement, prop: string, value: string): void {
  let props = _styleQueue.get(el);
  if (!props) {
    props = new Map<string, string>();
    _styleQueue.set(el, props);
  }
  props.set(prop, value);
}

export function setStyleIfChanged(el: HTMLElement, prop: string, value: string, epsilon = 0): void {
  let map = _styleCache.get(el);
  if (!map) {
    map = new Map();
    _styleCache.set(el, map);
  }
  const prev = map.get(prop);
  if (prev !== undefined) {
    // Try numeric comparison when possible
    const parseNum = (v: string) => {
      // Extract numeric portion (supports "12px", "45%", "1.2")
      const n = parseFloat(v);
      return Number.isNaN(n) ? null : n;
    };
    const a = parseNum(prev);
    const b = parseNum(value);
    if (a !== null && b !== null) {
      if (Math.abs(a - b) <= epsilon) return; // Skip tiny changes
    } else {
      if (prev === value) return; // Exact match for non-numeric values
    }
  }
  queueStyle(el, prop, value);
  map.set(prop, value);
}

export function flushStyleBatch(): void {
  if (_styleQueue.size === 0) return;
  for (const [el, props] of _styleQueue) {
    for (const [prop, value] of props) {
      el.style.setProperty(prop, value);
    }
  }
  _styleQueue.clear();
}
