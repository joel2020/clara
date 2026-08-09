class FakeAudio {
  static instances = [];

  constructor(src) {
    this.src = src;
    this.playbackRate = 1;
    this.onplay = null;
    this.onended = null;
    this.onerror = null;
    this.pauseCalls = 0;
    FakeAudio.instances.push(this);
  }

  play() {
    return Promise.resolve();
  }

  pause() {
    this.pauseCalls += 1;
  }
}

class FakeUtterance {
  constructor(text) {
    this.text = text;
    this.rate = 1;
    this.pitch = 1;
    this.lang = "";
    this.voice = null;
    this.onstart = null;
    this.onend = null;
    this.onerror = null;
  }
}

const synth = {
  cancelCalls: 0,
  utterances: [],
  cancel() {
    this.cancelCalls += 1;
  },
  getVoices() {
    return [];
  },
  speak(utterance) {
    this.utterances.push(utterance);
  },
};

globalThis.Audio = FakeAudio;
globalThis.SpeechSynthesisUtterance = FakeUtterance;
globalThis.window = { speechSynthesis: synth };

const { playPronunciation, stopPronunciation } = await import("./player.ts");

let ok = 0;
let failed = 0;

function check(condition, message) {
  if (condition) ok += 1;
  else {
    failed += 1;
    console.error(`FAIL ${message}`);
  }
}

function reset() {
  stopPronunciation();
  FakeAudio.instances.length = 0;
  synth.utterances.length = 0;
  synth.cancelCalls = 0;
  window.speechSynthesis = synth;
}

function test(name, run) {
  reset();
  try {
    run();
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`, error);
  }
}

test("a second playback pauses the first recording", () => {
  playPronunciation({ id: "american-r:bird", text: "bird" });
  const first = FakeAudio.instances[0];

  playPronunciation({ id: "american-r:car", text: "car" });

  check(first.pauseCalls === 1, "replacement pauses the previous audio element");
  check(FakeAudio.instances.length === 2, "replacement starts a new recording");
});

test("an alternate recording failure retries the primary recording once", () => {
  playPronunciation({ id: "american-r:bird", text: "bird", voice: "sarah" });
  const alternate = FakeAudio.instances[0];

  alternate.onerror?.(new Event("error"));
  alternate.onerror?.(new Event("error"));

  check(FakeAudio.instances[0]?.src === "/audio/v/sarah/american_r_bird.mp3", "alternate recording is tried first");
  check(FakeAudio.instances[1]?.src === "/audio/american_r_bird.mp3", "primary recording is the fallback");
  check(FakeAudio.instances.length === 2, "duplicate failure events cannot retry the primary twice");
});

test("a primary recording failure falls back to synthesis", () => {
  playPronunciation({ id: "american-r:bird", text: "bird" });

  FakeAudio.instances[0].onerror?.(new Event("error"));

  check(synth.utterances.length === 1, "primary recording failure starts speech synthesis");
  check(synth.utterances[0]?.text === "bird", "synthesis receives the requested text");
});

test("unsupported synthesis reports a terminal error", () => {
  let errors = 0;
  delete window.speechSynthesis;

  playPronunciation({ text: "custom phrase", onError: () => { errors += 1; } });

  check(errors === 1, "missing speech synthesis invokes onError once");
});

test("a synthesis error reports onError rather than onEnd", () => {
  let ends = 0;
  let errors = 0;
  playPronunciation({
    text: "custom phrase",
    onEnd: () => { ends += 1; },
    onError: () => { errors += 1; },
  });

  synth.utterances[0].onerror?.(new Event("error"));

  check(errors === 1, "synthesis failure invokes onError");
  check(ends === 0, "synthesis failure does not invoke onEnd");
});

test("successful completion reports onEnd only once", () => {
  let ends = 0;
  let errors = 0;
  playPronunciation({
    id: "american-r:bird",
    text: "bird",
    onEnd: () => { ends += 1; },
    onError: () => { errors += 1; },
  });
  const audio = FakeAudio.instances[0];

  audio.onended?.(new Event("ended"));
  audio.onended?.(new Event("ended"));
  audio.onerror?.(new Event("error"));

  check(ends === 1, "duplicate completion events invoke onEnd once");
  check(errors === 0, "events after successful completion do not invoke onError");
});

test("stale recording callbacks cannot clear or terminate a newer playback", () => {
  let firstEnds = 0;
  let firstErrors = 0;
  let secondEnds = 0;
  playPronunciation({
    id: "american-r:bird",
    text: "bird",
    onEnd: () => { firstEnds += 1; },
    onError: () => { firstErrors += 1; },
  });
  const first = FakeAudio.instances[0];

  playPronunciation({
    id: "american-r:car",
    text: "car",
    onEnd: () => { secondEnds += 1; },
  });
  const second = FakeAudio.instances[1];
  first.onerror?.(new Event("error"));
  first.onended?.(new Event("ended"));
  stopPronunciation();

  check(firstEnds === 0 && firstErrors === 0, "cancelled recording callbacks stay silent");
  check(FakeAudio.instances.length === 2, "stale recording failure does not start a fallback");
  check(second.pauseCalls === 1, "stale recording callback does not detach the active recording");
  check(secondEnds === 0, "stopping the active recording does not report completion");
});

test("stale synthesis callbacks cannot terminate a newer playback", () => {
  let firstEnds = 0;
  let firstErrors = 0;
  let secondEnds = 0;
  playPronunciation({
    text: "custom phrase",
    onEnd: () => { firstEnds += 1; },
    onError: () => { firstErrors += 1; },
  });
  const firstUtterance = synth.utterances[0];

  playPronunciation({
    id: "american-r:bird",
    text: "bird",
    onEnd: () => { secondEnds += 1; },
  });
  firstUtterance.onerror?.(new Event("error"));
  firstUtterance.onend?.(new Event("end"));
  FakeAudio.instances[0].onended?.(new Event("ended"));

  check(firstEnds === 0 && firstErrors === 0, "cancelled synthesis callbacks stay silent");
  check(secondEnds === 1, "newer recording reaches its own terminal state");
});

test("stopPronunciation does not report a false failure", () => {
  let ends = 0;
  let errors = 0;
  playPronunciation({
    text: "custom phrase",
    onEnd: () => { ends += 1; },
    onError: () => { errors += 1; },
  });
  const utterance = synth.utterances[0];

  stopPronunciation();
  utterance.onerror?.(new Event("error"));
  utterance.onend?.(new Event("end"));

  check(errors === 0, "deliberate cancellation does not invoke onError");
  check(ends === 0, "deliberate cancellation does not invoke onEnd");
});

stopPronunciation();
console.log(`player: ${ok} ok, ${failed} failed`);
process.exit(failed ? 1 : 0);
