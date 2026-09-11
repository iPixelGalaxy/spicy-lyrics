import React from "react";
import ReactDOM from "react-dom/client";
import { flushSync } from "react-dom";
import { PopupModal } from "../components/Modal.ts";
import SettingsPanel from "../components/ReactComponents/SettingsPanel/index.tsx";
import HiddenSettingsPanel from "../components/ReactComponents/SettingsPanel/HiddenSettingsPanel.tsx";
import AnimatorBehaviorPanel from "../components/ReactComponents/SettingsPanel/AnimatorBehaviorPanel.tsx";
import Fullscreen from "../components/Utils/Fullscreen.ts";
import type { SettingsPanelState } from "../components/ReactComponents/SettingsPanel/index.tsx";

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
  let previewEnteredFullscreen = false;
  let removePreviewPositioning: (() => void) | null = null;
  const restorePreview = () => {
    removePreviewPositioning?.();
    removePreviewPositioning = null;
    if (!previewEnteredFullscreen) return;
    previewEnteredFullscreen = false;
    if (Fullscreen.IsOpen) Fullscreen.Toggle(false);
  };
  const openAnimatorBehaviorPanel = (state: SettingsPanelState = { query: "", sectionFilter: "Appearance", scrollTop: 0 }) => {
    if (!Fullscreen.IsOpen) { previewEnteredFullscreen = true; Fullscreen.Toggle(false); }
    const { container, root } = renderPanel(targetDocument, React.createElement(AnimatorBehaviorPanel, { onBack: backToSettings, onClose: () => PopupModal.hide(), eventDocument: targetDocument }), "forward");
    PopupModal.transition({ title: "Animator Behavior", content: container, modalId: "animatorPreview", isLarge: false, onClose: () => { root.unmount(); restorePreview(); } });
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
    const { container, root } = renderPanel(targetDocument, React.createElement(HiddenSettingsPanel, { onBack: backToSettings }), "forward");
    PopupModal.transition({ title: "Hidden Settings", content: container, modalId: MODAL_ID, onClose: () => root.unmount() });
  };
  const backToSettings = () => {
    const state = (openAnimatorBehaviorPanel as any).state as SettingsPanelState | undefined;
    restorePreview();
    const { container, root } = renderPanel(
      targetDocument,
      React.createElement(SettingsPanel, { onOpenHiddenSettings: openHiddenSettingsPanel, onManageAnimator: openAnimatorBehaviorPanel, initialState: state }),
      "back"
    );
    PopupModal.transition({ title: "Settings", content: container, modalId: MODAL_ID, contentScrollTop: state?.scrollTop, onClose: () => root.unmount() });
  };

  const { container, root } = renderPanel(
    targetDocument,
    React.createElement(SettingsPanel, { onOpenHiddenSettings: openHiddenSettingsPanel, onManageAnimator: openAnimatorBehaviorPanel })
  );
  PopupModal.display({
    title: "Settings",
    content: container,
    isLarge: true,
    modalId: MODAL_ID,
    targetDocument,
    onClose: () => root.unmount(),
  });
}
