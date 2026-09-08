import { PopupModal } from "../components/Modal.ts";
import LyricsSourcesManager from "../components/ReactComponents/SettingsPanel/LyricsSourcesManager.tsx";
import { createReactModalContent, getModalScrollTop } from "./reactModalContent.tsx";

export async function OpenLyricsSourcesManager() {
  const { default: SettingsPanel } = await import("../components/ReactComponents/SettingsPanel/index.tsx");
  const settingsScrollTop = getModalScrollTop();
  const modalDocument = PopupModal.ownerDocument;
  const openSettings = () => {
    PopupModal.transition({
      title: "Settings",
      ...createReactModalContent(<SettingsPanel />, modalDocument),
      modalId: "settingsPanel",
      contentScrollTop: settingsScrollTop,
    });
  };

  const backButton = modalDocument.createElement("button");
  backButton.className = "sl-sp-btn sl-modal-header-back-btn";
  backButton.type = "button";
  backButton.textContent = "← Back";
  backButton.onclick = openSettings;

  const options = {
    title: "Manage Sources",
    ...createReactModalContent(<LyricsSourcesManager />, modalDocument),
    isLarge: true,
    modalId: "lyricsSourcesManager",
    headerLeft: backButton,
  };

  if (PopupModal.isConnected) {
    PopupModal.transition(options);
  } else {
    PopupModal.display(options);
  }
}
