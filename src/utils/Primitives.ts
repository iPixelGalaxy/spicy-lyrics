/**
 * Inlined implementations of @socali/modules (Maid, Scheduler, Signal, Spring).
 * Original source: https://github.com/surfbryce/web-modules (archived)
 */

// ─── FreeArray ───────────────────────────────────────────────────────────────
// Internal utility used by Signal and Maid.

let _uid = 0;
function GetUniqueId(): string {
  return `${++_uid}-${Math.random().toString(36).slice(2)}`;
}

class FreeArray<I> {
  private Items: Map<string, I> = new Map();

  Push(item: I): string {
    const key = GetUniqueId();
    this.Items.set(key, item);
    return key;
  }

  Remove(key: string): I | undefined {
    const item = this.Items.get(key);
    this.Items.delete(key);
    return item;
  }

  GetIterator(): IterableIterator<[string, I]> {
    return this.Items.entries();
  }
}

// ─── Signal ──────────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
type Callback = (...args: any[]) => void;
type DefaultCallback = () => void;
export type CallbackDefinition = Callback;

type SignalConnectionReferences = FreeArray<{ Callback: Callback; Connection: Connection }>;

export class Connection {
  private Refs: SignalConnectionReferences;
  private Key: string;
  private Disconnected = false;

  constructor(refs: SignalConnectionReferences, callback: Callback) {
    this.Refs = refs;
    this.Key = refs.Push({ Callback: callback, Connection: this });
  }

  Disconnect() {
    if (this.Disconnected) return;
    this.Disconnected = true;
    this.Refs.Remove(this.Key);
  }

  IsDisconnected() {
    return this.Disconnected;
  }
}

export class Event<P extends Callback = DefaultCallback> {
  private Sig: Signal<P>;
  constructor(signal: Signal<P>) {
    this.Sig = signal;
  }
  Connect(callback: P): Connection {
    return this.Sig.Connect(callback);
  }
  IsDestroyed() {
    return this.Sig.IsDestroyed();
  }
}

export class Signal<P extends Callback = DefaultCallback> {
  private Refs: SignalConnectionReferences = new FreeArray();
  private DestroyedState = false;

  Connect(callback: P): Connection {
    if (this.DestroyedState) throw new Error("Cannot connect to a Destroyed Signal");
    return new Connection(this.Refs, callback);
  }

  Fire(...args: Parameters<P>) {
    if (this.DestroyedState) throw new Error("Cannot fire a Destroyed Signal");
    for (const [, ref] of this.Refs.GetIterator()) {
      ref.Callback(...args);
    }
  }

  GetEvent(): Event<P> {
    return new Event(this);
  }

  IsDestroyed() {
    return this.DestroyedState;
  }

  Destroy() {
    if (this.DestroyedState) return;
    for (const [, ref] of this.Refs.GetIterator()) {
      ref.Connection.Disconnect();
    }
    this.DestroyedState = true;
  }
}

export const IsConnection = (value: unknown): value is Connection => value instanceof Connection;

// ─── Scheduler ───────────────────────────────────────────────────────────────

// [type, id, cancelled?]  type: 0=timeout, 1=interval, 2=animFrame
export type Scheduled = [0 | 1 | 2, number, true?];

export const Cancel = (scheduled: Scheduled) => {
  if (scheduled[2]) return;
  scheduled[2] = true;
  switch (scheduled[0]) {
    case 0: globalThis.clearTimeout(scheduled[1]); break;
    case 1: globalThis.clearInterval(scheduled[1]); break;
    case 2: globalThis.cancelAnimationFrame(scheduled[1]); break;
  }
};

export const IsScheduled = (value: unknown): value is Scheduled =>
  Array.isArray(value) &&
  (value.length === 2 || value.length === 3) &&
  typeof value[0] === "number" &&
  typeof value[1] === "number" &&
  (value[2] === undefined || value[2] === true);

export const Timeout = (seconds: number, callback: Callback): Scheduled =>
  [0, setTimeout(callback, seconds * 1000)];

export const Interval = (everySeconds: number, callback: Callback): Scheduled =>
  [1, setInterval(callback, everySeconds * 1000)];

export const OnPreRender = (callback: Callback): Scheduled =>
  [2, requestAnimationFrame(callback)];

export const Defer = (callback: Callback): Scheduled => {
  const scheduled: Scheduled = [2, 0];
  scheduled[1] = requestAnimationFrame(() => {
    scheduled[0] = 0;
    scheduled[1] = setTimeout(callback, 0);
  });
  return scheduled;
};

// ─── Maid ────────────────────────────────────────────────────────────────────

type MaidItem =
  | Giveable
  | Scheduled
  | MutationObserver
  | ResizeObserver
  | Element
  | Signal<CallbackDefinition>
  | Connection
  | (() => void);

export type GiveableItem = MaidItem;

export abstract class Giveable {
  abstract Destroy(): void;
}

const IsGiveable = (item: object): item is Giveable => "Destroy" in item;

export class Maid extends Giveable {
  private Items: Map<unknown, MaidItem> = new Map();
  private DestroyedState = false;

  private DestroyingSignal = new Signal<() => void>();
  private CleanedSignal = new Signal<() => void>();
  private DestroyedSignal = new Signal<() => void>();

  public Destroying = this.DestroyingSignal.GetEvent();
  public Cleaned = this.CleanedSignal.GetEvent();
  public Destroyed = this.DestroyedSignal.GetEvent();

  private CleanItem(item: MaidItem) {
    if (IsGiveable(item)) {
      item.Destroy();
    } else if (IsScheduled(item)) {
      Cancel(item);
    } else if (item instanceof MutationObserver || item instanceof ResizeObserver) {
      item.disconnect();
    } else if (IsConnection(item)) {
      item.Disconnect();
    } else if (item instanceof Element) {
      item.remove();
    } else if (typeof item === "function") {
      item();
    } else {
      console.warn("UNSUPPORTED MAID ITEM", typeof item, item);
    }
  }

  Give<T extends MaidItem>(item: T, key?: unknown): T {
    if (this.DestroyedState) {
      this.CleanItem(item);
      return item;
    }
    const finalKey = key ?? GetUniqueId();
    if (this.Has(finalKey)) this.Clean(finalKey);
    this.Items.set(finalKey, item);
    return item;
  }

  GiveItems<T extends MaidItem[]>(...args: T): T {
    for (const item of args) this.Give(item);
    return args;
  }

  Get<T extends MaidItem>(key: unknown): T | undefined {
    return this.DestroyedState ? undefined : (this.Items.get(key) as T);
  }

  Has(key: unknown): boolean {
    return this.DestroyedState ? false : this.Items.has(key);
  }

  Clean(key: unknown) {
    if (this.DestroyedState) return;
    const item = this.Items.get(key);
    if (item !== undefined) {
      this.Items.delete(key);
      this.CleanItem(item);
    }
  }

  CleanUp() {
    if (this.DestroyedState) return;
    for (const [key] of this.Items) this.Clean(key);
    if (!this.DestroyedState) this.CleanedSignal.Fire();
  }

  IsDestroyed() {
    return this.DestroyedState;
  }

  Destroy() {
    if (this.DestroyedState) return;
    this.DestroyingSignal.Fire();
    this.CleanUp();
    this.DestroyedState = true;
    this.DestroyedSignal.Fire();
    this.DestroyingSignal.Destroy();
    this.CleanedSignal.Destroy();
    this.DestroyedSignal.Destroy();
  }
}

// ─── Whentil ─────────────────────────────────────────────────────────────────
// Inlined from @spikerko/tools/Whentil

export type CancelableTask = {
  Cancel: () => void;
  Reset: () => void;
};

function _Until<T>(
  statement: T | (() => T),
  callback: () => void,
  maxRepeats: number = Infinity
): CancelableTask {
  let isCancelled = false;
  let hasReset = false;
  let executedCount = 0;
  const resolveStatement = (): T => (typeof statement === "function" ? (statement as () => T)() : statement);
  const runner = () => {
    if (isCancelled || executedCount >= maxRepeats) return;
    const conditionMet = resolveStatement();
    if (!conditionMet) {
      callback();
      executedCount++;
      setTimeout(runner, 0);
    }
  };
  setTimeout(runner, 0);
  return {
    Cancel() { isCancelled = true; },
    Reset() {
      if (executedCount >= maxRepeats || isCancelled) {
        isCancelled = false;
        hasReset = true;
        executedCount = 0;
        runner();
      }
    },
  };
}

function _When<T>(
  statement: T | (() => T),
  callback: (statement: T) => void,
  repeater: number = 1
): CancelableTask {
  let isCancelled = false;
  let hasReset = false;
  let executionsRemaining = repeater;
  const resolveStatement = (): T => (typeof statement === "function" ? (statement as () => T)() : statement);
  const runner = () => {
    if (isCancelled || executionsRemaining <= 0) return;
    try {
      const conditionMet = resolveStatement();
      if (conditionMet) {
        callback(resolveStatement());
        executionsRemaining--;
        if (executionsRemaining > 0) setTimeout(runner, 0);
      } else {
        setTimeout(runner, 0);
      }
    } catch {
      setTimeout(runner, 0);
    }
  };
  setTimeout(runner, 0);
  return {
    Cancel() { isCancelled = true; },
    Reset() {
      if (executionsRemaining <= 0 || isCancelled) {
        isCancelled = false;
        hasReset = true;
        executionsRemaining = repeater;
        runner();
      }
    },
  };
}

const Whentil = { When: _When, Until: _Until };
export default Whentil;

// ─── Cache / ExpireStore ──────────────────────────────────────────────────────
// Inlined from @spikerko/tools/Cache

export type ExpirationSettings = {
  Duration: number;
  Unit: "Weeks" | "Months" | "Days" | "Hours" | "Minutes" | "Seconds";
};

export type ExpireStoreInterface<ItemType> = {
  GetItem: (itemName: string) => Promise<ItemType | undefined>;
  SetItem: (itemName: string, content: ItemType) => Promise<ItemType>;
  RemoveItem: (itemName: string) => Promise<void>;
  Destroy: () => Promise<void>;
};

type _ExpireItem<C> = {
  ExpiresAt: number;
  CacheVersion: number;
  Content: C;
};

const _RetrievedExpireStores: Set<string> = new Set();

const _GetFromCacheAPI = async <C>(storeName: string, itemName: string): Promise<C | undefined> => {
  const cache = await caches.open(storeName);
  const response = await cache.match(`/${itemName}`);
  return response ? (response.json() as Promise<C>) : undefined;
};

const _UpdateCacheAPI = (storeName: string, itemName: string, content: unknown): Promise<void> =>
  caches.open(storeName)
    .then(cache =>
      cache.put(
        `/${itemName}`,
        new Response(JSON.stringify(content), { headers: { "Content-Type": "application/json" } })
      )
    )
    .catch(error => {
      console.warn(`Failed to Update Cache API (${storeName}/${itemName})`);
      console.error(error);
    });

export const GetExpireStore = <ItemType>(
  storeName: string,
  version: number,
  itemExpirationSettings: ExpirationSettings,
  forceNewData?: true
): Readonly<ExpireStoreInterface<ItemType>> => {
  if (_RetrievedExpireStores.has(storeName)) {
    throw new Error(`Can't retrieve ExpireStore (${storeName}) twice.`);
  }
  _RetrievedExpireStores.add(storeName);

  return Object.freeze({
    GetItem: (itemName: string) => {
      if (forceNewData) return Promise.resolve(undefined);
      return _GetFromCacheAPI<_ExpireItem<ItemType>>(storeName, itemName).then(expireItem => {
        if (!expireItem || expireItem.CacheVersion !== version || expireItem.ExpiresAt < Date.now()) {
          return undefined;
        }
        return expireItem.Content;
      });
    },
    SetItem: (itemName: string, content: ItemType) => {
      const expireAtDate = new Date();
      switch (itemExpirationSettings.Unit) {
        case "Weeks":
          expireAtDate.setHours(0, 0, 0, 0);
          expireAtDate.setDate(expireAtDate.getDate() + itemExpirationSettings.Duration * 7);
          break;
        case "Months":
          expireAtDate.setHours(0, 0, 0, 0);
          expireAtDate.setMonth(expireAtDate.getMonth() + itemExpirationSettings.Duration);
          expireAtDate.setDate(0);
          break;
        case "Days":
          expireAtDate.setHours(0, 0, 0, 0);
          expireAtDate.setDate(expireAtDate.getDate() + itemExpirationSettings.Duration);
          break;
        case "Hours":
          expireAtDate.setTime(expireAtDate.getTime() + itemExpirationSettings.Duration * 60 * 60 * 1000);
          break;
        case "Minutes":
          expireAtDate.setTime(expireAtDate.getTime() + itemExpirationSettings.Duration * 60 * 1000);
          break;
        case "Seconds":
          expireAtDate.setTime(expireAtDate.getTime() + itemExpirationSettings.Duration * 1000);
          break;
      }
      const expireItem: _ExpireItem<ItemType> = {
        ExpiresAt: expireAtDate.getTime(),
        CacheVersion: version,
        Content: content,
      };
      return _UpdateCacheAPI(storeName, itemName, expireItem).then(() => content as ItemType);
    },
    RemoveItem: (itemName: string) =>
      caches.open(storeName)
        .then(cache => cache.delete(`/${itemName}`))
        .then(wasDeleted => {
          if (!wasDeleted) console.warn(`Item '${itemName}' not found in cache store '${storeName}'.`);
        })
        .catch(error => {
          console.error(`Error removing item '${itemName}' from cache store '${storeName}':`, error);
          throw error;
        }),
    Destroy: () =>
      caches.delete(storeName).then(deleted => {
        if (!deleted) console.warn(`Cache store '${storeName}' could not be deleted or did not exist.`);
        _RetrievedExpireStores.delete(storeName);
      }).catch(error => {
        console.error(`Error destroying cache store '${storeName}':`, error);
        throw error;
      }),
  });
};

// ─── Spring ──────────────────────────────────────────────────────────────────
// Credits: https://github.com/Fraktality/spr/blob/master/spr.lua

const pi = Math.PI;
const tau = pi * 2;
const exp = Math.exp;
const sin = Math.sin;
const cos = Math.cos;
const sqrt = Math.sqrt;

const SLEEP_OFFSET_SQ_LIMIT = (1 / 3840) ** 2;
const SLEEP_VELOCITY_SQ_LIMIT = 1e-2 ** 2;
const EPS = 1e-5;

export class Spring {
  private DampingRatio: number;
  private Frequency: number;
  private Goal: number;
  private Position: number;
  private Velocity: number;

  constructor(
    startPosition: number,
    frequency: number,
    dampingRatio: number,
    goal: number = startPosition
  ) {
    if (frequency * dampingRatio < 0) throw new Error("Spring will not converge");
    this.DampingRatio = dampingRatio;
    this.Frequency = frequency;
    this.Goal = goal;
    this.Position = startPosition;
    this.Velocity = 0;
  }

  Step(deltaTime: number): number {
    const d = this.DampingRatio;
    const f = this.Frequency * tau;
    const goal = this.Goal;
    const pos = this.Position;
    const vel = this.Velocity;

    if (d === 1) {
      // Critically damped
      const q = exp(-f * deltaTime);
      const w = deltaTime * q;
      const wf = w * f;
      const gd = pos - goal;
      const newPos = gd * (q + wf) + vel * w + goal;
      const newVel = vel * (q - wf) - gd * (w * f * f);
      this.Position = newPos;
      this.Velocity = newVel;
      return newPos;
    } else if (d < 1) {
      // Underdamped
      const fdt = f * deltaTime;
      const q = exp(-d * fdt);
      const c = sqrt(1 - d * d);
      const cfdt = c * fdt;
      const i = cos(cfdt);
      const j = sin(cfdt);

      let z: number;
      if (c > EPS) {
        z = j / c;
      } else {
        const cSq = c * c;
        z = fdt + (((fdt * fdt * cSq * cSq) / 20 - cSq) * (fdt * fdt * fdt)) / 6;
      }

      const cf = f * c;
      let y: number;
      if (cf > EPS) {
        y = j / cf;
      } else {
        const cfSq = cf * cf;
        y = deltaTime + (((deltaTime * deltaTime * cfSq * cfSq) / 20 - cfSq) * (deltaTime * deltaTime * deltaTime)) / 6;
      }

      const gd = pos - goal;
      const newPos = ((gd * (i + z * d) + vel * y) * q) + goal;
      const newVel = (vel * (i - z * d) - gd * (z * f)) * q;
      this.Position = newPos;
      this.Velocity = newVel;
      return newPos;
    } else {
      // Overdamped
      const c = sqrt(d * d - 1);
      const r1 = -f * (d - c);
      const r2 = -f * (d + c);
      const ec1 = exp(r1 * deltaTime);
      const ec2 = exp(r2 * deltaTime);
      const gd = pos - goal;
      const co2 = (vel - gd * r1) / (2 * f * c);
      const co1 = ec1 * (gd - co2);
      const coEc2 = co2 * ec2;
      const newPos = co1 + coEc2 + goal;
      const newVel = co1 * r1 + coEc2 * r2;
      this.Position = newPos;
      this.Velocity = newVel;
      return newPos;
    }
  }

  CanSleep(): boolean {
    return !(
      this.Velocity ** 2 > SLEEP_VELOCITY_SQ_LIMIT ||
      (this.Goal - this.Position) ** 2 > SLEEP_OFFSET_SQ_LIMIT
    );
  }

  GetGoal(): number { return this.Goal; }

  SetGoal(goal: number, replacePosition?: boolean) {
    this.Goal = goal;
    if (replacePosition) {
      this.Position = goal;
      this.Velocity = 0;
    }
  }

  SetDampingRatio(dampingRatio: number) {
    if (this.Frequency * dampingRatio < 0) throw new Error("Spring will not converge");
    this.DampingRatio = dampingRatio;
  }

  SetFrequency(frequency: number) {
    if (frequency * this.DampingRatio < 0) throw new Error("Spring will not converge");
    this.Frequency = frequency;
  }
}
