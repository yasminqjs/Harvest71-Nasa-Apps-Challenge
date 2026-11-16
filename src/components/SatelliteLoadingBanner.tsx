import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useLanguage } from '../i18n/Language';
import { Pressable, Text } from '../i18n/native';
import { useCropQuality } from '../context/CropQualityContext';
import { MainTabKey } from './BottomTabBar';

interface SatelliteLoadingBannerProps {
  onNavigateTab: (tab: MainTabKey) => void;
}

/**
 * Global banner (above tabs) showing background satellite download progress
 * while the farmer navigates across the app.
 */
export const SatelliteLoadingBanner: React.FC<SatelliteLoadingBannerProps> = ({
  onNavigateTab,
}) => {
  const { language } = useLanguage();
  const en = language === 'en';
  const {
    isAnalyzing: isAnalyzingCropQuality,
    loadingProgressPct: satelliteLoadingProgressPct,
    loadingStage: satelliteLoadingStage,
    elapsedSec: satelliteElapsedSec,
    lastCompletedAt: satelliteLastCompletedAt,
    dismissCompleted: dismissSatelliteCompleted,
    requestOpenQualityView,
  } = useCropQuality();

  if (!isAnalyzingCropQuality && !satelliteLastCompletedAt) {
    return null;
  }

  if (!isAnalyzingCropQuality && satelliteLastCompletedAt) {
    return (
      <View style={styles.bannerOuter}>
        <View style={styles.doneBanner}>
          <View style={styles.topRow}>
            <Text style={styles.doneTitle}>
              {en ? '✅ Real satellite data ready!' : '✅ Dados reais de satélite prontos!'}
            </Text>
            <Pressable onPress={dismissSatelliteCompleted} hitSlop={8}>
              <Text style={styles.dismissText}>{en ? 'Close ✕' : 'Fechar ✕'}</Text>
            </Pressable>
          </View>
          <Text style={styles.doneSub}>
            {en
              ? 'NASA POWER + Sentinel-2 L2A + Landsat TIRS updated for your farm.'
              : 'NASA POWER + Sentinel-2 L2A + Landsat TIRS atualizados para a sua roça.'}
          </Text>
          <View style={styles.actionRow}>
            <Pressable
              onPress={() => {
                requestOpenQualityView();
                onNavigateTab('plantacao');
                dismissSatelliteCompleted();
              }}
              style={styles.doneBtn}
            >
              <Text style={styles.doneBtnText}>
                {en ? '🗺️ View Crop Quality & Markers' : '🗺️ Ver Qualidade da Plantação & Marcadores'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.bannerOuter}>
      <View style={styles.loadingBanner}>
        <View style={styles.topRow}>
          <View style={styles.spinnerRow}>
            <ActivityIndicator size="small" color="#FACC15" />
            <Text style={styles.loadingTitle}>
              {en
                ? '🛰️ Fetching Live NASA & Copernicus Data...'
                : '🛰️ Baixando Dados Reais NASA & Copernicus...'}
            </Text>
          </View>
          <Text style={styles.pctBadge}>
            {Math.round(satelliteLoadingProgressPct)}% • {satelliteElapsedSec}s
          </Text>
        </View>

        <Text style={styles.stageText}>{satelliteLoadingStage}</Text>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.max(8, Math.min(100, satelliteLoadingProgressPct))}%` },
            ]}
          />
        </View>

        <Text style={styles.persistNotice}>
          {en
            ? '🔄 Loading in background: you can switch tabs (Overview, Crops, Community) while satellite data finishes downloading!'
            : '🔄 Carregando em 2º plano: pode mudar de aba (Resumo, Plantação, Comunidade) que o satélite continua baixando os dados!'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bannerOuter: {
    width: '100%',
    maxWidth: 1184,
    alignSelf: 'center',
    paddingHorizontal: 12,
    marginTop: 8,
  },
  loadingBanner: {
    width: '100%',
    maxWidth: 1160,
    alignSelf: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  doneBanner: {
    width: '100%',
    maxWidth: 1160,
    alignSelf: 'center',
    backgroundColor: '#14532D',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#22C55E',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  spinnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  loadingTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    flex: 1,
  },
  pctBadge: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '900',
  },
  stageText: {
    color: '#E0F2FE',
    fontSize: 12,
    fontWeight: '700',
  },
  progressTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: '#1E293B',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#38BDF8',
  },
  persistNotice: {
    color: '#FDE68A',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 15,
  },
  doneTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  dismissText: {
    color: '#BBF7D0',
    fontSize: 12,
    fontWeight: '800',
  },
  doneSub: {
    color: '#DCFCE7',
    fontSize: 11,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  doneBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  doneBtnText: {
    color: '#14532D',
    fontSize: 11,
    fontWeight: '900',
  },
});
