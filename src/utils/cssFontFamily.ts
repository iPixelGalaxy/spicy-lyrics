export function toCssFontFamily(fontFamily: string) {
  const trimmed = fontFamily.trim();
  if (!trimmed) return "";
  return `"${trimmed.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
