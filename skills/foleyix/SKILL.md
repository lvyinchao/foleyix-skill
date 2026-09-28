---
name: foleyix
description: Generate narration, dialogue, sound scenes, sound effects, and ambience with Foleyix; check audio tasks and account quota, then download private WAV results. Use when the user asks for Foleyix audio creation or wants these audio files produced through their Foleyix account.
license: MIT-0
metadata:
  author: "Foleyix"
  version: "1.0.1"
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
| `narration` | Spoken text and brief delivery instructions |
| `dialogue` | Speaker-labelled dialogue and character descriptions |
| `scene` | A sound scene combining speech, events, and atmosphere |
| `sfx` | A specific sound event and its timing or texture |
| `ambience` | A sustained background sound environment |

Use only synthetic character voices for this workflow. Voice-reference upload, voice cloning, project editing, and whole-episode exports are outside this skill's commands.

```sh
node scripts/foleyix.mjs quota --json
node scripts/foleyix.mjs generate --mode narration --prompt "Welcome aboard. Read warmly and clearly." --out ./welcome.wav --json
```

Use `--input /absolute/path/script.txt` instead of `--prompt` for UTF-8 files. The default mode is `narration`. Generation waits up to ten minutes and downloads when `--out` is supplied; `--no-wait` returns the task ID immediately. Check the result's status and absolute file path before calling it complete. If audio inspection or playback is available in the host, listen to the delivered file and compare it with the user's request.

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
