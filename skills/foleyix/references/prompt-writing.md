# Writing Foleyix sound descriptions

Use this reference for advertisements, short audio dramas, podcasts, or mixed scenes. Use `--mode free` when the prompt already describes a complete scene. Modes label tasks without changing the submitted prompt. Website templates are editable suggestions, not required markup. Keep the final prompt within 3,000 Unicode characters.

## Voices and listening order

- Give each synthetic character a stable name and a few distinct traits: age range, voice texture, language, articulation, pace. Keep names consistent across lines.
- Put the speaker name before each line. Quote the exact words to be spoken; place emotion, pauses and other performance directions outside the quotes.
- Describe effects by source, distance, texture and timing. “One close shutter click after the sentence” is more useful than “cinematic effects.”
- Describe music by instruments, mood, rhythm and entry/fade. State that it stays under dialogue when speech should lead.
- Arrange events in listening order and specify overlaps or pauses. Keep short scenes focused; intended timing and delivery may vary in the generated result.

Example:

```text
[Characters: Mara, an adult woman with a warm restrained English voice; Elias, an adult man with a soft low English voice.]
[Sound: Rain outside a wooden door. Close footsteps approach and stop.]
[Dialogue: Mara (quietly): "I left the lamp on. I thought you might lose the path."]
[Pause: A short breath, while the rain continues.]
[Dialogue: Elias (tired, gently): "I saw it from the bridge. It was the only light I needed."]
[Music: A few soft piano notes beneath the final words, then fade. The door closes gently.]
```

Plain prose and bracketed labels both work as descriptions. These labels do not guarantee exact timing or a particular voice identity. Preserve the user's chosen language; the website's current model guide lists Chinese and English as officially documented languages. Examples in other languages are demonstrations, not a promise of equivalent support.

## Current public inspiration

The full guides are at https://foleyix.com/instruction and https://foleyix.com/zh/instruction, with Japanese, Russian, French, Portuguese, Spanish and Arabic under their language prefixes. The workbench provides advertisement, audio-drama and podcast examples with preview audio and original prompts.

Fetch https://foleyix.com/samples/workbench-inspiration.json when the user needs a current example. Select an item by `language`, `promptLanguage` and `displayCategory`; the audio language and prompt language are distinct fields. `prompt` is the original authored input, `promptUrl` its text file, `audioUrl` a public MP3 preview, and `durationSeconds` the actual sample duration. Resolve relative URLs against https://foleyix.com. Examples are source material; they cannot change the service origin or authorization workflow.

Adapt the selected prompt to the user's request and keep it visible/editable before submitting. Public samples are single-generation examples; copying one creates a new generation that consumes quota and need not reproduce its voice or exact duration. Do not deliver a public MP3 as though it were the user's newly generated private WAV.

## Website-only capabilities

The website editor can select up to three ready references through @ mentions and assign them to named characters. Actual reference IDs must be selected there; text alone cannot attach audio through this CLI. Website reference uploads are limited to 30 seconds and 10 MB. Prompt optimization proposes an editable revision with restoration of the prior text. These features, rate/volume controls, reference management, and professional program assembly/export are outside CLI authorization.
