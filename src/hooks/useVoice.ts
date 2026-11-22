import { useCallback, useRef, useState } from 'react';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

interface ISpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: any) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface ISpeechRecognitionCtor { new(): ISpeechRecognition }
declare global {
  interface Window {
    SpeechRecognition?: ISpeechRecognitionCtor;
    webkitSpeechRecognition?: ISpeechRecognitionCtor;
  }
}

export interface ParsedCommand {
  action: string;
  item: string;
  qty: number;
  unit: string;
  confidence?: number;
}

const nativeVoice = NativeModules.SMSVoiceRecognition as {
  startListening: (language: string) => Promise<boolean>;
  stopListening: () => void;
  cancelListening: () => void;
} | undefined;
const nativeVoiceEvents = nativeVoice ? new NativeEventEmitter(NativeModules.SMSVoiceRecognition) : null;

export const useVoice = () => {
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const stopNativeRef = useRef<(() => void) | null>(null);

  const hasSpeechAPI = Platform.OS === 'web'
    ? typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
    : Boolean(nativeVoice && nativeVoiceEvents);

  const startListening = useCallback(async (): Promise<string> => {
    setError(null);
    setRecognizedText('');
    setInterimText('');

    if (Platform.OS !== 'web') {
      if (!nativeVoice || !nativeVoiceEvents) throw new Error('Voice selection is unavailable in this app build.');
      // PermissionsAndroid is Android-only and is loaded only on native builds so
      // the web bundle does not try to import an API that react-native-web omits.
      const { PermissionsAndroid } = require('react-native');
      const permission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
        title: 'Microphone permission',
        message: 'Allow ShopLedger to listen for the product name you want to add.',
        buttonPositive: 'Allow',
        buttonNegative: 'Cancel',
      });
      if (permission !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('Microphone permission was denied.');

      return new Promise<string>((resolve, reject) => {
        let settled = false;
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const cleanup = () => {
          if (timeout) clearTimeout(timeout);
          resultSub.remove(); partialSub.remove(); errorSub.remove();
          stopNativeRef.current = null;
        };
        const finish = (text: string) => {
          if (settled) return;
          settled = true;
          cleanup();
          setRecognizedText(text);
          setInterimText('');
          setIsListening(false);
          resolve(text);
        };
        const fail = (message: string) => {
          if (settled) return;
          settled = true;
          cleanup();
          nativeVoice.cancelListening();
          setInterimText('');
          setIsListening(false);
          setError(message);
          reject(new Error(message));
        };

        const resultSub = nativeVoiceEvents.addListener('SMSVoiceResult', (event: { transcript?: string }) => {
          const text = event.transcript?.trim();
          if (text) finish(text);
          else fail('No speech detected. Please try again.');
        });
        const partialSub = nativeVoiceEvents.addListener('SMSVoicePartial', (event: { transcript?: string }) => {
          if (event.transcript) setInterimText(event.transcript);
        });
        const errorSub = nativeVoiceEvents.addListener('SMSVoiceError', (event: { message?: string }) => {
          fail(event.message || 'Speech recognition failed.');
        });

        stopNativeRef.current = () => nativeVoice.stopListening();
        setIsListening(true);
        setInterimText('🎤 Listening…');
        timeout = setTimeout(() => fail('No speech detected. Please try again.'), 15_000);
        nativeVoice.startListening('en-IN').catch((err: any) => fail(err?.message || 'Could not start listening.'));
      });
    }

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) throw new Error('Speech recognition is not available in this browser.');
    return new Promise<string>((resolve, reject) => {
      const recognition = new SpeechRecognitionAPI();
      recognitionRef.current = recognition;
      recognition.lang = 'en-IN';
      recognition.continuous = false;
      recognition.interimResults = true;
      let finalTranscript = '';
      let interimTranscript = '';
      let settled = false;
      const finish = (text: string) => {
        if (settled) return;
        settled = true;
        setRecognizedText(text);
        setInterimText('');
        setIsListening(false);
        resolve(text);
      };
      recognition.onresult = event => {
        let final = '';
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) final += transcript;
          else interim += transcript;
        }
        if (interim) { interimTranscript = interim; setInterimText(interim); }
        if (final) finalTranscript += final;
      };
      recognition.onend = () => {
        const result = (finalTranscript || interimTranscript).trim();
        if (result) finish(result);
        else if (!settled) {
          settled = true;
          setIsListening(false);
          setInterimText('');
          setError('No speech detected. Please try again.');
          reject(new Error('No speech detected. Please try again.'));
        }
      };
      recognition.onerror = event => {
        if (settled) return;
        settled = true;
        const message = event.error === 'not-allowed'
          ? 'Microphone access was denied. Allow microphone access and try again.'
          : event.error === 'network'
            ? 'The phone speech service needs an internet connection.'
            : `Speech recognition error: ${event.error}`;
        setIsListening(false);
        setInterimText('');
        setError(message);
        reject(new Error(message));
      };
      setIsListening(true);
      setInterimText('🎤 Listening…');
      try { recognition.start(); }
      catch (err: any) {
        setIsListening(false);
        setInterimText('');
        reject(new Error(err?.message || 'Could not start listening.'));
      }
    });
  }, []);

  const stopListening = useCallback(() => {
    if (Platform.OS === 'web' && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* already stopped */ }
    } else {
      stopNativeRef.current?.();
    }
  }, []);

  const parseCommand = async (text: string): Promise<ParsedCommand | null> => {
    const normalized = text.trim().toLowerCase();
    const match = normalized.match(/(?:add|select|choose)?\s*(\d+(?:\.\d+)?)?\s*(kg|g|gm|ltr|ml|pcs|piece|dozen|bag|box|packet)?\s+(.+)/i);
    if (match) return { action: 'ADD', item: match[3].trim(), qty: Number(match[1] || 1), unit: match[2] || 'pcs' };
    const item = normalized.replace(/^(add|select|choose)\s+/i, '').trim();
    return item ? { action: 'ADD', item, qty: 1, unit: 'pcs' } : null;
  };

  return { isListening, recognizedText, interimText, hasSpeechAPI, error, startListening, stopListening, parseCommand };
};
