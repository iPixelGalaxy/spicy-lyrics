import {
  $currentLyricsData,
  $currentlyFetching,
  $developerMode,
  $musixmatchToken,
} from "./stores.ts";
import { $isNowBarOpen, $nowBarSide } from "./uiState.ts";

const prefix = "SpicyLyrics-";

function stringify(value: any): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function set(key: string, value: any) {
  if (key === "currentlyFetching") {
    $currentlyFetching.set(value === true || value === "true");
    return;
  }
  if (key === "currentLyricsData") {
    $currentLyricsData.set(value == null ? "" : String(value));
    return;
  }
  if (key === "developerMode") {
    $developerMode.set(value === true || value === "true");
    return;
  }
  if (key === "musixmatchToken") {
    $musixmatchToken.set(value == null ? "" : String(value));
    return;
  }
  if (key === "IsNowBarOpen") {
    $isNowBarOpen.set(value === true || value === "true");
    return;
  }
  if (key === "NowBarSide") {
    $nowBarSide.set(value === "right" ? "right" : "left");
    return;
  }

  Spicetify.LocalStorage.set(`${prefix}${key}`, stringify(value));
}

function get(key: string) {
  if (key === "currentlyFetching") return $currentlyFetching.get();
  if (key === "currentLyricsData") return $currentLyricsData.get();
  if (key === "developerMode") return $developerMode.get() ? "true" : "false";
  if (key === "musixmatchToken") return $musixmatchToken.get();
  if (key === "IsNowBarOpen") return $isNowBarOpen.get() ? "true" : "false";
  if (key === "NowBarSide") return $nowBarSide.get();

  return Spicetify.LocalStorage.get(`${prefix}${key}`);
}

export default { set, get };
