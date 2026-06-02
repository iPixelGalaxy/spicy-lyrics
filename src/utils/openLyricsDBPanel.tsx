import ReactDOM from "react-dom/client";
import { flushSync } from "react-dom";
import { PopupModal } from "../components/Modal.ts";
import LyricsDBPanel from "../components/ReactComponents/LyricsManager/index.tsx";
import UploadTTMLModal from "../components/ReactComponents/LyricsManager/components/UploadTTMLModal.tsx";

function getModalScrollTop() {
  return Math.max(0, ...Array.from(PopupModal.querySelectorAll<HTMLElement>("*")).map((el) => el.scrollTop ?? 0));
}

export function OpenLyricsDBPanel() {
  _openUpload();
}

export function OpenTTMLDatabasePanel() {
  if (PopupModal.isConnected) {
    _openDB();
    return;
  }

  const container = document.createElement("div");
  const root = ReactDOM.createRoot(container);

  flushSync(() => {
    root.render(<LyricsDBPanel onBack={_openUpload} />);
  });

  PopupModal.display({
    title: "TTML Database",
    content: container,
    isLarge: true,
    onClose: () => root.unmount(),
  });
}

export async function OpenTTMLDatabasePanelFromSettings() {
  const { default: SettingsPanel } = await import("../components/ReactComponents/SettingsPanel/index.tsx");
  const settingsScrollTop = getModalScrollTop();
  const openSettings = () => {
    const container = document.createElement("div");
    const root = ReactDOM.createRoot(container);
    flushSync(() => {
      root.render(<SettingsPanel />);
    });
    PopupModal.transition({
      title: "Settings",
      content: container,
      onClose: () => root.unmount(),
      contentScrollTop: settingsScrollTop,
      modalId: "settingsPanel",
    });
  };

  _openDB(openSettings, "settingsTTMLDatabase");
}

function _openDB(onBack = _openUpload, modalId: string | null = null) {
  const container = document.createElement("div");
  const root = ReactDOM.createRoot(container);

  flushSync(() => {
    root.render(<LyricsDBPanel onBack={onBack} />);
  });

  PopupModal.transition({
    title: "TTML Database",
    content: container,
    isLarge: true,
    modalId,
    onClose: () => root.unmount(),
  });
}

function _openUpload() {
  const container = document.createElement("div");
  const root = ReactDOM.createRoot(container);

  flushSync(() => {
    root.render(
      <UploadTTMLModal
        onOpenDB={() => _openDB()}
        onDone={() => PopupModal.hide()}
      />
    );
  });

  const options = {
    title: "Load TTML",
    content: container,
    isLarge: true,
    onClose: () => root.unmount(),
  };

  if (PopupModal.isConnected) {
    PopupModal.transition(options);
  } else {
    PopupModal.display(options);
  }
}
