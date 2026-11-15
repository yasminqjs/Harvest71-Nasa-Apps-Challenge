import {
  DEFAULT_IRECE_FARM_CENTROID,
  DEFAULT_IRECE_FARM_POLYGON,
  SEED_ALERTS,
  SEED_FARMERS,
  SEED_PANCS,
  SEED_WELLS,
  buildInitialSeedFarms,
} from '../data/seedData';
import { runLocalAgronomicEngine } from '../services/localAgronomicEngine';
import { createDefaultLotsForFarm } from '../utils/agronomyHelpers';
import {
  AccessibilityProfile,
  AppFeedbackItem,
  AppLanguage,
  EdiblePlantPANC,
  FarmProperty,
  FarmerProfile,
  FieldValidationLog,
  ProactiveAlertItem,
  SyncQueueItem,
  WellPoint,
} from '../types/domain';

export interface LocalDatabaseSnapshot {
  accessibility: AccessibilityProfile;
  activeFarmerId: string;
  activeFarmId: string;
  usuarios: FarmerProfile[];
  fazendas: FarmProperty[];
  catalogoPancs: EdiblePlantPANC[];
  pocosSiagas: WellPoint[];
  alertas: ProactiveAlertItem[];
  fieldLogs: FieldValidationLog[];
  feedbacks: AppFeedbackItem[];
  syncQueue: SyncQueueItem[];
}

export const DEFAULT_ACCESSIBILITY: AccessibilityProfile = {
  voiceOnboardingCompleted: false,
  registrationCompleted: false,
  tutorialCompleted: false,
  appLanguage: 'en',
  voiceGuidanceEnabled: false,
  speechRate: 0.85,
  highContrast: false,
  largeText: false,
  languageLevel: 'acessivel',
};

export function buildSeedSnapshot(lang: AppLanguage = 'en'): LocalDatabaseSnapshot {
  const partialFarms = buildInitialSeedFarms();
  const fazendas: FarmProperty[] = partialFarms.map((pf) => {
    const centroid = pf.centroid ?? DEFAULT_IRECE_FARM_CENTROID;
    const cultura =
      pf.culturaPrincipal ?? (lang === 'en' ? 'Cowpea + Maize' : 'Feijão-Caupi + Milho');
    const raio = pf.raioBuscaKm ?? 15;
    const polygon = pf.polygon ?? DEFAULT_IRECE_FARM_POLYGON;
    return {
      id: pf.id!,
      farmerId: pf.farmerId!,
      nome: pf.nome!,
      municipio: pf.municipio!,
      estado: pf.estado!,
      regiaoNome: pf.regiaoNome!,
      bioma: pf.bioma!,
      centroid,
      polygon,
      areaHectares: pf.areaHectares!,
      areaTarefasBa: pf.areaTarefasBa!,
      raioBuscaKm: raio,
      culturaPrincipal: cultura,
      lotes: createDefaultLotsForFarm(
        centroid,
        pf.areaHectares ?? 6.85,
        cultura,
        polygon,
        lang
      ),
      diagnostico: runLocalAgronomicEngine(centroid, cultura, raio, {}, lang),
    };
  });

  return {
    accessibility: { ...DEFAULT_ACCESSIBILITY, appLanguage: lang },
    activeFarmerId: SEED_FARMERS[0].id,
    activeFarmId: fazendas[0].id,
    usuarios: [...SEED_FARMERS],
    fazendas,
    catalogoPancs: [...SEED_PANCS],
    pocosSiagas: [...SEED_WELLS],
    alertas: [...SEED_ALERTS],
    fieldLogs: [],
    feedbacks: [],
    syncQueue: [],
  };
}
