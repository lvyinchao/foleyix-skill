# Audio Creator · Foleyix

Write, optimize and repair prompts for background music, vocal songs, podcasts, ambience, effects, game effects, narration, dialogue, sound scenes and character voices. When generation is requested, use your Foleyix account and download the finished WAV. This repository contains the portable Agent Skills package and its dependency-free Node CLI.

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

This command reads the bundled website capability snapshot without login or network access. The upstream website and skill share a source catalog; publication checks its modes, input limits and generated copies. For current online capabilities, use [the public descriptor](https://foleyix.com/audio-capabilities.json). If unavailable, prompt preparation can use the bundled snapshot. CLI 1.4.1 can list and bind your saved reference voices. Reference creation/import/upload, game batches and programme editing/export use the website.

## Connect your account

From the installed skill directory:

```sh
node scripts/foleyix.mjs login
node scripts/foleyix.mjs whoami
node scripts/foleyix.mjs quota
```

Login prints a Foleyix authorization URL and short code. Open that URL manually in your browser, sign in, match the displayed account and code with your terminal, then approve the connection. The agent must wait for your approval. The CLI never launches a browser or another system program; `login --no-browser` remains accepted for compatibility.

The CLI authorization can generate audio, read your allowance, jobs and saved reference voices, and download your private audio. It cannot create/edit/delete voices, manage projects, account settings, payments or the operations dashboard. Credentials stay outside the skill and project files. Use `logout` to revoke this CLI connection while retaining your website session.

## Create audio

```sh
node scripts/foleyix.mjs generate --mode narration \
  --prompt "A warm narrator says: Every great story begins with a small sound." \
  --out ./narration.wav
```

Modes: `free`, `narration`, `dialogue`, `podcast`, `scene`, `sfx`, `ambience`. The default remains `narration`; modes label tasks without rewriting prompts. Prompts are limited to 3,000 Unicode characters. Use `--input script.txt` for a UTF-8 text file. The CLI waits for the job and validates the WAV before saving it. `--json` provides structured results without exposing access or refresh credentials.

Keep the job ID if generation times out or its result is unknown. Follow that job with `status`, then use `download`; do not automatically create another generation to retry the same request. Use the same `--request-id` when resuming a request whose initial response was lost.

For characters, dialogue, music, effects and current inspiration examples, read the [prompt writing guide](skills/audiocreator-foleyix/references/prompt-writing.md). Reference uploads, prompt optimization and professional exports use the website. To attach saved references, use the ordered CLI options below.

See [CLI reference](skills/audiocreator-foleyix/references/cli.md) and [SKILL.md](skills/audiocreator-foleyix/SKILL.md) for the complete workflow.

## Bind reference audio (1.4.1)

```sh
node scripts/foleyix.mjs voices --json
node scripts/foleyix.mjs generate --mode dialogue --prompt '@voice1: Hello. @voice2: Welcome back.' --voice-id SAVED_FIRST_ID --voice-id SAVED_SECOND_ID --out ./dialogue.wav --json
```

Replace the IDs with your chosen saved references from `voices`. Repeat `--voice-id` up to three times; order maps to `@voice1`, `@voice2`, `@voice3`. Typing a marker alone attaches no audio. References must be distinct, owned, completed and retained, at most 30 seconds and 10 MB each. The service uses the same reference validation and model binding as the website. The compiled prompt including reference descriptions must fit within 3,000 Unicode characters. Resume with the same reference IDs in the same order and the same request ID.

## Service and license

[Foleyix](https://foleyix.com) operates the hosted audio service. Account verification, available generation allowance and network access are required. Service availability and allowances are reported by the CLI; this skill does not enable billing or grant additional allowance.

The package and CLI use the [MIT-0 license](LICENSE). Hosted service use is governed by [Foleyix terms](https://foleyix.com/terms) and [acceptable use](https://foleyix.com/acceptable-use).
