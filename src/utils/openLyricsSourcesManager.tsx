import ReactDOM from "react-dom/client";
import { flushSync } from "react-dom";
import { PopupModal } from "../components/Modal.ts";
import LyricsSourcesManager from "../components/ReactComponents/SettingsPanel/LyricsSourcesManager.tsx";

export function OpenLyricsSourcesManager() {
  const container = document.createElement("div");
  const root = ReactDOM.createRoot(container);

  flushSync(() => {
    root.render(<LyricsSourcesManager />);
  });

  const options = {
    title: "Manage Sources",
    content: container,
    isLarge: true,
    modalId: "lyricsSourcesManager",
    onClose: () => root.unmount(),
  };

  if (PopupModal.isConnected) {
    PopupModal.transition(options);
  } else {
    PopupModal.display(options);
  }
}
