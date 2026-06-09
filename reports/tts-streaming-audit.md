# TTS Streaming Audit

Generated: 2026-06-08T16:17:52.561Z

## Compatibility Matrix

| Format | MIME | Chrome | Firefox | WebRTC | Production Verdict |
| --- | --- | --- | --- | --- | --- |
| Opus/WebM | audio/webm; codecs=opus | High | High | High | Recommended |
| MP3 | audio/mpeg; codecs=mp3 | Medium | Medium | High | Fallback only |
| PCM/WAV | audio/wav | High | High | Medium | Safe fallback |
| Raw PCM | audio/pcm | Low | Low | Medium | Avoid for browser playback |



- Observed Firefox error was caused by MP3 decoder path variance.

- Fix applied: configurable output format + propagated provider content type.

- Best production streaming format: Opus/WebM (`audio/webm; codecs=opus`) with WAV fallback.