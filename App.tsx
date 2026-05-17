import './global.css';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { DEFAULT_SOURCE, DEFAULT_TARGET, Language } from './constants/languages';
import { testIDs } from './constants/testIDs';
import { colors } from './constants/theme';
import { initOpenAI, transcribeAudio, translateText } from './services/openai';
import { classifyError, userMessage } from './services/errors';
import { requestPermissions, startRecording, stopRecording } from './services/audio';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import EdgeTrail, { type TrailState } from './components/EdgeTrail';
import LanguagePicker from './components/LanguagePicker';
import OfflineBanner from './components/OfflineBanner';
import RecordButton from './components/RecordButton';
import SettingsScreen from './components/SettingsScreen';
import TranslationCard from './components/TranslationCard';

const API_KEY_STORAGE = 'openai_api_key';

/** App title with the second half in neon — the Tron wordmark. */
function Wordmark({ size }: { size: 'lg' | 'sm' }) {
  const cls = size === 'lg' ? 'text-3xl' : 'text-xl';
  return (
    <Text className={`${cls} font-bold tracking-tight text-fg`}>
      Open<Text className="text-neon">Translator</Text>
    </Text>
  );
}

function AppContent() {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [source, setSource] = useState<Language>(DEFAULT_SOURCE);
  const [target, setTarget] = useState<Language>(DEFAULT_TARGET);

  const [textInput, setTextInput] = useState('');
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [originalText, setOriginalText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [error, setError] = useState('');
  const [lastTranscription, setLastTranscription] = useState<{
    text: string;
    source: string;
    target: string;
  } | null>(null);

  const { isOffline } = useNetworkStatus();

  useEffect(() => {
    (async () => {
      const saved = await SecureStore.getItemAsync(API_KEY_STORAGE);
      if (saved) {
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
    initOpenAI(key);
    setIsReady(true);
  }, [apiKeyInput]);

  const handleLogout = useCallback(async () => {
    await SecureStore.deleteItemAsync(API_KEY_STORAGE);
    setIsReady(false);
    setShowSettings(false);
    setApiKeyInput('');
    setTextInput('');
    setOriginalText('');
    setTranslatedText('');
    setError('');
  }, []);

  const handleSwapLanguages = useCallback(() => {
    setSource(target);
    setTarget(source);
  }, [source, target]);

  const runTranslation = useCallback(
    async (text: string, src: Language, tgt: Language) => {
      setError('');
      setProcessing(true);
      setOriginalText(text);
      setTranslatedText('');
      setLastTranscription({ text, source: src.name, target: tgt.name });
      try {
        const translation = await translateText(text, src.name, tgt.name);
        setTranslatedText(translation);
      } catch (e: unknown) {
        setError(userMessage(classifyError(e)));
      } finally {
        setProcessing(false);
      }
    },
    [],
  );

  const handleTranslateText = useCallback(() => {
    const trimmed = textInput.trim();
    if (!trimmed || processing || recording) return;
    if (isOffline) {
      Alert.alert('No connection', 'Internet is required for translation.');
      return;
    }
    void runTranslation(trimmed, source, target);
  }, [textInput, processing, recording, isOffline, runTranslation, source, target]);

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
        setError(userMessage(classifyError(e)));
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

  const handleRetryTranslation = useCallback(() => {
    if (!lastTranscription || processing) return;
    setError('');
    setProcessing(true);
    translateText(lastTranscription.text, lastTranscription.source, lastTranscription.target)
      .then(setTranslatedText)
      .catch((e: unknown) => setError(userMessage(classifyError(e))))
      .finally(() => setProcessing(false));
  }, [lastTranscription, processing]);

  const trailState: TrailState = recording
    ? 'recording'
    : processing
      ? 'processing'
      : 'idle';

  // ── API key setup screen ──
  if (!isReady) {
    return (
      <View className="flex-1 bg-base">
        <EdgeTrail state="idle" />
        <StatusBar style="light" />
        <SafeAreaView className="flex-1">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 justify-center px-6"
          >
            <View testID={testIDs.setup.screen}>
              <View className="mb-1 items-center">
                <Wordmark size="lg" />
              </View>
              <Text className="mb-8 text-center text-sm text-fg-muted">
                Voice & text translator powered by OpenAI
              </Text>

              <View className="rounded-2xl border border-neon/20 bg-surface p-6">
                <Text className="mb-2 font-mono text-xs uppercase tracking-[2px] text-neon">
                  OpenAI API key
                </Text>
                <Text className="mb-4 text-[13px] leading-5 text-fg-muted">
                  Get one at platform.openai.com. Your key is stored securely on
                  this device only.
                </Text>
                <TextInput
                  testID={testIDs.setup.apiKeyInput}
                  accessibilityLabel="OpenAI API key"
                  className="mb-4 rounded-xl border border-neon/20 bg-surface-input p-3.5 text-base text-fg"
                  placeholder="sk-..."
                  placeholderTextColor={colors.fgFaint}
                  value={apiKeyInput}
                  onChangeText={setApiKeyInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />
                <Pressable
                  testID={testIDs.setup.saveButton}
                  accessibilityRole="button"
                  accessibilityLabel="Save key and start"
                  onPress={handleSaveKey}
                  className="items-center rounded-xl border border-neon bg-neon/10 py-3.5"
                >
                  <Text className="font-mono text-sm uppercase tracking-[2px] text-neon">
                    Save & Start
                  </Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    );
  }

  // ── Main translator screen ──
  const showEmptyHint = !originalText && !translatedText && !error;
  const canTranslateText = textInput.trim().length > 0 && !processing && !recording;

  return (
    <View className="flex-1 bg-base">
      <EdgeTrail state={trailState} />
      <StatusBar style="light" />
      <SafeAreaView className="flex-1">
        <OfflineBanner isOffline={isOffline} />

        <View className="flex-row items-center justify-between px-5 pt-3">
          <Wordmark size="sm" />
          <Pressable
            testID={testIDs.header.settingsButton}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            onPress={() => setShowSettings(true)}
            className="rounded-lg border border-neon/25 px-3 py-1.5"
          >
            <Text className="font-mono text-[11px] uppercase tracking-[2px] text-fg-muted">
              Settings
            </Text>
          </Pressable>
        </View>

        <LanguagePicker
          source={source}
          target={target}
          onChangeSource={setSource}
          onChangeTarget={setTarget}
          onSwap={handleSwapLanguages}
        />

        <View className="flex-1 px-5">
          <TranslationCard
            originalText={originalText}
            translatedText={translatedText}
            sourceLabel={source.name}
            targetLabel={target.name}
          />

          {showEmptyHint ? (
            <View className="flex-1 items-center justify-center">
              <Text className="text-center font-mono text-xs uppercase tracking-[2px] text-fg-faint">
                Speak or type to translate
              </Text>
            </View>
          ) : null}

          {error ? (
            <Text
              testID={testIDs.translation.errorText}
              className="mt-3 text-center text-[13px] text-danger"
            >
              {error}
            </Text>
          ) : null}
          {error && originalText && !translatedText ? (
            <Pressable
              testID={testIDs.translation.retryButton}
              accessibilityRole="button"
              accessibilityLabel="Retry translation"
              onPress={handleRetryTranslation}
              disabled={processing}
              className="mt-3 self-center rounded-full border border-neon/40 px-6 py-2"
            >
              <Text className="font-mono text-xs uppercase tracking-[2px] text-neon">
                Retry
              </Text>
            </Pressable>
          ) : null}
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="px-5 pb-2"
        >
          <View className="mb-4 flex-row items-center gap-2">
            <TextInput
              testID={testIDs.textInput.field}
              accessibilityLabel="Text to translate"
              className="flex-1 rounded-xl border border-neon/20 bg-surface-input px-3.5 py-3 text-base text-fg"
              placeholder="Type to translate…"
              placeholderTextColor={colors.fgFaint}
              value={textInput}
              onChangeText={setTextInput}
              onSubmitEditing={handleTranslateText}
              returnKeyType="send"
              editable={!recording}
            />
            <Pressable
              testID={testIDs.textInput.translateButton}
              accessibilityRole="button"
              accessibilityLabel="Translate text"
              accessibilityState={{ disabled: !canTranslateText }}
              onPress={handleTranslateText}
              disabled={!canTranslateText}
              className={`rounded-xl border px-4 py-3 ${
                canTranslateText ? 'border-neon bg-neon/10' : 'border-neon/15'
              }`}
            >
              <Text
                className={`font-mono text-xs uppercase tracking-[2px] ${
                  canTranslateText ? 'text-neon' : 'text-fg-faint'
                }`}
              >
                Go
              </Text>
            </Pressable>
          </View>

          <View className="items-center">
            <RecordButton
              isRecording={recording}
              isProcessing={processing}
              onPress={handleRecordPress}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <SettingsScreen
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        onLogout={handleLogout}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}
