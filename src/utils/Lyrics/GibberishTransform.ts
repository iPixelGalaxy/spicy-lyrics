/**
 * Gibberish Mode — "Wenomechainsama" Style Lyrics Transform
 *
 * Converts English (and any Latin-script) lyrics into phonetically-smashed
 * gibberish that looks like how a non-English speaker might transcribe what
 * they hear. Words in a line get joined together, phonetically mangled,
 * vowels shifted, and consonants simplified — nothing survives intact.
 */

// ── Word-level contractions & common words ──────────────────────────────
// These fire BEFORE spaces are removed so \b works correctly.
const WordReplacements: [RegExp, string][] = [
  // Contractions — smash hard
  [/\bi'm\b/gi, "am"],
  [/\bi'll\b/gi, "al"],
  [/\bi've\b/gi, "av"],
  [/\bi'd\b/gi, "ad"],
  [/\byou're\b/gi, "yur"],
  [/\byou'll\b/gi, "yul"],
  [/\byou've\b/gi, "yuv"],
  [/\byou'd\b/gi, "yud"],
  [/\bwe're\b/gi, "wir"],
  [/\bwe'll\b/gi, "wil"],
  [/\bwe've\b/gi, "wiv"],
  [/\bthey're\b/gi, "der"],
  [/\bthey'll\b/gi, "del"],
  [/\bthey've\b/gi, "dev"],
  [/\bhe's\b/gi, "his"],
  [/\bshe's\b/gi, "shis"],
  [/\bit's\b/gi, "is"],
  [/\bthat's\b/gi, "das"],
  [/\bwhat's\b/gi, "was"],
  [/\bthere's\b/gi, "das"],
  [/\bhere's\b/gi, "his"],
  [/\blet's\b/gi, "les"],
  [/\bdon't\b/gi, "don"],
  [/\bcan't\b/gi, "kan"],
  [/\bwon't\b/gi, "won"],
  [/\bisn't\b/gi, "int"],
  [/\baren't\b/gi, "ant"],
  [/\bdidn't\b/gi, "din"],
  [/\bdoesn't\b/gi, "das"],
  [/\bwasn't\b/gi, "wan"],
  [/\bweren't\b/gi, "wen"],
  [/\bwouldn't\b/gi, "wun"],
  [/\bcouldn't\b/gi, "kun"],
  [/\bshouldn't\b/gi, "shun"],
  [/\bhaven't\b/gi, "han"],
  [/\bhasn't\b/gi, "han"],

  // Common words — heavily reduced
  [/\bthe\b/gi, "da"],
  [/\byou\b/gi, "yu"],
  [/\byour\b/gi, "ya"],
  [/\byours\b/gi, "yas"],
  [/\bthrough\b/gi, "tru"],
  [/\bthough\b/gi, "do"],
  [/\bthought\b/gi, "tot"],
  [/\bthere\b/gi, "da"],
  [/\btheir\b/gi, "da"],
  [/\bthey\b/gi, "de"],
  [/\bthat\b/gi, "da"],
  [/\bthis\b/gi, "dis"],
  [/\bthese\b/gi, "dis"],
  [/\bthose\b/gi, "dos"],
  [/\bthen\b/gi, "den"],
  [/\bthan\b/gi, "dan"],
  [/\bwith\b/gi, "wi"],
  [/\bwhat\b/gi, "wa"],
  [/\bwhen\b/gi, "wen"],
  [/\bwhere\b/gi, "we"],
  [/\bwhile\b/gi, "wal"],
  [/\bwhich\b/gi, "wic"],
  [/\bwho\b/gi, "hu"],
  [/\bknow\b/gi, "no"],
  [/\bknew\b/gi, "nu"],
  [/\bknown\b/gi, "non"],
  [/\bhave\b/gi, "ha"],
  [/\bhaving\b/gi, "havin"],
  [/\bbeen\b/gi, "bin"],
  [/\bbeing\b/gi, "bin"],
  [/\bnight\b/gi, "nai"],
  [/\bright\b/gi, "rai"],
  [/\blight\b/gi, "lai"],
  [/\bfight\b/gi, "fai"],
  [/\bsight\b/gi, "sai"],
  [/\bmight\b/gi, "mai"],
  [/\btight\b/gi, "tai"],
  [/\bhigh\b/gi, "hai"],
  [/\beyes\b/gi, "ais"],
  [/\beye\b/gi, "ai"],
  [/\blove\b/gi, "lof"],
  [/\bloving\b/gi, "lofin"],
  [/\bloved\b/gi, "lofd"],
  [/\bgive\b/gi, "gif"],
  [/\bgiven\b/gi, "gifn"],
  [/\blive\b/gi, "lif"],
  [/\balive\b/gi, "alaif"],
  [/\bcould\b/gi, "cu"],
  [/\bwould\b/gi, "wu"],
  [/\bshould\b/gi, "shu"],
  [/\babout\b/gi, "abau"],
  [/\beverything\b/gi, "evrtin"],
  [/\bsomething\b/gi, "samtin"],
  [/\bnothing\b/gi, "natin"],
  [/\banything\b/gi, "enitin"],
  [/\beveryone\b/gi, "evrwan"],
  [/\bsomeone\b/gi, "samwan"],
  [/\banyone\b/gi, "eniwan"],
  [/\bpeople\b/gi, "pipl"],
  [/\blittle\b/gi, "lito"],
  [/\bbeautiful\b/gi, "byutifo"],
  [/\bbecause\b/gi, "bikos"],
  [/\bbefore\b/gi, "bifo"],
  [/\bforever\b/gi, "foreva"],
  [/\btogether\b/gi, "tugeda"],
  [/\bremember\b/gi, "rimemba"],
  [/\bwanna\b/gi, "wana"],
  [/\bgonna\b/gi, "gona"],
  [/\bgotta\b/gi, "gota"],
  [/\bever\b/gi, "eva"],
  [/\bnever\b/gi, "neva"],
  [/\bover\b/gi, "ova"],
  [/\bunder\b/gi, "anda"],
  [/\bafter\b/gi, "afta"],
  [/\bbetter\b/gi, "beta"],
  [/\bwater\b/gi, "wata"],
  [/\bmother\b/gi, "mada"],
  [/\bfather\b/gi, "fada"],
  [/\bbrother\b/gi, "brada"],
  [/\banother\b/gi, "anada"],
  [/\bwonder\b/gi, "wanda"],
  [/\bheart\b/gi, "hat"],
  [/\bearth\b/gi, "et"],
  [/\bworld\b/gi, "wald"],
  [/\bgirl\b/gi, "gal"],
  [/\bonly\b/gi, "onli"],
  [/\breally\b/gi, "rili"],
  [/\balready\b/gi, "olredi"],
  [/\balways\b/gi, "olwes"],
  [/\bmaybe\b/gi, "mebi"],
  [/\bevery\b/gi, "evri"],
  [/\baway\b/gi, "awe"],
  [/\btoday\b/gi, "tude"],
  [/\btonight\b/gi, "tunai"],
  [/\bmorning\b/gi, "monin"],
  [/\bfeeling\b/gi, "filin"],
  [/\bfeel\b/gi, "fil"],
  [/\bbelieve\b/gi, "bilif"],
  [/\bmyself\b/gi, "masef"],
  [/\byourself\b/gi, "yasef"],
  [/\bsomebody\b/gi, "sambadi"],
  [/\bnobody\b/gi, "nobadi"],
  [/\beverybody\b/gi, "evribadi"],
  [/\bcome\b/gi, "kam"],
  [/\bsome\b/gi, "sam"],
  [/\bdone\b/gi, "dan"],
  [/\bgone\b/gi, "gon"],
  [/\bone\b/gi, "wan"],
  [/\bnone\b/gi, "nan"],
  [/\balone\b/gi, "alon"],
  [/\bphone\b/gi, "fon"],
  [/\bhome\b/gi, "hom"],
  [/\btime\b/gi, "taim"],
  [/\bmine\b/gi, "main"],
  [/\bline\b/gi, "lain"],
  [/\bfine\b/gi, "fain"],
  [/\bshine\b/gi, "shain"],
  [/\bfire\b/gi, "faia"],
  [/\bdesire\b/gi, "disaia"],
  [/\bhigher\b/gi, "haia"],
  [/\bdown\b/gi, "daun"],
  [/\btown\b/gi, "taun"],
  [/\bknown\b/gi, "non"],
  [/\bsound\b/gi, "saun"],
  [/\bfound\b/gi, "faun"],
  [/\bground\b/gi, "graun"],
  [/\baround\b/gi, "araun"],
  [/\bmake\b/gi, "mek"],
  [/\btake\b/gi, "tek"],
  [/\bwake\b/gi, "wek"],
  [/\bbreak\b/gi, "brek"],
  [/\bstay\b/gi, "ste"],
  [/\bplay\b/gi, "ple"],
  [/\bsay\b/gi, "se"],
  [/\bday\b/gi, "de"],
  [/\bway\b/gi, "we"],
  [/\bmay\b/gi, "me"],
  [/\bpray\b/gi, "pre"],
  [/\btrue\b/gi, "tru"],
  [/\bblue\b/gi, "blu"],
  [/\binto\b/gi, "intu"],
  [/\blike\b/gi, "laik"],
  [/\bjust\b/gi, "jas"],
  [/\bmuch\b/gi, "mac"],
  [/\bsuch\b/gi, "sac"],
  [/\btouch\b/gi, "tac"],
  [/\bkeep\b/gi, "kip"],
  [/\bsleep\b/gi, "slip"],
  [/\bdeep\b/gi, "dip"],
  [/\bneed\b/gi, "nid"],
  [/\bfree\b/gi, "fri"],
  [/\bsee\b/gi, "si"],
  [/\bbeen\b/gi, "bin"],
  [/\btree\b/gi, "tri"],
  [/\bthree\b/gi, "tri"],
  [/\bhere\b/gi, "hia"],
  [/\bfear\b/gi, "fia"],
  [/\bnear\b/gi, "nia"],
  [/\bclear\b/gi, "klia"],
  [/\btear\b/gi, "tia"],
  [/\bhear\b/gi, "hia"],
  [/\byear\b/gi, "yia"],
  [/\bdear\b/gi, "dia"],
];

// ── Phonetic pattern rules (applied after word-level, after joining) ────
const PhoneticRules: [RegExp, string][] = [
  // Long multi-char combos — longest first
  [/ough/g, "o"],
  [/augh/g, "af"],
  [/ight/g, "ai"],
  [/ould/g, "u"],
  [/tion/g, "shun"],
  [/sion/g, "shun"],
  [/cious/g, "shus"],
  [/tious/g, "shus"],
  [/ious/g, "yus"],
  [/eous/g, "yus"],
  [/ence/g, "ens"],
  [/ance/g, "ans"],
  [/ture/g, "cha"],
  [/sure/g, "sha"],
  [/ness/g, "nes"],
  [/ment/g, "men"],
  [/able/g, "abo"],
  [/ible/g, "ibo"],

  // Digraphs & silent combos
  [/wh/g, "w"],
  [/ck/g, "k"],
  [/ph/g, "f"],
  [/gh/g, ""],
  [/kn/g, "n"],
  [/wr/g, "r"],
  [/mb$/g, "m"],
  [/mn/g, "n"],
  [/sc([eiy])/g, "s$1"],

  // th → t everywhere
  [/th/g, "t"],

  // Ending patterns
  [/ble$/g, "bo"],
  [/ple$/g, "po"],
  [/tle$/g, "to"],
  [/ing/g, "in"],
  [/ful/g, "fo"],
  [/ally/g, "ali"],
  [/ely/g, "li"],
  [/ly$/g, "li"],
  [/ery/g, "ri"],
  [/ary/g, "ari"],
  [/ory/g, "ori"],

  // -er, -or, -ar endings → a
  [/er$/g, "a"],
  [/or$/g, "a"],
  [/ar$/g, "a"],
  [/our$/g, "a"],
  [/re$/g, "a"],

  // -ed endings
  [/([aeiou])ted$/g, "$1d"],
  [/([aeiou])ded$/g, "$1d"],
  [/ied$/g, "id"],
  [/([^aeiou])ed$/g, "$1"],

  // Vowel digraphs — aggressively reduce
  [/eigh/g, "e"],
  [/ea/g, "e"],
  [/oo/g, "u"],
  [/ee/g, "i"],
  [/ie/g, "i"],
  [/ei/g, "e"],
  [/ou/g, "u"],
  [/oi/g, "oy"],
  [/au/g, "o"],
  [/aw/g, "o"],
  [/ow/g, "o"],
  [/ai/g, "e"],
  [/ay$/g, "e"],

  // Double consonants → single
  [/([bcdfghjklmnpqrstvwxyz])\1/g, "$1"],

  // Trailing silent 'e' after a consonant
  [/([bcdfghjklmnpqrstvwxyz])e$/g, "$1"],
];

// ── Aggressive vowel shifting (the secret sauce) ────────────────────────
// Applied last to mutate any remaining "normal-looking" vowels.
const VowelShifts: [RegExp, string][] = [
  // Unstressed interior vowels get swapped around
  [/([bcdfghjklmnpqrstvwxyz])a([bcdfghjklmnpqrstvwxyz])a/g, "$1a$2o"],
  [/([bcdfghjklmnpqrstvwxyz])e([bcdfghjklmnpqrstvwxyz])e/g, "$1e$2a"],
  [/([bcdfghjklmnpqrstvwxyz])i([bcdfghjklmnpqrstvwxyz])i/g, "$1i$2e"],
  [/([bcdfghjklmnpqrstvwxyz])o([bcdfghjklmnpqrstvwxyz])o/g, "$1o$2a"],
  [/([bcdfghjklmnpqrstvwxyz])u([bcdfghjklmnpqrstvwxyz])u/g, "$1u$2o"],

  // Drop weak interior vowels in longer words (consonant clusters feel more gibberish)
  // Only drop if surrounded by single consonants (keeps it pronounceable)
  [/([bcdfghjklmnpqrstvwxyz])e([bcdfghjklmnpqrstvwxyz][aeiou])/g, "$1$2"],
];

/**
 * Core phonetic simplification — applied to any text chunk.
 */
function phoneticSimplify(text: string): string {
  let result = text.toLowerCase();

  // Strip all punctuation
  result = result.replace(/[.,!?;:'"()\[\]{}\-—–…@#$%^&*~`]/g, "");

  // Apply phonetic rules
  for (const [pattern, replacement] of PhoneticRules) {
    result = result.replace(pattern, replacement);
  }

  // Apply vowel shifts to make it even more alien
  for (const [pattern, replacement] of VowelShifts) {
    result = result.replace(pattern, replacement);
  }

  return result;
}

/**
 * Transform a full line of lyrics into gibberish.
 * Words are joined together and phonetically mangled, then capitalised.
 *
 * Used for Line-synced and Static lyrics.
 */
export function gibberishifyLine(text: string): string {
  if (!text || text.trim().length === 0) return text;

  let result = text;

  // Apply word-level replacements first (while spaces exist)
  for (const [pattern, replacement] of WordReplacements) {
    result = result.replace(pattern, replacement);
  }

  // Remove spaces (join words)
  result = result.replace(/\s+/g, "");

  // Phonetic simplify the joined result
  result = phoneticSimplify(result);

  // Capitalize first letter
  if (result.length > 0) {
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }

  return result;
}

/**
 * Transform a single syllable / word fragment into gibberish.
 * Does NOT join words — that is handled by the applyer via IsPartOfWord.
 *
 * Used for Syllable-synced lyrics where each syllable has its own timing.
 */
export function gibberishifySyllable(text: string): string {
  if (!text || text.trim().length === 0) return text;

  let result = text;

  // Apply word-level replacements
  for (const [pattern, replacement] of WordReplacements) {
    result = result.replace(pattern, replacement);
  }

  // Phonetic simplify
  result = phoneticSimplify(result);

  return result;
}
