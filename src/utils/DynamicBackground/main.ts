import * as THREE from "@3d/three";
import { GetShaderUniforms, VertexShader, FragmentShader, type ShaderUniforms, DisposeShaderUniforms } from "./Shaders.ts";
import { Maid, Giveable } from "../Primitives.ts";
import PrefixError from "./PrefixError.ts";

export type CoverArtCache = Map<string, OffscreenCanvas>;

export interface DynamicBackgroundPlugin extends Giveable {
  name: string;
  // deno-lint-ignore no-explicit-any
  initialize: (...args: any[]) => Promise<void> | void;
}

export interface DynamicBackgroundPluginDefiniton {
  // deno-lint-ignore no-explicit-any
  new(options?: any): DynamicBackgroundPlugin;
}

export type DynamicBackgroundPlugins = Record<string, DynamicBackgroundPlugin>;
export type DynamicBackgroundPluginTuple = [DynamicBackgroundPluginDefiniton, Record<string, unknown> | undefined];
export type DynamicBackgroundPluginsArray = Array<DynamicBackgroundPlugin | DynamicBackgroundPluginTuple>;

export interface DynamicBackgroundOptions {
  transition?: number | boolean;
  blur?: number;
  maid?: Maid;
  speed?: number;
  coverArtCache?: CoverArtCache;
  plugins?: DynamicBackgroundPluginsArray;
  cacheLimit?: number;
  // deno-lint-ignore no-explicit-any
  [key: string]: any;
}

export interface DynamicBackgroundUpdateOptions {
  image?: string;
  placeholderHueShift?: number;
  blur?: number;
  speed?: number;
}

const DynamicBackgroundError = new PrefixError({
  name: "DynamicBackgroundError",
  prefix: "DynamicBackground: ",
}).Create();

export class DynamicBackground implements Giveable {
  public container: HTMLElement & {
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    uniforms: ShaderUniforms;
    texture?: THREE.Texture;
    material?: THREE.ShaderMaterial;
    animationFrameId?: number;
  };
  public maid: Maid;
  public resizeObserver?: ResizeObserver;
  public blurAmount: number;
  public transitionDuration: number;
  public rotationSpeed: number;
  public rotationAngle: number = 0;
  public lastFrameTime: number = 0;

  private _isUpdating: boolean = false;
  private _queuedUpdate: DynamicBackgroundUpdateOptions | null = null;

  public currentImage?: string;
  public currentPlaceholderHueShift: number = 0;

  public renderCamera!: THREE.OrthographicCamera;
  public meshGeometry!: THREE.PlaneGeometry;

  public blurredCoverArts: Map<string, OffscreenCanvas>;

  // deno-lint-ignore no-explicit-any
  public plugins: DynamicBackgroundPlugins | Array<any>;
  public clientOptions: DynamicBackgroundOptions | undefined;

  constructor(options: DynamicBackgroundOptions = {}) {
    this.clientOptions = options;
    const pluginsInput = options.plugins ?? [];
    // deno-lint-ignore no-explicit-any
    let pluginsObj: Record<string, any> = {};

    if (Array.isArray(pluginsInput)) {
      for (const plugin of pluginsInput) {
        if (Array.isArray(plugin)) {
          const [PluginClass, pluginOptions] = plugin;
          if (PluginClass) {
            const pluginInstance = new PluginClass(pluginOptions);
            if (pluginInstance && typeof pluginInstance === "object" && typeof pluginInstance.name === "string") {
              pluginsObj[pluginInstance.name] = pluginInstance;
            }
          }
        } else {
          if (plugin && typeof plugin === "object" && typeof (plugin as { name?: unknown }).name === "string") {
            pluginsObj[(plugin as { name: string }).name] = plugin;
          }
        }
      }
    } else if (typeof pluginsInput === "object" && pluginsInput !== null && !Array.isArray(pluginsInput)) {
      pluginsObj = Object.assign({}, pluginsInput as DynamicBackgroundPlugins);
    }

    this.plugins = pluginsObj;
    this.blurAmount = options.blur ?? 40;
    this.rotationSpeed = options.speed ?? 0.2;
    this.blurredCoverArts = options.coverArtCache ?? new Map();

    if (typeof options.transition === "boolean") {
      this.transitionDuration = options.transition ? 0.2 : 0;
    } else {
      this.transitionDuration = options.transition ?? 0.2;
    }

    this.maid = options.maid ?? new Maid();
    this.initThreeObjects();

    this.maid.Give(() => { if (this.meshGeometry) this.meshGeometry.dispose(); });

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "default",
      preserveDrawingBuffer: false,
    });

    this.container = renderer.domElement as typeof this.container;

    const renderScene = new THREE.Scene();
    const materialUniforms = GetShaderUniforms();
    const meshMaterial = new THREE.ShaderMaterial({
      uniforms: materialUniforms,
      vertexShader: VertexShader,
      fragmentShader: FragmentShader,
    });

    this.container.material = meshMaterial;

    const sceneMesh = new THREE.Mesh(
      this.meshGeometry,
      meshMaterial as unknown as THREE.MeshBasicMaterial
    );
    renderScene.add(sceneMesh);

    this.container.renderer = renderer;
    this.container.scene = renderScene;
    this.container.uniforms = materialUniforms;
    this.container.uniforms.RotationSpeed.value = this.rotationSpeed;

    this.maid.Give(() => {
      if (this.container.renderer) {
        this.container.renderer.dispose();
        const gl = this.container.renderer.getContext();
        if (gl && !gl.isContextLost()) {
          const loseContext = gl.getExtension("WEBGL_lose_context");
          if (loseContext) loseContext.loseContext();
        }
        this.container.renderer = undefined as unknown as THREE.WebGLRenderer;
      }
    });
    this.maid.Give(() => {
      if (this.container.material) {
        this.container.material.dispose();
        this.container.material = undefined;
      }
    });
    this.maid.Give(() => {
      if (this.container.texture) {
        this.container.texture.dispose();
        this.container.texture = undefined;
      }
    });
    this.maid.Give(() => {
      if (this.container.uniforms) DisposeShaderUniforms(this.container.uniforms);
    });
    this.maid.Give(() => {
      if (this.container.animationFrameId) {
        cancelAnimationFrame(this.container.animationFrameId);
        this.container.animationFrameId = undefined;
      }
    });
    this.maid.Give(() => {
      if (this.container.parentElement) this.container.remove();
    });
    this.maid.Give(() => {
      if (!options.coverArtCache) this.blurredCoverArts.clear();
    });
    this.maid.Give(() => this.cleanup());

    Object.values(this.plugins).map(async plugin => {
      if (!plugin) return;
      this.maid.Give(() => plugin.Destroy());
      await plugin.initialize({ ClientOptions: options, InternalContent: this });
    });
  }

  private initThreeObjects(): void {
    this.renderCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    (this.renderCamera as unknown as { position: { z: number } }).position.z = 1;
    this.meshGeometry = new THREE.PlaneGeometry(2, 2);
  }

  public async Update(options: DynamicBackgroundUpdateOptions): Promise<void> {
    this._queuedUpdate = options;
    if (this._isUpdating) return;
    this._isUpdating = true;
    try {
      while (this._queuedUpdate) {
        const currentUpdateOptions = this._queuedUpdate;
        this._queuedUpdate = null;
        await this._performUpdate(currentUpdateOptions);
      }
    } finally {
      this._isUpdating = false;
    }
  }

  private async _performUpdate(options: DynamicBackgroundUpdateOptions): Promise<void> {
    if (this.maid.IsDestroyed()) return;

    const { image: newImage, placeholderHueShift = 0, blur = this.blurAmount, speed = this.rotationSpeed } = options;
    const image = newImage ?? this.currentImage;

    if (!image || typeof image !== "string") {
      throw new DynamicBackgroundError("Image must be a string and is required for the first update.");
    }

    const imageChanged = image !== this.currentImage;
    const hueShiftChanged = placeholderHueShift !== this.currentPlaceholderHueShift;
    const blurChanged = blur !== this.blurAmount;
    const oldSpeed = this.rotationSpeed;
    const speedChanged = speed !== oldSpeed;

    if (!imageChanged && !hueShiftChanged && !blurChanged && !speedChanged) return;

    if (blurChanged || hueShiftChanged) this.blurredCoverArts.delete(image);

    this.blurAmount = blur;
    this.rotationSpeed = speed;
    this.currentImage = image;
    this.currentPlaceholderHueShift = placeholderHueShift;

    if (!this.container.texture) {
      await this.initializeTexture(image, placeholderHueShift);
      return;
    }

    if (this.container.animationFrameId) {
      cancelAnimationFrame(this.container.animationFrameId);
      this.container.animationFrameId = undefined;
    }

    const newBlurredCover = await this.getBlurredCoverArt(image, placeholderHueShift);
    const newTexture = new THREE.CanvasTexture(newBlurredCover);
    newTexture.minFilter = THREE.NearestFilter;
    newTexture.magFilter = THREE.NearestFilter;
    newTexture.needsUpdate = true;

    if (this.container.uniforms.NewBlurredCoverArt.value) {
      (this.container.uniforms.NewBlurredCoverArt.value as THREE.Texture).dispose();
    }

    this.container.uniforms.NewBlurredCoverArt.value = newTexture;
    this.container.uniforms.RotationSpeed.value = oldSpeed;

    if (this.container.renderer && this.container.scene) {
      this.container.renderer.render(this.container.scene, this.renderCamera);
    }

    this.container.uniforms.TransitionProgress.value = 0;

    if (this.transitionDuration <= 0) {
      this.completeTransition(newTexture, image);
      return;
    }

    await this.animateTransition(newTexture, image, oldSpeed);
  }

  public GetCanvasElement(): HTMLElement {
    return this.container;
  }

  public Destroy(): void {
    if (this.maid.IsDestroyed()) {
      this.cleanup();
      return;
    }
    this.cleanup();
    this.maid.Destroy();
  }

  private async initializeTexture(imageCoverUrl: string, placeholderHueShift: number = 0): Promise<void> {
    const blurredCover = await this.getBlurredCoverArt(imageCoverUrl, placeholderHueShift);
    const texture = new THREE.CanvasTexture(blurredCover);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;

    this.container.texture = texture;
    this.container.uniforms.BlurredCoverArt.value = texture;
    this.container.uniforms.Time.value = 0;
    this.container.uniforms.RotationSpeed.value = this.rotationSpeed;
    this.container.setAttribute("data-cover-id", imageCoverUrl);

    this.currentImage = imageCoverUrl;
    this.currentPlaceholderHueShift = placeholderHueShift;
  }

  private animateTransition(newTexture: THREE.Texture, newCoverArtUrl: string, oldSpeed: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const newSpeed = this.rotationSpeed;
      const duration = this.transitionDuration * 1000;
      let startTime: number | null = null;

      const animationState = { canceled: false, frameId: 0 };

      let cleanupKey: unknown;
      if (!this.maid.IsDestroyed()) {
        cleanupKey = this.maid.Give(() => {
          animationState.canceled = true;
          cancelAnimationFrame(animationState.frameId);
          if (this.container.uniforms) {
            this.container.uniforms.TransitionProgress.value = 0;
            this.container.uniforms.RotationSpeed.value = this.rotationSpeed;
          }
        });
      }

      this.lastFrameTime = performance.now();
      const animate = (timestamp: number) => {
        if (animationState.canceled) {
          resolve();
          return;
        }

        if (startTime === null) startTime = timestamp;

        const elapsedTime = timestamp - startTime;
        const progress = Math.min(elapsedTime / duration, 1);
        const deltaTime = (timestamp - this.lastFrameTime) / 1000;
        this.lastFrameTime = timestamp;

        const animatedSpeed = oldSpeed + (newSpeed - oldSpeed) * progress;
        this.rotationAngle += deltaTime * animatedSpeed;

        this.container.uniforms.RotationAngle.value = this.rotationAngle;
        this.container.uniforms.TransitionProgress.value = progress;

        if (this.container.renderer && this.container.scene) {
          this.container.renderer.render(this.container.scene, this.renderCamera);
        }

        if (progress < 1) {
          animationState.frameId = requestAnimationFrame(animate);
        } else {
          if (animationState.canceled) {
            resolve();
            return;
          }
          this.completeTransition(newTexture, newCoverArtUrl);
          if (cleanupKey !== undefined && !this.maid.IsDestroyed()) {
            this.maid.Clean(cleanupKey);
          }
          resolve();
        }
      };

      animationState.frameId = requestAnimationFrame(animate);
    });
  }

  private completeTransition(newTexture: THREE.Texture, newCoverArtUrl: string): void {
    if (this.container.texture) this.container.texture.dispose();

    this.container.texture = newTexture;
    this.container.uniforms.BlurredCoverArt.value = newTexture;
    this.container.uniforms.NewBlurredCoverArt.value = null;
    this.container.uniforms.TransitionProgress.value = 0;
    this.container.uniforms.RotationSpeed.value = this.rotationSpeed;
    this.container.setAttribute("data-cover-id", newCoverArtUrl);

    this.currentImage = newCoverArtUrl;

    if (this.container.renderer && this.container.scene) {
      this.container.renderer.render(this.container.scene, this.renderCamera);
    }

    this.startAnimation();
  }

  private startAnimation(): void {
    if (this.container.animationFrameId) {
      cancelAnimationFrame(this.container.animationFrameId);
      this.container.animationFrameId = undefined;
    }

    this.lastFrameTime = performance.now();
    const animate = (time: number) => {
      if (!this.container || !this.container.renderer || this.container.renderer.getContext()?.isContextLost()) {
        if (this.container?.animationFrameId) {
          cancelAnimationFrame(this.container.animationFrameId);
          this.container.animationFrameId = undefined;
        }
        return;
      }
      if (!this.renderCamera) return;

      const deltaTime = (time - this.lastFrameTime) / 1000;
      this.lastFrameTime = time;

      this.rotationAngle += deltaTime * this.rotationSpeed;
      this.container.uniforms.RotationAngle.value = this.rotationAngle;

      this.container.renderer.render(this.container.scene, this.renderCamera);
      this.container.animationFrameId = requestAnimationFrame(animate);
    };

    animate(performance.now());
  }

  private updateContainerDimensions(width: number, height: number): void {
    const { renderer, scene, uniforms } = this.container;

    renderer.setSize(width, height);
    renderer.setPixelRatio(globalThis.devicePixelRatio);

    const scaledWidth = width * globalThis.devicePixelRatio;
    const scaledHeight = height * globalThis.devicePixelRatio;

    const largestAxis = scaledWidth > scaledHeight ? "X" : "Y";
    const largestAxisSize = scaledWidth > scaledHeight ? scaledWidth : scaledHeight;

    uniforms.BackgroundCircleOrigin.value.set(scaledWidth / 2, scaledHeight / 2);
    uniforms.BackgroundCircleRadius.value = largestAxisSize * 1.5;
    uniforms.CenterCircleOrigin.value.set(scaledWidth / 2, scaledHeight / 2);
    uniforms.CenterCircleRadius.value = largestAxisSize * (largestAxis === "X" ? 1 : 0.75);
    uniforms.LeftCircleOrigin.value.set(0, scaledHeight);
    uniforms.LeftCircleRadius.value = largestAxisSize * 0.75;
    uniforms.RightCircleOrigin.value.set(scaledWidth, 0);
    uniforms.RightCircleRadius.value = largestAxisSize * (largestAxis === "X" ? 0.65 : 0.5);

    renderer.render(scene, this.renderCamera);
    this.startAnimation();
  }

  public AppendToElement(element: HTMLElement): void {
    if (this.maid.IsDestroyed()) return;

    if (this.container.parentElement) this.container.remove();

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }

    element.appendChild(this.container);

    this.resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const width = Math.max(entry.contentRect.width, 500);
        const height = Math.max(entry.contentRect.height, 500);
        this.updateContainerDimensions(width, height);
      }
    });

    if (!this.maid.IsDestroyed()) {
      this.maid.Give(() => {
        if (this.resizeObserver) {
          this.resizeObserver.disconnect();
          this.resizeObserver = undefined;
        }
      });
    }

    this.resizeObserver.observe(element);

    const width = Math.max(element.clientWidth, 500);
    const height = Math.max(element.clientHeight, 500);
    this.updateContainerDimensions(width, height);
  }

  private async getBlurredCoverArt(coverArtUrl: string, placeholderHueShift: number = 0): Promise<OffscreenCanvas> {
    if (this.blurredCoverArts.has(coverArtUrl)) {
      const canvas = this.blurredCoverArts.get(coverArtUrl)!;
      if (
        typeof this.clientOptions?.cacheLimit === "number" &&
        this.blurredCoverArts.size >= this.clientOptions.cacheLimit
      ) {
        this.blurredCoverArts.delete(coverArtUrl);
        this.blurredCoverArts.set(coverArtUrl, canvas);
      }
      return canvas;
    }

    const image = new Image();
    image.src = coverArtUrl;
    if (coverArtUrl.includes("https://") || coverArtUrl.includes("http://")) {
      image.crossOrigin = "anonymous";
    }
    await image.decode();

    const originalSize = Math.min(image.width, image.height);
    const resizedBlurAmount = this.blurAmount * (originalSize / 640);
    const blurExtent = Math.ceil(3 * resizedBlurAmount);

    const circleCanvas = new OffscreenCanvas(originalSize, originalSize);
    const circleCtx = circleCanvas.getContext("2d")!;

    circleCtx.beginPath();
    circleCtx.arc(originalSize / 2, originalSize / 2, originalSize / 2, 0, Math.PI * 2);
    circleCtx.closePath();
    circleCtx.clip();

    circleCtx.drawImage(
      image,
      (image.width - originalSize) / 2,
      (image.height - originalSize) / 2,
      originalSize,
      originalSize,
      0,
      0,
      originalSize,
      originalSize
    );

    const padding = blurExtent * 1.5;
    const expandedSize = originalSize + padding;
    const blurredCanvas = new OffscreenCanvas(expandedSize, expandedSize);
    const blurredCtx = blurredCanvas.getContext("2d")!;

    blurredCtx.filter = `blur(${resizedBlurAmount}px) hue-rotate(${placeholderHueShift}deg)`;
    blurredCtx.drawImage(circleCanvas, padding / 2, padding / 2);

    if (
      typeof this.clientOptions?.cacheLimit === "number" &&
      this.blurredCoverArts.size >= this.clientOptions.cacheLimit
    ) {
      const oldestKey = this.blurredCoverArts.keys().next().value;
      if (oldestKey !== undefined) this.blurredCoverArts.delete(oldestKey);
    }

    this.blurredCoverArts.set(coverArtUrl, blurredCanvas);
    return blurredCanvas;
  }

  public async PrefetchImage(imageUrl: string, placeholderHueShift: number = 0): Promise<OffscreenCanvas> {
    return this.getBlurredCoverArt(imageUrl, placeholderHueShift);
  }

  private cleanup(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }

    if (this.container.animationFrameId) {
      cancelAnimationFrame(this.container.animationFrameId);
      this.container.animationFrameId = undefined;
    }

    if (this.container.uniforms) DisposeShaderUniforms(this.container.uniforms);
    if (this.container.material) {
      this.container.material.dispose();
      this.container.material = undefined;
    }
    if (this.container.texture) {
      this.container.texture.dispose();
      this.container.texture = undefined;
    }

    if (this.container.scene) {
      this.container.scene.traverse((object: THREE.Object3D) => {
        if (object instanceof THREE.Mesh) {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach((material: THREE.Material) => material.dispose());
            } else {
              object.material.dispose();
            }
          }
        }
      });
    }

    if (this.container.renderer) {
      this.container.renderer.dispose();
      const gl = this.container.renderer.getContext();
      if (gl && !gl.isContextLost()) {
        const loseContext = gl.getExtension("WEBGL_lose_context");
        if (loseContext) loseContext.loseContext();
      }
      this.container.renderer = undefined as unknown as THREE.WebGLRenderer;
    }

    if (this.container) this.container.remove();
    if (this.meshGeometry) this.meshGeometry.dispose();

    this.currentImage = undefined;
    this.currentPlaceholderHueShift = 0;
  }
}
