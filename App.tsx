import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, StyleSheet, View } from 'react-native';
import { Text } from './src/i18n/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AlertTopBanner } from './src/components/AlertTopBanner';
import { AppHeader } from './src/components/AppHeader';
import { AppTutorialModal } from './src/components/AppTutorialModal';
import { BottomTabBar, MainTabKey } from './src/components/BottomTabBar';
import { MobileViewport } from './src/components/MobileViewport';
import { LanguageMenu } from './src/components/LanguageMenu';
import { LanguageProvider } from './src/i18n/Language';
import {
  AccessibilityProvider,
  useAccessibility,
} from './src/context/AccessibilityContext';
import { CommunityScreen } from './src/screens/CommunityScreen';
import { DecisionScreen } from './src/screens/DecisionScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { NordesteOnboardingScreen } from './src/screens/NordesteOnboardingScreen';
import { SettingsModal, SettingsTabKey } from './src/screens/SettingsModal';
import { VoiceOnboardingScreen } from './src/screens/VoiceOnboardingScreen';
import { getAppTheme } from './src/theme/tokens';

const Harvest71Root: React.FC = () => {
  const {
    ready,
    accessibility,
    nordesteMapCompleted,
    tutorialVisible,
    openTutorial,
    closeTutorial,
    stopVoice,
  } = useAccessibility();
  const [activeTab, setActiveTab] = useState<MainTabKey>('resumo');
  const [openCurrentRotation, setOpenCurrentRotation] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTabKey>('perfil');

  useEffect(() => {
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        // Garante que modais transitórios não fiquem travando cliques após recriação da Activity no Android
        setSettingsOpen(false);
      }
    });
    return () => appSub.remove();
  }, []);

  useEffect(() => {
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (settingsOpen) {
        setSettingsOpen(false);
        return true;
      }
      if (tutorialVisible) {
        void closeTutorial(true);
        return true;
      }
      if (
        accessibility.voiceOnboardingCompleted &&
        nordesteMapCompleted &&
        activeTab !== 'resumo'
      ) {
        setOpenCurrentRotation(false);
        setActiveTab('resumo');
        return true;
      }
      return false;
    });
    return () => backSub.remove();
  }, [
    settingsOpen,
    tutorialVisible,
    closeTutorial,
    accessibility.voiceOnboardingCompleted,
    nordesteMapCompleted,
    activeTab,
  ]);

  const openSettingsAt = (tab: SettingsTabKey = 'perfil') => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  };

  const navigateTab = (tab: MainTabKey) => {
    if (tab === activeTab) return;
    stopVoice();
    setOpenCurrentRotation(false);
    setActiveTab(tab);
  };

  const theme = getAppTheme(accessibility);

  if (!ready) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={{ fontWeight: '800', color: theme.text, marginTop: 10 }}>
          Carregando dados offline da roça...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]} edges={['top', 'bottom']}>
      <StatusBar style={accessibility.highContrast ? 'light' : 'dark'} />
      {(!accessibility.voiceOnboardingCompleted || !nordesteMapCompleted) && (
        <View style={{ alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 4 }}>
          <LanguageMenu theme={theme} />
        </View>
      )}

      {!accessibility.voiceOnboardingCompleted ? (
        <VoiceOnboardingScreen />
      ) : !nordesteMapCompleted ? (
        <NordesteOnboardingScreen />
      ) : (
        <View style={styles.shell}>
          <AppHeader
            onOpenSettings={() => openSettingsAt('perfil')}
            onOpenTutorial={openTutorial}
          />
          <AlertTopBanner onOpenAllAlerts={() => openSettingsAt('alertas')} />
          <View style={styles.body}>
            {activeTab === 'resumo' && (
              <HomeScreen
                onNavigateTab={navigateTab}
                onOpenCurrentRotation={() => {
                  setOpenCurrentRotation(true);
                  setActiveTab('plantacao');
                }}
                onOpenFeedback={() => openSettingsAt('feedback')}
                onOpenTutorial={openTutorial}
              />
            )}
            {activeTab === 'plantacao' && <DecisionScreen openCurrentRotation={openCurrentRotation} />}
            {activeTab === 'comunidade' && <CommunityScreen />}
          </View>
          <BottomTabBar activeTab={activeTab} onChangeTab={navigateTab} />
          {settingsOpen && (
            <SettingsModal
              visible={settingsOpen}
              initialTab={settingsTab}
              onClose={() => setSettingsOpen(false)}
            />
          )}
          {tutorialVisible && (
            <AppTutorialModal
              visible={tutorialVisible}
              onClose={() => closeTutorial(true)}
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AccessibilityProvider>
          <MobileViewport>
            <Harvest71Root />
          </MobileViewport>
        </AccessibilityProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shell: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
});
