import { PopupModal } from "../components/Modal.ts";
import BuildChannelPanel from "../components/ReactComponents/BuildChannelPanel.tsx";
import { createReactModalContent } from "./reactModalContent.tsx";

export function OpenBuildChannelPanel() {
  const entrypointChannels = (window as any)._spicy_lyrics_channels;
  if (entrypointChannels?.showSwitcher) {
    entrypointChannels.showSwitcher();
    return;
  }

  const options = {
    title: "Build Channel",
    ...createReactModalContent(<BuildChannelPanel />),
    modalId: "buildChannelPanel",
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
