import { useState, useCallback, useRef, useEffect } from 'react';
import { voiceCommandService, VoiceCommand, VoiceLanguage } from '../services/voice/voiceCommandService';

interface UseVoiceCommandOptions {
  onCommand: (cmd: VoiceCommand) => void;
  onError?:  (msg: string) => void;
  language?: VoiceLanguage;
  autoStop?: boolean;
}

interface UseVoiceCommandReturn {
  listening:  boolean;
  partial:    string;
  supported:  boolean;
  start:      () => void;
  stop:       () => void;
  toggle:     () => void;
}

export const useVoiceCommand = (options?: UseVoiceCommandOptions): UseVoiceCommandReturn => {
  const [listening, setListening] = useState(false);
  const [partial,   setPartial]   = useState('');
  const stopRef = useRef<(() => void) | null>(null);

  // Safety check for options
  const opts = options || { onCommand: () => {} };

  const supported = voiceCommandService.isSupported();

  useEffect(() => {
    if (opts.language) {
      voiceCommandService.setLanguage(opts.language);
    }
  }, [opts.language]);

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    setListening(false);
    setPartial('');
  }, []);

  const start = useCallback(() => {
    if (!supported || listening) return;
    setListening(true);
    setPartial('');

    const cleanup = voiceCommandService.startListening(
      (cmd) => {
        opts.onCommand(cmd);
        if (opts.autoStop !== false) stop();
      },
      (err) => {
        opts.onError?.(err);
        stop();
      },
      (text) => setPartial(text),
    );

    stopRef.current = cleanup;
  }, [supported, listening, opts, stop]);

  const toggle = useCallback(() => {
    if (listening) stop(); else start();
  }, [listening, start, stop]);

  useEffect(() => () => { stopRef.current?.(); }, []);

  return { listening, partial, supported, start, stop, toggle };
};
