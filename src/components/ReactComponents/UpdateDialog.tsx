import React, { useEffect, useState } from "react";
import { coerce, gt, lt, lte } from "semver";
import { NoticeLink, showNotice } from "./NoticeDialog.tsx";

const PATCH_NOTES_URL = "https://raw.githubusercontent.com/iPixelGalaxy/spicy-lyrics/dev/.change-notes/PATCH_NOTES.md";
const PATCH_NOTES_PAGE_URL = "https://github.com/iPixelGalaxy/spicy-lyrics/blob/dev/.change-notes/PATCH_NOTES.md";
const FEATURE_GUIDE_URL = "https://github.com/iPixelGalaxy/spicy-lyrics/blob/dev/.change-notes/FEATURE_CHANGES.md";
const FETCH_TIMEOUT_MS = 10_000;
const DISCORD_URL = "https://discord.com/invite/uqgXU5wh8j";

type PatchNote = { text: string; version: string; };

function normalizeVersion(value: string) { return coerce(value.trim()); }

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
    if (match[1] && match[2]) tokens.push(<a className="sl-notice-link" key={key} href={match[2]} target="_blank" rel="noreferrer">{match[1]}</a>);
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

function PatchNotes({ fromVersion, toVersion, style }: { fromVersion: string; toVersion: string; style?: React.CSSProperties }) {
  const [notes, setNotes] = useState<PatchNote[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let closed = false;
    const timeout = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    setState("loading");
    fetch(PATCH_NOTES_URL, { signal: controller.signal, cache: "no-store" })
      .then((response) => { if (!response.ok) throw new Error(`Patch notes request failed: ${response.status}`); return response.text(); })
      .then((markdown) => {
        if (closed) return;
        setNotes(getPatchNotes(markdown, fromVersion, toVersion));
        setState("ready");
      })
      .catch(() => { if (!closed) setState("error"); })
      .finally(() => window.clearTimeout(timeout));
    return () => { closed = true; window.clearTimeout(timeout); controller.abort(); };
  }, [fromVersion, retry, toVersion]);

  return <section className="sl-notice-patch-notes" aria-label="Patch notes" aria-live="polite" style={style}>
    <h3>What changed</h3>
    {state === "loading" && <p>Loading patch notes…</p>}
    {state === "error" && <p>Couldn&apos;t load patch notes. <button className="sl-notice-retry" type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button></p>}
    {state === "ready" && notes.length === 0 && <p>No patch notes are available for this update.</p>}
    {state === "ready" && notes.length > 0 && <ul>{notes.map((note, index) => <li key={`${note.version}-${index}`}>{renderInlineMarkdown(note.text)}</li>)}</ul>}
  </section>;
}

export const releaseNotesUrl = (_version: string) => PATCH_NOTES_PAGE_URL;

export function showUpdatedDialog(fromVersion: string, toVersion: string) {
  const downgraded = isDowngrade(fromVersion, toVersion);
  const content: React.ReactElement<{ style?: React.CSSProperties }>[] = [
    <p className="sl-notice-text">You were on <span className="sl-notice-version">{fromVersion}</span>. You are now on <span className="sl-notice-version">{toVersion}</span>.</p>,
  ];
  if (hasPixelEditionVersion(fromVersion) && !downgraded) {
    content.push(<PatchNotes fromVersion={fromVersion} toVersion={toVersion} />);
  }
  content.push(<p className="sl-notice-text sl-notice-text--quiet">Need help? Visit our <NoticeLink href={DISCORD_URL}>Discord</NoticeLink>.</p>);

  showNotice({
    title: downgraded ? `Changed to ${toVersion}` : `Updated to ${toVersion}`,
    content,
    primary: { label: "See all patch notes", onClick: () => window.open(PATCH_NOTES_PAGE_URL, "_blank", "noopener,noreferrer") },
    extraActions: needsWalkthrough(fromVersion)
      ? [{ label: "New to Pixel Edition?", onClick: () => window.open(FEATURE_GUIDE_URL, "_blank", "noopener,noreferrer") }]
      : undefined,
    secondaryLabel: "Close",
  });
}
