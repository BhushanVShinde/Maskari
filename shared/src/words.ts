/**
 * ~150 common, family-friendly, drawable nouns.
 */
export const WORDS: string[] = [
  "elephant", "bicycle", "rainbow", "pizza", "guitar", "umbrella", "castle",
  "rocket", "dolphin", "cactus", "snowman", "lighthouse", "butterfly", "hamburger",
  "octopus", "penguin", "volcano", "airplane", "camera", "telescope", "windmill",
  "anchor", "balloon", "banana", "basket", "beach", "beard", "bridge", "broom",
  "bubble", "cake", "camel", "campfire", "candle", "carrot", "cat", "chair",
  "cheese", "cherry", "clock", "cloud", "clown", "compass", "crab", "crayon",
  "crown", "cupcake", "diamond", "dinosaur", "dog", "donut", "dragon", "drum",
  "duck", "eagle", "egg", "envelope", "eyeglasses", "feather", "fence", "fire",
  "fireworks", "fish", "flag", "flower", "fork", "fountain", "fox", "frog",
  "giraffe", "glove", "goat", "grapes", "hammer", "hat", "heart", "helicopter",
  "honey", "horse", "hotdog", "house", "igloo", "island", "jacket", "jellyfish",
  "kangaroo", "key", "kite", "koala", "ladder", "ladybug", "lamp", "leaf",
  "lemon", "lion", "lizard", "lollipop", "magnet", "mailbox", "map", "mermaid",
  "monkey", "moon", "mountain", "mouse", "mushroom", "necklace", "nest", "owl",
  "paintbrush", "panda", "parachute", "parrot", "peacock", "pencil", "piano",
  "pineapple", "pirate", "pizza slice", "pumpkin", "rabbit", "raccoon", "robot",
  "rose", "sailboat", "sandwich", "scarecrow", "scissors", "seahorse", "shark",
  "sheep", "shoe", "snail", "snake", "snowflake", "soccer ball", "spider",
  "spoon", "squirrel", "starfish", "strawberry", "sun", "sunflower", "swan",
  "sword", "teapot", "tent", "tiger", "toaster", "tomato", "tooth", "tornado",
  "tractor", "train", "tree", "trophy", "turtle", "unicorn", "violin", "wagon",
  "watch", "watermelon", "whale", "wheel", "zebra",
];

/**
 * Pick `count` distinct random words, preferring words not in `exclude`.
 * If the pool of unused words runs low, falls back to the full list so a game
 * never stalls for lack of options.
 */
export function pickWords(
  count: number,
  exclude: ReadonlySet<string> = new Set(),
): string[] {
  const available = WORDS.filter((w) => !exclude.has(w));
  const pool = available.length >= count ? available : [...WORDS];

  const chosen: string[] = [];
  const used = new Set<string>();
  while (chosen.length < count && used.size < pool.length) {
    const word = pool[Math.floor(Math.random() * pool.length)];
    if (!used.has(word)) {
      used.add(word);
      chosen.push(word);
    }
  }
  return chosen;
}

/**
 * Build a masked version of a word for guessers: letters become spaced
 * underscores, e.g. "pizza" → "_ _ _ _ _". Spaces between words are preserved.
 * Pass `revealedIndices` (0-based letter index) to reveal hint letters.
 */
export function maskWord(
  word: string,
  revealedIndices: ReadonlySet<number> = new Set(),
): string {
  let idx = 0;
  return word
    .trim()
    .split(/\s+/)
    .map((segment) =>
      [...segment]
        .filter((c) => /[a-z0-9]/i.test(c))
        .map((c) => {
          const i = idx++;
          return revealedIndices.has(i) ? c.toUpperCase() : "_";
        })
        .join(" "),
    )
    .join("   ");
}

/** Flat letter indices that are not yet revealed (for hint scheduling). */
export function unrevealedLetterIndices(
  word: string,
  revealed: ReadonlySet<number>,
): number[] {
  const out: number[] = [];
  let idx = 0;
  for (const segment of word.trim().split(/\s+/)) {
    for (const c of segment) {
      if (/[a-z0-9]/i.test(c)) {
        if (!revealed.has(idx)) out.push(idx);
        idx++;
      }
    }
  }
  return out;
}

/** Number of guessable letters (excludes spaces/hyphens). */
export function wordLetterCount(word: string): number {
  return (word.match(/[a-z0-9]/gi) ?? []).length;
}
