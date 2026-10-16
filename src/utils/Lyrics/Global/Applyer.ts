// deno-lint-ignore-file no-explicit-any

import { $currentLyricsData, $currentLyricsType, $customFont, $customFontEnabled, $spaceGravityMode } from "../../stores.ts";
import { ClearScrollSimplebar } from "../../Scrolling/Simplebar/ScrollSimplebar.ts";
import { setBlurringLastLine } from "../Animator/Lyrics/LyricsAnimator.ts";
import { DestroyAllLyricsContainers } from "../Applyer/CreateLyricsContainer.ts";
import { EmitApply, EmitNotApplyed } from "../Applyer/OnApply.ts";
import { ApplyStaticLyrics, type StaticLyricsData } from "../Applyer/Static.ts";
import { ApplyLineLyrics } from "../Applyer/Synced/Line.ts";
import { ApplySyllableLyrics, ClearSyllableRenderSession } from "../Applyer/Synced/Syllable.ts";
import {
  ConvertLineLyricsToExperimentalWordSync,
  ConvertStaticLyricsToExperimentalWordSync,
  SplitAppleMusicSyllableWords,
} from "../ExperimentalWordSync.ts";
import { getDynamicAudioAnalysis } from "../../audioAnalysis.ts";
import fetchLyrics, { ClearLyricsPageContainer, getSongKey } from "../fetchLyrics.ts";
import { BuildLyricsNotice, HasNotice, SetShownNotice, SyncNoLyricsLayout } from "../LyricsNotice.ts";
import { ClearLyricsContentArrays, isRomanized, LyricsObject, setRomanizedStatus } from "../lyrics.ts";
import { HideLoaderContainer, PaintLyricsLoader, ShowQueueLoader } from "../LyricsLoader.ts";
import { PageContainer } from "../../../components/Pages/PageView.ts";
import { CleanUpIsByCommunity } from "../Applyer/Credits/ApplyIsByCommunity.tsx";
import { SpotifyPlayer } from "../../../components/Global/SpotifyPlayer.ts";
import { ApplyMemeFormat, NormalizeLyricsCommaSpacing } from "../ProcessLyrics.ts";
import Defaults from "../../../components/Global/Defaults.ts";
import { captureLyricsViewportAnchor, triggerRemeasureLV } from "../LyricsVirtualizer.ts";
import { UpdateStaticLyricsRomanization } from "../Applyer/Static.ts";
import { UpdateLineLyricsRomanization } from "../Applyer/Synced/Line.ts";
import { UpdateSyllableLyricsRomanization } from "../Applyer/Synced/Syllable.ts";
import { needsDefaultLyricsFont } from "../LyricsFontFallback.ts";

/**
 * Union type for all lyrics data types
 */
export type LyricsData = {
  Type: "Syllable" | "Line" | "Static" | string;
  [key: string]: any;
};

function isAppleMusicLyrics(lyrics: LyricsData): boolean {
  return (
    lyrics.sourceDisplayName?.trim().toLowerCase() === "apple music" ||
    lyrics.source?.toLowerCase() === "aml" ||
    lyrics.source?.toLowerCase() === "apple" ||
    lyrics.fetchProvider?.toLowerCase() === "aml" ||
    lyrics.fetchProvider?.toLowerCase() === "apple"
  );
}


let currentAbortController: AbortController | null = null;
let appliedLyricsIdentity: string | null = null;
let renderedLyrics: LyricsData | null = null;
let applyGeneration = 0;
let fontCheckGeneration = 0;
const watchedFontDocuments = new WeakSet<Document>();

async function refreshLyricsFontFallback(): Promise<void> {
  const checkGeneration = ++fontCheckGeneration;
  const renderGeneration = applyGeneration;
  const page = PageContainer;
  const lyrics = renderedLyrics;
  if (!page || !lyrics) return;

  const targetDocument = page.ownerDocument;
  if (targetDocument.fonts && !watchedFontDocuments.has(targetDocument)) {
    watchedFontDocuments.add(targetDocument);
    targetDocument.fonts.addEventListener("loadingdone", () => {
      if (PageContainer?.ownerDocument === targetDocument) void refreshLyricsFontFallback();
    });
  }

  let fallback = false;
  if ($customFontEnabled.get()) {
    const elements = lyrics.Type === "Syllable"
      ? LyricsObject.Types.Syllable.Lines.filter(line => !line.DotLine).flatMap(line =>
          line.Syllables?.Lead.filter(word => !word.Dot).map(word => word.HTMLElement) ?? [])
      : lyrics.Type === "Line"
        ? LyricsObject.Types.Line.Lines.filter(line => !line.DotLine).map(line => line.HTMLElement)
        : LyricsObject.Types.Static.Lines.map(line => line.HTMLElement);
    const variant = isRomanized ? "lyricsRomanizedText" : "lyricsOriginalText";
    const text = elements.map(element => element.dataset[variant] ?? element.textContent ?? "").join("\n");
    fallback = await needsDefaultLyricsFont($customFont.get(), text, targetDocument);
  }

  if (checkGeneration !== fontCheckGeneration || renderGeneration !== applyGeneration ||
      PageContainer !== page || renderedLyrics !== lyrics) return;
  if (page.classList.contains("LyricsFontFallback") !== fallback) {
    page.classList.toggle("LyricsFontFallback", fallback);
    triggerRemeasureLV();
  }
}

$customFont.listen(() => { void refreshLyricsFontFallback(); });
$customFontEnabled.listen(() => { void refreshLyricsFontFallback(); });

/**
 * A song change starts a new rendering epoch before its lyrics request settles.
 * This prevents an older async word-sync conversion from replacing the new song.
 */
export function InvalidatePendingLyricsApplication(): void {
  applyGeneration += 1;
}

export function ShouldReapplyRenderedLyricsForSpaceGravity(enabled: boolean): boolean {
  if (!renderedLyrics) return false;

  if (enabled) {
    return renderedLyrics.Type === "Line" || renderedLyrics.Type === "Static";
  }

  return renderedLyrics.experimentalWordSyncReason === "SpaceGravity";
}

export function UpdateRenderedRomanization(useRomanized: boolean): boolean {
  if (!renderedLyrics) return false;

  if (renderedLyrics.Type === "Syllable") {
    UpdateSyllableLyricsRomanization(useRomanized);
  } else if (renderedLyrics.Type === "Line") {
    UpdateLineLyricsRomanization(useRomanized);
  } else if (renderedLyrics.Type === "Static") {
    UpdateStaticLyricsRomanization(useRomanized);
  } else {
    return false;
  }

  setRomanizedStatus(useRomanized);
  void refreshLyricsFontFallback();
  triggerRemeasureLV();
  return true;
}

function getLyricsIdentity(descriptor: object | string): string | null {
  if (descriptor && typeof descriptor === "object" && typeof (descriptor as any).id === "string") {
    return (descriptor as any).id;
  }
  return SpotifyPlayer.GetUri() ?? null;
}

export const cleanupApplyLyricsAbortController = () => {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null
  }
}

export function ShouldApplyLyricsForUri(
  expectedUri: string | undefined,
  lyricsContent: [object | string, number] | null
): boolean {
  if (!expectedUri || !lyricsContent) {
    return false;
  }

  const currentUri = SpotifyPlayer.GetUri() ?? "";
  if (getSongKey(expectedUri) !== getSongKey(currentUri)) {
    return false;
  }

  const [descriptor] = lyricsContent;
  if (!descriptor || typeof descriptor === "string") {
    return true;
  }

  const descriptorId = typeof (descriptor as any).id === "string"
    ? (descriptor as any).id
    : null;
  if (!descriptorId) {
    return true;
  }

  const currentId = currentUri.startsWith("spotify:local:")
    ? getSongKey(currentUri)
    : SpotifyPlayer.GetId();
  return descriptorId === currentId;
}

export async function ApplyLyricsIfCurrent(
  expectedUri: string | undefined,
  lyricsContent: [object | string, number] | null
): Promise<void> {
  if (!ShouldApplyLyricsForUri(expectedUri, lyricsContent)) {
    return;
  }

  await ApplyLyrics(lyricsContent);
}

/**
 * Apply lyrics based on their type
 * @param lyrics - The lyrics data to apply
 */
export default async function ApplyLyrics(lyricsContent: [object | string, number] | null): Promise<void> {
  if (!PageContainer || !lyricsContent) return;
  const generation = ++applyGeneration;
  const page = PageContainer;
  const uri = SpotifyPlayer.GetUri();
  setBlurringLastLine(null);
  const [descriptor, _status] = lyricsContent;
  if (descriptor === "lyrics-queued") {
    ShowQueueLoader();
    SetShownNotice(null);
    SyncNoLyricsLayout();
    return;
  }
  const incomingLyricsIdentity = getLyricsIdentity(descriptor);
  const viewportAnchor =
    incomingLyricsIdentity !== null && incomingLyricsIdentity === appliedLyricsIdentity
      ? captureLyricsViewportAnchor()
      : null;

  const isNotice = typeof descriptor === "string" && HasNotice(descriptor);

  let lyrics: LyricsData | null = null;

  if (!isNotice) {
    lyrics = descriptor as LyricsData;
    NormalizeLyricsCommaSpacing(lyrics);
    const sourceNeedsWordSync = lyrics.Type === "Line" || lyrics.Type === "Static";
    const shouldUseExperimentalWordSync =
      sourceNeedsWordSync && (Defaults.EnableExperimentalWordSync || $spaceGravityMode.get());

    if (shouldUseExperimentalWordSync) {
      const analysisTrackId =
        typeof lyrics.id === "string" && lyrics.id.length > 0
          ? lyrics.id
          : SpotifyPlayer.GetId() ?? "";
      const audioAnalysis = analysisTrackId
        ? await getDynamicAudioAnalysis(analysisTrackId)
        : null;

      // Keep current lyrics mounted while analysis loads. A newer apply owns the
      // page, and a Gravity toggle may have removed its temporary requirement.
      if (generation !== applyGeneration || PageContainer !== page || SpotifyPlayer.GetUri() !== uri) return;

      const forceWordSyncForSpaceGravity =
        !Defaults.EnableExperimentalWordSync && $spaceGravityMode.get();
      if (Defaults.EnableExperimentalWordSync || forceWordSyncForSpaceGravity) {
        if (lyrics.Type === "Line") {
          lyrics = ConvertLineLyricsToExperimentalWordSync(lyrics, audioAnalysis) as LyricsData;
        } else {
          lyrics = ConvertStaticLyricsToExperimentalWordSync(
            lyrics,
            audioAnalysis,
            SpotifyPlayer.GetDuration() / 1000
          ) as LyricsData;
        }

        if (forceWordSyncForSpaceGravity && lyrics.experimentalWordSync) {
          lyrics.experimentalWordSyncReason = "SpaceGravity";
        }

        // Re-apply gibberish for newly-created syllables. Original formatting
        // ran before conversion, while lyrics were still Line/Static.
        if (Defaults.MemeFormat !== "Off") {
          ApplyMemeFormat(lyrics);
        }
      }
    } else if (
      Defaults.EnableExperimentalWordSync &&
      lyrics.Type === "Syllable" &&
      isAppleMusicLyrics(lyrics)
    ) {
      lyrics = SplitAppleMusicSyllableWords(lyrics) as LyricsData;

      if (lyrics.experimentalAppleWordSplitting && Defaults.MemeFormat !== "Off") {
        ApplyMemeFormat(lyrics);
      }
    }

    // Word-sync conversion may introduce new syllables, so normalize its output
    // before the renderer and any regenerated display text consume it.
    NormalizeLyricsCommaSpacing(lyrics);
  }

  if (generation !== applyGeneration || PageContainer !== page || SpotifyPlayer.GetUri() !== uri) return;
  if (lyrics && !viewportAnchor && uri) {
    await PaintLyricsLoader(uri);
    if (generation !== applyGeneration || PageContainer !== page || SpotifyPlayer.GetUri() !== uri) return;
  }

  cleanupApplyLyricsAbortController();
  renderedLyrics = null;
  page.classList.remove("LyricsFontFallback");
  EmitNotApplyed();
  ClearSyllableRenderSession();
  DestroyAllLyricsContainers();
  ClearLyricsContentArrays();
  ClearScrollSimplebar();
  ClearLyricsPageContainer();
  CleanUpIsByCommunity();

  if (isNotice) {
    $currentLyricsType.set("None");

    if (descriptor === "lyrics-not-found") {
      const trackId = SpotifyPlayer.GetId() ?? "";
      $currentLyricsData.set(`NO_LYRICS:${uri ?? trackId}`);
    } else {
      $currentLyricsData.set("");
    }

    const lyricsContainer = PageContainer.querySelector<HTMLElement>(
      ".LyricsContainer .LyricsContent"
    );

    if (!lyricsContainer) return;

    if (!currentAbortController || currentAbortController.signal.aborted) {
      currentAbortController = new AbortController();
    }

    const noticeUri = uri;
    lyricsContainer.appendChild(
      BuildLyricsNotice(descriptor as string, _status, noticeUri, currentAbortController.signal, () => {
        // Retry the track that's playing now; a notice left over from a
        // skipped track is replaced by that track's own apply anyway.
        const uri = SpotifyPlayer.GetUri();
        if (uri) fetchLyrics(uri).then(ApplyLyrics);
      })
    );

    SetShownNotice(descriptor);
    SyncNoLyricsLayout();

    EmitApply("None", null)
    appliedLyricsIdentity = null;
    renderedLyrics = null;
    if (uri) await HideLoaderContainer(uri);
    return;
  }

  if (!lyrics) {
    if (uri) await HideLoaderContainer(uri);
    return;
  }

  Defaults.CurrentLyricsType = lyrics.Type;
  $currentLyricsType.set(lyrics.Type);
  // The first renderer pass must establish its real container before Gravity
  // takes ownership. Gravity then switches in through the mounted-session path.
  PageContainer?.classList.remove("SpaceGravityMode");

  // Lyrics replace any notice, whichever path applied them (a TTML upload re-applies
  // without going through fetchLyrics), so a later layout sync can't hide them.
  SetShownNotice(null);
  SyncNoLyricsLayout();

  const romanize = isRomanized;

  if (Defaults.RightAlignLyrics && lyrics.Content) {
    for (const item of (lyrics as any).Content) {
      item.OppositeAligned = !item.OppositeAligned;
    }
  }

  if (lyrics.Type === "Syllable") {
    ApplySyllableLyrics(lyrics as any, romanize, viewportAnchor);
  } else if (lyrics.Type === "Line") {
    ApplyLineLyrics(lyrics as any, romanize, viewportAnchor);
  } else if (lyrics.Type === "Static") {
    // Type assertion to StaticLyricsData since we've verified the Type is "Static"
    ApplyStaticLyrics(lyrics as StaticLyricsData, romanize, viewportAnchor);
  }

  appliedLyricsIdentity = incomingLyricsIdentity;
  renderedLyrics = lyrics;
  void refreshLyricsFontFallback();
  if (uri) await HideLoaderContainer(uri);
}
