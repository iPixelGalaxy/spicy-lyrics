import React from "react";
import ReactDOM from "react-dom/client";
import { flushSync } from "react-dom";
import { PopupModal } from "../components/Modal.ts";
import SettingsPanel from "../components/ReactComponents/SettingsPanel/index.tsx";
import ExperimentsPanel from "../components/ReactComponents/SettingsPanel/ExperimentsPanel.tsx";

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
  const openExperimentsPanel = () => {
    const { container, root } = renderPanel(
      targetDocument,
      React.createElement(ExperimentsPanel, { onBack: backToSettings }),
      "forward"
    );
    PopupModal.transition({ title: "Experiments", content: container, modalId: MODAL_ID, onClose: () => root.unmount() });
  };

  const backToSettings = () => {
    const { container, root } = renderPanel(
      targetDocument,
      React.createElement(SettingsPanel, { onOpenExperiments: openExperimentsPanel }),
      "back"
    );
    PopupModal.transition({ title: "Settings", content: container, modalId: MODAL_ID, onClose: () => root.unmount() });
  };

  const { container, root } = renderPanel(
    targetDocument,
    React.createElement(SettingsPanel, { onOpenExperiments: openExperimentsPanel })
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
