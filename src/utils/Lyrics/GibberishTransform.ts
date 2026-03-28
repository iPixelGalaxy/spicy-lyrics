/**
 * Gibberish Mode — "Wenomechainsama" Style Lyrics Transform
 *
 * Converts English (and any Latin-script) lyrics into phonetically-smashed
 * gibberish that looks like how a non-English speaker might transcribe what
 * they hear. Words get phonetically mangled per-word FIRST (so ending rules
 * work), then joined together, then a universal vowel-shift pass ensures
 * nothing survives looking like real English.
 */

// ── Word-level contractions & common words ──────────────────────────────
// Applied BEFORE joining so \b anchors work.
const WordReplacements: [RegExp, string][] = [
  // Contractions
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
  [/\bleft\b/gi, "lef"],
  [/\bhead\b/gi, "hed"],
  [/\bdead\b/gi, "ded"],
  [/\bread\b/gi, "red"],
  [/\bsaid\b/gi, "sed"],
  [/\bhalf\b/gi, "haf"],
  [/\btalk\b/gi, "tok"],
  [/\bwalk\b/gi, "wok"],
  [/\bscary\b/gi, "skeri"],
  [/\bhappy\b/gi, "hapi"],
  [/\bcrazy\b/gi, "kresi"],
  [/\bbaby\b/gi, "bebi"],
  [/\blady\b/gi, "ledi"],
  [/\bbody\b/gi, "badi"],
  [/\bsorry\b/gi, "sori"],
  [/\bstory\b/gi, "stori"],
  [/\bglory\b/gi, "glori"],
  [/\bworry\b/gi, "wori"],
  [/\bhurry\b/gi, "hari"],
  [/\bhello\b/gi, "helo"],
  [/\byellow\b/gi, "yelo"],
  [/\bfollow\b/gi, "folo"],
  [/\bshadow\b/gi, "shado"],
  [/\bwindow\b/gi, "windo"],
  [/\btomorrow\b/gi, "tumoro"],
  [/\bhaven\b/gi, "hafn"],
  [/\bheaven\b/gi, "hefn"],
  [/\bseven\b/gi, "sefn"],
  [/\bopen\b/gi, "opn"],
  [/\bbroken\b/gi, "brokn"],
  [/\btaken\b/gi, "tekn"],
  [/\bfallen\b/gi, "foln"],
  [/\bgolden\b/gi, "goldn"],
  [/\blisten\b/gi, "lisn"],
  [/\boften\b/gi, "ofn"],
  [/\bchild\b/gi, "chaild"],
  [/\bwild\b/gi, "waild"],
  [/\bmind\b/gi, "maind"],
  [/\bfind\b/gi, "faind"],
  [/\bkind\b/gi, "kaind"],
  [/\bbehind\b/gi, "bihaind"],
  [/\bblind\b/gi, "blaind"],
  [/\bwind\b/gi, "wind"],
  [/\bdream\b/gi, "drim"],
  [/\bscream\b/gi, "skrim"],
  [/\bstream\b/gi, "strim"],
  [/\bteam\b/gi, "tim"],
  [/\bmean\b/gi, "min"],
  [/\bclean\b/gi, "klin"],
  [/\bocean\b/gi, "oshun"],
  [/\bplace\b/gi, "ples"],
  [/\bface\b/gi, "fes"],
  [/\bspace\b/gi, "spes"],
  [/\bgrace\b/gi, "gres"],
  [/\bthing\b/gi, "tin"],
  [/\bring\b/gi, "rin"],
  [/\bsing\b/gi, "sin"],
  [/\bbring\b/gi, "brin"],
  [/\bking\b/gi, "kin"],
  [/\bwing\b/gi, "win"],
  [/\bstring\b/gi, "strin"],
  [/\bswing\b/gi, "swin"],
  [/\bwrong\b/gi, "ron"],
  [/\bstrong\b/gi, "stron"],
  [/\bsong\b/gi, "son"],
  [/\blong\b/gi, "lon"],
  [/\balong\b/gi, "alon"],
  [/\bbelong\b/gi, "bilon"],
  [/\bpiece\b/gi, "pis"],
  [/\bvoice\b/gi, "voys"],
  [/\bchoice\b/gi, "choys"],
  [/\bnoise\b/gi, "noyz"],
  [/\bhorse\b/gi, "hos"],
  [/\bcourse\b/gi, "kos"],
  [/\bforce\b/gi, "fos"],
  [/\bonce\b/gi, "wans"],
  [/\bdance\b/gi, "dans"],
  [/\bchance\b/gi, "chans"],
  [/\bsince\b/gi, "sins"],
  [/\bprince\b/gi, "prins"],
  [/\bwhite\b/gi, "wait"],
  [/\bwrite\b/gi, "rait"],
  [/\bquite\b/gi, "kwait"],
  [/\bsmile\b/gi, "smail"],
  [/\bstyle\b/gi, "stail"],
  [/\bcause\b/gi, "koz"],
  [/\bpause\b/gi, "poz"],
  [/\bclose\b/gi, "klos"],
  [/\bthose\b/gi, "dos"],
  [/\brose\b/gi, "ros"],
  [/\blose\b/gi, "lus"],
  [/\bchoose\b/gi, "chus"],
  [/\bhouse\b/gi, "haus"],
  [/\bmouse\b/gi, "maus"],
];

// ── Per-word phonetic rules (applied to each word BEFORE joining) ───────
// These use $ anchors and \b so they MUST run while words are separate.
const PerWordPhoneticRules: [RegExp, string][] = [
  // Multi-char patterns
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
  [/ture/g, "cha"],
  [/sure/g, "sha"],

  // Digraphs & silent combos
  [/wh/g, "w"],
  [/ck/g, "k"],
  [/ph/g, "f"],
  [/gh/g, ""],
  [/kn/g, "n"],
  [/wr/g, "r"],
  [/mb$/g, "m"],
  [/mn/g, "n"],

  // th → t
  [/th/g, "t"],

  // Ending patterns ($ anchors work here because words are still separate)
  [/ness$/g, "nes"],
  [/ment$/g, "men"],
  [/able$/g, "abo"],
  [/ible$/g, "ibo"],
  [/ble$/g, "bo"],
  [/ple$/g, "po"],
  [/tle$/g, "to"],
  [/ful$/g, "fo"],
  [/ally$/g, "ali"],
  [/ously$/g, "usli"],
  [/ely$/g, "li"],
  [/ly$/g, "li"],
  [/ery$/g, "ri"],
  [/ary$/g, "ari"],
  [/ory$/g, "ori"],
  [/ity$/g, "iti"],
  [/ety$/g, "eti"],

  // -er, -or, -ar, -re endings → a
  [/ier$/g, "ia"],
  [/er$/g, "a"],
  [/or$/g, "a"],
  [/ar$/g, "a"],
  [/our$/g, "a"],
  [/re$/g, "a"],

  // -ed endings
  [/ied$/g, "id"],
  [/([aeiou])ted$/g, "$1d"],
  [/([aeiou])ded$/g, "$1d"],
  [/([^aeiou])ed$/g, "$1"],

  // -ing
  [/ing$/g, "in"],

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

/**
 * Universal vowel rotation — the nuclear option.
 *
 * Shifts vowels that sit between consonants (CVC pattern) so that
 * every surviving "normal" word gets mutated.  The shift is deterministic
 * (same input → same output) but looks alien.
 *
 *   a → o,  e → a,  i → e,  o → u,  u → i
 *
 * We skip the very first vowel of the string so the word onset stays
 * vaguely recognisable (mirrors how the meme keeps the first sound).
 */
function rotateVowels(text: string): string {
  const vowelMap: Record<string, string> = {
    a: "o",
    e: "a",
    i: "e",
    o: "u",
    u: "i",
  };

  let hitFirst = false;
  let result = "";
  let rotatedCount = 0;
  let skippedFirst = "";

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if ("aeiou".includes(ch)) {
      if (!hitFirst) {
        hitFirst = true;
        skippedFirst = ch;
        result += ch;
      } else {
        const mapped = vowelMap[ch] ?? ch;
        if (mapped !== ch) rotatedCount++;
        result += mapped;
      }
    } else {
      result += ch;
    }
  }

  console.log(`[Gibberish/rotateVowels] Skipped first vowel: "${skippedFirst}", rotated ${rotatedCount} vowels | "${text}" → "${result}"`);

  return result;
}

/**
 * Apply per-word phonetic mangling to a single word.
 */
function mangleWord(word: string): string {
  let result = word.toLowerCase();

  // Strip punctuation
  result = result.replace(/[.,!?;:'"()\[\]{}\-—–…@#$%^&*~`]/g, "");

  if (result.length === 0) return result;

  const beforePhonetic = result;

  // Apply phonetic rules ($ anchors work because this is a single word)
  for (const [pattern, replacement] of PerWordPhoneticRules) {
    const before = result;
    result = result.replace(pattern, replacement);
    if (result !== before) {
      console.log(`[Gibberish/mangleWord] Rule ${pattern} → "${replacement}" | "${before}" → "${result}"`);
    }
  }

  if (result === beforePhonetic) {
    console.log(`[Gibberish/mangleWord] No phonetic rules matched for "${beforePhonetic}"`);
  }

  return result;
}

/**
 * Transform a full line of lyrics into gibberish.
 * Each word is mangled individually (so $ anchors work), then they're
 * joined, then a universal vowel rotation ensures nothing looks normal.
 *
 * Used for Line-synced and Static lyrics.
 */
export function gibberishifyLine(text: string): string {
  if (!text || text.trim().length === 0) return text;

  console.log(`[Gibberish] ── INPUT: "${text}"`);

  let result = text;

  // Phase 1: Word-level dictionary replacements (while spaces exist)
  const beforeDict = result;
  for (const [pattern, replacement] of WordReplacements) {
    const before = result;
    result = result.replace(pattern, replacement);
    if (result !== before) {
      console.log(`[Gibberish/Phase1-Dict] ${pattern} → "${replacement}" | "${before}" → "${result}"`);
    }
  }
  if (result === beforeDict) {
    console.log(`[Gibberish/Phase1-Dict] No dictionary replacements matched`);
  }
  console.log(`[Gibberish] After Phase 1 (dict): "${result}"`);

  // Phase 2: Per-word phonetic mangling ($ anchors need word boundaries)
  const words = result.split(/\s+/);
  console.log(`[Gibberish/Phase2-Mangle] Words to mangle:`, words);
  const mangledWords = words.map((w) => {
    const mangled = mangleWord(w);
    if (mangled !== w.toLowerCase()) {
      console.log(`[Gibberish/Phase2-Mangle] "${w}" → "${mangled}"`);
    } else {
      console.log(`[Gibberish/Phase2-Mangle] "${w}" → "${mangled}" (unchanged)`);
    }
    return mangled;
  });

  // Phase 3: Join words together
  result = mangledWords.join("");
  console.log(`[Gibberish] After Phase 3 (join): "${result}"`);

  // Phase 4: Universal vowel rotation (skip first vowel)
  const beforeRotation = result;
  result = rotateVowels(result);
  console.log(`[Gibberish] After Phase 4 (vowel rotate): "${result}" ${result === beforeRotation ? "(NO CHANGE)" : ""}`);

  // Phase 5: Final cleanup — collapse double consonants created by joining
  const beforeCleanup = result;
  result = result.replace(/([bcdfghjklmnpqrstvwxyz])\1/g, "$1");
  if (result !== beforeCleanup) {
    console.log(`[Gibberish] After Phase 5 (cleanup): "${result}"`);
  }

  console.log(`[Gibberish] ── OUTPUT: "${result}"`);
  console.log(`[Gibberish] ──────────────────────────────────`);

  return result;
}

