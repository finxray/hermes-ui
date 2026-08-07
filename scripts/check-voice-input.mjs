#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const {
  collectSpeechTranscript,
  createBrowserSpeechRecognition,
  insertSpeechTranscript,
  isBrowserSpeechRecognitionSupported,
  voiceInputErrorMessage
} = await import(pathToFileURL("apps/web/src/lib/browserVoiceInput.ts").toString());

class FakeSpeechRecognition {}

const supportedWindow = { webkitSpeechRecognition: FakeSpeechRecognition };
assert.equal(isBrowserSpeechRecognitionSupported(supportedWindow), true);
assert(createBrowserSpeechRecognition(supportedWindow) instanceof FakeSpeechRecognition);
assert.equal(isBrowserSpeechRecognitionSupported({}), false);
assert.equal(createBrowserSpeechRecognition({}), null);

assert.deepEqual(insertSpeechTranscript("Hello", "world", "from Hermes"), {
  cursor: 17,
  value: "Hello from Hermes world"
});
assert.deepEqual(insertSpeechTranscript("Ask: ", ".", "what time is it"), {
  cursor: 20,
  value: "Ask: what time is it."
});

assert.equal(
  collectSpeechTranscript({
    0: { 0: { transcript: "voice " }, isFinal: true, length: 1 },
    1: { 0: { transcript: "input" }, isFinal: false, length: 1 },
    length: 2
  }),
  "voice input"
);
assert.equal(voiceInputErrorMessage("not-allowed"), "Microphone permission was denied.");
assert.equal(voiceInputErrorMessage("audio-capture"), "No working microphone was found.");

const composer = readFileSync("apps/web/src/components/chat/Composer.tsx", "utf8");
assert(composer.includes("createBrowserSpeechRecognition(window)"));
assert(composer.includes('aria-pressed={isVoiceListening}'));
assert(composer.includes('data-listening={isVoiceListening ? "true" : "false"}'));
assert(composer.includes('data-visible={voiceInputHasError ? "true" : "false"}'));
assert(composer.includes("cancelVoiceInput();\n    clearDraft();"));
assert(composer.includes("collectSpeechTranscript(event.results)"));

console.log("Browser voice-input checks passed.");
