/**
 * voiceCommandService.ts — React Native + AI powered
 * ─────────────────────────────────────────────────────
 * Uses @react-native-voice/voice for speech-to-text.
 * Falls back to web SpeechRecognition in web builds.
 * Ambiguous commands go to Gemini AI for parsing.
 *
 * Supported languages: en-IN, kn-IN (Kannada), ta-IN (Tamil), hi-IN (Hindi)
 *
 * Install dependency:
 *   npm install @react-native-voice/voice
 *   cd ios && pod install
 */

import { parseCommandAI } from '../ai/geminiService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type VoiceCommandType =
  | 'search-product'
  | 'add-to-cart'
  | 'remove-from-cart'
  | 'apply-discount'
  | 'checkout'
  | 'customer-lookup'
  | 'cancel-bill'
  | 'print-bill'
  | 'restock'
  | 'price-check'
  | 'unknown';

export interface VoiceCommand {
  command: VoiceCommandType;
  parameters: Record<string, string | number>;
  confidence: number;
  rawTranscript: string;
  language: string;
}

export type VoiceLanguage = 'en-IN' | 'kn-IN' | 'ta-IN' | 'hi-IN';

// ─── Regex patterns (English — Kannada/Tamil/Hindi go to AI) ─────────────────

const PATTERNS: Record<VoiceCommandType, RegExp[]> = {
  'search-product':  [/search\s+(?:for\s+)?(.+)/i, /find\s+(.+)/i, /show\s+(?:me\s+)?(.+)/i],
  'add-to-cart':     [/add\s+(\d+)\s+(?:of\s+)?(.+?)\s*(?:to\s+cart)?$/i, /add\s+(.+?)\s+(?:to\s+)?cart/i, /(.+?)\s+add\s+karo/i],
  'remove-from-cart':[/remove\s+(.+?)\s+from\s+cart/i, /delete\s+(.+)/i, /hata\s+(.+)/i],
  'apply-discount':  [/(?:apply\s+)?(.+?)\s*%\s*discount/i, /discount\s+(\d+)/i],
  'checkout':        [/checkout/i, /bill\s+karo/i, /payment\s+karo/i, /complete/i],
  'customer-lookup': [/(?:find|lookup)\s+customer\s+(.+)/i, /customer\s+(.+)/i],
  'cancel-bill':     [/cancel\s+(?:bill|this)/i, /void/i, /cancel\s+karo/i],
  'print-bill':      [/print\s+(?:bill|receipt)/i, /print\s+karo/i],
  'restock':         [/restock\s+(.+?)\s+(\d+)/i, /add\s+stock\s+(.+?)\s+(\d+)/i],
  'price-check':     [/(?:price|rate)\s+(?:of\s+)?(.+)/i, /(.+?)\s+ka\s+(?:rate|price)/i],
  'unknown':         [],
};

// ─── Regex parser ─────────────────────────────────────────────────────────────

const parseByRegex = (transcript: string): VoiceCommand | null => {
  for (const [type, patterns] of Object.entries(PATTERNS) as [VoiceCommandType, RegExp[]][]) {
    if (type === 'unknown') continue;
    for (const pattern of patterns) {
      const match = transcript.trim().match(pattern);
      if (!match) continue;

      const cmd: VoiceCommand = {
        command: type,
        parameters: {},
        confidence: 0.9,
        rawTranscript: transcript,
        language: 'en-IN',
      };

      switch (type) {
        case 'add-to-cart':
          if (match[1] && match[2] && !isNaN(Number(match[1]))) {
            cmd.parameters.quantity = Number(match[1]);
            cmd.parameters.product  = match[2].trim();
          } else {
            cmd.parameters.product  = (match[1] || match[2]).trim();
            cmd.parameters.quantity = 1;
          }
          break;
        case 'search-product':  cmd.parameters.query        = match[1].trim(); break;
        case 'remove-from-cart':cmd.parameters.product      = match[1].trim(); break;
        case 'apply-discount':  cmd.parameters.discount     = Number((match[1] || match[2]).replace('%','')); break;
        case 'customer-lookup': cmd.parameters.customerName = match[1].trim(); break;
        case 'price-check':     cmd.parameters.product      = match[1].trim(); break;
        case 'restock':
          cmd.parameters.product  = match[1].trim();
          cmd.parameters.quantity = Number(match[2]);
          break;
      }
      return cmd;
    }
  }
  return null;
};

// ─── AI fallback parser ───────────────────────────────────────────────────────

const parseByAI = async (transcript: string, language: VoiceLanguage): Promise<VoiceCommand | null> => {
  try {
    const result = await parseCommandAI(
      `Language: ${language}. Transcript: "${transcript}"`,
    );
    if (!result?.action) return null;

    const actionMap: Record<string, VoiceCommandType> = {
      ADD:     'add-to-cart',
      RESTOCK: 'restock',
      REMOVE:  'remove-from-cart',
      SEARCH:  'search-product',
      PRICE:   'price-check',
      CHECKOUT:'checkout',
    };

    return {
      command: actionMap[result.action] ?? 'unknown',
      parameters: {
        product:  result.item  ?? '',
        quantity: result.qty   ?? 1,
        unit:     result.unit  ?? 'pcs',
      },
      confidence: 0.75,
      rawTranscript: transcript,
      language,
    };
  } catch {
    return null;
  }
};

// ─── React Native Voice wrapper ───────────────────────────────────────────────

let rnVoice: any = null;
try { rnVoice = require('@react-native-voice/voice').default; } catch { /* web build or not installed */ }

// ─── Service ──────────────────────────────────────────────────────────────────

export const voiceCommandService = {
  currentLanguage: 'en-IN' as VoiceLanguage,

  setLanguage(lang: VoiceLanguage) {
    this.currentLanguage = lang;
  },

  isSupported(): boolean {
    if (rnVoice) return true;
    if (typeof window === 'undefined') return false;
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  },

  /**
   * Start listening. Returns a cleanup/stop function.
   * onResult fires with parsed VoiceCommand.
   * onPartial fires with interim transcript text for live display.
   */
  startListening(
    onResult:  (cmd: VoiceCommand) => void,
    onError:   (msg: string) => void,
    onPartial?: (text: string) => void,
  ): () => void {
    if (rnVoice) {
      return this._startRN(onResult, onError, onPartial);
    }
    return this._startWeb(onResult, onError, onPartial);
  },

  _startRN(
    onResult:  (cmd: VoiceCommand) => void,
    onError:   (msg: string) => void,
    onPartial?: (text: string) => void,
  ): () => void {
    const lang = this.currentLanguage;

    rnVoice.onSpeechResults = async (e: any) => {
      const transcript: string = e.value?.[0] ?? '';
      if (!transcript) return;

      // Try regex first, fall back to AI for non-English or complex commands
      let cmd = parseByRegex(transcript);
      if (!cmd || lang !== 'en-IN') {
        cmd = await parseByAI(transcript, lang);
      }

      if (cmd) {
        onResult(cmd);
      } else {
        onError(`Could not understand: "${transcript}"`);
      }
    };

    rnVoice.onSpeechPartialResults = (e: any) => {
      onPartial?.(e.value?.[0] ?? '');
    };

    rnVoice.onSpeechError = (e: any) => {
      onError(e.error?.message ?? 'Speech recognition error');
    };

    rnVoice.start(lang).catch((err: any) => onError(err.message));

    return () => { rnVoice.stop(); rnVoice.cancel(); };
  },

  _startWeb(
    onResult:  (cmd: VoiceCommand) => void,
    onError:   (msg: string) => void,
    onPartial?: (text: string) => void,
  ): () => void {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { onError('Not supported'); return () => {}; }

    const rec = new SpeechRecognition();
    rec.continuous      = false;
    rec.interimResults  = true;
    rec.lang            = this.currentLanguage;

    rec.onresult = async (event: any) => {
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript;
        else onPartial?.(event.results[i][0].transcript);
      }
      if (!final) return;

      let cmd = parseByRegex(final);
      if (!cmd) cmd = await parseByAI(final, this.currentLanguage);
      if (cmd) onResult(cmd);
      else onError(`Could not understand: "${final}"`);
    };

    rec.onerror = (e: any) => onError(`Error: ${e.error}`);
    rec.start();
    return () => rec.abort();
  },

  /** Text-to-speech confirmation (accessibility + UX) */
  speak(text: string, rate = 1.0): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = rate;
      u.lang = this.currentLanguage;
      window.speechSynthesis.speak(u);
    }
  },

  /** Convenience: parse a string without recording (for testing or text input) */
  async parseText(text: string): Promise<VoiceCommand | null> {
    return parseByRegex(text) ?? parseByAI(text, this.currentLanguage);
  },
};
