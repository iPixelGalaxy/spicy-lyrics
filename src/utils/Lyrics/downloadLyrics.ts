import { $currentLyricsData } from "../stores";
import { toast } from "sonner";
import { SpotifyPlayer } from "../../components/Global/SpotifyPlayer";
import YAML from "yaml";

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\- .]/g, "_").slice(0, 100);
}

function formatTime(sec: number): string {
  const ms = Math.round(sec * 1000);
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${milliseconds
    .toString()
    .padStart(3, "0")}`;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function generateTTMLFromLyricsData(data: any, forceLine: boolean = false): string {
  let bodyContent = "";

  if (data.Type === "Static") {
    bodyContent = (data.Lines || []).map((line: any) => {
      const text = escapeXml(line.Text || "");
      return `      <p>${text}</p>`;
    }).join("\n");
  } else if (data.Type === "Line") {
    bodyContent = (data.Content || []).filter((item: any) => item.Type === "Vocal").map((line: any) => {
      const text = escapeXml(line.Text || "");
      const begin = formatTime(line.StartTime ?? 0);
      const end = formatTime(line.EndTime ?? 0);
      return `      <p begin="${begin}" end="${end}">${text}</p>`;
    }).join("\n");
  } else if (data.Type === "Syllable") {
    bodyContent = (data.Content || []).filter((item: any) => item.Type === "Vocal").map((line: any) => {
      const lead = line.Lead;
      if (!lead) return "";
      const begin = formatTime(lead.StartTime ?? 0);
      const end = formatTime(lead.EndTime ?? 0);

      if (forceLine) {
        const text = escapeXml(lead.Syllables?.map((s: any) => s.Text || "").join(" ") || "");
        return `      <p begin="${begin}" end="${end}"${line.OppositeAligned ? ' ttm:agent="v2"' : ""}>${text}</p>`;
      }
      
      const leadSpans = (lead.Syllables || []).map((s: any, index: number) => {
        const sBegin = formatTime(s.StartTime ?? 0);
        const sEnd = formatTime(s.EndTime ?? 0);
        const prevSyllable = index > 0 ? lead.Syllables[index - 1] : null;
        const prefix = (prevSyllable && !prevSyllable.IsPartOfWord) ? " " : "";
        const sText = escapeXml(s.Text || "");
        
        // If there's only 1 syllable for the entire line, don't wrap it in a span to avoid redundancy
        if (lead.Syllables.length === 1 && sBegin === begin && sEnd === end) {
          return `${prefix}${sText}`;
        }
        
        // Put the prefix outside the span so it isn't highlighted by karaoke players
        return `${prefix}<span begin="${sBegin}" end="${sEnd}">${sText}</span>`;
      }).join("");

      // Background vocals
      const backgrounds = line.Background || [];
      let bgMarkup = "";
      if (backgrounds.length > 0 && !forceLine) {
        const bgSpans = backgrounds.map((bg: any) => {
          const bgSyllables = (bg.Syllables || []).map((s: any, index: number) => {
            const sBegin = formatTime(s.StartTime ?? 0);
            const sEnd = formatTime(s.EndTime ?? 0);
            const prevSyllable = index > 0 ? bg.Syllables[index - 1] : null;
            const prefix = (prevSyllable && !prevSyllable.IsPartOfWord) ? " " : "";
            const sText = escapeXml(s.Text || "");
            if (bg.Syllables.length === 1 && sBegin === formatTime(bg.StartTime ?? 0) && sEnd === formatTime(bg.EndTime ?? 0)) {
              return `${prefix}<span begin="${sBegin}" end="${sEnd}">${sText}</span>`;
            }
            return `${prefix}<span begin="${sBegin}" end="${sEnd}">${sText}</span>`;
          }).join("");
          return bgSyllables;
        }).join("");
        bgMarkup = ` <span ttm:role="x-bg">${bgSpans}</span>`;
      }

      return `      <p begin="${begin}" end="${end}"${line.OppositeAligned ? ' ttm:agent="v2"' : ""}>${leadSpans}${bgMarkup}</p>`;
    }).filter(Boolean).join("\n");
  }

  const writers = (data.SongWriters || []).map((writer: string) => {
    return `      <amll:meta key="songwriter" value="${escapeXml(writer)}" />`;
  }).join("\n");
  const writersBlock = writers ? `\n${writers}` : "";

  return `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:amll="http://www.apple.com/apple-music/line-level">
  <head>
    <metadata>
      <ttm:title>${escapeXml(data.title || "Lyrics")}</ttm:title>${writersBlock}
    </metadata>
  </head>
  <body>
    <div>
${bodyContent}
    </div>
  </body>
</tt>`;
}

export async function downloadCurrentLyricsAsTTML(forceLine: boolean = false) {
  const rawLyrics = $currentLyricsData.get();
  if (!rawLyrics || rawLyrics.startsWith("NO_LYRICS:")) {
    toast.error("No lyrics available to download.", { duration: 4000 });
    return;
  }

  let lyricsData: any;
  try {
    lyricsData = JSON.parse(rawLyrics);
  } catch (_err) {
    toast.error("Error parsing lyrics data.", { duration: 4000 });
    return;
  }

  if (lyricsData.Type === "Static") {
    toast.warning("Current lyrics are not synced, downloading static text instead.", { duration: 4000 });
  }

  const ttmlContent = generateTTMLFromLyricsData(lyricsData, forceLine);
  const blob = new Blob([ttmlContent], { type: "application/ttml+xml" });
  const url = URL.createObjectURL(blob);
  
  const titleStr = SpotifyPlayer.GetName() || "lyrics";
  const artists = SpotifyPlayer.GetArtists() || [];
  const artistStr = artists.length > 0 ? artists.map((a) => a.name).join(", ") : "";
  const title = artistStr ? `${titleStr} - ${artistStr}` : titleStr;
  const filename = `${sanitizeFilename(title)}.ttml`;

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function generateLyricsfileFromLyricsData(data: any): string {
  const titleStr = SpotifyPlayer.GetName() || data.title || "Lyrics";
  const artists = SpotifyPlayer.GetArtists() || [];
  const artistStr = artists.length > 0 ? artists.map((a) => a.name).join(", ") : (data.artist || "Unknown Artist");

  const doc: any = {
    version: "1.0",
    metadata: {
      title: titleStr,
      artist: artistStr,
      ...(data.SongWriters?.length ? { songwriters: data.SongWriters } : {}),
    },
  };

  if (data.Type === "Static") {
    if (data.Lines?.some((l: any) => l.Text?.includes("Instrumental"))) {
      doc.metadata.instrumental = true;
    } else {
      doc.plain = (data.Lines || []).map((l: any) => l.Text || "").join("\n");
    }
  } else if (data.Type === "Line") {
    doc.lines = (data.Content || [])
      .filter((item: any) => item.Type === "Vocal")
      .map((line: any) => ({
        text: line.Text || "",
        start_ms: Math.round((line.StartTime ?? 0) * 1000),
        end_ms: Math.round((line.EndTime ?? 0) * 1000),
      }));
  } else if (data.Type === "Syllable") {
    doc.lines = (data.Content || [])
      .filter((item: any) => item.Type === "Vocal" && item.Lead)
      .map((line: any) => {
        const lead = line.Lead;
        const lineText = (lead.Syllables || [])
          .map((s: any, idx: number) => {
            const next = lead.Syllables[idx + 1];
            return s.Text + (s.IsPartOfWord || !next ? "" : " ");
          })
          .join("");

        const words = (lead.Syllables || []).map((s: any, idx: number) => {
          const next = lead.Syllables[idx + 1];
          const hasSpace = !s.IsPartOfWord && next;
          return {
            text: s.Text + (hasSpace ? " " : ""),
            start_ms: Math.round((s.StartTime ?? 0) * 1000),
            end_ms: Math.round((s.EndTime ?? 0) * 1000),
          };
        });

        return {
          text: lineText,
          start_ms: Math.round((lead.StartTime ?? 0) * 1000),
          end_ms: Math.round((lead.EndTime ?? 0) * 1000),
          words,
        };
      });
  }

  return YAML.stringify(doc);
}

export async function downloadCurrentLyricsAsLyricsfile() {
  const rawLyrics = $currentLyricsData.get();
  if (!rawLyrics || rawLyrics.startsWith("NO_LYRICS:")) {
    toast.error("No lyrics available to download.", { duration: 4000 });
    return;
  }

  let lyricsData: any;
  try {
    lyricsData = JSON.parse(rawLyrics);
  } catch (_err) {
    toast.error("Error parsing lyrics data.", { duration: 4000 });
    return;
  }

  const yamlContent = generateLyricsfileFromLyricsData(lyricsData);
  const blob = new Blob([yamlContent], { type: "application/x-yaml" });
  const url = URL.createObjectURL(blob);

  const titleStr = SpotifyPlayer.GetName() || "lyrics";
  const artists = SpotifyPlayer.GetArtists() || [];
  const artistStr = artists.length > 0 ? artists.map((a) => a.name).join(", ") : "";
  const title = artistStr ? `${titleStr} - ${artistStr}` : titleStr;
  const filename = `${sanitizeFilename(title)}.lyricsfile.yaml`;

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

