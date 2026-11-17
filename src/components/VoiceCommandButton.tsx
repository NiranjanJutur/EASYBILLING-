import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Alert, Animated } from 'react-native';
import { voiceCommandService, type VoiceCommand } from '../services/voice/voiceCommandService';
import { COLORS, FONT_SIZE, FONT_WEIGHT } from '../config/theme';

interface VoiceButtonProps {
  onCommand: (command: any) => void;
  disabled?: boolean;
  style?: any;
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({ onCommand, disabled, style }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const pulseAnimation = new Animated.Value(1);

  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnimation.setValue(1);
    }
  }, [isListening]);

  const handleStartListening = () => {
    if (disabled) return;

    if (!voiceCommandService.isSupported()) {
      Alert.alert('Not Supported', 'Speech recognition is not supported on this device');
      return;
    }

    setIsListening(true);
    setTranscript('');

    const stopListening = voiceCommandService.startListening(
      (command: VoiceCommand) => {
        setIsListening(false);
        setTranscript(command.command);
        onCommand(command.command); // Sending command string as per BillingScreen expectation
        voiceCommandService.speak(`${command.command} received`);
      },
      (error: string) => {
        setIsListening(false);
        if (error !== 'No speech detected') {
          Alert.alert('Voice Error', error);
        }
      }
    );

    // Auto-stop after 7 seconds
    setTimeout(() => {
      if (isListening) {
        stopListening();
        setIsListening(false);
      }
    }, 7000);
  };

  return (
    <View style={[styles.container, style]}>
      <Animated.View
        style={[
          styles.button,
          isListening && styles.listeningButton,
          disabled && styles.disabledButton,
          {
            transform: [{ scale: pulseAnimation }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.buttonContent}
          onPress={handleStartListening}
          disabled={isListening || disabled}
        >
          <Text style={styles.buttonIcon}>{isListening ? '🎤' : '🎙️'}</Text>
          <Text style={styles.buttonText}>{isListening ? '...' : 'Voice'}</Text>
        </TouchableOpacity>
      </Animated.View>

      {transcript && isListening && (
        <View style={styles.transcriptBox}>
          <Text style={styles.transcriptText}>{transcript}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.INFO,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  listeningButton: {
    backgroundColor: COLORS.ERROR,
  },
  disabledButton: {
    backgroundColor: COLORS.BORDER,
  },
  buttonContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonIcon: {
    fontSize: 22,
    color: COLORS.WHITE,
  },
  buttonText: {
    fontSize: FONT_SIZE.XS,
    color: COLORS.WHITE,
    marginTop: 1,
    fontWeight: FONT_WEIGHT.BOLD,
  },
  transcriptBox: {
    position: 'absolute',
    top: -40,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  transcriptText: {
    fontSize: FONT_SIZE.XS,
    color: COLORS.WHITE,
    fontWeight: FONT_WEIGHT.MEDIUM,
  },
});