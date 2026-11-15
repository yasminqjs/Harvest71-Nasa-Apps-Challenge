import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AlertTopBanner } from './src/components/AlertTopBanner';
import { AppHeader } from './src/components/AppHeader';
import { AppTutorialModal } from './src/components/AppTutorialModal';
import { BottomTabBar, MainTabKey } from './src/components/BottomTabBar';
import { MobileViewport } from './src/components/MobileViewport';
import {
  AccessibilityProvider,
  useAccessibility,
} from './src/context/AccessibilityContext';
import { DecisionScreen } from './src/screens/DecisionScreen';
import { FoodSecurityScreen } from './src/screens/FoodSecurityScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { MapScreen } from './src/screens/MapScreen';
import { NordesteOnboardingScreen } from './src/screens/NordesteOnboardingScreen';
import { SettingsModal, SettingsTabKey } from './src/screens/SettingsModal';
import { VoiceOnboardingScreen } from './src/screens/VoiceOnboardingScreen';
import { getAppTheme } from './src/theme/tokens';

const RoçaVivaRoot: React.FC = () => {
  const {
    ready,
    accessibility,
    nordesteMapCompleted,
    tutorialVisible,
    openTutorial,
    closeTutorial,
  } = useAccessibility();
  const [activeTab, setActiveTab] = useState<MainTabKey>('inicio');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTabKey>('perfil');

  const openSettingsAt = (tab: SettingsTabKey = 'perfil') => {
    setSettingsTab(tab);
    setSettingsOpen(true);
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
            {activeTab === 'inicio' && (
              <HomeScreen
                onNavigateTab={setActiveTab}
                onOpenFeedback={() => openSettingsAt('feedback')}
                onOpenTutorial={openTutorial}
              />
            )}
            {activeTab === 'mapa' && <MapScreen />}
            {activeTab === 'safra' && <DecisionScreen />}
            {activeTab === 'pancs' && <FoodSecurityScreen />}
          </View>
          <BottomTabBar activeTab={activeTab} onChangeTab={setActiveTab} />
          <SettingsModal
            visible={settingsOpen}
            initialTab={settingsTab}
            onClose={() => setSettingsOpen(false)}
          />
          <AppTutorialModal
            visible={tutorialVisible}
            onClose={() => closeTutorial(true)}
          />
        </View>
      )}
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AccessibilityProvider>
        <MobileViewport>
          <RoçaVivaRoot />
        </MobileViewport>
      </AccessibilityProvider>
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
