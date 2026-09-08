export function getCjkSegmentationLocale(text: string): "ja" | "ko" | "zh" {
  if (/\p{Script=Hangul}/u.test(text)) return "ko";
  if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(text)) return "ja";
  return "zh";
}
