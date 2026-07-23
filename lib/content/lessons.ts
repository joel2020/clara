import type { Lesson, LessonIntro, PracticeItem } from "@/lib/db/types";
import { CONVERSATION_LESSONS } from "./conversation.ts";
import { CONVERSATION_LESSONS_2 } from "./conversation-2.ts";
import { CONVERSATION_LESSONS_3 } from "./conversation-3.ts";

// The full curriculum. Lesson 1 (Short i vs Long ee) is the flagship — the
// pattern every other lesson follows. Minimal-pair lessons drill two contrasting
// sounds; sound-focus lessons drill one target across several words; the phrase
// lesson is for connected speech and rhythm.

type PairSeed = {
  pairId: string;
  a: { text: string; ipa: string; phoneme: string; hint: string };
  b: { text: string; ipa: string; phoneme: string; hint: string };
};

// Build two minimal-pair items that point at each other via pairId.
function pairItems(categoryId: string, seeds: PairSeed[]): PracticeItem[] {
  const items: PracticeItem[] = [];
  for (const s of seeds) {
    items.push({
      id: `${categoryId}:${s.a.text.toLowerCase()}`,
      text: s.a.text,
      ipa: s.a.ipa,
      mouthHint: s.a.hint,
      kind: "word",
      categoryId,
      phoneme: s.a.phoneme,
      pairId: s.pairId,
    });
    items.push({
      id: `${categoryId}:${s.b.text.toLowerCase()}`,
      text: s.b.text,
      ipa: s.b.ipa,
      mouthHint: s.b.hint,
      kind: "word",
      categoryId,
      phoneme: s.b.phoneme,
      pairId: s.pairId,
    });
  }
  return items;
}

function words(
  categoryId: string,
  rows: { text: string; ipa: string; phoneme: string; hint: string; note?: string }[],
): PracticeItem[] {
  // Some lessons repeat a spelling with different stress/sense (e.g. "present"
  // noun vs verb). Disambiguate the id with the phoneme so each card is unique.
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const base = `${categoryId}:${r.text.toLowerCase().replace(/\s+/g, "-")}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    const id = n === 0 ? base : `${base}-${r.phoneme.toLowerCase().replace(/[^a-z0-9]+/g, "") || n}`;
    return {
      id,
      text: r.text,
      ipa: r.ipa,
      mouthHint: r.hint,
      kind: "word" as const,
      categoryId,
      phoneme: r.phoneme,
      note: r.note,
    };
  });
}

function phrases(
  categoryId: string,
  rows: { text: string; ipa: string; phoneme: string; hint: string; note?: string }[],
): PracticeItem[] {
  return rows.map((r, i) => ({
    id: `${categoryId}:phrase-${i + 1}`,
    text: r.text,
    ipa: r.ipa,
    mouthHint: r.hint,
    kind: "phrase" as const,
    categoryId,
    phoneme: r.phoneme,
    note: r.note,
  }));
}

const SHORT_I_HINT = "Relax your lips and jaw. Short, quick, almost lazy. Don't smile.";
const LONG_E_HINT = "Smile wide, pull your lips back, tongue high. A long 'eeee' — hold it.";
const FLAP_HINT = "Between two vowels, don't say a hard T — tap it once so it comes out like a quick, soft D. 'water' → 'wah-der'.";
const AMER_R_HINT = "Curl your tongue tip up and back without touching anything, and say every R — even at the end. 'car', never 'cah'.";

export const LESSONS: Lesson[] = [
  // ── 1. /ɪ/ vs /iː/ — the flagship ───────────────────────────────────────
  {
    id: "i-vs-ii",
    title: "Short i vs Long ee",
    subtitle: "/ɪ/ vs /iː/",
    description:
      "The classic. Spanish has one 'i' sound; English has two. Hear the difference, then make it: ship vs sheep.",
    kind: "minimal-pairs",
    categoryIds: ["i-vs-ii"],
    order: 1,
    items: pairItems("i-vs-ii", [
      {
        pairId: "ship-sheep",
        a: { text: "ship", ipa: "/ʃɪp/", phoneme: "ɪ", hint: SHORT_I_HINT },
        b: { text: "sheep", ipa: "/ʃiːp/", phoneme: "iː", hint: LONG_E_HINT },
      },
      {
        pairId: "bit-beat",
        a: { text: "bit", ipa: "/bɪt/", phoneme: "ɪ", hint: SHORT_I_HINT },
        b: { text: "beat", ipa: "/biːt/", phoneme: "iː", hint: LONG_E_HINT },
      },
      {
        pairId: "fill-feel",
        a: { text: "fill", ipa: "/fɪl/", phoneme: "ɪ", hint: SHORT_I_HINT },
        b: { text: "feel", ipa: "/fiːl/", phoneme: "iː", hint: LONG_E_HINT },
      },
      {
        pairId: "live-leave",
        a: { text: "live", ipa: "/lɪv/", phoneme: "ɪ", hint: SHORT_I_HINT },
        b: { text: "leave", ipa: "/liːv/", phoneme: "iː", hint: LONG_E_HINT },
      },
      {
        pairId: "sit-seat",
        a: { text: "sit", ipa: "/sɪt/", phoneme: "ɪ", hint: SHORT_I_HINT },
        b: { text: "seat", ipa: "/siːt/", phoneme: "iː", hint: LONG_E_HINT },
      },
      {
        pairId: "it-eat",
        a: { text: "it", ipa: "/ɪt/", phoneme: "ɪ", hint: SHORT_I_HINT },
        b: { text: "eat", ipa: "/iːt/", phoneme: "iː", hint: LONG_E_HINT },
      },
    ]),
  },

  // ── The American T (flap) ────────────────────────────────────────────────
  {
    id: "flap-t",
    title: "The American T",
    subtitle: "t → soft d",
    description:
      "The most American sound there is: between vowels, T becomes a quick soft D. 'Water' is 'wader', 'better' is 'bedder'.",
    kind: "sound-focus",
    categoryIds: ["flap-t"],
    order: 1.5,
    items: words("flap-t", [
      { text: "water", ipa: "/ˈwɔːtər/", phoneme: "flap", hint: FLAP_HINT },
      { text: "better", ipa: "/ˈbɛtər/", phoneme: "flap", hint: FLAP_HINT },
      { text: "letter", ipa: "/ˈlɛtər/", phoneme: "flap", hint: FLAP_HINT },
      { text: "city", ipa: "/ˈsɪti/", phoneme: "flap", hint: FLAP_HINT },
      { text: "party", ipa: "/ˈpɑːrti/", phoneme: "flap", hint: FLAP_HINT },
      { text: "later", ipa: "/ˈleɪtər/", phoneme: "flap", hint: FLAP_HINT },
      { text: "pretty", ipa: "/ˈprɪti/", phoneme: "flap", hint: FLAP_HINT },
      { text: "daughter", ipa: "/ˈdɔːtər/", phoneme: "flap", hint: FLAP_HINT },
      { text: "computer", ipa: "/kəmˈpjuːtər/", phoneme: "flap", hint: FLAP_HINT },
      { text: "thirty", ipa: "/ˈθɜːrti/", phoneme: "flap", hint: FLAP_HINT },
    ]),
  },

  // ── The American R (rhotic) ──────────────────────────────────────────────
  {
    id: "american-r",
    title: "The American R",
    subtitle: "/ɹ/",
    description:
      "American English says every R — even at the end. Curl the tongue back and never drop it: car, hard, sister.",
    kind: "sound-focus",
    categoryIds: ["american-r"],
    order: 1.7,
    items: words("american-r", [
      { text: "car", ipa: "/kɑːr/", phoneme: "r", hint: AMER_R_HINT },
      { text: "hard", ipa: "/hɑːrd/", phoneme: "r", hint: AMER_R_HINT },
      { text: "work", ipa: "/wɜːrk/", phoneme: "r", hint: AMER_R_HINT },
      { text: "bird", ipa: "/bɜːrd/", phoneme: "r", hint: AMER_R_HINT },
      { text: "world", ipa: "/wɜːrld/", phoneme: "r", hint: AMER_R_HINT },
      { text: "first", ipa: "/fɜːrst/", phoneme: "r", hint: AMER_R_HINT },
      { text: "sister", ipa: "/ˈsɪstər/", phoneme: "r", hint: AMER_R_HINT },
      { text: "teacher", ipa: "/ˈtiːtʃər/", phoneme: "r", hint: AMER_R_HINT },
      { text: "morning", ipa: "/ˈmɔːrnɪŋ/", phoneme: "r", hint: AMER_R_HINT },
      { text: "girl", ipa: "/ɡɜːrl/", phoneme: "r", hint: AMER_R_HINT },
    ]),
  },

  // ── 2. /b/ vs /v/ ────────────────────────────────────────────────────────
  {
    id: "b-vs-v",
    title: "B vs V",
    subtitle: "/b/ vs /v/",
    description: "In Spanish these are the same sound. In English, v means teeth on lip and a buzz. Berry vs very.",
    kind: "minimal-pairs",
    categoryIds: ["b-vs-v"],
    order: 2,
    items: pairItems("b-vs-v", [
      {
        pairId: "berry-very",
        a: { text: "berry", ipa: "/ˈbɛri/", phoneme: "b", hint: "Press both lips together, then pop them apart." },
        b: { text: "very", ipa: "/ˈvɛri/", phoneme: "v", hint: "Top teeth on your bottom lip, push air — it buzzes." },
      },
      {
        pairId: "ban-van",
        a: { text: "ban", ipa: "/bæn/", phoneme: "b", hint: "Lips together, then release with your voice on." },
        b: { text: "van", ipa: "/væn/", phoneme: "v", hint: "Teeth touch lip, buzz, then open into the vowel." },
      },
      {
        pairId: "boat-vote",
        a: { text: "boat", ipa: "/boʊt/", phoneme: "b", hint: "Both lips press and pop — no teeth." },
        b: { text: "vote", ipa: "/voʊt/", phoneme: "v", hint: "Top teeth on lip first — feel the buzz." },
      },
      {
        pairId: "base-vase",
        a: { text: "base", ipa: "/beɪs/", phoneme: "b", hint: "Lips together for the start." },
        b: { text: "vase", ipa: "/veɪs/", phoneme: "v", hint: "Teeth on lip for the start — vvv." },
      },
      {
        pairId: "bat-vat",
        a: { text: "bat", ipa: "/bæt/", phoneme: "b", hint: "Pop the lips for b." },
        b: { text: "vat", ipa: "/væt/", phoneme: "v", hint: "Buzz the teeth-on-lip for v." },
      },
    ]),
  },

  // ── 3. /dʒ/ vs /j/ ───────────────────────────────────────────────────────
  {
    id: "dj-vs-y",
    title: "J vs Y",
    subtitle: "/dʒ/ vs /j/",
    description: "English 'j' is hard and buzzy; 'y' is soft and gliding. Jail vs Yale, jet vs yet.",
    kind: "minimal-pairs",
    categoryIds: ["dj-vs-y"],
    order: 3,
    items: pairItems("dj-vs-y", [
      {
        pairId: "jail-yale",
        a: { text: "jail", ipa: "/dʒeɪl/", phoneme: "dʒ", hint: "Tongue presses the roof, release with a buzzy 'j'." },
        b: { text: "Yale", ipa: "/jeɪl/", phoneme: "j", hint: "Tongue stays soft and low — glide 'yy' into the vowel." },
      },
      {
        pairId: "jet-yet",
        a: { text: "jet", ipa: "/dʒɛt/", phoneme: "dʒ", hint: "Hard 'j': a little puff of buzz at the start." },
        b: { text: "yet", ipa: "/jɛt/", phoneme: "j", hint: "Soft 'y': no buzz, just glide in." },
      },
      {
        pairId: "joke-yolk",
        a: { text: "joke", ipa: "/dʒoʊk/", phoneme: "dʒ", hint: "Buzzy 'j' to start." },
        b: { text: "yolk", ipa: "/joʊk/", phoneme: "j", hint: "Soft 'y' to start — like 'yo'." },
      },
      {
        pairId: "jam-yam",
        a: { text: "jam", ipa: "/dʒæm/", phoneme: "dʒ", hint: "Press and release a hard 'j'." },
        b: { text: "yam", ipa: "/jæm/", phoneme: "j", hint: "Glide a soft 'y'." },
      },
      {
        pairId: "jello-yellow",
        a: { text: "jello", ipa: "/ˈdʒɛloʊ/", phoneme: "dʒ", hint: "Start buzzy and hard." },
        b: { text: "yellow", ipa: "/ˈjɛloʊ/", phoneme: "j", hint: "Start soft and gliding." },
      },
    ]),
  },

  // ── 4. /θ/ and /ð/ ───────────────────────────────────────────────────────
  {
    id: "th",
    title: "The TH sounds",
    subtitle: "/θ/ and /ð/",
    description:
      "Tongue between your teeth. Voiceless θ (think) is just air; voiced ð (this) turns your voice on. Don't let them become t, d, or s.",
    kind: "sound-focus",
    categoryIds: ["th"],
    order: 4,
    items: [
      // "think" lives in the think/sink minimal pair below — listing it here too
      // would duplicate its id.
      ...words("th", [
        { text: "three", ipa: "/θriː/", phoneme: "θ", hint: "TH then glide to r — tongue starts between the teeth." },
        { text: "both", ipa: "/boʊθ/", phoneme: "θ", hint: "End with tongue between teeth, just air." },
        { text: "thank", ipa: "/θæŋk/", phoneme: "θ", hint: "Air-only TH at the start — not 't', not 's'." },
        { text: "this", ipa: "/ðɪs/", phoneme: "ð", hint: "Tongue between teeth, but turn your voice ON — it buzzes." },
        { text: "the", ipa: "/ðə/", phoneme: "ð", hint: "Soft buzzy TH, tongue lightly between teeth." },
        { text: "mother", ipa: "/ˈmʌðər/", phoneme: "ð", hint: "Voiced TH in the middle — buzz between the teeth." },
        { text: "breathe", ipa: "/briːð/", phoneme: "ð", hint: "End voiced — feel the buzz on your tongue tip." },
      ]),
      // A few traps where Spanish speakers substitute t/s — drilled as pairs.
      ...pairItems("th", [
        {
          pairId: "think-sink",
          a: { text: "think", ipa: "/θɪŋk/", phoneme: "θ", hint: "Tongue OUT between teeth — air only." },
          b: { text: "sink", ipa: "/sɪŋk/", phoneme: "s", hint: "Tongue stays behind the teeth — a hiss." },
        },
        {
          pairId: "thin-tin",
          a: { text: "thin", ipa: "/θɪn/", phoneme: "θ", hint: "Tongue between teeth, soft air." },
          b: { text: "tin", ipa: "/tɪn/", phoneme: "t", hint: "Tongue taps behind teeth — a sharp t." },
        },
      ]),
    ],
  },

  // ── 5. /h/ ───────────────────────────────────────────────────────────────
  {
    id: "h",
    title: "The H sound",
    subtitle: "/h/",
    description: "A soft breath, not the harsh Spanish 'j'. And watch the silent-h traps where the h disappears.",
    kind: "sound-focus",
    categoryIds: ["h"],
    order: 5,
    items: words("h", [
      { text: "hat", ipa: "/hæt/", phoneme: "h", hint: "A gentle puff of breath, then the vowel. Soft, not scraped." },
      { text: "house", ipa: "/haʊs/", phoneme: "h", hint: "Breathe out softly to start — like fogging a mirror." },
      { text: "behind", ipa: "/bɪˈhaɪnd/", phoneme: "h", hint: "Keep the h breathy in the middle: be-HIND." },
      { text: "hello", ipa: "/həˈloʊ/", phoneme: "h", hint: "Light breath on the h, stress the 'lo'." },
      { text: "happy", ipa: "/ˈhæpi/", phoneme: "h", hint: "Soft breathy start, not a throat scrape." },
      { text: "ahead", ipa: "/əˈhɛd/", phoneme: "h", hint: "Breathy h in the middle: a-HEAD." },
      { text: "hour", ipa: "/ˈaʊər/", phoneme: "silent-h", hint: "The h is SILENT — start on the vowel: 'our'.", note: "Silent h" },
      { text: "honest", ipa: "/ˈɒnɪst/", phoneme: "silent-h", hint: "Silent h — say 'onist'.", note: "Silent h" },
      { text: "honor", ipa: "/ˈɒnər/", phoneme: "silent-h", hint: "Silent h — say 'onor'.", note: "Silent h" },
    ]),
  },

  // ── 6. s-cluster onsets ──────────────────────────────────────────────────
  {
    id: "s-clusters",
    title: "S-cluster starts",
    subtitle: "speak, not 'espeak'",
    description: "Spanish adds an 'e' before s+consonant. Train starting clean and sharp right on the s.",
    kind: "sound-focus",
    categoryIds: ["s-clusters"],
    order: 6,
    items: words("s-clusters", [
      { text: "speak", ipa: "/spiːk/", phoneme: "sp", hint: "Hiss the s first, then go straight to p. No 'eh' before it." },
      { text: "school", ipa: "/skuːl/", phoneme: "sk", hint: "Start on the s — 'sssk', not 'esk'." },
      { text: "student", ipa: "/ˈstuːdənt/", phoneme: "st", hint: "Lead with the s, then t. Clean start." },
      { text: "Spain", ipa: "/speɪn/", phoneme: "sp", hint: "s then p immediately — no vowel in front." },
      { text: "street", ipa: "/striːt/", phoneme: "str", hint: "Three sounds in a row: s-t-r. Start hissing the s." },
      { text: "stop", ipa: "/stɒp/", phoneme: "st", hint: "Begin on the s, not 'estop'." },
      { text: "start", ipa: "/stɑːrt/", phoneme: "st", hint: "Hiss into the t — clean onset." },
      { text: "study", ipa: "/ˈstʌdi/", phoneme: "st", hint: "s-t together at the front." },
      { text: "Spanish", ipa: "/ˈspænɪʃ/", phoneme: "sp", hint: "Ironically — say it clean: 'sp', not 'esp'." },
      { text: "special", ipa: "/ˈspɛʃəl/", phoneme: "sp", hint: "Lead on the s, glide into p." },
    ]),
  },

  // ── 7. -ed endings ───────────────────────────────────────────────────────
  {
    id: "ed-endings",
    title: "-ed endings",
    subtitle: "/t/ /d/ /ɪd/",
    description:
      "Past tense -ed has three sounds. After t/d it adds a syllable (wanted); otherwise it's a quick /t/ or /d/.",
    kind: "sound-focus",
    categoryIds: ["ed-endings"],
    order: 7,
    items: words("ed-endings", [
      { text: "walked", ipa: "/wɔːkt/", phoneme: "t", hint: "Ends in a quick 't': 'walkt'. No extra syllable." },
      { text: "helped", ipa: "/hɛlpt/", phoneme: "t", hint: "Just add 't': 'helpt'." },
      { text: "asked", ipa: "/æskt/", phoneme: "t", hint: "'askt' — s, k, t all at the end." },
      { text: "watched", ipa: "/wɒtʃt/", phoneme: "t", hint: "'watcht' — ends in a sharp t." },
      { text: "played", ipa: "/pleɪd/", phoneme: "d", hint: "Soft 'd' at the end: 'playd'. One syllable." },
      { text: "lived", ipa: "/lɪvd/", phoneme: "d", hint: "'livd' — end with a voiced d." },
      { text: "called", ipa: "/kɔːld/", phoneme: "d", hint: "'cawld' — soft d ending." },
      { text: "used", ipa: "/juːzd/", phoneme: "d", hint: "'yoozd' — voiced d at the end." },
      { text: "wanted", ipa: "/ˈwɒntɪd/", phoneme: "ɪd", hint: "Add a FULL syllable: 'want-id'." },
      { text: "needed", ipa: "/ˈniːdɪd/", phoneme: "ɪd", hint: "Extra syllable: 'need-id'." },
      { text: "started", ipa: "/ˈstɑːrtɪd/", phoneme: "ɪd", hint: "'start-id' — you hear the -id." },
      { text: "decided", ipa: "/dɪˈsaɪdɪd/", phoneme: "ɪd", hint: "'decide-id' — full extra syllable." },
    ]),
  },

  // ── 8. final consonant clusters ──────────────────────────────────────────
  {
    id: "final-clusters",
    title: "Final consonant clusters",
    subtitle: "say every ending",
    description: "Spanish rarely stacks consonants at the end, so they get dropped. Pronounce each one to the end.",
    kind: "sound-focus",
    categoryIds: ["final-clusters"],
    order: 8,
    items: words("final-clusters", [
      { text: "texts", ipa: "/tɛksts/", phoneme: "ksts", hint: "Say it all: 'teksts'. Don't drop the last t." },
      { text: "asked", ipa: "/æskt/", phoneme: "skt", hint: "'askt' — s, k, t to the end." },
      { text: "world", ipa: "/wɜːrld/", phoneme: "rld", hint: "Finish the l and d: 'wor-ld'." },
      { text: "films", ipa: "/fɪlmz/", phoneme: "lmz", hint: "l, m, z all land: 'filmz'." },
      { text: "helped", ipa: "/hɛlpt/", phoneme: "lpt", hint: "l, p, t: 'helpt'." },
      { text: "facts", ipa: "/fækts/", phoneme: "kts", hint: "'fakts' — keep the final t." },
      { text: "desks", ipa: "/dɛsks/", phoneme: "sks", hint: "s, k, s: 'desks'. Don't stop at 'desk'." },
      { text: "months", ipa: "/mʌnθs/", phoneme: "nθs", hint: "n, TH, s: 'munths'. Tongue out for the th." },
      { text: "clothes", ipa: "/kloʊðz/", phoneme: "ðz", hint: "Voiced TH then z: 'clothez'." },
    ]),
  },

  // ── 9. schwa /ə/ ─────────────────────────────────────────────────────────
  {
    id: "schwa",
    title: "Schwa reduction",
    subtitle: "/ə/ — the lazy 'uh'",
    description: "Unstressed vowels in English collapse into a tiny 'uh'. Don't pronounce them full — relax them.",
    kind: "sound-focus",
    categoryIds: ["schwa"],
    order: 9,
    items: words("schwa", [
      { text: "about", ipa: "/əˈbaʊt/", phoneme: "ə", hint: "First sound is a tiny lazy 'uh': 'uh-BOUT'." },
      { text: "banana", ipa: "/bəˈnænə/", phoneme: "ə", hint: "Only the middle is strong: 'buh-NA-nuh'." },
      { text: "the", ipa: "/ðə/", phoneme: "ə", hint: "Before consonants it's 'thuh', not 'thee'." },
      { text: "problem", ipa: "/ˈprɒbləm/", phoneme: "ə", hint: "Second vowel reduces: 'PROB-luhm'." },
      { text: "supply", ipa: "/səˈplaɪ/", phoneme: "ə", hint: "First syllable is weak: 'suh-PLY'." },
      { text: "again", ipa: "/əˈɡɛn/", phoneme: "ə", hint: "Start with 'uh': 'uh-GEN'." },
      { text: "support", ipa: "/səˈpɔːrt/", phoneme: "ə", hint: "'suh-PORT' — weak first syllable." },
      { text: "around", ipa: "/əˈraʊnd/", phoneme: "ə", hint: "'uh-ROUND' — relax that first vowel." },
    ]),
  },

  // ── 10. word stress ──────────────────────────────────────────────────────
  {
    id: "word-stress",
    title: "Word stress",
    subtitle: "PHOto vs photoGRAPHy",
    description: "English punches one syllable hard. Move the stress and the meaning (or the word) changes.",
    kind: "sound-focus",
    categoryIds: ["word-stress"],
    order: 10,
    items: words("word-stress", [
      { text: "photo", ipa: "/ˈfoʊtoʊ/", phoneme: "1", hint: "Punch the first part: PHO-to." },
      { text: "photography", ipa: "/fəˈtɒɡrəfi/", phoneme: "2", hint: "Stress moves to the second: pho-TOG-ra-phy." },
      { text: "present", ipa: "/ˈprɛzənt/", phoneme: "noun", hint: "A gift = PRE-sent (stress first).", note: "noun" },
      { text: "present", ipa: "/prɪˈzɛnt/", phoneme: "verb", hint: "To give = pre-SENT (stress second).", note: "verb" },
      { text: "record", ipa: "/ˈrɛkɔːrd/", phoneme: "noun", hint: "A REcord (stress first).", note: "noun" },
      { text: "record", ipa: "/rɪˈkɔːrd/", phoneme: "verb", hint: "To reCORD (stress second).", note: "verb" },
      { text: "object", ipa: "/ˈɒbdʒɪkt/", phoneme: "noun", hint: "An OBject (stress first).", note: "noun" },
      { text: "object", ipa: "/əbˈdʒɛkt/", phoneme: "verb", hint: "To obJECT (stress second).", note: "verb" },
    ]),
  },

  // ── 11. connected speech / phrases ───────────────────────────────────────
  {
    id: "connected-speech",
    title: "Phrases & rhythm",
    subtitle: "connected speech",
    description: "Real English links words and rides a rhythm. Say whole phrases smoothly — don't chop word by word.",
    kind: "phrase",
    categoryIds: ["connected-speech"],
    order: 11,
    items: phrases("connected-speech", [
      {
        text: "She sells seashells by the seashore",
        ipa: "/ʃiː sɛlz ˈsiːʃɛlz baɪ ðə ˈsiːʃɔːr/",
        phoneme: "s/ʃ",
        hint: "Switch cleanly between 's' and 'sh'. Keep it light and flowing.",
      },
      {
        text: "I've been thinking about it",
        ipa: "/aɪv bɪn ˈθɪŋkɪŋ əˈbaʊt ɪt/",
        phoneme: "linking",
        hint: "Link 'about it' into 'abou-tit'. Soft TH on 'thinking'.",
      },
      {
        text: "The thirty-three thieves thought",
        ipa: "/ðə ˈθɜːrti θriː θiːvz θɔːt/",
        phoneme: "θ/ð",
        hint: "Tongue between teeth on every TH. Slow first, then speed up.",
      },
      {
        text: "Very big black bears",
        ipa: "/ˈvɛri bɪɡ blæk bɛərz/",
        phoneme: "b/v",
        hint: "Teeth-on-lip for 'very', lips-together for the b-words.",
      },
      {
        text: "He has a happy home",
        ipa: "/hiː hæz ə ˈhæpi hoʊm/",
        phoneme: "h",
        hint: "A soft breath on every h. Don't drop them.",
      },
      {
        text: "What do you want to do?",
        ipa: "/ˈwʌt dʒə ˈwɑːnə duː/",
        phoneme: "reduction",
        hint: "Natural English: 'whatcha wanna do'. Relax the small words.",
      },
    ]),
  },
];

// ── The full-lesson layer: teach first, then drill, then real sentences ─────
// Every built-in lesson gets a "Learn" stage (a short mini-class shown before
// any drilling) and a closing set of sentences that put the sound into
// connected speech. Kept in one block so the curriculum's teaching voice is
// easy to review and edit as a whole.

const INTROS: Record<string, LessonIntro> = {
  "i-vs-ii": {
    summary: "English splits the Spanish 'i' into two different vowels — a short relaxed one and a long tense one.",
    whyTricky:
      "Spanish has exactly one 'i', so 'ship' and 'sheep' sound identical to your ear at first. In English they're different words — and mixing them up can get embarrassing fast.",
    how: [
      "Short /ɪ/ — relax your lips and jaw completely. It's quick and lazy. Don't smile.",
      "Long /iː/ — smile wide, pull your lips back, tongue high. Stretch it: eeee.",
      "Feel it: your face is loose for 'ship', tight and smiling for 'sheep'.",
    ],
    exampleIds: ["i-vs-ii:ship", "i-vs-ii:sheep", "i-vs-ii:live", "i-vs-ii:leave"],
  },
  "flap-t": {
    summary: "The flap T is the most American sound of all: between two vowels, T (and D) become a quick, soft D.",
    whyTricky:
      "Textbooks and British English keep a crisp T, so 'water' sounds like 'wa-TER'. Americans tap it — 'wah-der'. Say a hard T and you sound stiff or foreign; miss the tap and fast American speech is hard to follow.",
    how: [
      "Find a T (or D) sitting between two vowel sounds: wa-t-er, be-tt-er, ci-t-y.",
      "Instead of a hard T, tap the ridge behind your teeth once — it comes out like a soft, quick D.",
      "Keep it light and fast: 'water' → 'wah-der', 'city' → 'si-dee', 'party' → 'par-dee'.",
    ],
    exampleIds: ["flap-t:water", "flap-t:better", "flap-t:city", "flap-t:party"],
  },
  "american-r": {
    summary: "American English is rhotic — every R is pronounced, including at the end of a word: car, hard, sister.",
    whyTricky:
      "The Spanish R is a tap or trill with the tongue tip forward. The American R is the opposite — the tongue curls back and touches nothing. And unlike British English, Americans never drop the final R.",
    how: [
      "Pull your tongue up and back so the tip points at the roof of your mouth — but don't let it touch.",
      "Round your lips a little and let it 'growl' low in your mouth.",
      "Say the R at the END too: 'car', 'teacher', 'morning' — never 'cah' or 'teach-uh'.",
    ],
    exampleIds: ["american-r:car", "american-r:work", "american-r:sister", "american-r:girl"],
  },
  "b-vs-v": {
    summary: "In English, b and v are two different sounds made in two different places.",
    whyTricky:
      "In Spanish, b and v are pronounced the same, so 'berry' and 'very' collapse into one word. English listeners hear the difference instantly.",
    how: [
      "For /b/ — press both lips together, then pop them open with your voice on.",
      "For /v/ — rest your top teeth on your bottom lip and push air through. It buzzes.",
      "Check in a mirror: teeth visible on v, lips only on b.",
    ],
    exampleIds: ["b-vs-v:berry", "b-vs-v:very", "b-vs-v:boat", "b-vs-v:vote"],
  },
  "dj-vs-y": {
    summary: "The English j is hard and buzzy; y is a soft glide. Spanish sits in between — English splits them apart.",
    whyTricky:
      "Colombian Spanish often says 'yo' with a soft j, so 'jet' and 'yet' blur together. In English they're separate sounds and separate words.",
    how: [
      "For /dʒ/ — press your tongue to the roof of your mouth and release with a buzz, like the g in 'gym'.",
      "For /j/ — keep the tongue relaxed and glide. No contact, no buzz.",
      "Whisper both: j still makes friction; y is just air.",
    ],
    exampleIds: ["dj-vs-y:jet", "dj-vs-y:yet", "dj-vs-y:jail", "dj-vs-y:yale"],
  },
  th: {
    summary: "The two TH sounds — air-only /θ/ and voiced /ð/ — both need your tongue between your teeth.",
    whyTricky:
      "Latin American Spanish has no TH, so it becomes t, d, or s: 'tink', 'dis', 'sank you'. Putting your tongue between your teeth feels strange at first — that's normal, and it's the whole trick.",
    how: [
      "Put the tip of your tongue gently between your teeth. Yes — visibly out.",
      "For 'think': blow air only. No voice.",
      "For 'this': same position, but turn your voice on so it buzzes.",
      "Practice in a mirror until seeing your tongue feels normal.",
    ],
    exampleIds: ["th:think", "th:this", "th:three", "th:mother"],
  },
  h: {
    summary: "English h is a soft breath — much gentler than the Spanish j — and sometimes it disappears completely.",
    whyTricky:
      "Spanish h is silent and Spanish j scrapes the throat. English h sits in between: a warm little breath, like fogging a mirror. And in 'hour' and 'honest' it really is silent.",
    how: [
      "Breathe out gently through an open mouth — no scraping, no effort.",
      "Add the vowel right after the breath: h-at, h-ouse.",
      "Memorize the silent-h words — hour, honest, honor — and start those on the vowel.",
    ],
    exampleIds: ["h:hat", "h:house", "h:hour", "h:honest"],
  },
  "s-clusters": {
    summary: "English words can start with s + consonant — no vowel in front. Speak, not 'espeak'.",
    whyTricky:
      "Spanish never starts a word with s + consonant (escuela, estudiante, España), so your mouth automatically inserts an 'e'. English speakers hear that extra syllable immediately.",
    how: [
      "Start hissing the s first: sssss.",
      "While hissing, jump straight to the next consonant: ssss-peak.",
      "No vowel before the s. If you hear an 'e', reset and start from the hiss.",
    ],
    exampleIds: ["s-clusters:speak", "s-clusters:school", "s-clusters:spain", "s-clusters:street"],
  },
  "ed-endings": {
    summary: "The past-tense -ed has three different sounds — and only one of them adds a syllable.",
    whyTricky:
      "The spelling says 'ed', so it's tempting to say 'walk-ed' with a full syllable every time. English only does that after t or d sounds: wanted, needed.",
    how: [
      "After soft sounds (k, p, s, ch, f): -ed is a quick /t/. walked → 'walkt'.",
      "After voiced sounds (l, v, n, vowels): a soft /d/. played → 'playd'.",
      "Only after t or d: a full extra syllable /ɪd/. wanted → 'want-id'.",
    ],
    exampleIds: ["ed-endings:walked", "ed-endings:played", "ed-endings:wanted"],
  },
  "final-clusters": {
    summary: "English stacks consonants at the ends of words — and every one of them counts.",
    whyTricky:
      "Spanish words end gently, usually in a vowel, n, s, or r. Endings like 'texts' (k-s-t-s) feel impossible, so they get chopped to 'tex'. But dropped endings change the meaning: ask vs asked.",
    how: [
      "Say the word slowly and land every consonant: te-k-s-t-s.",
      "Speed up gradually without dropping any of them.",
      "Exaggerate the final consonant in practice — in real speech it'll come out just right.",
    ],
    exampleIds: ["final-clusters:texts", "final-clusters:asked", "final-clusters:world", "final-clusters:films"],
  },
  schwa: {
    summary: "The schwa — a tiny, lazy 'uh' — is the most common sound in all of English.",
    whyTricky:
      "Spanish pronounces every vowel fully and clearly. English does the opposite: unstressed vowels collapse into 'uh'. Pronouncing every vowel fully is the #1 thing that makes English sound foreign.",
    how: [
      "Find the stressed syllable and punch it: ba-NA-na.",
      "Let every other vowel go limp: buh-NA-nuh.",
      "The schwa is short, central, effortless — your mouth barely moves.",
    ],
    exampleIds: ["schwa:about", "schwa:banana", "schwa:problem", "schwa:supply"],
  },
  "word-stress": {
    summary: "English punches one syllable per word — and moving that punch can change the meaning.",
    whyTricky:
      "Spanish stress is predictable and even marked with accents. English stress is invisible and it moves: PHO-to becomes pho-TOG-ra-phy, and RE-cord (the noun) vs re-CORD (the verb) are different words.",
    how: [
      "Make the stressed syllable longer, louder, and a little higher.",
      "Squash the syllables around it (hello again, schwa).",
      "Noun + verb pairs: nouns usually stress the FIRST syllable, verbs the SECOND.",
    ],
    exampleIds: ["word-stress:photo", "word-stress:photography", "word-stress:record", "word-stress:record-verb"],
  },
  "connected-speech": {
    summary: "Real English links words together and rides a rhythm — you speak in waves, not word by word.",
    whyTricky:
      "Spanish gives every syllable equal time. English stretches the stressed words and squashes everything in between — that's why natives sound 'fast'. The words aren't fast; the small ones are just tiny.",
    how: [
      "Find the big words — nouns and verbs — and stress those.",
      "Link word endings into the next word: 'about it' → 'abou-tit'.",
      "Keep a steady beat on the stressed words and let the rest tumble between them.",
    ],
    exampleIds: ["connected-speech:phrase-2", "connected-speech:phrase-6"],
  },
};

const SENTENCES: Record<string, { text: string; ipa: string; phoneme: string; hint: string }[]> = {
  "i-vs-ii": [
    { text: "Can I sit in this seat?", ipa: "/kæn aɪ sɪt ɪn ðɪs siːt/", phoneme: "sentence", hint: "Quick relaxed i in 'sit', long smiling ee in 'seat'." },
    { text: "I want to live near the sea", ipa: "/aɪ wɒnt tə lɪv nɪr ðə siː/", phoneme: "sentence", hint: "Short lazy i in 'live', then stretch the 'sea'." },
    { text: "Did you see the ship and the sheep?", ipa: "/dɪd juː siː ðə ʃɪp ænd ðə ʃiːp/", phoneme: "sentence", hint: "Two quick i's (did, ship), two long ee's (see, sheep)." },
  ],
  "b-vs-v": [
    { text: "The van is very big", ipa: "/ðə væn ɪz ˈvɛri bɪɡ/", phoneme: "sentence", hint: "Teeth on lip for 'van' and 'very'; lips pop for 'big'." },
    { text: "I vote for the best berry", ipa: "/aɪ voʊt fɔːr ðə bɛst ˈbɛri/", phoneme: "sentence", hint: "Start 'vote' with a buzz, 'berry' with a lip pop." },
    { text: "Bring the vase to the boat", ipa: "/brɪŋ ðə veɪs tuː ðə boʊt/", phoneme: "sentence", hint: "b, v, b — feel the switch each time." },
  ],
  "dj-vs-y": [
    { text: "Did you say jet or yet?", ipa: "/dɪd juː seɪ dʒɛt ɔːr jɛt/", phoneme: "sentence", hint: "Hard buzzy j in 'jet', soft glide in 'yet'." },
    { text: "You will enjoy the yellow jello", ipa: "/juː wɪl ɪnˈdʒɔɪ ðə ˈjɛloʊ ˈdʒɛloʊ/", phoneme: "sentence", hint: "Glide 'yellow', buzz 'jello'." },
    { text: "The judge said yes to your joke", ipa: "/ðə dʒʌdʒ sɛd jɛs tuː jɔːr dʒoʊk/", phoneme: "sentence", hint: "Two buzzy j's, two soft y's." },
  ],
  th: [
    { text: "I think this is my mother's", ipa: "/aɪ θɪŋk ðɪs ɪz maɪ ˈmʌðərz/", phoneme: "sentence", hint: "Tongue between teeth twice — air for 'think', voice for 'this'." },
    { text: "Thank you for these three things", ipa: "/θæŋk juː fɔːr ðiːz θriː θɪŋz/", phoneme: "sentence", hint: "Every TH with the tongue out. No t, no s." },
    { text: "Breathe in and think of the sea", ipa: "/briːð ɪn ænd θɪŋk ʌv ðə siː/", phoneme: "sentence", hint: "End 'breathe' with a buzz, start 'think' with air." },
  ],
  h: [
    { text: "Her house is behind the hill", ipa: "/hɜːr haʊs ɪz bɪˈhaɪnd ðə hɪl/", phoneme: "sentence", hint: "Four soft breaths — no throat scraping." },
    { text: "I hope he is honest", ipa: "/aɪ hoʊp hiː ɪz ˈɒnɪst/", phoneme: "sentence", hint: "Breathe 'hope' and 'he' — but 'honest' has NO h." },
    { text: "Say hello to Henry in an hour", ipa: "/seɪ həˈloʊ tuː ˈhɛnri ɪn ən ˈaʊər/", phoneme: "sentence", hint: "Soft h's — then a silent one in 'hour'." },
  ],
  "s-clusters": [
    { text: "Students speak Spanish at school", ipa: "/ˈstuːdənts spiːk ˈspænɪʃ æt skuːl/", phoneme: "sentence", hint: "Four clean s-starts. No 'e' before any of them." },
    { text: "Stop at the street sign", ipa: "/stɒp æt ðə striːt saɪn/", phoneme: "sentence", hint: "Hiss straight into the t — stop, street." },
    { text: "She started to study in Spain", ipa: "/ʃiː ˈstɑːrtɪd tuː ˈstʌdi ɪn speɪn/", phoneme: "sentence", hint: "st, st, sp — begin each one on the hiss." },
  ],
  "ed-endings": [
    { text: "I walked and talked yesterday", ipa: "/aɪ wɔːkt ænd tɔːkt ˈjɛstərdeɪ/", phoneme: "sentence", hint: "'walkt', 'talkt' — quick t, no extra syllable." },
    { text: "She wanted what she needed", ipa: "/ʃiː ˈwɒntɪd wʌt ʃiː ˈniːdɪd/", phoneme: "sentence", hint: "Both get the extra syllable: want-id, need-id." },
    { text: "We played and then decided", ipa: "/wiː pleɪd ænd ðɛn dɪˈsaɪdɪd/", phoneme: "sentence", hint: "Soft d on 'played', full -id on 'decided'." },
  ],
  "final-clusters": [
    { text: "He asked about the texts", ipa: "/hiː æskt əˈbaʊt ðə tɛksts/", phoneme: "sentence", hint: "Finish every ending: askt, teksts." },
    { text: "The world watched the films", ipa: "/ðə wɜːrld wɒtʃt ðə fɪlmz/", phoneme: "sentence", hint: "rld, tcht, lmz — land every consonant." },
    { text: "She helped with the facts", ipa: "/ʃiː hɛlpt wɪð ðə fækts/", phoneme: "sentence", hint: "helpt and fakts — keep the final t." },
  ],
  schwa: [
    { text: "The problem is about supply", ipa: "/ðə ˈprɒbləm ɪz əˈbaʊt səˈplaɪ/", phoneme: "sentence", hint: "Three lazy 'uh's: the, a-, su-." },
    { text: "Can I have a banana again?", ipa: "/kæn aɪ hæv ə bəˈnænə əˈɡɛn/", phoneme: "sentence", hint: "Relax every weak vowel — buh-NA-nuh, uh-GEN." },
    { text: "Ask around for some support", ipa: "/æsk əˈraʊnd fɔːr səm səˈpɔːrt/", phoneme: "sentence", hint: "uh-ROUND, suh-PORT — squash the weak syllables." },
  ],
  "word-stress": [
    { text: "I want to record a record", ipa: "/aɪ wɒnt tuː rɪˈkɔːrd ə ˈrɛkɔːrd/", phoneme: "sentence", hint: "Verb first: re-CORD. Then the noun: RE-cord." },
    { text: "Please present the present", ipa: "/pliːz prɪˈzɛnt ðə ˈprɛzənt/", phoneme: "sentence", hint: "pre-SENT (give), PRE-sent (gift)." },
    { text: "Photography starts with a photo", ipa: "/fəˈtɒɡrəfi stɑːrts wɪð ə ˈfoʊtoʊ/", phoneme: "sentence", hint: "pho-TOG-ra-phy, then PHO-to — feel the punch move." },
  ],
};

for (const lesson of LESSONS) {
  lesson.intro = INTROS[lesson.id];
  const rows = SENTENCES[lesson.id];
  if (rows) lesson.items = [...lesson.items, ...phrases(lesson.categoryIds[0], rows)];
}

// The Conversación track ships with its own intros, so it joins AFTER the
// sounds-track merge above.
LESSONS.push(...CONVERSATION_LESSONS);
LESSONS.push(...CONVERSATION_LESSONS_2);
LESSONS.push(...CONVERSATION_LESSONS_3);

export const LESSON_BY_ID = new Map(LESSONS.map((l) => [l.id, l]));

/** Every built-in practice item, flattened — handy for SRS and lookups. */
export const ALL_ITEMS: PracticeItem[] = LESSONS.flatMap((l) => l.items);
export const ITEM_BY_ID = new Map(ALL_ITEMS.map((i) => [i.id, i]));

/** The minimal-pair partner of an item, if it has one. */
export function partnerOf(item: PracticeItem, pool: PracticeItem[] = ALL_ITEMS): PracticeItem | undefined {
  if (!item.pairId) return undefined;
  return pool.find((i) => i.pairId === item.pairId && i.id !== item.id);
}
