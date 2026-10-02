---
name: foleyix
description: Create audio from free-form descriptions, narration, dialogue, podcasts, sound scenes, sound effects, and ambience with Foleyix; check tasks and quota, then download private WAV results. Use when the user asks to create or retrieve audio through their Foleyix account.
license: MIT-0
metadata:
  author: "Foleyix"
  version: "1.1.0"
  homepage: "https://foleyix.com/skill"
  openclaw:
    requires:
      bins: [node]
    envVars:
      - name: FOLEYIX_CONFIG_DIR
        required: false
        description: Optional absolute private directory for local CLI login and request state. Defaults to the user's .config/foleyix directory.
    homepage: "https://foleyix.com/skill"
    emoji: "🔊"
---

# Foleyix

Requires Node.js 22.20 or newer and network access. This standard Agent Skill works with Codex, Claude Code, Qoder, OpenClaw, Hermes, and compatible clients.

Create audio through the user's Foleyix account at https://foleyix.com. The website and this CLI share the same account, audio-time quota, task queue, and sound library. The skill is free software; Foleyix generation uses the account's trial or subscription quota measured in seconds. Check `quota` for the current balance.

Run the bundled, zero-dependency CLI from this skill's directory. Resolve the installed skill path before running a command; do not assume the project contains this script.

```sh
node scripts/foleyix.mjs help
node scripts/foleyix.mjs whoami --json
```

If `whoami` requests login, run:

```sh
node scripts/foleyix.mjs login --no-browser --json
```

The CLI writes an authorization URL and short user code to stderr. Present them to the user and wait for the user to log in, verify the account and code, and approve on the website. Do not collect the user's password, approve on their behalf, read the private credential file, or put credentials in agent context. Successful login returns the connected account without tokens. Login always displays the link for the user to open manually; it does not launch system programs. `--no-browser` remains accepted for compatibility.

## Create and deliver audio

Choose the mode that fits the requested result:

| Mode | Input |
| --- | --- |
| `free` | A complete authored sound description |
| `narration` | Spoken text and brief delivery instructions |
| `dialogue` | Speaker-labelled dialogue and character descriptions |
| `podcast` | Host-labelled conversation with natural turn taking |
| `scene` | A sound scene combining speech, events, and atmosphere |
| `sfx` | A specific sound event and its timing or texture |
| `ambience` | A sustained background sound environment |

For structured scenes, read [references/prompt-writing.md](references/prompt-writing.md): it explains characters, quoted dialogue, effects, music, listening order, and the current public examples. Preserve the user's words and chosen language. Templates and optimization are suggestions; use the final authored prompt rather than silently replacing it.

Use synthetic character descriptions in CLI prompts. The website's reference-audio selection with `@voice1`–`@voice3`, reference upload, audio controls, prompt optimizer, free script generator, project editing, and whole-episode exports require website workflows; this CLI accepts only mode and prompt and cannot bind reference audio. Do not imply that typing an @ marker into a CLI prompt attaches a voice.

```sh
node scripts/foleyix.mjs quota --json
node scripts/foleyix.mjs generate --mode narration --prompt "Welcome aboard. Read warmly and clearly." --out ./welcome.wav --json
```

Use `--input /absolute/path/script.txt` instead of `--prompt` for UTF-8 files. Input is limited to 3,000 Unicode characters. Mode selection labels the task; it does not rewrite or add instructions to the submitted prompt. The default remains `narration` for existing commands; explicitly choose `--mode free` for complete descriptions and copied inspiration prompts. Generation waits up to ten minutes and downloads when `--out` is supplied; `--no-wait` returns the task ID immediately. Check the result's status and absolute file path before calling it complete. If audio inspection or playback is available in the host, listen to the delivered file and compare it with the user's request.

Check quota before generating: available generation seconds are `generationLimit - generationUsed - generationReserved`. Queued tasks hold reservations; a wait timeout does not release them. Storage and queue capacity are shared with the website. Requested duration is guidance, not a guarantee; report the actual delivered duration when available. Downloading an existing result does not consume generation seconds.

Every generation request has a persistent request ID. If a response is lost, the CLI retries with the same ID and reuses unresolved matching requests on the next invocation. Preserve the returned `requestId` and use `--request-id ID` with exactly the same input when resuming. Never automatically create a replacement for a task whose status is `unknown`. A wait timeout leaves the task running; use its existing ID:

```sh
node scripts/foleyix.mjs status TASK_ID --json
node scripts/foleyix.mjs download TASK_ID --out ./result.wav --json
```

## Account and task operations

```sh
node scripts/foleyix.mjs jobs --active --json
node scripts/foleyix.mjs jobs --limit 50 --json
node scripts/foleyix.mjs logout --json
```

Downloads require an available result owned by the connected account. The CLI checks WAV type, header, and complete byte count before saving atomically. Choose an existing output directory; existing files need an explicit `--force`. Logout revokes this CLI connection and reports success only after the server confirms it.

Read [references/cli.md](references/cli.md) for pagination, JSON outcomes, request recovery, and development-origin usage. A paused model service, exhausted audio time, full queue, expired result, or rejected website authorization is a concrete failure; report it without claiming audio was generated.
