import { describe, expect, it } from "bun:test";
import { isLyricsfile, parseLyricsfileToLyrics } from "./ParseLyricsfile";

describe("ParseLyricsfile", () => {
  it("detects lyricsfile YAML content correctly", () => {
    const validWordSynced = `
version: '1.0'
metadata:
  title: 'Song Title'
  artist: 'Artist'
lines:
  - text: 'Hello world'
    start_ms: 1200
    words:
      - text: 'Hello '
        start_ms: 1200
        end_ms: 1800
`;
    expect(isLyricsfile(validWordSynced)).toBe(true);

    const validLineSynced = `
version: '1.0'
metadata:
  title: 'Song Title'
  artist: 'Artist'
lines:
  - text: 'Hello world'
    start_ms: 1200
    end_ms: 2500
`;
    expect(isLyricsfile(validLineSynced)).toBe(true);

    const validPlain = `
version: '1.0'
metadata:
  title: 'Song Title'
  artist: 'Artist'
plain: |
  Line 1
  Line 2
`;
    expect(isLyricsfile(validPlain)).toBe(true);

    expect(isLyricsfile("<tt><body><div><p>hello</p></div></body></tt>")).toBe(false);
    expect(isLyricsfile("[00:12.34]Hello world")).toBe(false);
    expect(isLyricsfile('{"type": "Line"}')).toBe(false);
  });

  it("parses word-synced lyricsfile correctly", () => {
    const yaml = `
version: '1.0'

metadata:
  title: 'Small Hours'
  artist: 'Example Artist'
  language: 'en'
  songwriters: 'John Doe, Jane Smith'

lines:
  - text: 'Stay until the morning'
    start_ms: 4200
    end_ms: 6800
    words:
      - text: 'Stay '
        start_ms: 4200
        end_ms: 4800
      - text: 'until '
        start_ms: 4800
        end_ms: 5400
      - text: 'the '
        start_ms: 5400
        end_ms: 5750
      - text: 'morning'
        start_ms: 5750
        end_ms: 6800
`;

    const result = parseLyricsfileToLyrics(yaml);
    expect(result.Type).toBe("Syllable");
    expect(result.SongWriters).toEqual(["John Doe", "Jane Smith"]);
    expect(result.StartTime).toBe(4.2);
    expect(result.Content.length).toBe(1);

    const line = result.Content[0];
    expect(line.Type).toBe("Vocal");
    expect(line.Lead.StartTime).toBe(4.2);
    expect(line.Lead.EndTime).toBe(6.8);
    expect(line.Lead.Syllables.length).toBe(4);

    expect(line.Lead.Syllables[0]).toEqual({
      Text: "Stay",
      StartTime: 4.2,
      EndTime: 4.8,
      IsPartOfWord: false,
    });
    expect(line.Lead.Syllables[1]).toEqual({
      Text: "until",
      StartTime: 4.8,
      EndTime: 5.4,
      IsPartOfWord: false,
    });
    expect(line.Lead.Syllables[2]).toEqual({
      Text: "the",
      StartTime: 5.4,
      EndTime: 5.75,
      IsPartOfWord: false,
    });
    expect(line.Lead.Syllables[3]).toEqual({
      Text: "morning",
      StartTime: 5.75,
      EndTime: 6.8,
      IsPartOfWord: false,
    });
  });

  it("handles sub-word syllable splits (IsPartOfWord: true)", () => {
    const yaml = `
version: '1.0'
metadata:
  title: 'Test'
  artist: 'Artist'
lines:
  - text: 'synchronized'
    start_ms: 1000
    end_ms: 3000
    words:
      - text: 'syn'
        start_ms: 1000
        end_ms: 1500
      - text: 'chro'
        start_ms: 1500
        end_ms: 2200
      - text: 'nized'
        start_ms: 2200
        end_ms: 3000
`;

    const result = parseLyricsfileToLyrics(yaml);
    expect(result.Type).toBe("Syllable");
    const syllables = result.Content[0].Lead.Syllables;
    expect(syllables.length).toBe(3);
    expect(syllables[0].IsPartOfWord).toBe(true);
    expect(syllables[1].IsPartOfWord).toBe(true);
    expect(syllables[2].IsPartOfWord).toBe(false);
  });

  it("parses line-synced lyricsfile correctly", () => {
    const yaml = `
version: '1.0'

metadata:
  title: 'Two Voices'
  artist: 'Example Duo'
  language: 'en'

lines:
  - text: 'I will follow the river'
    start_ms: 10000
    end_ms: 15000
  - text: 'Follow the river home'
    start_ms: 12500
    end_ms: 16500
`;

    const result = parseLyricsfileToLyrics(yaml);
    expect(result.Type).toBe("Line");
    expect(result.StartTime).toBe(10);
    expect(result.Content.length).toBe(2);

    expect(result.Content[0]).toEqual({
      Type: "Vocal",
      Text: "I will follow the river",
      StartTime: 10,
      EndTime: 15,
      OppositeAligned: false,
    });

    expect(result.Content[1]).toEqual({
      Type: "Vocal",
      Text: "Follow the river home",
      StartTime: 12.5,
      EndTime: 16.5,
      OppositeAligned: false,
    });
  });

  it("parses plain static lyricsfile correctly", () => {
    const yaml = `
version: '1.0'

metadata:
  title: 'City Signals'
  artist: 'Example Artist'
  language: 'en'

plain: |
  Waiting for the signal
  Watching all the lights change
`;

    const result = parseLyricsfileToLyrics(yaml);
    expect(result.Type).toBe("Static");
    expect(result.Lines).toEqual([
      { Text: "Waiting for the signal" },
      { Text: "Watching all the lights change" },
    ]);
  });

  it("parses instrumental lyricsfile correctly", () => {
    const yaml = `
version: '1.0'
metadata:
  title: 'Instrumental Song'
  artist: 'Composer'
  instrumental: true
`;

    const result = parseLyricsfileToLyrics(yaml);
    expect(result.Type).toBe("Static");
    expect(result.Lines).toEqual([{ Text: "♪ Instrumental ♪" }]);
  });

  it("handles missing end_ms gracefully in word-synced and line-synced files", () => {
    const yaml = `
version: '1.0'
metadata:
  title: 'No End Times'
  artist: 'Artist'
lines:
  - text: 'First line'
    start_ms: 1000
    words:
      - text: 'First '
        start_ms: 1000
      - text: 'line'
        start_ms: 1500
  - text: 'Second line'
    start_ms: 3000
`;

    const result = parseLyricsfileToLyrics(yaml);
    expect(result.Type).toBe("Syllable");
    expect(result.Content.length).toBe(2);
    expect(result.Content[0].Lead.StartTime).toBe(1);
    expect(result.Content[0].Lead.EndTime).toBeGreaterThanOrEqual(1.5);
    expect(result.Content[1].Lead.StartTime).toBe(3);
  });

  it("parses duets correctly with singer / opposite_aligned properties", () => {
    const yaml = `
version: '1.0'
metadata:
  title: 'Duet Song'
  artist: 'Duo'
lines:
  - text: 'Left vocal'
    start_ms: 1000
    end_ms: 3000
    singer: 'Singer 1'
  - text: 'Right vocal'
    start_ms: 3500
    end_ms: 6000
    singer: 'Singer 2'
`;

    const result = parseLyricsfileToLyrics(yaml);
    expect(result.Type).toBe("Line");
    expect(result.Content[0].OppositeAligned).toBe(false);
    expect(result.Content[1].OppositeAligned).toBe(true);
  });

  it("parses background vocals and merges into previous lead line", () => {
    const yaml = `
version: '1.0'
metadata:
  title: 'Backing Vocals'
  artist: 'Artist'
lines:
  - text: 'Lead melody'
    start_ms: 2000
    end_ms: 5000
    words:
      - text: 'Lead '
        start_ms: 2000
        end_ms: 3000
      - text: 'melody'
        start_ms: 3000
        end_ms: 5000
  - text: '(backing harmony)'
    start_ms: 3500
    end_ms: 5500
    background: true
    singer: 'v2'
    words:
      - text: 'backing '
        start_ms: 3500
        end_ms: 4500
      - text: 'harmony'
        start_ms: 4500
        end_ms: 5500
`;

    const result = parseLyricsfileToLyrics(yaml);
    expect(result.Type).toBe("Syllable");
    expect(result.Content.length).toBe(1);
    expect(result.Content[0].Lead.Syllables[0].Text).toBe("Lead");
    expect(result.Content[0].Background).toBeDefined();
    expect(result.Content[0].Background.length).toBe(1);
    expect(result.Content[0].Background[0].Syllables[0].Text).toBe("backing");
    expect(result.Content[0].Background[0].OppositeAligned).toBe(true);
  });
});


