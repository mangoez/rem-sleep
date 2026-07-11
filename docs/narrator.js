"use strict";

/**
 * Narrator reads a story's lines aloud, one line per utterance.
 *
 *   Narrator.play(lines, { storyId, onLine(i), onEnd() })
 *     Starts narrating from line 0. If already narrating, the old run is
 *     silently replaced. `lines` is an array of { text, speaker? } where
 *     speaker is "mod" (default) or "pwincess". onLine fires as each line
 *     begins, including again for a line spoken after resume.
 *     onEnd fires once when the final line finishes, not on stop().
 *   Narrator.pause()   silence now. No op unless narrating.
 *   Narrator.resume()  continue from the start of the paused line.
 *                        no op unless paused.
 *   Narrator.stop()    back to idle. No op when idle.
 *
 * Everything else, Kokoro audio lookup, browser voice fallback, speaker mapping,
 * and queue cancel races, is this module's business alone.
 */
const Narrator = (() => {
  const AUDIO_EXT = "wav";

  // The cast maps each speaker to both a generated audio shape and a fallback
  // browser voice shape. 1.0 means engine normal.
  const VOICES = {
    mod: {
      pitch: 0.95,
      rate: 0.9,
      audioRate: 0.94,
      lang: "en-US",
      voiceHints: ["Daniel", "Alex", "Microsoft Guy", "Microsoft David", "Microsoft Mark", "Google UK English Male"],
    },
    pwincess: {
      pitch: 1.35,
      rate: 1.08,
      audioRate: 1.04,
      lang: "en-US",
      voiceHints: ["Samantha", "Victoria", "Karen", "Tessa", "Microsoft Jenny", "Microsoft Zira", "Google US English"],
    },
  };

  let state = "idle"; // "idle" | "playing" | "paused"
  let lines = [];
  let index = 0;
  let callbacks = {};
  let webVoices = [];
  let currentAudio = null;
  let activeStoryId = "";
  // Bumped on every cancel. Active utterance callbacks compare against it
  // so a cancelled run can never advance the queue of the run that replaced it.
  let session = 0;

  function refreshWebVoices() {
    if (!window.speechSynthesis) return;
    webVoices = window.speechSynthesis.getVoices();
  }

  if (window.speechSynthesis) {
    refreshWebVoices();
    if (typeof window.speechSynthesis.addEventListener === "function") {
      window.speechSynthesis.addEventListener("voiceschanged", refreshWebVoices);
    } else {
      window.speechSynthesis.onvoiceschanged = refreshWebVoices;
    }
  }

  function scoreWebVoice(webVoice, voice) {
    const name = webVoice.name.toLowerCase();
    const lang = (webVoice.lang || "").toLowerCase();
    let score = 0;
    if (lang === voice.lang.toLowerCase()) score += 10;
    else if (lang.startsWith("en")) score += 6;
    else return -1;

    voice.voiceHints.forEach((hint, i) => {
      if (name.includes(hint.toLowerCase())) score += 30 - i;
    });
    if (/natural|enhanced|premium|neural|online/.test(name)) score += 5;
    if (/compact/.test(name)) score -= 6;
    if (webVoice.default) score += 1;
    return score;
  }

  function pickWebVoice(voice) {
    if (!webVoices.length) refreshWebVoices();
    const best = webVoices
      .map((webVoice) => ({ webVoice, score: scoreWebVoice(webVoice, voice) }))
      .filter((candidate) => candidate.score >= 0)
      .sort((a, b) => b.score - a.score)[0];
    return best ? best.webVoice : null;
  }

  function speakWeb(text, voice, done) {
    if (!window.speechSynthesis) {
      done();
      return;
    }

    const u = new window.SpeechSynthesisUtterance(text);
    u.voice = pickWebVoice(voice);
    u.lang = voice.lang;
    u.pitch = voice.pitch;
    u.rate = voice.rate;
    u.onend = done;
    u.onerror = done; // a line the engine chokes on is skipped, not fatal
    window.speechSynthesis.speak(u);
  }

  function audioPath(storyId, lineIndex, speaker) {
    if (!storyId) return "";
    const file = `${String(lineIndex + 1).padStart(3, "0")}-${speaker}.${AUDIO_EXT}`;
    return `audio/${storyId}/${file}`;
  }

  function speakAudio(src, voice, done, fallback) {
    const audio = new Audio(src);
    currentAudio = audio;
    audio.preload = "auto";
    audio.playbackRate = voice.audioRate;
    audio.onended = done;
    audio.onerror = () => {
      if (currentAudio === audio) currentAudio = null;
      fallback();
    };
    audio.play().catch(() => {
      if (currentAudio === audio) currentAudio = null;
      fallback();
    });
  }

  function speakCurrent() {
    const mySession = session;
    const line = lines[index];
    const speaker = line.speaker || "mod";
    const voice = VOICES[speaker] || VOICES.mod;
    if (callbacks.onLine) callbacks.onLine(index);
    const done = () => {
      if (session !== mySession) return; // this run was cancelled meanwhile
      currentAudio = null;
      index += 1;
      if (index < lines.length) {
        speakCurrent();
      } else {
        state = "idle";
        if (callbacks.onEnd) callbacks.onEnd();
      }
    };
    const fallback = () => {
      if (session !== mySession) return;
      speakWeb(line.text, voice, done);
    };
    const src = audioPath(activeStoryId, index, speaker);
    if (src) speakAudio(src, voice, done, fallback);
    else fallback();
  }

  function cancelEngine() {
    session += 1;
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = "";
      currentAudio = null;
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  return {
    play(newLines, cbs) {
      cancelEngine();
      lines = newLines || [];
      index = 0;
      callbacks = cbs || {};
      activeStoryId = callbacks.storyId || "";
      if (!lines.length) { // empty story: end immediately rather than error
        state = "idle";
        if (callbacks.onEnd) callbacks.onEnd();
        return;
      }
      state = "playing";
      speakCurrent();
    },

    // Pause cancels the current utterance and resume speaks that line from
    // its start, avoiding Chrome's speechSynthesis.pause() path (notoriously
    // unreliable). Line start granularity is fine at bedtime.
    pause() {
      if (state !== "playing") return;
      if (currentAudio) {
        currentAudio.pause();
      } else {
        cancelEngine();
      }
      state = "paused";
    },

    resume() {
      if (state !== "paused") return;
      state = "playing";
      if (currentAudio) {
        currentAudio.play().catch(() => speakCurrent());
      } else {
        speakCurrent();
      }
    },

    stop() {
      if (state === "idle") return;
      cancelEngine();
      state = "idle";
      lines = [];
      index = 0;
      activeStoryId = "";
      callbacks = {};
    },
  };
})();
