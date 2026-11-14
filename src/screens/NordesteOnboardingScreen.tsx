import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NordesteSvgMap } from '../components/NordesteSvgMap';
import { useAccessibility } from '../context/AccessibilityContext';
import { BahiaRegionPreset } from '../data/seedData';
import { getAppTheme } from '../theme/tokens';
import { FarmObjective, FinancialTier, LaborType, WaterAccess } from '../types/domain';

export const NordesteOnboardingScreen: React.FC = () => {
  const {
    accessibility,
    activeFarmer,
    activeFarm,
    selectBahiaRegion,
    saveFarmerProfile,
    setNordesteMapCompleted,
    toggleVoiceGuidance,
    speak,
  } = useAccessibility();
  const theme = getAppTheme(accessibility);

  const [tratamento, setTratamento] = useState(activeFarmer?.tratamento ?? 'Dona Maria');
  const [waterAccess, setWaterAccess] = useState<WaterAccess>(
    activeFarmer?.waterAccess ?? 'sequeiro'
  );
  const [laborType, setLaborType] = useState<LaborType>(
    activeFarmer?.laborType ?? 'familiar'
  );
  const [financialTier, setFinancialTier] = useState<FinancialTier>(
    activeFarmer?.financialTier ?? 'pronaf'
  );
  const [objective, setObjective] = useState<FarmObjective>(
    activeFarmer?.objective ?? 'subsistencia'
  );

  const handleSelectRegion = async (reg: BahiaRegionPreset) => {
    await selectBahiaRegion(reg.id);
    speak(`Região selecionada: ${reg.nome}, ${reg.municipio}, na Bahia.`);
  };

  const handleContinue = async () => {
    if (activeFarmer) {
      await saveFarmerProfile({
        ...activeFarmer,
        tratamento: tratamento.trim() || activeFarmer.tratamento,
        waterAccess,
        laborType,
        financialTier,
        objective,
      });
    }
    setNordesteMapCompleted(true);
    speak(
      `Tudo pronto. Abrindo a tela inicial da sua roça em ${activeFarm?.regiaoNome ?? 'Bahia'}.`
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={styles.container}
    >
      {/* Topo idêntico ao wireframe esquerdo: nome_app + botão de voz persistente */}
      <View style={styles.topBar}>
        <View style={{ width: 42 }} />
        <Text style={[styles.appName, { color: theme.text, fontSize: 26 * theme.scale }]}>
          RoçaViva
        </Text>
        <Pressable
          onPress={toggleVoiceGuidance}
          style={[
            styles.soundPill,
            {
              backgroundColor: accessibility.voiceGuidanceEnabled
                ? theme.primary
                : theme.surface,
              borderColor: theme.border,
            },
          ]}
        >
          <Ionicons
            name={accessibility.voiceGuidanceEnabled ? 'volume-high' : 'volume-mute'}
            size={20}
            color={accessibility.voiceGuidanceEnabled ? theme.primaryText : theme.text}
          />
        </Pressable>
      </View>

      <Text style={[styles.lead, { color: theme.textMuted, fontSize: 14 * theme.scale }]}>
        Toque na sua região da Bahia / Nordeste para iniciar offline:
      </Text>

      <View
        style={[
          styles.mapCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <NordesteSvgMap
          selectedRegionName={activeFarm?.regiaoNome ?? 'Recôncavo Baiano'}
          onSelectRegion={handleSelectRegion}
          theme={theme}
        />
        <Text style={[styles.selectedHint, { color: theme.primary }]}>
          📍 {activeFarm?.regiaoNome} ({activeFarm?.municipio} - {activeFarm?.estado}) • Bioma{' '}
          {activeFarm?.bioma}
        </Text>
      </View>

      {/* Onboarding sociodemográfico e produtivo respeitoso */}
      <View
        style={[
          styles.profileCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: theme.text, fontSize: 16 * theme.scale }]}>
          Como prefere ser chamado(a)? (opcional)
        </Text>
        <TextInput
          value={tratamento}
          onChangeText={setTratamento}
          placeholder="Ex.: Dona Maria, Seu João..."
          placeholderTextColor={theme.textMuted}
          style={[
            styles.input,
            {
              backgroundColor: theme.bg,
              borderColor: theme.border,
              color: theme.text,
              fontSize: 16 * theme.scale,
            },
          ]}
        />

        <Text style={[styles.subLabel, { color: theme.textMuted }]}>Acesso à água:</Text>
        <View style={styles.optionRow}>
          {[
            { id: 'sequeiro' as WaterAccess, label: '🌧️ Sequeiro (chuva)' },
            { id: 'poco_artesiano' as WaterAccess, label: '🕳️ Poço' },
            { id: 'acude' as WaterAccess, label: '💧 Açude / Cisterna' },
            { id: 'irrigacao' as WaterAccess, label: '🚿 Irrigação' },
          ].map((opt) => (
            <Pressable
              key={opt.id}
              onPress={() => setWaterAccess(opt.id)}
              style={[
                styles.optChip,
                {
                  backgroundColor:
                    waterAccess === opt.id ? theme.primary : theme.surfaceMuted,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: waterAccess === opt.id ? theme.primaryText : theme.text,
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.subLabel, { color: theme.textMuted }]}>Força de trabalho:</Text>
        <View style={styles.optionRow}>
          {[
            { id: 'familiar' as LaborType, label: '👨‍👩‍👧 Braçal / Familiar' },
            { id: 'tracao_animal' as LaborType, label: '🐂 Tração animal' },
            { id: 'maquinario' as LaborType, label: '🚜 Maquinário' },
          ].map((opt) => (
            <Pressable
              key={opt.id}
              onPress={() => setLaborType(opt.id)}
              style={[
                styles.optChip,
                {
                  backgroundColor:
                    laborType === opt.id ? theme.primary : theme.surfaceMuted,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: laborType === opt.id ? theme.primaryText : theme.text,
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.subLabel, { color: theme.textMuted }]}>
          Recurso financeiro & objetivo:
        </Text>
        <View style={styles.optionRow}>
          {[
            { id: 'recursos_proprios' as FinancialTier, label: '🪙 Próprio / Zero' },
            { id: 'pronaf' as FinancialTier, label: '🏦 Pronaf' },
            { id: 'emprestimo_local' as FinancialTier, label: '🤝 Crédito local' },
          ].map((opt) => (
            <Pressable
              key={opt.id}
              onPress={() => setFinancialTier(opt.id)}
              style={[
                styles.optChip,
                {
                  backgroundColor:
                    financialTier === opt.id ? theme.primary : theme.surfaceMuted,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: financialTier === opt.id ? theme.primaryText : theme.text,
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.optionRow}>
          {[
            { id: 'subsistencia' as FarmObjective, label: '🍲 Comida da família' },
            { id: 'misto' as FarmObjective, label: '🌾 Família + Venda' },
            { id: 'comercial' as FarmObjective, label: '🛒 Comercial' },
          ].map((opt) => (
            <Pressable
              key={opt.id}
              onPress={() => setObjective(opt.id)}
              style={[
                styles.optChip,
                {
                  backgroundColor:
                    objective === opt.id ? theme.primary : theme.surfaceMuted,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: objective === opt.id ? theme.primaryText : theme.text,
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable
        onPress={handleContinue}
        style={[
          styles.ctaBtn,
          { backgroundColor: theme.primary, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.ctaText, { color: theme.primaryText, fontSize: 18 * theme.scale }]}>
          Entrar na minha roça →
        </Text>
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 14,
    paddingBottom: 28,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  appName: {
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  soundPill: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lead: {
    textAlign: 'center',
    fontWeight: '600',
  },
  mapCard: {
    borderRadius: 24,
    borderWidth: 2,
    padding: 12,
    alignItems: 'center',
    gap: 8,
  },
  selectedHint: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  profileCard: {
    borderRadius: 22,
    borderWidth: 2,
    padding: 14,
    gap: 8,
  },
  sectionTitle: {
    fontWeight: '800',
  },
  input: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontWeight: '700',
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optChip: {
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  ctaBtn: {
    minHeight: 58,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontWeight: '900',
  },
});
