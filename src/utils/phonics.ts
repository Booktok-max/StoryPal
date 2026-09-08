/**
 * Phonics helper for young readers:
 * Provides syllable breakdowns and kid-friendly definitions.
 */

export interface PhonicsWordInfo {
  word: string;
  syllables: string;
  meaning: string;
  exampleSentence: string;
  rhymesWith?: string[];
}

const COMMON_KID_WORDS: Record<string, PhonicsWordInfo> = {
  owl: {
    word: "owl",
    syllables: "owl",
    meaning: "A fluffy nocturnal bird with big round eyes that says 'hoot-hoot'!",
    exampleSentence: "The owl sits high up in the oak tree.",
    rhymesWith: ["howl", "foul", "growl"],
  },
  forest: {
    word: "forest",
    syllables: "for·est",
    meaning: "A big, peaceful land covered with many green trees and animals.",
    exampleSentence: "Deer and rabbits hop through the deep green forest.",
  },
  bright: {
    word: "bright",
    syllables: "bright",
    meaning: "Giving out a lot of sparkling light, like the sun or stars.",
    exampleSentence: "The yellow sun was very bright today.",
    rhymesWith: ["night", "light", "sight"],
  },
  friendly: {
    word: "friendly",
    syllables: "friend·ly",
    meaning: "Kind, pleasant, and smiling; acting like a good pal.",
    exampleSentence: "The friendly dog wagged its tail happily.",
  },
  glowing: {
    word: "glowing",
    syllables: "glow·ing",
    meaning: "Shining softly with gentle, warm light.",
    exampleSentence: "The fireflies were glowing in the dark bushes.",
  },
  berries: {
    word: "berries",
    syllables: "ber·ries",
    meaning: "Small, juicy, sweet fruits that grow on bushes.",
    exampleSentence: "We picked sweet red strawberries for dessert.",
  },
  twinkled: {
    word: "twinkled",
    syllables: "twin·kled",
    meaning: "Shone with quick, little flashes of light.",
    exampleSentence: "The tiny stars twinkled in the night sky.",
  },
  emerald: {
    word: "emerald",
    syllables: "em·er·ald",
    meaning: "A precious shiny gemstone with a rich, vibrant green color.",
    exampleSentence: "Her shiny necklace had a bright emerald stone.",
  },
  dragon: {
    word: "dragon",
    syllables: "drag·on",
    meaning: "A magical mythical creature with wings, scales, and a long tail.",
    exampleSentence: "Pip the little dragon can fly high in the sky.",
  },
  bubbles: {
    word: "bubbles",
    syllables: "bub·bles",
    meaning: "Thin floating spheres of soapy liquid filled with air.",
    exampleSentence: "We blew shiny purple bubbles in the warm backyard.",
  },
  floating: {
    word: "floating",
    syllables: "float·ing",
    meaning: "Drifting gently on top of water or through the light air.",
    exampleSentence: "The fluffy white clouds are floating across the blue sky.",
  },
  rainbow: {
    word: "rainbow",
    syllables: "rain·bow",
    meaning: "An arc of wonderful colors (red, orange, yellow, green, blue, violet) in the sky.",
    exampleSentence: "After the rain stopped, a bright rainbow appeared.",
  },
  unique: {
    word: "unique",
    syllables: "u·nique",
    meaning: "Being one of a kind; special and unlike anything else!",
    exampleSentence: "Every snowflake has its own unique, beautiful shape.",
  },
  explorer: {
    word: "explorer",
    syllables: "ex·plor·er",
    meaning: "A brave person who travels to new places to learn and discover things.",
    exampleSentence: "The explorer searched the mysterious caves.",
  },
  clockwork: {
    word: "clockwork",
    syllables: "clock·work",
    meaning: "A mechanism with gears and springs, like an old wind-up clock.",
    exampleSentence: "The clockwork toy walked across the wooden floor.",
  },
  harmonic: {
    word: "harmonic",
    syllables: "har·mon·ic",
    meaning: "Pleasant sounds and musical notes that blend sweetly together.",
    exampleSentence: "The flute made sweet harmonic music in the hall.",
  },
  dormouse: {
    word: "dormouse",
    syllables: "dor·mouse",
    meaning: "A tiny furry woodland mouse famous for taking long cozy naps.",
    exampleSentence: "The sleepy dormouse nestled under the warm leaves.",
  },
  tortoise: {
    word: "tortoise",
    syllables: "tor·toise",
    meaning: "A calm, gentle turtle with a sturdy domed shell who walks slowly and steadily.",
    exampleSentence: "The friendly tortoise took small, careful steps down the path.",
    rhymesWith: ["porpoise"],
  },
  hare: {
    word: "hare",
    syllables: "hare",
    meaning: "A quick, long-eared cousin of the rabbit who loves to leap and sprint fast.",
    exampleSentence: "The energetic hare zipped across the clover meadow.",
    rhymesWith: ["care", "bear", "fair"],
  },
  steady: {
    word: "steady",
    syllables: "stead·y",
    meaning: "Moving evenly without stopping or wobbling; dependable and constant.",
    exampleSentence: "Slow and steady steps helped her climb the tall green hill.",
  },
  boastful: {
    word: "boastful",
    syllables: "boast·ful",
    meaning: "Bragging too much and showing off about what you can do.",
    exampleSentence: "Instead of being boastful, he let his good actions speak.",
  },
  savannah: {
    word: "savannah",
    syllables: "sa·van·nah",
    meaning: "A warm, grassy open plain with scattered acacia trees where lions roam.",
    exampleSentence: "Giraffes and zebras graze peacefully across the sunlit savannah.",
  },
  mighty: {
    word: "mighty",
    syllables: "might·y",
    meaning: "Very strong, powerful, and grand.",
    exampleSentence: "The mighty lion had a golden mane and a deep, royal roar.",
  },
  scamper: {
    word: "scamper",
    syllables: "scam·per",
    meaning: "To run with quick, light, playful steps like a happy puppy or mouse.",
    exampleSentence: "The little brown mice scamper under the garden fence.",
  },
  shepherd: {
    word: "shepherd",
    syllables: "shep·herd",
    meaning: "A kind caretaker who watches over and protects sheep on grassy hills.",
    exampleSentence: "The young shepherd counted his fluffy sheep before twilight.",
  },
  villagers: {
    word: "villagers",
    syllables: "vil·lag·ers",
    meaning: "People who live together in a friendly, cozy small town or village.",
    exampleSentence: "The cheerful villagers gathered in the square to bake bread.",
  },
  grasshopper: {
    word: "grasshopper",
    syllables: "grass·hop·per",
    meaning: "A bright green insect with long back legs that can hop high and make cheerful chirping sounds.",
    exampleSentence: "The green grasshopper played a lively summer tune on his fiddle.",
  },
  harvest: {
    word: "harvest",
    syllables: "har·vest",
    meaning: "Gathering ripe crops, grains, and sweet fruits when the season arrives.",
    exampleSentence: "Autumn is the time for a joyful harvest of crisp red apples.",
  },
  cloak: {
    word: "cloak",
    syllables: "cloak",
    meaning: "A warm, sleeveless coat that wraps around the shoulders to keep out the chill.",
    exampleSentence: "The traveler wrapped his thick wool cloak against the mountain wind.",
    rhymesWith: ["oak", "soak", "spoke"],
  },
  gentle: {
    word: "gentle",
    syllables: "gen·tle",
    meaning: "Soft, mild, and kind; not rough or loud.",
    exampleSentence: "The gentle morning sunshine warmed the waking garden flowers.",
  },
  fable: {
    word: "fable",
    syllables: "fa·ble",
    meaning: "A short, timeless story that features animal characters and teaches a valuable lesson about life.",
    exampleSentence: "Aesop wrote many wise fables that children still love today.",
    rhymesWith: ["table", "cable", "able"],
  },
};

/**
 * Basic algorithmic hyphenation for young readers if word is not in pre-defined dictionary
 */
export function divideIntoSyllables(word: string): string {
  const clean = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!clean) return word;

  if (COMMON_KID_WORDS[clean]) {
    return COMMON_KID_WORDS[clean].syllables;
  }

  // Simple phonetic syllable separation
  if (clean.length <= 3) return clean;

  const vowels = "aeiouy";
  let result = "";
  let inVowel = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const isVowel = vowels.includes(char);

    if (i > 1 && i < clean.length - 1 && !isVowel && inVowel) {
      // Check next char
      if (!vowels.includes(clean[i + 1])) {
        result += char + "·";
        inVowel = false;
        continue;
      }
    }

    result += char;
    inVowel = isVowel;
  }

  return result;
}

export function getWordDetails(rawWord: string): PhonicsWordInfo {
  const clean = rawWord.toLowerCase().replace(/[^a-z]/g, "");
  if (COMMON_KID_WORDS[clean]) {
    return COMMON_KID_WORDS[clean];
  }

  const syllables = divideIntoSyllables(clean);
  return {
    word: clean,
    syllables,
    meaning: `A wonderful story word to discover! Notice the sounds: "${syllables}".`,
    exampleSentence: `Let's practice reading "${clean}" together in this book page!`,
  };
}
