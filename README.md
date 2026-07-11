# REM Sleep

This is a dumb little bedtime story app where a greasy reddit mod reads classic
fairy tales to his pwincess.

It is intentionally cringe. That is the point.

Live site:

https://mangoez.github.io/REM-sleep/

## What is in here

- `docs/` is the actual web app.
- `docs/stories/` has the story data.
- `docs/narrator.js` handles play, pause, resume, stop, Kokoro audio, and fallback voice picking.
- `scripts/check-stories.js` checks that the story files are still valid.
- `scripts/generate-kokoro-audio.js` makes the voice files for the site.

## Run it

Open this file in a browser:

```text
docs/index.html
```

No server needed. No build step needed for the web version.

There is also a quick voice test page:

```text
docs/tts-check.html
```

Use that when the voices sound cursed and you want to know if it is the browser,
the device, or our settings.

## Voices

The app uses generated Kokoro audio when the files exist in `docs/audio/`.

If those files are missing, it falls back to browser `speechSynthesis` so the
buttons still work while you are messing around locally.

The current Kokoro setup is:

- `mod`: `am_puck`, normal speed and pitch with a more nasal greasy reddit man read
- `pwincess`: `af_heart`, slowed down with a tiny pitch lift into ditzy young girl mode

Install Kokoro first:

```sh
python3.11 -m venv .venv-kokoro
.venv-kokoro/bin/python -m pip install "kokoro>=0.9.4" soundfile
```

Then generate the audio:

```sh
node scripts/generate-kokoro-audio.js
```

Run it again with `--force` if you changed a story line and want to overwrite
old audio:

```sh
node scripts/generate-kokoro-audio.js --force
```

The Kokoro model cache goes into `.kokoro-cache/`, which is ignored. The
generated story audio goes into `docs/audio/`, which should be committed for
GitHub Pages.

You can mess with the casting without editing code:

```sh
KOKORO_MOD_VOICE=am_eric KOKORO_PWINCESS_VOICE=af_bella node scripts/generate-kokoro-audio.js --force
```

The story text is spoken as written. The cringe stays.

## Add a story

1. Copy one of the files in `docs/stories/`.
2. Add your story object.
3. Use this shape for each line:

```js
{ text: "mod says something" }
{ text: "pwincess says something", speaker: "pwincess" }
```

4. Add the new story script to `docs/index.html`.
5. Run the checker:

```sh
node scripts/check-stories.js
```

The checker will reject:

- empty stories
- lines over 280 characters
- unknown speakers
- any pwincess line with the letter `r`

She does not say `r`. Do not make her say `r`.

## Notes

Most of the reasoning log is in `REVIEW.md`. It is mostly here so future me can
remember why things are weird.
