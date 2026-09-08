import Logger from "./Logger";

const intervalLogger = new Logger("Interval Manager");

class IntervalManager {
  private generation = 0;
  private callback: () => void;
  private duration: number; // Duration in milliseconds
  private lastTimestamp: number | null;
  private animationFrameId: number | null;
  private intervalId: ReturnType<typeof setInterval> | null;
  private targetWindowProvider: () => Window;
  private activeWindow: Window | null;
  public Running: boolean;
  public Destroyed: boolean;

  constructor(duration: number, callback: () => void, targetWindowProvider: () => Window = () => window) {
    if (Number.isNaN(duration)) {
      throw new Error("Duration cannot be NaN.");
    }

    this.callback = callback;
    this.duration = duration === Infinity ? 0 : duration * 1000; // Convert seconds to milliseconds or set to 0 for immediate execution
    this.lastTimestamp = null;
    this.animationFrameId = null;
    this.intervalId = null;
    this.targetWindowProvider = targetWindowProvider;
    this.activeWindow = null;
    this.Running = false;
    this.Destroyed = false;
  }

  // Starts the requestAnimationFrame loop
  public Start() {
    if (this.Destroyed) {
      intervalLogger.warn("Cannot start; IntervalManager has been destroyed");
      return;
    }

    if (this.Running) {
      intervalLogger.warn("Interval is already running");
      return;
    }

    this.Running = true;
    this.lastTimestamp = null;
    const generation = ++this.generation;

    if (this.duration > 0 && Number.isFinite(this.duration)) {
      this.activeWindow = this.targetWindowProvider();
      this.intervalId = this.activeWindow.setInterval(() => {
        if (!this.Running || this.Destroyed || generation !== this.generation) return;
        this.callback();
      }, this.duration);

      return;
    }

    let reportedCallbackError = false;
    const loop = (timestamp: number) => {
      if (!this.Running || this.Destroyed || generation !== this.generation) return;
      this.animationFrameId = null;

      try {
        if (this.lastTimestamp === null) {
          this.lastTimestamp = timestamp;
        }

        const elapsed = timestamp - this.lastTimestamp;

        if (this.duration === 0 || elapsed >= this.duration) {
          this.callback();
          reportedCallbackError = false;
          if (generation === this.generation) {
            this.lastTimestamp = this.duration === 0 ? null : timestamp;
          }
        }
      } catch (error) {
        if (!reportedCallbackError) {
          intervalLogger.error("Animation frame callback failed", error);
          reportedCallbackError = true;
        }
      } finally {
        // A callback may stop or restart the manager. Only its own run can
        // schedule another frame, including when the callback throws.
        if (this.Running && !this.Destroyed && generation === this.generation) {
          this.animationFrameId = (this.activeWindow ?? this.targetWindowProvider()).requestAnimationFrame(loop);
        }
      }
    };

    this.activeWindow = this.targetWindowProvider();
    this.animationFrameId = this.activeWindow.requestAnimationFrame(loop);

  }

  // Stops the animation frame loop without destroying the manager
  public Stop() {
    this.generation++;
    if (this.intervalId !== null) {
      (this.activeWindow ?? window).clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.animationFrameId !== null) {
      (this.activeWindow ?? window).cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.Running = false;
    this.lastTimestamp = null;
    this.activeWindow = null;
  }

  // Restarts the animation frame loop
  public Restart() {
    if (this.Destroyed) {
      intervalLogger.warn("Cannot restart; IntervalManager has been destroyed");
      return;
    }

    this.Stop();
    this.Start();
  }

  // Fully cleans up the manager and makes it unusable
  public Destroy() {
    if (this.Destroyed) {
      intervalLogger.warn("IntervalManager is already destroyed");
      return;
    }

    this.Stop();
    this.Destroyed = true;
    this.Running = false;
  }
}

export { IntervalManager };
