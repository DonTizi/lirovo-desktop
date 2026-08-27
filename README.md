# Lirovo

Turn any video into structured data, on your own Mac.

Give it a link or a file and a schema. It transcribes the audio, cuts the video
into frames, describes what is on screen, builds a knowledge graph over both,
and fills in the fields you asked for — **each value carrying the moment in the
video that proves it**, whether that was said out loud or only shown on a slide.

Nothing leaves the machine unless you point it at a model that lives somewhere
else.

## Install

Download the latest DMG from [Releases](https://github.com/DonTizi/lirovo-desktop/releases).
The app carries the tools it needs — ffmpeg, ffprobe, whisper.cpp and yt-dlp —
so a Mac with nothing installed works on first launch. The speech model is
fetched on demand and verified against a published checksum.

You still need something to do the reasoning: a local OpenAI-compatible server
(Ollama, LM Studio, llama.cpp), or one of the agent CLIs it can detect. Settings
shows what this machine has and what it is missing.

## From source

```
pnpm install
pnpm desktop          # the app
pnpm cli doctor       # what this machine can do
```

## The CLI

The same engine, without the window:

```
lirovo doctor
lirovo install                            # fetch what is missing and fetchable
lirovo extract <url|file> --schema s.json
lirovo extract <url|file> --no-inference  # transcript and frames only
```

## How it is laid out

| package | what it is |
| --- | --- |
| `packages/contracts` | types, zod schemas, errors, ports. No Node. |
| `packages/core` | use cases and the pipeline. No concrete adapters. |
| `packages/node-runtime` | the adapters: ffmpeg, yt-dlp, whisper, SQLite, models |
| `apps/cli` | the terminal surface |
| `apps/desktop` | the Electron app |

## Licence

[Apache-2.0](LICENSE).

The macOS app **distributes** third-party programs inside its bundle, including
a GPL-licensed FFmpeg. [`NOTICE`](NOTICE) carries their licences and the written
offer of corresponding source that the GPL requires.

## Security

[`SECURITY.md`](SECURITY.md). Report privately.
