/**
 * Audio playback utility for Gemini TTS (gemini-3.1-flash-tts-preview)
 * and seamless browser SpeechSynthesis fallback for kids reading.
 */

let activeAudioSource: AudioBufferSourceNode | null = null;
let activeAudioCtx: AudioContext | null = null;

export function stopCurrentAudio() {
  if (activeAudioSource) {
    try {
      activeAudioSource.stop();
    } catch {
      // already stopped
    }
    activeAudioSource = null;
  }
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Play PCM or standard audio from base64 string
 */
export async function playGeminiAudio(
  base64Data: string,
  sampleRate = 24000,
  onEnded?: () => void
): Promise<void> {
  stopCurrentAudio();

  const AudioContextClass =
    window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("Web Audio API not supported");
  }

  if (!activeAudioCtx || activeAudioCtx.state === "closed") {
    activeAudioCtx = new AudioContextClass();
  }

  if (activeAudioCtx.state === "suspended") {
    await activeAudioCtx.resume();
  }

  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Attempt 1: Standard container decode (WAV, MP3)
  try {
    const audioBuffer = await activeAudioCtx.decodeAudioData(bytes.buffer.slice(0));
    const source = activeAudioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(activeAudioCtx.destination);
    source.onended = () => {
      activeAudioSource = null;
      onEnded?.();
    };
    activeAudioSource = source;
    source.start(0);
    return;
  } catch (decodeErr) {
    // Attempt 2: Raw PCM 16-bit 24kHz little-endian
    try {
      const pcm16 = new Int16Array(bytes.buffer);
      const audioBuffer = activeAudioCtx.createBuffer(1, pcm16.length, sampleRate);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < pcm16.length; i++) {
        channelData[i] = pcm16[i] / 32768.0;
      }

      const source = activeAudioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(activeAudioCtx.destination);
      source.onended = () => {
        activeAudioSource = null;
        onEnded?.();
      };
      activeAudioSource = source;
      source.start(0);
      return;
    } catch (pcmErr) {
      console.warn("PCM audio playback failed, fallback to browser speech synthesis", pcmErr);
      throw decodeErr;
    }
  }
}

/**
 * High quality child-friendly browser speech synthesis fallback
 */
export function playBrowserSpeech(
  text: string,
  voicePreference: "Puck" | "Kore" | "Zephyr" = "Puck",
  onWordBoundary?: (charIndex: number, length: number) => void,
  onEnded?: () => void
): boolean {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return false;
  }

  stopCurrentAudio();

  const utterance = new SpeechSynthesisUtterance(text);
  // Slightly slower pace and cheerful pitch suitable for young readers
  utterance.rate = 0.88;
  utterance.pitch = voicePreference === "Puck" ? 1.15 : voicePreference === "Zephyr" ? 0.95 : 1.05;

  const voices = window.speechSynthesis.getVoices();
  // Find a friendly english voice
  const preferredVoice =
    voices.find((v) => v.lang.startsWith("en") && (v.name.includes("Natural") || v.name.includes("Google") || v.name.includes("Samantha"))) ||
    voices.find((v) => v.lang.startsWith("en")) ||
    voices[0];

  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  if (onWordBoundary) {
    utterance.onboundary = (event) => {
      if (event.name === "word") {
        onWordBoundary(event.charIndex, event.charLength || 5);
      }
    };
  }

  utterance.onend = () => {
    onEnded?.();
  };

  utterance.onerror = () => {
    onEnded?.();
  };

  window.speechSynthesis.speak(utterance);
  return true;
}
