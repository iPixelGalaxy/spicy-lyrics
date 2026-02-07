/**
 * Efficiently sets the state class on a line element.
 * Replaces duplicated classList add/remove blocks throughout LyricsAnimator.
 */
export function setLineStateClass(
  el: HTMLElement,
  state: "Active" | "NotSung" | "Sung"
): void {
  switch (state) {
    case "Active":
      if (!el.classList.contains("Active")) {
        el.classList.add("Active");
      }
      if (el.classList.contains("NotSung")) {
        el.classList.remove("NotSung");
      }
      if (el.classList.contains("Sung")) {
        el.classList.remove("Sung");
      }
      break;
    case "NotSung":
      if (!el.classList.contains("NotSung")) {
        el.classList.add("NotSung");
      }
      el.classList.remove("Sung");
      if (el.classList.contains("Active")) {
        el.classList.remove("Active");
      }
      break;
    case "Sung":
      if (!el.classList.contains("Sung")) {
        el.classList.add("Sung");
      }
      el.classList.remove("Active", "NotSung");
      break;
  }
}
