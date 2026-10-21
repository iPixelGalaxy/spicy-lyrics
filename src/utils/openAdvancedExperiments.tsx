import { PopupModal } from "../components/Modal.ts";
import ExperimentsPanel from "../components/ReactComponents/SettingsPanel/ExperimentsPanel.tsx";
import { createReactModalContent, getModalScrollTop } from "./reactModalContent.tsx";

export async function OpenAdvancedExperiments() {
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
    title: "Experiments",
    ...createReactModalContent(<ExperimentsPanel advancedOnly showBuiltIn={false} />, modalDocument),
    isLarge: true,
    modalId: "advancedExperiments",
    headerLeft: backButton,
  };

  if (PopupModal.isConnected) {
    PopupModal.transition(options);
  } else {
    PopupModal.display(options);
  }
}
