import ReactDOM from "react-dom/client";
import { flushSync } from "react-dom";
import { PopupModal } from "../components/Modal.ts";
import LyricsSourcesManager from "../components/ReactComponents/SettingsPanel/LyricsSourcesManager.tsx";

function getModalScrollTop() {
  return Math.max(0, ...Array.from(PopupModal.querySelectorAll<HTMLElement>("*")).map((el) => el.scrollTop ?? 0));
}

export async function OpenLyricsSourcesManager() {
  const { default: SettingsPanel } = await import("../components/ReactComponents/SettingsPanel/index.tsx");
  const settingsScrollTop = getModalScrollTop();
  const modalDocument = PopupModal.ownerDocument;
  const openSettings = () => {
    const settingsContainer = modalDocument.createElement("div");
    const settingsRoot = ReactDOM.createRoot(settingsContainer);

    flushSync(() => {
      settingsRoot.render(<SettingsPanel />);
    });

    PopupModal.transition({
      title: "Settings",
      content: settingsContainer,
      modalId: "settingsPanel",
      contentScrollTop: settingsScrollTop,
      onClose: () => settingsRoot.unmount(),
    });
  };

  const backButton = modalDocument.createElement("button");
  backButton.className = "sl-sp-btn sl-modal-header-back-btn";
  backButton.type = "button";
  backButton.textContent = "← Back";
  backButton.onclick = openSettings;

  const container = modalDocument.createElement("div");
  const root = ReactDOM.createRoot(container);

  flushSync(() => {
    root.render(<LyricsSourcesManager />);
  });

  const options = {
    title: "Manage Sources",
    content: container,
    isLarge: true,
    modalId: "lyricsSourcesManager",
    headerLeft: backButton,
    onClose: () => root.unmount(),
  };

  if (PopupModal.isConnected) {
    PopupModal.transition(options);
  } else {
    PopupModal.display(options);
  }
}
