export type BrowserSpeechRecognitionAlternative = {
  transcript: string;
};

export type BrowserSpeechRecognitionResult = {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: BrowserSpeechRecognitionAlternative;
};

export type BrowserSpeechRecognitionResultList = {
  readonly length: number;
  readonly [index: number]: BrowserSpeechRecognitionResult;
};

export type BrowserSpeechRecognitionEvent = {
  readonly resultIndex: number;
  readonly results: BrowserSpeechRecognitionResultList;
};

export type BrowserSpeechRecognitionErrorEvent = {
  readonly error: string;
  readonly message?: string;
};

export type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onend: (() => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onstart: (() => void) | null;
  abort: () => void;
  start: () => void;
  stop: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: BrowserSpeechRecognitionConstructor;
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
};

export function createBrowserSpeechRecognition(windowObject: Window): BrowserSpeechRecognition | null {
  const voiceWindow = windowObject as SpeechRecognitionWindow;
  const Recognition = voiceWindow.SpeechRecognition ?? voiceWindow.webkitSpeechRecognition;
  return Recognition ? new Recognition() : null;
}

export function isBrowserSpeechRecognitionSupported(windowObject: Window): boolean {
  const voiceWindow = windowObject as SpeechRecognitionWindow;
  return Boolean(voiceWindow.SpeechRecognition ?? voiceWindow.webkitSpeechRecognition);
}

export function collectSpeechTranscript(results: BrowserSpeechRecognitionResultList) {
  let finalTranscript = "";
  let interimTranscript = "";

  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    const transcript = result?.[0]?.transcript ?? "";
    if (result?.isFinal) {
      finalTranscript += transcript;
    } else {
      interimTranscript += transcript;
    }
  }

  return `${finalTranscript}${interimTranscript}`.trim();
}

export function insertSpeechTranscript(prefix: string, suffix: string, transcript: string) {
  const cleanTranscript = transcript.trim();
  if (!cleanTranscript) {
    return { cursor: prefix.length, value: `${prefix}${suffix}` };
  }

  const leadingSpace = prefix.length > 0 && !/\s$/.test(prefix) ? " " : "";
  const trailingSpace = suffix.length > 0 && !/^[\s.,!?;:)]/.test(suffix) ? " " : "";
  const insertion = `${leadingSpace}${cleanTranscript}${trailingSpace}`;

  return {
    cursor: prefix.length + leadingSpace.length + cleanTranscript.length,
    value: `${prefix}${insertion}${suffix}`
  };
}

export function voiceInputErrorMessage(error: string): string {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone permission was denied.";
    case "audio-capture":
      return "No working microphone was found.";
    case "network":
      return "Voice recognition could not reach its speech service.";
    case "no-speech":
      return "No speech was detected.";
    case "language-not-supported":
      return "Voice recognition does not support this language.";
    default:
      return "Voice recognition stopped unexpectedly.";
  }
}
