# ADR-0005: Browser-backed composer voice input

## Status

Accepted for Stoix 0.1.x.

## Context

Hermes currently reports `audio_api: false`, so Stoix has no verified Hermes
endpoint for speech-to-text. Adding a Stoix transcription route would introduce
an unverified runtime responsibility and another credential/audio data path.

## Decision

The composer uses the browser Speech Recognition API when available. The browser
requests microphone permission and supplies interim/final transcript text to the
existing local draft. Stoix does not receive, upload, or persist microphone audio.

The control remains visible but disabled when the browser does not expose speech
recognition. Permission, microphone, network, language, and no-speech failures are
reported through the control's accessible status.

## Consequences

- Dictation works without a Stoix server route or API key.
- Browser and platform support varies; Chromium-derived browsers are the primary
  supported surface today.
- A browser implementation may use its vendor speech service, so audio processing
  behavior is governed by that browser rather than Stoix.
- A future verified Hermes audio capability can replace the adapter without
  changing composer draft or send behavior.
