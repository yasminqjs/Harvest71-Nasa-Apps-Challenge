export const ROTATION_PLAN_KEY_PREFIX = 'rocaviva_rotation_plan_v1:';

export function rotationPlanKey(farmId: string, lotId: string): string {
  return ROTATION_PLAN_KEY_PREFIX + JSON.stringify([farmId, lotId]);
}
