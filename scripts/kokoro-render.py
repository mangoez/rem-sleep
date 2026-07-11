import json
import os
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro import KPipeline


SAMPLE_RATE = 24000
VOICE = {
    "mod": os.environ.get("KOKORO_MOD_VOICE", "am_puck"),
    "pwincess": os.environ.get("KOKORO_PWINCESS_VOICE", "af_heart"),
}
SPEED = {
    "mod": float(os.environ.get("KOKORO_MOD_SPEED", "1.0")),
    "pwincess": float(os.environ.get("KOKORO_PWINCESS_SPEED", "0.96")),
}
PITCH = {
    "mod": float(os.environ.get("KOKORO_MOD_PITCH", "1.0")),
    "pwincess": float(os.environ.get("KOKORO_PWINCESS_PITCH", "1.08")),
}


def pitch_fast(audio, factor):
    if factor == 1.0 or len(audio) < 2:
        return audio
    source_positions = np.arange(0, len(audio), factor)
    shifted = np.interp(source_positions, np.arange(len(audio)), audio)
    return shifted.astype(np.float32)


def render_one(pipeline, item):
    speaker = item["speaker"]
    voice = VOICE.get(speaker, VOICE["mod"])
    speed = SPEED.get(speaker, SPEED["mod"])
    pitch = PITCH.get(speaker, PITCH["mod"])
    output_path = Path(item["outputPath"])
    output_path.parent.mkdir(parents=True, exist_ok=True)

    generator = pipeline(item["text"], voice=voice, speed=speed, split_pattern=None)
    chunks = []
    for _, _, audio in generator:
        chunks.append(np.asarray(audio, dtype=np.float32))
    if not chunks:
        raise RuntimeError(f"Kokoro returned no audio for {output_path}")

    audio = np.concatenate(chunks)
    audio = pitch_fast(audio, pitch)
    sf.write(output_path, audio, SAMPLE_RATE)


def main():
    if len(sys.argv) != 2:
        print("Usage: kokoro-render.py manifest.json", file=sys.stderr)
        return 2

    with open(sys.argv[1], "r", encoding="utf-8") as handle:
        manifest = json.load(handle)
    items = manifest["items"]

    print(f"Loading Kokoro voices: mod={VOICE['mod']}, pwincess={VOICE['pwincess']}")
    pipeline = KPipeline(lang_code="a")

    for index, item in enumerate(items, start=1):
        label = f"{item['storyId']} {item['lineNumber']} {item['speaker']}"
        print(f"Rendering {index}/{len(items)} {label}")
        render_one(pipeline, item)

    print(f"Done. Wrote {len(items)} file(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
