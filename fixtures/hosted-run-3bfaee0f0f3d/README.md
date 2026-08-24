# Golden reference — hosted run `job_3bfaee0f0f3d`

`frames_manifest.json` is the frame manifest a real hosted run produced for an
11.8-minute video (708.0 s): 125 detected scene changes, 107 kept after pHash
dedup, `scene` at 0.3, hamming 5.

Only the manifest is committed. The media is 45 MB and lives outside the repo;
`scripts/golden-frames.mjs` compares a local run against this file when you have
the source.

## What is stable, and what is not

The local port reproduces the manifest exactly on the two things that matter:

| Signal | Result |
|---|---|
| raw frame list (`idx` + `t_ms`) | **125/125 identical** |
| frames kept after dedup | **107 vs 107** |
| per-frame `phash` string | 120/125 identical |
| per-frame `kept` flag | 123/125 identical |

The five differing hashes are all **hamming distance 2** — the noise floor,
against a dedup threshold of 5. They come from JPEG encoder differences between
ffmpeg builds: the same decoded video re-encodes to very slightly different
pixels, and pHash is a function of pixels.

Those two bits then flipped which frame of one near-identical PAIR became its
cluster representative (54 vs 57), which is why two `kept` flags disagree while
the total stays 107.

**So the oracle compares the raw frame list and the kept COUNT, not the hash
strings and not per-frame kept flags.** Asserting on pHash equality would build
a gate that fails on an ffmpeg upgrade and teaches everyone to ignore it.
