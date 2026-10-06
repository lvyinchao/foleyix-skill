# Audio Creator · Foleyix

Direct sound, write, optimize and repair prompts for background music, vocal songs, podcasts, ambience, effects, game effects, narration, dialogue, sound scenes and character voices. When generation is requested, use your Foleyix account and download the finished WAV. This repository contains the portable Agent Skills package and its dependency-free Node CLI.

Supported installation targets include Codex, Claude Code, Qoder, OpenClaw and Hermes. Prompt-only work runs offline without login or Node.js. Account operations and generation require Node **22.20 or later**. The skill and CLI are MIT-0; audio generation uses your Foleyix account and the same duration allowance as the website. Downloading existing audio does not consume generation time.

## Install

```sh
npx skills@1.7.0 add lvyinchao/foleyix-skill --skill audiocreator-foleyix --global
```

Select your agent when prompted. Git is required for GitHub installation. A ZIP installation is also available:

```sh
npx skills@1.7.0 add https://foleyix.com/downloads/audiocreator-foleyix-skill.zip --skill audiocreator-foleyix --global
```

You can give your agent this instruction:

> Install the Foleyix skill from https://foleyix.com/skill, then run its CLI login and wait for me to authorize it on the website.

Chinese installation guide: [foleyix.com/zh/skill](https://foleyix.com/zh/skill).

The skill identifier is `$audiocreator-foleyix` (renamed from `$foleyix`). The GitHub repository URL remains unchanged. Remove an older local `foleyix` skill after installing this replacement if your agent still shows both; existing account connections use the same private configuration directory.

## Audio types and website synchronization

Background music is instrumental; songs include singing or rap and exact lyrics. Both use `--mode free`. Podcasts use `--mode podcast`, environment recordings use `--mode ambience`, and standalone effects use `--mode sfx`.

```sh
node scripts/foleyix.mjs capabilities --json
```

This command reads the bundled website capability snapshot without login or network access. The upstream website and skill share a source catalog; publication checks its modes, input limits and generated copies. For current online capabilities, use [the public descriptor](https://foleyix.com/audio-capabilities.json). If unavailable, prompt preparation can use the bundled snapshot. CLI 1.6.0 can create synthetic references, generate previews, upload authorized WAVs, and list and bind saved references. Catalog import, game batches and programme editing/export use the website.

## Sound direction and long scripts

The [director guide](skills/audiocreator-foleyix/references/direction.md) plans line-specific performance, emphasis, pauses, turn taking, sound hierarchy, spatial perspective, energy changes and segment continuity while preserving exact dialogue, lyrics and user constraints. Load only the sound-type branch needed. Exact loudness, looping and seamless joins require actual editing and listening.

Long input is split near sentence or paragraph boundaries into requests satisfying both limits, including bound reference descriptions. With an output path, results are separate `.part-001.wav` files. Resume with the original input and parent request ID; completed parts are reused. Stop on unknown or failed outcomes rather than creating replacement tasks. Automatic splitting does not repeat opening directions or merge/mix clips. For directed programs, prepare self-contained segment inputs with stable speaker/reference mappings.

Generation charges only successfully saved audio duration. A positive balance is required to start; debt blocks generation and generated-audio access until repaid by subscription or time packs.

## Connect your account

From the installed skill directory:

```sh
node scripts/foleyix.mjs login
node scripts/foleyix.mjs whoami
node scripts/foleyix.mjs quota
```

Login prints a Foleyix authorization URL and short code. Open that URL manually in your browser, sign in, match the displayed account and code with your terminal, then approve the connection. The agent must wait for your approval. The CLI never launches a browser or another system program; `login --no-browser` remains accepted for compatibility.

New login requests `audio:read audio:generate voices:write`: generation, owned reference creation/preview/upload, allowance and task reads, and private audio downloads. Older connections retain their original grants; run `login` again and approve the displayed reference write permission before using the new commands. Editing/deleting voices, catalog import, projects, account settings, payments and the operations dashboard remain excluded. Credentials stay outside the skill and project files. Use `logout` to revoke this CLI connection while retaining your website session.

## Create audio

```sh
node scripts/foleyix.mjs generate --mode narration \
  --prompt "A warm narrator says: Every great story begins with a small sound." \
  --out ./narration.wav
```

Modes: `free`, `narration`, `dialogue`, `podcast`, `scene`, `sfx`, `ambience`. The default remains `narration`; modes label tasks without rewriting prompts. Each complete request is limited to 500 Han characters and 2,000 total Unicode code points; mixed text obeys both limits. Longer input automatically splits losslessly into ordered requests. Use `--input script.txt` for a UTF-8 text file. The CLI waits for the job and validates the WAV before saving it. `--json` provides structured results without exposing access or refresh credentials.

Keep the job ID if generation times out or its result is unknown. Follow that job with `status`, then use `download`; do not automatically create another generation to retry the same request. Use the same `--request-id` when resuming a request whose initial response was lost.

For characters, dialogue, music, effects and current inspiration examples, read the [prompt writing guide](skills/audiocreator-foleyix/references/prompt-writing.md). Reference uploads can use the CLI with explicit rights confirmation. Prompt optimization and professional exports use the website. To attach saved references, use the ordered CLI options below.

See [CLI reference](skills/audiocreator-foleyix/references/cli.md) and [SKILL.md](skills/audiocreator-foleyix/SKILL.md) for the complete workflow.

## Create and upload reference audio (1.5.0)

```sh
node scripts/foleyix.mjs voice-create --name "Narrator" --description "Warm, clear synthetic adult voice" --preview-text "Welcome aboard." --json
node scripts/foleyix.mjs voice-preview RETURNED_VOICE_ID --out ./reference.wav --json
node scripts/foleyix.mjs voice-upload --input /absolute/path/reference.wav --name "Narrator reference" --rights-confirmed --json
```

Creation first saves metadata; a successful preview produces a reusable reference and uses the shared generation allowance. Upload accepts a complete PCM/float WAV up to 30 seconds and 10 MB, requires rights and speaker permission, and uses storage without generation seconds. `voice-preview` supports the same request recovery and download options as `generate`; `jobs --kind voice-design` follows previews. Inspect `voices` before retrying an uncertain metadata creation or upload, since those writes are not idempotent.

## Bind reference audio

```sh
node scripts/foleyix.mjs voices --json
node scripts/foleyix.mjs generate --mode dialogue --prompt '@voice1: Hello. @voice2: Welcome back.' --voice-id SAVED_FIRST_ID --voice-id SAVED_SECOND_ID --out ./dialogue.wav --json
```

Replace the IDs with your chosen saved references from `voices`. Repeat `--voice-id` up to three times; order maps to `@voice1`, `@voice2`, `@voice3`. Typing a marker alone attaches no audio. References must be distinct, owned, completed and retained, at most 30 seconds and 10 MB each. The service uses the same reference validation and model binding as the website. The compiled prompt including reference descriptions must fit within 500 Han characters and 2,000 total Unicode code points. Resume with the same reference IDs in the same order and the same request ID.

## Service and license

[Foleyix](https://foleyix.com) operates the hosted audio service. Account verification, available generation allowance and network access are required. Service availability and allowances are reported by the CLI; this skill does not enable billing or grant additional allowance.

The package and CLI use the [MIT-0 license](LICENSE). Hosted service use is governed by [Foleyix terms](https://foleyix.com/terms) and [acceptable use](https://foleyix.com/acceptable-use).
