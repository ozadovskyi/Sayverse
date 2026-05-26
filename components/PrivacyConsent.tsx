import React from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { testIDs } from '../constants/testIDs';
import EdgeTrail from './EdgeTrail';

interface Props {
  onAgree: () => void;
  onDecline: () => void;
}

const OPENAI_PRIVACY_URL = 'https://openai.com/policies/privacy-policy';
const SAYVERSE_PRIVACY_URL = 'https://sayverse.app/privacy/';

/**
 * Third-party-AI consent gate. Shown once after the API key is saved and
 * before the main translator screen is ever rendered. Required by Apple
 * App Store Guideline 5.1.2(i) (Nov 2025 generative-AI disclosure) and is
 * the GDPR Article 6(1)(a) lawful basis on which Sayverse operates the
 * device→OpenAI flow. Resettable via Settings → Reset consent.
 */
export default function PrivacyConsent({ onAgree, onDecline }: Props) {
  return (
    <View className="flex-1 bg-base">
      <EdgeTrail state="idle" />
      <StatusBar style="light" />
      <SafeAreaView className="flex-1">
        <ScrollView
          testID={testIDs.consent.screen}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: 24,
            paddingVertical: 32,
          }}
        >
          <Text className="mb-1 text-center font-mono text-xs uppercase tracking-[3px] text-neon">
            Before you start
          </Text>
          <Text className="mb-6 text-center text-2xl font-bold text-fg">
            How Sayverse uses OpenAI
          </Text>

          <View className="mb-4 rounded-2xl border border-neon/20 bg-surface p-5">
            <Text className="text-[15px] leading-6 text-fg">
              Sayverse uses OpenAI for transcription (Whisper) and translation
              (GPT-4o-mini).
            </Text>
            <Text className="mt-3 text-[15px] leading-6 text-fg">
              When you record voice or translate text, that data is sent
              directly from this device to OpenAI through your API key.
              Sayverse has no servers — nothing routes through us.
            </Text>
            <Text className="mt-3 text-[15px] leading-6 text-fg">
              OpenAI retains API data for up to 30 days for abuse monitoring,
              then deletes it. They do not train on your API data by default.
            </Text>
          </View>

          <View className="mb-6 flex-row flex-wrap items-center justify-center">
            <Pressable
              accessibilityRole="link"
              onPress={() => Linking.openURL(OPENAI_PRIVACY_URL)}
              hitSlop={8}
            >
              <Text className="font-mono text-[12px] uppercase tracking-[1px] text-neon underline">
                OpenAI Privacy Policy
              </Text>
            </Pressable>
            <Text className="mx-2 text-fg-muted">·</Text>
            <Pressable
              testID={testIDs.consent.policyLink}
              accessibilityRole="link"
              accessibilityLabel="Open Sayverse Privacy Policy"
              onPress={() => Linking.openURL(SAYVERSE_PRIVACY_URL)}
              hitSlop={8}
            >
              <Text className="font-mono text-[12px] uppercase tracking-[1px] text-neon underline">
                Sayverse Privacy Policy
              </Text>
            </Pressable>
          </View>

          <Text className="mb-6 text-center text-[13px] leading-5 text-fg-muted">
            You can revoke this consent any time in Settings → Reset consent.
            Without consent Sayverse cannot function.
          </Text>

          <Pressable
            testID={testIDs.consent.agreeButton}
            accessibilityRole="button"
            accessibilityLabel="Agree and continue"
            onPress={onAgree}
            className="mb-3 items-center rounded-xl border border-neon bg-neon/10 py-3.5"
          >
            <Text className="font-mono text-sm uppercase tracking-[2px] text-neon">
              Agree and continue
            </Text>
          </Pressable>

          <Pressable
            testID={testIDs.consent.declineButton}
            accessibilityRole="button"
            accessibilityLabel="Decline consent"
            onPress={onDecline}
            className="items-center rounded-xl border border-neon/20 py-3.5"
          >
            <Text className="font-mono text-sm uppercase tracking-[2px] text-fg-muted">
              Decline
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
