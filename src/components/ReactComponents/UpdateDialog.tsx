import React, { useEffect, useState } from "react";
import { coerce, gt, lt, lte } from "semver";

const PATCH_NOTES_URL = "https://raw.githubusercontent.com/iPixelGalaxy/spicy-lyrics/dev/.change-notes/PATCH_NOTES.md";
const PATCH_NOTES_PAGE_URL = "https://github.com/iPixelGalaxy/spicy-lyrics/blob/dev/.change-notes/PATCH_NOTES.md";
const FEATURE_GUIDE_URL = "https://github.com/iPixelGalaxy/spicy-lyrics/blob/dev/.change-notes/FEATURE_CHANGES.md";
const FETCH_TIMEOUT_MS = 10_000;

interface UpdateDialogProps { fromVersion: string; spicyLyricsVersion: string; }
type PatchNote = { text: string; version: string; };

function normalizeVersion(value: string) { return coerce(value.trim()); }
function getLatestPatchVersion(markdown: string): string | null {
  return markdown.match(/^##\s+v?(\d+\.\d+\.\d+)\s*$/im)?.[1] ?? null;
}

function getPatchNotes(markdown: string, fromVersion: string, installedVersion: string): PatchNote[] {
  const installed = normalizeVersion(installedVersion);
  const from = normalizeVersion(fromVersion);
  if (!installed || (from && !gt(installed, from))) return [];

  const notes: PatchNote[] = [];
  let version: string | null = null;
  let currentNote: string[] | null = null;
  const finishNote = () => {
    if (!version || !currentNote) return;
    const noteVersion = normalizeVersion(version);
    if (noteVersion && lte(noteVersion, installed) && (!from || gt(noteVersion, from))) notes.push({ version, text: currentNote.join(" ").trim() });
    currentNote = null;
  };

  for (const line of markdown.replace(/\r/g, "").split("\n")) {
    const versionMatch = line.match(/^##\s+v?(\d+\.\d+\.\d+)\s*$/i);
    if (versionMatch) { finishNote(); version = versionMatch[1]; continue; }
    const noteMatch = line.match(/^\s*[-*]\s+(.+)$/);
    if (noteMatch) { finishNote(); currentNote = [noteMatch[1].trim()]; continue; }
    if (currentNote && line.trim() && !line.startsWith("#")) currentNote.push(line.trim());
  }
  finishNote();
  return notes;
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > cursor) tokens.push(text.slice(cursor, match.index));
    const key = `${match.index}-${match[0]}`;
    if (match[1] && match[2]) tokens.push(<a key={key} href={match[2]} target="_blank" rel="noreferrer">{match[1]}</a>);
    else if (match[3]) tokens.push(<strong key={key}>{match[3]}</strong>);
    else if (match[4]) tokens.push(<code key={key}>{match[4]}</code>);
    cursor = pattern.lastIndex;
  }
  if (cursor < text.length) tokens.push(text.slice(cursor));
  return tokens;
}

function hasPixelEditionVersion(fromVersion: string): boolean { return /^100\.10\.\d+$/i.test(fromVersion.trim()); }
function needsWalkthrough(fromVersion: string): boolean { return !hasPixelEditionVersion(fromVersion); }
function isDowngrade(fromVersion: string, installedVersion: string): boolean {
  const from = normalizeVersion(fromVersion);
  const installed = normalizeVersion(installedVersion);
  return Boolean(from && installed && lt(installed, from));
}

const UpdateDialog: React.FC<UpdateDialogProps> = ({ fromVersion, spicyLyricsVersion }) => {
  const [notes, setNotes] = useState<PatchNote[]>([]);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);
  const downgraded = isDowngrade(fromVersion, spicyLyricsVersion);
  const showUpgradeNotes = hasPixelEditionVersion(fromVersion);
  const onLatestVersion = Boolean(
    latestVersion && normalizeVersion(latestVersion)?.version === normalizeVersion(spicyLyricsVersion)?.version
  );

  useEffect(() => {
    const controller = new AbortController();
    let closed = false;
    const timeout = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    setState("loading");
    fetch(PATCH_NOTES_URL, { signal: controller.signal, cache: "no-store" })
      .then((response) => { if (!response.ok) throw new Error(`Patch notes request failed: ${response.status}`); return response.text(); })
      .then((markdown) => {
        setLatestVersion(getLatestPatchVersion(markdown));
        setNotes(getPatchNotes(markdown, fromVersion, spicyLyricsVersion));
        setState("ready");
      })
      .catch(() => { if (!closed) setState("error"); })
      .finally(() => window.clearTimeout(timeout));
    return () => { closed = true; window.clearTimeout(timeout); controller.abort(); };
  }, [fromVersion, retry, spicyLyricsVersion]);

  return <div className="update-card-wrapper">
    <div className="uc-header">
      <div>
        <h2 className="uc-title">Spicy Lyrics {downgraded ? "downgraded" : "updated"}!</h2>
        <p className="uc-subtitle">{onLatestVersion ? "You're running the latest version." : <>You are running: <strong>{spicyLyricsVersion}</strong> Latest is: <strong>{latestVersion ?? "Checking…"}</strong></>}</p>
      </div>
      <div className="uc-actions">
        {needsWalkthrough(fromVersion) && <button className="btn-secondary" onClick={() => window.open(FEATURE_GUIDE_URL, "_blank")}>New to Pixel Edition?</button>}
        <button className="btn-primary" onClick={() => window.open(PATCH_NOTES_PAGE_URL, "_blank")}>See all patch notes</button>
        <button className="btn-discord" onClick={() => window.open("https://discord.com/invite/uqgXU5wh8j", "_blank")}>Discord</button>
      </div>
    </div>
    <div className="uc-divider" />
    {(fromVersion || spicyLyricsVersion) && <div className="uc-version-row">
      {fromVersion && <span className="uc-ver">{fromVersion}</span>}
      {fromVersion && spicyLyricsVersion && <span className="uc-arrow">-&gt;</span>}
      {spicyLyricsVersion && <span className="uc-ver new">{spicyLyricsVersion}</span>}
    </div>}
    {showUpgradeNotes && <section className="uc-patch-notes" aria-label="Patch notes" aria-live="polite">
      {state === "loading" && <p className="uc-notes-status">Loading patch notes…</p>}
      {state === "error" && <p className="uc-notes-status">Couldn&apos;t load patch notes. <button className="btn-quiet" type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button></p>}
      {state === "ready" && notes.length === 0 && <p className="uc-notes-status">No patch notes are available for this update.</p>}
      {state === "ready" && notes.length > 0 && <ul>{notes.map((note, index) => <li key={`${note.version}-${index}`}>{renderInlineMarkdown(note.text)}</li>)}</ul>}
    </section>}
  </div>;
};

export default UpdateDialog;
