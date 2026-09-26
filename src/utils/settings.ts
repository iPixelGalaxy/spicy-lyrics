import React from "react";
import ReactDOM from "react-dom/client";
import { flushSync } from "react-dom";
import { PopupModal } from "../components/Modal.ts";
import SettingsPanel from "../components/ReactComponents/SettingsPanel/index.tsx";
import HiddenSettingsPanel from "../components/ReactComponents/SettingsPanel/HiddenSettingsPanel.tsx";
import AnimatorBehaviorPanel from "../components/ReactComponents/SettingsPanel/AnimatorBehaviorPanel.tsx";
import Fullscreen from "../components/Utils/Fullscreen.ts";
import type { SettingsPanelState } from "../components/ReactComponents/SettingsPanel/index.tsx";
import { $settingsMenuLocation } from "./uiState.ts";
import { $rememberSettingsMenuLocation } from "./stores.ts";

const MODAL_ID = "settingsPanel";
type Direction = "forward" | "back";

function renderPanel(targetDocument: Document, element: React.ReactElement, direction?: Direction) {
  const container = targetDocument.createElement("div");
  container.className = direction ? `sl-sp-page sl-sp-page--${direction}` : "sl-sp-page";
  const root = ReactDOM.createRoot(container);
  flushSync(() => root.render(element));
  return { container, root };
}

export function openSettingsPanel(targetDocument: Document = document) {
  const rememberedLocation = $rememberSettingsMenuLocation.get()
    ? $settingsMenuLocation.get()
    : { route: "settings" as const, query: "", sectionFilter: "Appearance", scrollTop: 0 };
  let currentState: SettingsPanelState = {
    query: rememberedLocation.query,
    sectionFilter: rememberedLocation.sectionFilter,
    scrollTop: rememberedLocation.scrollTop,
  };
  let currentRoute = rememberedLocation.route;
  const updateState = (state: SettingsPanelState) => {
    currentState = { ...state, scrollTop: currentState.scrollTop };
  };
  const captureScrollPosition = () => {
    const mainSection = targetDocument.querySelector<HTMLElement>(".slmodal-settingsPanel .sl-modal-main-section");
    const scrollElement = mainSection?.querySelector<HTMLElement>(".sl-sp-settings-scroll") ?? mainSection;
    if (scrollElement) currentState.scrollTop = scrollElement.scrollTop;
  };
  const saveLocation = () => {
    captureScrollPosition();
    if ($rememberSettingsMenuLocation.get()) {
      $settingsMenuLocation.set({ ...currentState, route: currentRoute });
    }
  };
  let previewEnteredFullscreen = false;
  let removePreviewPositioning: (() => void) | null = null;
  const restorePreview = () => {
    removePreviewPositioning?.();
    removePreviewPositioning = null;
    if (!previewEnteredFullscreen) return;
    previewEnteredFullscreen = false;
    if (Fullscreen.IsOpen) Fullscreen.Toggle(false);
  };
  const closePanel = (root: ReactDOM.Root) => {
    saveLocation();
    root.unmount();
  };
  const createSettingsPanel = () => React.createElement(SettingsPanel, {
    onOpenHiddenSettings: openHiddenSettingsPanel,
    onManageAnimator: openAnimatorBehaviorPanel,
    initialState: currentState,
    onStateChange: updateState,
  });
  const openAnimatorBehaviorPanel = (state: SettingsPanelState = currentState) => {
    currentState = state;
    currentRoute = "animator";
    if (!Fullscreen.IsOpen) { previewEnteredFullscreen = true; Fullscreen.Toggle(false); }
    const { container, root } = renderPanel(targetDocument, React.createElement(AnimatorBehaviorPanel, { onBack: backToSettings, onClose: () => PopupModal.hide(), eventDocument: targetDocument }), "forward");
    PopupModal.transition({ title: "Animator Behavior", content: container, modalId: "animatorPreview", isLarge: false, onClose: () => { saveLocation(); root.unmount(); restorePreview(); } });
    const positionPreview = () => {
      const modal = targetDocument.querySelector<HTMLElement>(".slmodal-animatorPreview");
      const artwork = targetDocument.querySelector<HTMLElement>("#SpicyLyricsPage .NowBar .MediaImageContainer");
      if (!modal || !artwork) return;
      const bounds = artwork.getBoundingClientRect();
      modal.style.setProperty("--animator-preview-center", `${bounds.left + bounds.width / 2}px`);
    };
    const targetWindow = targetDocument.defaultView ?? window;
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(positionPreview);
    let observedArtwork: HTMLElement | null = null;
    const observeArtwork = () => {
      const artwork = targetDocument.querySelector<HTMLElement>("#SpicyLyricsPage .NowBar .MediaImageContainer");
      if (!artwork || artwork === observedArtwork) return;
      resizeObserver?.disconnect();
      resizeObserver?.observe(artwork);
      observedArtwork = artwork;
    };
    const layoutObserver = new MutationObserver(() => { observeArtwork(); positionPreview(); });
    layoutObserver.observe(targetDocument.body, { childList: true, subtree: true });
    observeArtwork();
    targetWindow.addEventListener("resize", positionPreview);
    const timers = [0, 50, 150, 350].map((delay) => targetWindow.setTimeout(() => { observeArtwork(); positionPreview(); }, delay));
    targetWindow.requestAnimationFrame(() => { observeArtwork(); positionPreview(); targetWindow.requestAnimationFrame(positionPreview); });
    removePreviewPositioning = () => { resizeObserver?.disconnect(); layoutObserver.disconnect(); timers.forEach((timer) => targetWindow.clearTimeout(timer)); targetWindow.removeEventListener("resize", positionPreview); };
    (openAnimatorBehaviorPanel as any).state = state;
  };
  const openHiddenSettingsPanel = () => {
    captureScrollPosition();
    currentRoute = "hidden";
    const { container, root } = renderPanel(targetDocument, React.createElement(HiddenSettingsPanel, { onBack: backToSettings }), "forward");
    PopupModal.transition({ title: "Hidden Settings", content: container, modalId: MODAL_ID, onClose: () => closePanel(root) });
  };
  const backToSettings = () => {
    const state = (openAnimatorBehaviorPanel as any).state as SettingsPanelState | undefined;
    currentState = state ?? currentState;
    currentRoute = "settings";
    restorePreview();
    const { container, root } = renderPanel(
      targetDocument,
      createSettingsPanel(),
      "back"
    );
    PopupModal.transition({ title: "Settings", content: container, modalId: MODAL_ID, contentScrollTop: currentState.scrollTop, onClose: () => closePanel(root) });
  };

  const { container, root } = renderPanel(
    targetDocument,
    createSettingsPanel()
  );
  PopupModal.display({
    title: "Settings",
    content: container,
    isLarge: true,
    modalId: MODAL_ID,
    targetDocument,
    onClose: () => closePanel(root),
  });

  if (rememberedLocation.route === "hidden") openHiddenSettingsPanel();
  else if (rememberedLocation.route === "animator") openAnimatorBehaviorPanel(currentState);
}
