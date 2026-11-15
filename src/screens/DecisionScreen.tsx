import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { Pressable, Text } from '../i18n/native';
import { FeatureBadge } from '../components/FeatureBadge';
import { DssatAreaSimulation } from '../components/dssat/DssatAreaSimulation';
import { DssatRotationSearch } from '../components/dssat/DssatRotationSearch';
import { PlantationQualityPlaceholder } from '../components/placeholders/PlantationQualityPlaceholder';
import { FarmVariablesEditorSubscreen } from '../components/subscreens/FarmVariablesEditorSubscreen';
import { HistoricoPlantioSubscreen } from '../components/subscreens/HistoricoPlantioSubscreen';
import { RotacaoAtualSubscreen } from '../components/subscreens/RotacaoAtualSubscreen';
import { useAccessibility } from '../context/AccessibilityContext';
import { FEATURE_COLOR_STYLES } from '../models/farmArchitecture';
import { getAppTheme } from '../theme/tokens';
import { formatArea } from '../utils/regionalize';
import { MapScreen } from './MapScreen';

type PlantationBlock =
  | 'atualizar_hub'
  | 'atualizar_lotes'
  | 'atualizar_mapa'
  | 'atualizar_variaveis'
  | 'atualizar_historico'
  | 'talhao_dssat'
  | 'planejar_rotacao'
  | 'qualidade_atual'
  | null;

/**
 * Aba Plantação ("O que o usuário vê" -> aba plantação):
 * - VERDE:   Atualizar dados da plantação e da fazenda (Pegador de informações da fazenda)
 * - CINZA:   Planejar rotações futuras e comparar opções com o DSSAT
 * - ROXO:    Ver qualidade da plantação atual [PLACEHOLDER Visualizador de qualidade]
 */
export const DecisionScreen: React.FC<{ openCurrentRotation?: boolean }> = ({
  openCurrentRotation = false,
}) => {
  const { accessibility, activeFarmer, activeFarm, farmArchitecture } = useAccessibility();
  const theme = getAppTheme(accessibility);
  const [activeBlock, setActiveBlock] = useState<PlantationBlock>(
    openCurrentRotation ? 'atualizar_lotes' : null
  );
  const [plannerLotId, setPlannerLotId] = useState<string>();

  const goBack = useCallback(() => {
    if (
      activeBlock === 'atualizar_lotes' ||
      activeBlock === 'atualizar_mapa' ||
      activeBlock === 'atualizar_variaveis' ||
      activeBlock === 'atualizar_historico'
    ) {
      if (activeBlock === 'atualizar_lotes') setPlannerLotId(undefined);
      setActiveBlock('atualizar_hub');
    } else if (activeBlock === 'planejar_rotacao' && plannerLotId) {
      setActiveBlock('atualizar_lotes');
    } else {
      setActiveBlock(null);
    }
  }, [activeBlock, plannerLotId]);

  useEffect(() => {
    if (!activeBlock) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => sub.remove();
  }, [activeBlock, goBack]);

  if (!activeFarm || !activeFarmer || !farmArchitecture) return null;

  const verde = FEATURE_COLOR_STYLES.verde;
  const roxo = FEATURE_COLOR_STYLES.roxo;
  const plantacoes = farmArchitecture.plantacoes;
  const ha = activeFarm.areaHectares;
  const historyCount =
    (activeFarmer.historicoCultivoDetalhado?.length ?? 0) ||
    (activeFarmer.historicoCultivo?.length ?? 0);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.bg }}
        contentContainerStyle={styles.container}
      >
        {activeBlock === 'atualizar_lotes' ? (
          <RotacaoAtualSubscreen
            onBack={goBack}
            initialLotId={plannerLotId}
            onPlanRotation={(lotId) => {
              setPlannerLotId(lotId);
              setActiveBlock('planejar_rotacao');
            }}
            title="Lotes e Cultura Atual"
          />
        ) : activeBlock === 'atualizar_historico' ? (
          <HistoricoPlantioSubscreen
            onBack={() => setActiveBlock('atualizar_hub')}
            title="Histórico da Terra e Cultivo"
          />
        ) : activeBlock === 'atualizar_variaveis' ? (
          <FarmVariablesEditorSubscreen onBack={() => setActiveBlock('atualizar_hub')} />
        ) : activeBlock === 'atualizar_mapa' ? (
          <View style={{ gap: 10 }}>
            <View style={styles.topRow}>
              <Pressable
                onPress={() => setActiveBlock('atualizar_hub')}
                style={[
                  styles.backBtn,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <Ionicons name="arrow-back" size={18} color={theme.text} />
                <Text style={[styles.backText, { color: theme.text }]}>Voltar</Text>
              </Pressable>
              <Text style={[styles.screenTitle, { color: theme.text, fontSize: 17 * theme.scale }]}>
                Demarcar Terreno e Lotes
              </Text>
              <View style={{ width: 64 }} />
            </View>
            <MapScreen />
          </View>
        ) : activeBlock === 'atualizar_hub' ? (
          <View style={{ gap: 12 }}>
            <View style={styles.topRow}>
              <Pressable
                onPress={() => setActiveBlock(null)}
                style={[
                  styles.backBtn,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <Ionicons name="arrow-back" size={18} color={theme.text} />
                <Text style={[styles.backText, { color: theme.text }]}>Plantação</Text>
              </Pressable>
              <Text style={[styles.screenTitle, { color: theme.text, fontSize: 17 * theme.scale }]}>
                Atualizar Dados
              </Text>
              <View style={{ width: 64 }} />
            </View>

            <View
              style={[
                styles.hubBanner,
                { backgroundColor: theme.surface, borderColor: verde.border },
              ]}
            >
              <FeatureBadge color="verde" />
              <Text style={{ fontSize: 12, color: theme.textMuted }}>
                Atualize as informações coletadas no cadastro: terreno demarcado, lotes/cultura
                atual, variáveis da fazenda e histórico da terra.
              </Text>
            </View>

            <Pressable
              onPress={() => setActiveBlock('atualizar_lotes')}
              style={[
                styles.choiceBlock,
                { backgroundColor: theme.surface, borderColor: verde.border },
              ]}
            >
              <View style={[styles.choiceIcon, { backgroundColor: verde.bg }]}>
                <Ionicons name="leaf-outline" size={26} color={verde.text} />
              </View>
              <View style={styles.choiceBody}>
                <Text style={[styles.choiceTitle, { color: theme.text }]}>
                  Cultura atual e rotações planejadas
                </Text>
                <Text style={{ fontSize: 12, color: theme.textMuted }}>
                  {plantacoes.length} plantação{plantacoes.length === 1 ? '' : 'ões'} •
                  Especificações NASA/FAO GAEZ EcoCrop
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={verde.text} />
            </Pressable>

            <Pressable
              onPress={() => setActiveBlock('atualizar_mapa')}
              style={[
                styles.choiceBlock,
                { backgroundColor: theme.surface, borderColor: verde.border },
              ]}
            >
              <View style={[styles.choiceIcon, { backgroundColor: verde.bg }]}>
                <Ionicons name="map-outline" size={26} color={verde.text} />
              </View>
              <View style={styles.choiceBody}>
                <Text style={[styles.choiceTitle, { color: theme.text }]}>
                  Demarcar terreno da fazenda no mapa
                </Text>
                <Text style={{ fontSize: 12, color: theme.textMuted }}>
                  Área atual: {formatArea(ha, activeFarm.areaTarefasBa)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={verde.text} />
            </Pressable>

            <Pressable
              onPress={() => setActiveBlock('atualizar_variaveis')}
              style={[
                styles.choiceBlock,
                { backgroundColor: theme.surface, borderColor: verde.border },
              ]}
            >
              <View style={[styles.choiceIcon, { backgroundColor: verde.bg }]}>
                <Ionicons name="options-outline" size={26} color={verde.text} />
              </View>
              <View style={styles.choiceBody}>
                <Text style={[styles.choiceTitle, { color: theme.text }]}>
                  Variáveis da fazenda (usuário)
                </Text>
                <Text style={{ fontSize: 12, color: theme.textMuted }}>
                  Água ({activeFarmer.waterAccess}), trabalho ({activeFarmer.laborType}), objetivo (
                  {activeFarmer.objective})
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={verde.text} />
            </Pressable>

            <Pressable
              onPress={() => setActiveBlock('atualizar_historico')}
              style={[
                styles.choiceBlock,
                { backgroundColor: theme.surface, borderColor: verde.border },
              ]}
            >
              <View style={[styles.choiceIcon, { backgroundColor: verde.bg }]}>
                <Ionicons name="calendar-outline" size={26} color={verde.text} />
              </View>
              <View style={styles.choiceBody}>
                <Text style={[styles.choiceTitle, { color: theme.text }]}>
                  Histórico da terra e safras anteriores
                </Text>
                <Text style={{ fontSize: 12, color: theme.textMuted }}>
                  {historyCount} registro{historyCount === 1 ? '' : 's'} • NASA POWER + SRTM +
                  Landsat TIRS 30 m
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={verde.text} />
            </Pressable>
          </View>
        ) : activeBlock === 'talhao_dssat' ? (
          <DssatAreaSimulation onBack={() => setActiveBlock(null)} />
        ) : activeBlock === 'planejar_rotacao' ? (
          <DssatRotationSearch initialLotId={plannerLotId} onBack={goBack} />
        ) : activeBlock === 'qualidade_atual' ? (
          <PlantationQualityPlaceholder
            farmArchitecture={farmArchitecture}
            selectedPlantation={plantacoes[0]}
            onBack={() => setActiveBlock(null)}
            theme={theme}
          />
        ) : (
          /* HUB DA ABA PLANTAÇÃO (exactamente as 4 features coloridas do diagrama) */
          <View style={{ gap: 12 }}>
            <View
              style={[
                styles.hubBanner,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.hubTitle, { color: theme.text, fontSize: 19 * theme.scale }]}>
                Plantação e Modelagem da Fazenda
              </Text>
              <Text style={{ fontSize: 12, color: theme.textMuted }}>
                {activeFarm.nome} • {formatArea(ha, activeFarm.areaTarefasBa)} •{' '}
                {plantacoes.length} plantação{plantacoes.length === 1 ? '' : 'ões'}
              </Text>
              <View style={[styles.dataModelStrip, { backgroundColor: theme.bg }]}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: theme.text }}>
                  Camadas de dados ativas nesta fazenda:
                </Text>
                <Text style={{ fontSize: 11, color: theme.textMuted }}>
                  • Histórico da terra: NASA POWER + SRTM + Landsat C2 L2 TIRS (30 m)
                </Text>
                <Text style={{ fontSize: 11, color: theme.textMuted }}>
                  • Cultura atual: seleção do usuário + NASA/FAO GAEZ EcoCrop
                </Text>
                <Text style={{ fontSize: 11, color: theme.textMuted }}>
                  • Culturas futuras: registro do agricultor ou planejamento de rotações
                </Text>
              </View>
            </View>

            {/* 1. VERDE: Atualizar dados da plantação e da fazenda */}
            <Pressable
              onPress={() => setActiveBlock('atualizar_hub')}
              style={[
                styles.choiceBlock,
                { backgroundColor: theme.surface, borderColor: verde.border },
              ]}
            >
              <View style={[styles.choiceIcon, { backgroundColor: verde.bg }]}>
                <Ionicons name="create-outline" size={26} color={verde.text} />
              </View>
              <View style={styles.choiceBody}>
                <FeatureBadge color="verde" customText="VERDE • Implementado" />
                <Text style={[styles.choiceTitle, { color: theme.text }]}>
                  Atualizar dados da plantação e da fazenda
                </Text>
                <Text style={{ fontSize: 12, color: theme.textMuted }}>
                  Editar terreno, lotes, cultura atual, variáveis da fazenda e histórico
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={verde.text} />
            </Pressable>

            {([
              ['planejar_rotacao', 'calendar-outline', 'Planejar rotação', 'Monte, compare e salve opções para os próximos plantios.'],
              ['talhao_dssat', 'earth-outline', 'Meu Talhão no DSSAT', 'Simule uma cultura com o solo e o clima da área cadastrada.'],
            ] as const).map(([block, icon, title, description]) => (
              <Pressable key={block} accessibilityRole="button" onPress={() => setActiveBlock(block)}
                style={[styles.choiceBlock, { backgroundColor: theme.surface, borderColor: theme.accent }]}>
                <View style={[styles.choiceIcon, { backgroundColor: theme.surface }]}>
                  <Ionicons name={icon} size={26} color={theme.accent} />
                </View>
                <View style={styles.choiceBody}>
                  <Text style={[styles.choiceTitle, { color: theme.text }]}>{title}</Text>
                  <Text style={{ fontSize: 12, color: theme.textMuted }}>{description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color={theme.accent} />
              </Pressable>
            ))}

            {/* 4. ROXO [PLACEHOLDER]: Ver qualidade da plantação atual */}
            <Pressable
              onPress={() => setActiveBlock('qualidade_atual')}
              style={[
                styles.choiceBlock,
                styles.placeholderBlock,
                { backgroundColor: roxo.bg, borderColor: roxo.border },
              ]}
            >
              <View style={[styles.choiceIcon, { backgroundColor: theme.surface }]}>
                <Ionicons name="pulse-outline" size={26} color={roxo.text} />
              </View>
              <View style={styles.choiceBody}>
                <FeatureBadge color="roxo" customText="ROXO • Placeholder Qualidade" />
                <Text style={[styles.choiceTitle, { color: roxo.text }]}>
                  Ver qualidade da plantação atual
                </Text>
                <Text style={{ fontSize: 12, color: roxo.text }}>
                  Visualizador de qualidade da plantação aguardando merge futuro
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={roxo.text} />
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 14,
    gap: 12,
    paddingBottom: 26,
  },
  hubBanner: {
    borderRadius: 18,
    borderWidth: 2,
    padding: 14,
    gap: 6,
  },
  hubTitle: {
    fontWeight: '900',
  },
  dataModelStrip: {
    borderRadius: 12,
    padding: 10,
    gap: 3,
    marginTop: 2,
  },
  choiceBlock: {
    borderRadius: 20,
    borderWidth: 2,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 94,
  },
  placeholderBlock: {
    borderStyle: 'dashed',
  },
  choiceIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceBody: {
    flex: 1,
    gap: 4,
  },
  choiceTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  backText: {
    fontSize: 13,
    fontWeight: '800',
  },
  screenTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '900',
  },
});
