import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Modal, StyleSheet, TextInput, TouchableOpacity, ScrollView, Animated, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT, SHADOW, GRADIENTS } from '../config/theme';
import { aiAssistantService, AIAssistantResponse } from '../services/ai/aiAssistantService';
import GradientView from './GradientView';

interface AIAssistantModalProps {
  visible: boolean;
  onClose: () => void;
}

const AIAssistantModal = ({ visible, onClose }: AIAssistantModalProps) => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string; suggestions?: string[] }[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible && messages.length === 0) {
      setMessages([{ role: 'assistant', content: "Hello! I'm your FamilyOS Business Assistant. How can I help you today?" }]);
    }
  }, [visible]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    
    const userMsg = { role: 'user' as const, content: text };
    setMessages(prev => [...prev, userMsg]);
    setQuery('');
    setLoading(true);

    try {
      const response = await aiAssistantService.ask(text);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: response.answer, 
        suggestions: response.suggestedFollowUps 
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I hit a snag. Please try again." }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <View style={styles.container}>
          <View style={[styles.header, { backgroundColor: COLORS.PRIMARY }]}>
            <View>
              <Text style={styles.title}>AI Business Assistant</Text>
              <Text style={styles.subtitle}>Grounded in live data</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={{ fontSize: 24, color: '#fff' }}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView ref={scrollRef} style={styles.chatArea} contentContainerStyle={{ padding: SPACING.MD }}>
            {messages.map((msg, i) => (
              <View key={i} style={[styles.msgContainer, msg.role === 'user' ? styles.userMsg : styles.aiMsg]}>
                <View style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}>
                  <Text style={[styles.msgText, msg.role === 'user' ? styles.userText : styles.aiText]}>{msg.content}</Text>
                </View>
                {msg.suggestions && (
                  <View style={styles.suggestions}>
                    {msg.suggestions.map((s, idx) => (
                      <TouchableOpacity key={idx} style={styles.suggestionBtn} onPress={() => handleSend(s)}>
                        <Text style={styles.suggestionText}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ))}
            {loading && (
              <View style={styles.loadingBubble}>
                <ActivityIndicator size="small" color={COLORS.PRIMARY} />
                <Text style={styles.loadingText}>Analyzing business data...</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.inputArea}>
            <TextInput
              style={styles.input}
              placeholder="Ask anything... e.g. 'What sold today?'"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => handleSend(query)}
            />
            <TouchableOpacity style={styles.sendBtn} onPress={() => handleSend(query)}>
              <View style={[styles.sendIcon, { backgroundColor: COLORS.PRIMARY }]}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>→</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  container: { height: '80%', backgroundColor: '#F9FAFB', borderTopLeftRadius: RADIUS.LG, borderTopRightRadius: RADIUS.LG, overflow: 'hidden' },
  header: { padding: SPACING.LG, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#fff', fontSize: 18, fontWeight: '900' },
  subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', alignItems: 'center' },
  chatArea: { flex: 1 },
  msgContainer: { marginBottom: SPACING.LG, maxWidth: '85%' },
  userMsg: { alignSelf: 'flex-end' },
  aiMsg: { alignSelf: 'flex-start' },
  bubble: { padding: SPACING.MD, borderRadius: RADIUS.LG, ...SHADOW.LIGHT },
  userBubble: { backgroundColor: COLORS.PRIMARY, borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: '#fff', borderBottomLeftRadius: 4 },
  msgText: { fontSize: 14, lineHeight: 20 },
  userText: { color: '#fff', fontWeight: '500' },
  aiText: { color: COLORS.TEXT_HEADING },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 8 },
  suggestionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.PILL, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.PRIMARY + '30' },
  suggestionText: { fontSize: 11, color: COLORS.PRIMARY, fontWeight: '700' },
  loadingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: SPACING.MD },
  loadingText: { fontSize: 12, color: COLORS.TEXT_DIM, fontStyle: 'italic' },
  inputArea: { padding: SPACING.MD, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: COLORS.DIVIDER, flexDirection: 'row', alignItems: 'center', gap: 12 },
  input: { flex: 1, height: 48, backgroundColor: '#F3F4F6', borderRadius: RADIUS.LG, paddingHorizontal: 16, fontSize: 14 },
  sendBtn: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden' },
  sendIcon: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});

export default AIAssistantModal;
