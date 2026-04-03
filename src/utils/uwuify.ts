// A collection of kawaii emojis and kaomojis
const KAWAII_EMOJIS: string[] = [
  " (・`ω´・)", " ;;w;;", " owo", " UwU", " >w<", " ^w^",
  " ✨", " 🥺", " 👉👈", " 💖", " (✿◠‿◠)", " 🌸"
];

/**
 * Transforms standard text into uwuified text.
 * @param text The input string to uwuify.
 * @returns The uwuified string.
 */
export function uwuify(text: string): string {
  if (!text) return text;

  // 1. Swap 'r' and 'l' for 'w' (handling both cases)
  let uwu = text
    .replace(/[rl]/g, "w")
    .replace(/[RL]/g, "W");

  // 2. Add the classic "nya" (n + vowel becomes ny + vowel)
  uwu = uwu
    .replace(/n([aeiou])/g, "ny$1")
    .replace(/N([aeiou])/g, "Ny$1")
    .replace(/N([AEIOU])/g, "NY$1");

  // 3. Replace "ove" with "uv" (e.g., love -> wuv)
  uwu = uwu
    .replace(/ove/g, "uv")
    .replace(/OVE/g, "UV");

  // 4. Add random stuttering to words (approx 15% chance per word)
  uwu = uwu.split(" ").map((word) => {
    // Only stutter if the word has alphabet characters and passes the RNG check
    if (word.match(/^[a-zA-Z]/) && Math.random() < 0.15) {
      return `${word[0]}-${word}`;
    }
    return word;
  }).join(" ");

  // 5. Inject kawaii emojis after punctuation (approx 50% chance)
  uwu = uwu.replace(/([.!?,])/g, (match) => {
    if (Math.random() < 0.5) {
      const randomEmoji = KAWAII_EMOJIS[Math.floor(Math.random() * KAWAII_EMOJIS.length)];
      return `${match}${randomEmoji}`;
    }
    return match;
  });

  // 6. Sometimes add a trailing emoji at the very end if it doesn't have one
  if (Math.random() < 0.7) {
    const randomEmoji = KAWAII_EMOJIS[Math.floor(Math.random() * KAWAII_EMOJIS.length)];
    uwu += randomEmoji;
  }

  return uwu;
}
