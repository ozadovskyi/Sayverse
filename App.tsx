import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';

import { Language, DEFAULT_SOURCE, DEFAULT_TARGET } from './constants/languages';
import { ThemeColors } from './constants/themes';
import { initOpenAI, isInitialized, transcribeAudio, translateText } from './services/openai';
import { classifyError, userMessage } from './services/errors';
import { requestPermissions, startRecording, stopRecording } from './services/audio';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import RecordButton from './components/RecordButton';
import LanguagePicker from './components/LanguagePicker';
import TranslationCard from './components/TranslationCard';
import OfflineBanner from './components/OfflineBanner';
import SettingsScreen from './components/SettingsScreen';

const API_KEY_STORAGE = 'openai_api_key';

function AppContent() {
  const { colors, themeName } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [apiKey, setApiKey] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [source, setSource] = useState<Language>(DEFAULT_SOURCE);
  const [target, setTarget] = useState<Language>(DEFAULT_TARGET);

  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [originalText, setOriginalText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [error, setError] = useState('');
  const [lastTranscription, setLastTranscription] = useState<{
    text: string; source: string; target: string;
  } | null>(null);

  const { isOffline } = useNetworkStatus();

  useEffect(() => {
    (async () => {
      const saved = await SecureStore.getItemAsync(API_KEY_STORAGE);
      if (saved) {
        setApiKey(saved);
        initOpenAI(saved);
        setIsReady(true);
      }
    })();
  }, []);

  const handleSaveKey = useCallback(async () => {
    const key = apiKeyInput.trim();
    if (!key.startsWith('sk-')) {
      Alert.alert('Invalid key', 'OpenAI API key should start with "sk-"');
      return;
    }
    await SecureStore.setItemAsync(API_KEY_STORAGE, key);
    setApiKey(key);
    initOpenAI(key);
    setIsReady(true);
  }, [apiKeyInput]);

  const handleLogout = useCallback(async () => {
    await SecureStore.deleteItemAsync(API_KEY_STORAGE);
    setApiKey('');
    setIsReady(false);
    setApiKeyInput('');
    setOriginalText('');
    setTranslatedText('');
  }, []);

  const handleSwapLanguages = useCallback(() => {
    setSource(target);
    setTarget(source);
  }, [source, target]);

  const handleRecordPress = useCallback(async () => {
    if (recording) {
      setRecording(false);
      setProcessing(true);
      setOriginalText('');
      setTranslatedText('');

      try {
        const uri = await stopRecording();
        if (!uri) {
          setError('No audio recorded');
          setProcessing(false);
          return;
        }

        const { text } = await transcribeAudio(uri);
        setOriginalText(text);
        setLastTranscription({ text, source: source.name, target: target.name });

        const translation = await translateText(text, source.name, target.name);
        setTranslatedText(translation);
      } catch (e: unknown) {
        const appError = classifyError(e);
        setError(userMessage(appError));
      } finally {
        setProcessing(false);
      }
      return;
    }

    if (isOffline) {
      Alert.alert('No connection', 'Internet is required for voice translation.');
      return;
    }
    setError('');
    const granted = await requestPermissions();
    if (!granted) {
      Alert.alert('Permission needed', 'Microphone access is required for voice translation.');
      return;
    }
    setRecording(true);
    await startRecording();
  }, [recording, isOffline, source, target]);

  const handleRetryTranslation = useCallback(async () => {
    if (!lastTranscription) return;
    setError('');
    setProcessing(true);
    try {
      const translation = await translateText(
        lastTranscription.text, lastTranscription.source, lastTranscription.target,
      );
      setTranslatedText(translation);
    } catch (e: unknown) {
      const appError = classifyError(e);
      setError(userMessage(appError));
    } finally {
      setProcessing(false);
    }
  }, [lastTranscription]);

  // ── API Key Setup Screen ──
  if (!isReady) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style={colors.statusBar} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.setupContainer}
        >
          <Text style={styles.title}>OpenTranslator</Text>
          <Text style={styles.subtitle}>Voice translator powered by OpenAI</Text>

          <View style={styles.setupCard}>
            <Text style={styles.setupLabel}>Enter your OpenAI API key</Text>
            <Text style={styles.setupHint}>
              Get it at platform.openai.com. Your key is stored securely on this device only.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="sk-..."
              placeholderTextColor={colors.textMuted}
              value={apiKeyInput}
              onChangeText={setApiKeyInput}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <Pressable style={styles.saveButton} onPress={handleSaveKey}>
              <Text style={styles.saveButtonText}>Save & Start</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Main Translator Screen ──
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={colors.statusBar} />
      <OfflineBanner isOffline={isOffline} />

      <View style={styles.header}>
        <Text style={styles.title}>OpenTranslator</Text>
        <View style={styles.headerButtons}>
          <Pressable onPress={() => setShowSettings(true)}>
            <Text style={styles.headerButtonText}>Settings</Text>
          </Pressable>
          <Pressable onPress={handleLogout}>
            <Text style={styles.headerButtonText}>Change key</Text>
          </Pressable>
        </View>
      </View>

      <LanguagePicker
        source={source}
        target={target}
        onChangeSource={setSource}
        onChangeTarget={setTarget}
        onSwap={handleSwapLanguages}
      />

      <View style={styles.content}>
        <TranslationCard
          originalText={originalText}
          translatedText={translatedText}
          sourceLabel={source.name}
          targetLabel={target.name}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {error && originalText && !translatedText ? (
          <Pressable style={styles.retryButton} onPress={handleRetryTranslation} disabled={processing}>
            <Text style={styles.retryButtonText}>Retry Translation</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.footer}>
        <RecordButton
          isRecording={recording}
          isProcessing={processing}
          onPress={handleRecordPress}
        />
      </View>

      <SettingsScreen visible={showSettings} onClose={() => setShowSettings(false)} />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    setupContainer: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 28,
      fontWeight: '800',
      textAlign: 'center',
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 14,
      textAlign: 'center',
      marginTop: 4,
      marginBottom: 32,
    },
    setupCard: {
      backgroundColor: colors.bgCard,
      borderRadius: 16,
      padding: 24,
      borderWidth: colors.neonGlow ? 1 : 0,
      borderColor: colors.border,
    },
    setupLabel: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 8,
    },
    setupHint: {
      color: colors.textSecondary,
      fontSize: 13,
      marginBottom: 16,
      lineHeight: 18,
    },
    input: {
      backgroundColor: colors.bgInput,
      borderRadius: 10,
      padding: 14,
      color: colors.textPrimary,
      fontSize: 16,
      marginBottom: 16,
      borderWidth: colors.neonGlow ? 1 : 0,
      borderColor: colors.border,
    },
    saveButton: {
      backgroundColor: colors.accent,
      borderRadius: 10,
      padding: 14,
      alignItems: 'center',
    },
    saveButtonText: {
      color: colors.buttonText,
      fontSize: 16,
      fontWeight: '700',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 12,
    },
    headerButtons: {
      flexDirection: 'row',
      gap: 16,
    },
    headerButtonText: {
      color: colors.textMuted,
      fontSize: 13,
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
    },
    errorText: {
      color: colors.danger,
      fontSize: 13,
      textAlign: 'center',
      marginTop: 12,
    },
    retryButton: {
      backgroundColor: colors.accent,
      borderRadius: 20,
      paddingVertical: 10,
      paddingHorizontal: 24,
      alignSelf: 'center',
      marginTop: 12,
    },
    retryButtonText: {
      color: colors.buttonText,
      fontSize: 14,
      fontWeight: '600',
    },
    footer: {
      paddingBottom: 32,
      alignItems: 'center',
    },
  });
