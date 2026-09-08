import type { ReactNode } from "react";
import ReactDOM from "react-dom/client";
import { flushSync } from "react-dom";
import { PopupModal } from "../components/Modal.ts";

export function createReactModalContent(
  children: ReactNode,
  targetDocument: Document = PopupModal.ownerDocument
) {
  const content = targetDocument.createElement("div");
  const root = ReactDOM.createRoot(content);
  flushSync(() => root.render(children));
  return { content, onClose: () => root.unmount() };
}

export function getModalScrollTop(): number {
  let scrollTop = 0;
  for (const element of PopupModal.querySelectorAll<HTMLElement>("*")) {
    scrollTop = Math.max(scrollTop, element.scrollTop ?? 0);
  }
  return scrollTop;
}
