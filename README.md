# Foleyix Agent Skill

Create narration, dialogue, sound scenes, sound effects and ambience through your Foleyix account, then download the finished WAV. This repository contains the portable Agent Skills package and its dependency-free Node CLI.

Supported installation targets include Codex, Claude Code, Qoder, OpenClaw and Hermes. Node **22.20 or later** is required. The skill and CLI are MIT-0; audio generation uses your Foleyix account and the same duration allowance as the website. Downloading existing audio does not consume generation time.

## Install

```sh
npx skills@1.7.0 add lvyinchao/foleyix-skill --skill foleyix --global
```

Select your agent when prompted. Git is required for GitHub installation. A ZIP installation is also available:

```sh
npx skills@1.7.0 add https://foleyix.com/downloads/foleyix-skill.zip --skill foleyix --global
```

You can give your agent this instruction:

> Install the Foleyix skill from https://foleyix.com/skill, then run its CLI login and wait for me to authorize it on the website.

Chinese installation guide: [foleyix.com/zh/skill](https://foleyix.com/zh/skill).

## Connect your account

From the installed skill directory:

```sh
node scripts/foleyix.mjs login
node scripts/foleyix.mjs whoami
node scripts/foleyix.mjs quota
```

Login opens Foleyix in your browser. Sign in, match the displayed account and code with your terminal, then approve the connection. The agent must wait for your approval. For a remote terminal, use `login --no-browser`.

The CLI authorization can generate audio, read your allowance and jobs, and download your private audio. It cannot manage projects, voices, account settings, payments or the operations dashboard. Credentials stay outside the skill and project files. Use `logout` to revoke this CLI connection while retaining your website session.

## Create audio

```sh
node scripts/foleyix.mjs generate --mode narration \
  --prompt "A warm narrator says: Every great story begins with a small sound." \
  --out ./narration.wav
```

Modes: `narration`, `dialogue`, `scene`, `sfx`, `ambience`. Use `--input script.txt` for a UTF-8 text file. The CLI waits for the job and validates the WAV before saving it. `--json` provides structured results without exposing access or refresh credentials.

Keep the job ID if generation times out or its result is unknown. Follow that job with `status`, then use `download`; do not automatically create another generation to retry the same request. Use the same `--request-id` when resuming a request whose initial response was lost.

See [CLI reference](skills/foleyix/references/cli.md) and [SKILL.md](skills/foleyix/SKILL.md) for the complete workflow.

## Service and license

[Foleyix](https://foleyix.com) operates the hosted audio service. Account verification, available generation allowance and network access are required. Service availability and allowances are reported by the CLI; this skill does not enable billing or grant additional allowance.

The package and CLI use the [MIT-0 license](LICENSE). Hosted service use is governed by [Foleyix terms](https://foleyix.com/terms) and [acceptable use](https://foleyix.com/acceptable-use).
