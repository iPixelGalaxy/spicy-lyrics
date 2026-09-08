import ReactDOM from "react-dom/client";
import { flushSync } from "react-dom";
import { PopupModal } from "../components/Modal.ts";
import BuildChannelPanel from "../components/ReactComponents/BuildChannelPanel.tsx";

export function OpenBuildChannelPanel() {
  const entrypointChannels = (window as any)._spicy_lyrics_channels;
  if (entrypointChannels?.showSwitcher) {
    entrypointChannels.showSwitcher();
    return;
  }

  const container = PopupModal.ownerDocument.createElement("div");
  const root = ReactDOM.createRoot(container);

  flushSync(() => {
    root.render(<BuildChannelPanel />);
  });

  const options = {
    title: "Build Channel",
    content: container,
    modalId: "buildChannelPanel",
    onClose: () => root.unmount(),
  };

  if (PopupModal.isConnected) {
    PopupModal.transition(options);
  } else {
    PopupModal.display({ ...options, isLarge: true });
  }
}

/** Opens the entrypoint branch manager when it is available. */
export function OpenBuildChannelManager() {
  const entrypointChannels = (window as any)._spicy_lyrics_channels;
  if (entrypointChannels?.showManage) {
    entrypointChannels.showManage();
    return;
  }
  OpenBuildChannelPanel();
}
