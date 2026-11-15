import {
  SEED_ALERTS,
  SEED_FARMERS,
  SEED_PANCS,
  SEED_WELLS,
  buildInitialSeedFarms,
} from '../data/seedData';
import { runLocalAgronomicEngine } from '../services/localAgronomicEngine';
import {
  AccessibilityProfile,
  AppFeedbackItem,
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
  tutorialCompleted: false,
  voiceGuidanceEnabled: false,
  speechRate: 0.85,
  highContrast: false,
  largeText: false,
  languageLevel: 'acessivel',
};

export function buildSeedSnapshot(): LocalDatabaseSnapshot {
  const partialFarms = buildInitialSeedFarms();
  const fazendas: FarmProperty[] = partialFarms.map((pf) => {
    const centroid = pf.centroid ?? { latitude: -12.9714, longitude: -38.5014 };
    const cultura = pf.culturaPrincipal ?? 'Feijão-Caupi + Mandioca';
    const raio = pf.raioBuscaKm ?? 15;
    return {
      id: pf.id!,
      farmerId: pf.farmerId!,
      nome: pf.nome!,
      municipio: pf.municipio!,
      estado: pf.estado!,
      regiaoNome: pf.regiaoNome!,
      bioma: pf.bioma!,
      centroid,
      polygon: pf.polygon!,
      areaHectares: pf.areaHectares!,
      areaTarefasBa: pf.areaTarefasBa!,
      raioBuscaKm: raio,
      culturaPrincipal: cultura,
      diagnostico: runLocalAgronomicEngine(centroid, cultura, raio),
    };
  });

  return {
    accessibility: { ...DEFAULT_ACCESSIBILITY },
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
