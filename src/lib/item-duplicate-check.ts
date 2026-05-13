// 품목 중복 검사용 유틸 — revisionNumber / itemCode / id / timestamps 제외하고 모든 필드 비교

export const ITEM_DUPE_FIELDS = [
  'itemName', 'unit', 'category', 'subCategory', 'status', 'memo',
  'length', 'width', 'height', 'diameter', 'weight',
  'innerLength', 'innerWidth', 'innerHeight', 'thickness',
  'material', 'packType', 'color', 'formFactor',
  'chemistryType', 'cellModel', 'seriesCount', 'parallelCount',
  'circuit', 'layerCount',
  'dischargeCutoffVoltage', 'nominalVoltage', 'chargeCutoffVoltage',
  'nominalCapacity', 'energy', 'maxChargeCurrent', 'maxDischargeCurrent',
  'continuousChargeCurrent', 'continuousDischargeCurrent',
  'chargeCRate', 'dischargeCRate',
  'manufacturer', 'ratedVoltage', 'minSeriesCount', 'maxSeriesCount', 'maxVoltage',
  'vendors', 'specialOptions', 'certifications', 'drawings', 'specSheets', 'images',
] as const

function norm(v: unknown): string {
  if (v === null || v === undefined || v === '') return ''
  if (Array.isArray(v)) return [...v].sort().join('||')
  // Prisma Decimal 객체
  if (typeof v === 'object' && v !== null && 'toNumber' in v && typeof (v as any).toNumber === 'function') {
    return String((v as any).toNumber())
  }
  return String(v).trim()
}

export function isSameItem(existing: Record<string, unknown>, incoming: Record<string, unknown>): boolean {
  return ITEM_DUPE_FIELDS.every(f => norm(existing[f]) === norm(incoming[f]))
}
