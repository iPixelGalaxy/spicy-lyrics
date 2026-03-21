type JapaneseToken = {
  surface_form?: string;
  basic_form?: string;
  reading?: string;
  pronunciation?: string;
};

// Keep this conservative. These are lyric-common readings that are often
// stylistic or irregular enough to deserve explicit control.
const TOKEN_READING_OVERRIDES = new Map<string, string>([
  ["一人", "ヒトリ"],
  ["二人", "フタリ"],
  ["何処", "ドコ"],
  ["此処", "ココ"],
  ["彼処", "アソコ"],
  ["大人", "オトナ"],
  ["今日", "キョウ"],
]);

const KATAKANA_ONLY = /^[ァ-ヴー]+$/;
const HIRAGANA_ONLY = /^[ぁ-ゔー]+$/;

function toKatakana(text: string): string {
  return text.replace(/[ぁ-ゔ]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) + 0x60)
  );
}

function normalizeReading(reading?: string): string | undefined {
  if (!reading || reading === "*") return undefined;
  if (KATAKANA_ONLY.test(reading)) return reading;
  if (HIRAGANA_ONLY.test(reading)) return toKatakana(reading);
  return undefined;
}

export function patchJapaneseTokenReading(token: JapaneseToken): void {
  const override =
    TOKEN_READING_OVERRIDES.get(token.surface_form ?? "") ??
    TOKEN_READING_OVERRIDES.get(token.basic_form ?? "");

  if (override) {
    token.reading = override;
    token.pronunciation = override;
    return;
  }

  const normalizedPronunciation = normalizeReading(token.pronunciation);
  const normalizedReading = normalizeReading(token.reading);

  if (normalizedPronunciation && token.pronunciation !== normalizedPronunciation) {
    token.pronunciation = normalizedPronunciation;
  }

  if (normalizedReading && token.reading !== normalizedReading) {
    token.reading = normalizedReading;
  }
}
