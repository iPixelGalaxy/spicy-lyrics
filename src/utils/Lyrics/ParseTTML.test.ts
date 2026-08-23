import { describe, expect, it } from "bun:test";
import { Window } from "happy-dom";

const window = new Window();
globalThis.DOMParser = window.DOMParser as any;
globalThis.Node = window.Node as any;
globalThis.Element = window.Element as any;

import parseTTMLToLyrics from "./ParseTTML";

describe("ParseTTML - Duets & Background Vocals", () => {
  it("parses duets correctly when ttm:agent is declared in head", () => {
    const ttml = `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata">
  <head>
    <metadata>
      <ttm:agent xml:id="v1" type="person">Singer 1</ttm:agent>
      <ttm:agent xml:id="v2" type="person">Singer 2</ttm:agent>
    </metadata>
  </head>
  <body>
    <div>
      <p begin="00:01.000" end="00:04.000" ttm:agent="v1">
        <span begin="00:01.000" end="00:02.000">I </span>
        <span begin="00:02.000" end="00:04.000">sing</span>
      </p>
      <p begin="00:03.500" end="00:06.000" ttm:agent="v2">
        <span begin="00:03.500" end="00:04.500">You </span>
        <span begin="00:04.500" end="00:06.000">sing</span>
      </p>
    </div>
  </body>
</tt>`;

    const result = parseTTMLToLyrics(ttml) as any;
    expect(result.Type).toBe("Syllable");
    expect(result.Content.length).toBe(2);
    expect(result.Content[0].OppositeAligned).toBe(false);
    expect(result.Content[1].OppositeAligned).toBe(true);
  });

  it("parses duets correctly when ttm:agent is only specified on paragraphs without head declaration", () => {
    const ttml = `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata">
  <body>
    <div>
      <p begin="00:01.000" end="00:04.000" ttm:agent="v1">
        <span begin="00:01.000" end="00:04.000">Line one</span>
      </p>
      <p begin="00:04.500" end="00:08.000" ttm:agent="v2">
        <span begin="00:04.500" end="00:08.000">Line two</span>
      </p>
    </div>
  </body>
</tt>`;

    const result = parseTTMLToLyrics(ttml) as any;
    expect(result.Content.length).toBe(2);
    expect(result.Content[0].OppositeAligned).toBe(false);
    expect(result.Content[1].OppositeAligned).toBe(true);
  });

  it("parses single-span background vocals correctly without child spans", () => {
    const ttml = `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata">
  <body>
    <div>
      <p begin="00:01.000" end="00:05.000">
        <span begin="00:01.000" end="00:03.000">Main vocal</span>
        <span begin="00:03.500" end="00:05.000" ttm:role="x-bg">(Backing vocal)</span>
      </p>
    </div>
  </body>
</tt>`;

    const result = parseTTMLToLyrics(ttml) as any;
    expect(result.Type).toBe("Syllable");
    expect(result.Content.length).toBe(1);
    expect(result.Content[0].Lead.Syllables.length).toBe(1);
    expect(result.Content[0].Lead.Syllables[0].Text).toBe("Main vocal");
    expect(result.Content[0].Background).toBeDefined();
    expect(result.Content[0].Background.length).toBe(1);
    expect(result.Content[0].Background[0].Syllables[0].Text).toBe("Backing vocal");
  });

  it("parses nested-span background vocals with time ranges", () => {
    const ttml = `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata">
  <body>
    <div>
      <p begin="00:01.000" end="00:05.000">
        <span begin="00:01.000" end="00:03.000">Lead</span>
        <span ttm:role="x-bg">
          <span begin="00:03.000" end="00:04.000">(Ooh </span>
          <span begin="00:04.000" end="00:05.000">yeah)</span>
        </span>
      </p>
    </div>
  </body>
</tt>`;

    const result = parseTTMLToLyrics(ttml) as any;
    expect(result.Content.length).toBe(1);
    expect(result.Content[0].Background).toBeDefined();
    expect(result.Content[0].Background[0].Syllables.length).toBe(2);
    expect(result.Content[0].Background[0].Syllables[0].Text).toBe("Ooh");
    expect(result.Content[0].Background[0].Syllables[1].Text).toBe("yeah");
  });

  it("parses whole paragraph background vocals and attaches to preceding line", () => {
    const ttml = `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata">
  <body>
    <div>
      <p begin="00:01.000" end="00:04.000">
        <span begin="00:01.000" end="00:04.000">I will follow</span>
      </p>
      <p begin="00:02.500" end="00:05.000" ttm:role="x-bg">
        <span begin="00:02.500" end="00:05.000">(follow you)</span>
      </p>
    </div>
  </body>
</tt>`;

    const result = parseTTMLToLyrics(ttml) as any;
    expect(result.Content.length).toBe(1);
    expect(result.Content[0].Lead.Syllables[0].Text).toBe("I will follow");
    expect(result.Content[0].Background).toBeDefined();
    expect(result.Content[0].Background.length).toBe(1);
    expect(result.Content[0].Background[0].Syllables[0].Text).toBe("follow you");
  });

  it("parses background vocals with duet agent correctly", () => {
    const ttml = `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata">
  <body>
    <div>
      <p begin="00:01.000" end="00:05.000" ttm:agent="v1">
        <span begin="00:01.000" end="00:03.000">Lead left</span>
        <span begin="00:03.500" end="00:05.000" ttm:role="x-bg" ttm:agent="v2">(Backing right)</span>
      </p>
    </div>
  </body>
</tt>`;

    const result = parseTTMLToLyrics(ttml) as any;
    expect(result.Content[0].OppositeAligned).toBe(false);
    expect(result.Content[0].Background[0].OppositeAligned).toBe(true);
  });
});
