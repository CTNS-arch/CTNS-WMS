import { getOptions } from './select-options'
import { THIRD_LEVEL } from './classification'

const CATEGORY_CODE: Record<string, string> = {
  PRODUCT: '1',
  ASSEMBLY: '2',
  COMPONENT: '3',
}

function getCode(field: string, value: string): string {
  if (!value) return '?'
  const opt = getOptions(field).find(o => o.value === value)
  return opt?.code ?? value
}

function getThirdCode(subCategory: string, thirdValue: string): string {
  if (!thirdValue) return '??'
  const def = THIRD_LEVEL[subCategory]
  if (!def) return '??'
  if (def.staticOptions) {
    const opt = def.staticOptions.find(o => o.value === thirdValue)
    return opt?.code ?? thirdValue.slice(0, 2).toUpperCase()
  }
  if (def.optKey) return getCode(def.optKey, thirdValue)
  return '??'
}

export type ItemCodeType = 'bp' | 'bms' | 'cell' | 'component' | 'simple'

export function getItemCodeType(category?: string, subCategory?: string): ItemCodeType {
  if (subCategory === 'PO') return 'bp'
  if (category === 'PRODUCT' && subCategory === 'BP') return 'bp'
  if (category === 'PRODUCT' && (subCategory === 'BM' || subCategory === 'PC')) return 'bms'
  if (category === 'COMPONENT' && subCategory === 'CL') return 'cell'
  if (category === 'COMPONENT' && subCategory) return 'component'
  return 'simple'
}

export interface CodeParts {
  categoryCode: string
  subCode: string
  chemistryCode: string
  cellModelCode: string
  configCode: string
  circuitCode: string
  versionCode: string
}

export function buildCodeParts(form: {
  category?: string
  subCategory?: string
  chemistryType?: string
  cellModel?: string
  seriesCount?: number | string
  parallelCount?: number | string
  circuit?: string
  revisionNumber?: number | string
}): CodeParts {
  return {
    categoryCode: CATEGORY_CODE[form.category ?? ''] ?? '?',
    subCode: getCode('subCategory', form.subCategory ?? ''),
    chemistryCode: getCode('chemistryType', form.chemistryType ?? ''),
    cellModelCode: getCode('cellModel', form.cellModel ?? ''),
    configCode:
      form.seriesCount && form.parallelCount
        ? `${form.seriesCount}S${form.parallelCount}P`
        : '?S?P',
    circuitCode: getCode('circuit', form.circuit ?? ''),
    versionCode: String(form.revisionNumber || 1).padStart(3, '0'),
  }
}

export function buildItemCode(parts: CodeParts): string {
  return `${parts.categoryCode}-${parts.subCode}-${parts.chemistryCode}-${parts.cellModelCode}-${parts.configCode}-${parts.circuitCode}-${parts.versionCode}`
}

// 셀 코드: 3-CL-{화학계}-{셀모델}
export function buildCellCode(form: {
  category?: string
  chemistryType?: string
  cellModel?: string
}): string {
  const catCode = CATEGORY_CODE[form.category ?? ''] ?? '?'
  const chemCode = getCode('chemistryType', form.chemistryType ?? '')
  const cellCode = getCode('cellModel', form.cellModel ?? '')
  return `${catCode}-CL-${chemCode}-${cellCode}`
}

// 부자재 컴포넌트 코드: {catCode}-{sub}-{3분류코드}-{일련번호4자리}
export function buildComponentCode(form: {
  category?: string
  subCategory?: string
  formFactor?: string
  revisionNumber?: number | string
}): string {
  const catCode = CATEGORY_CODE[form.category ?? ''] ?? '?'
  const subCode = getCode('subCategory', form.subCategory ?? '')
  const thirdCode = getThirdCode(form.subCategory ?? '', form.formFactor ?? '')
  const serial = String(form.revisionNumber || 1).padStart(4, '0')
  return `${catCode}-${subCode}-${thirdCode}-${serial}`
}

// BMS/PCM 코드: {catCode}-{BM/PC}-{제조사코드}-{직렬}S-{용량}A-{버전}
export function buildBmsCode(form: {
  category?: string
  subCategory?: string
  manufacturer?: string
  seriesCount?: number | string
  nominalCapacity?: number | string
  revisionNumber?: number | string
}): string {
  const catCode = CATEGORY_CODE[form.category ?? ''] ?? '?'
  const subCode = getCode('subCategory', form.subCategory ?? '')
  const mfrCode = form.manufacturer ? getCode('manufacturer', form.manufacturer) : '?'
  const serS = form.seriesCount ? `${form.seriesCount}S` : '?S'
  const capA = form.nominalCapacity ? `${Math.round(Number(form.nominalCapacity))}A` : '?A'
  const version = String(form.revisionNumber || 1).padStart(3, '0')
  return `${catCode}-${subCode}-${mfrCode}-${serS}-${capA}-${version}`
}

// 간단 코드 (어셈블리 등 미분류): {catCode}-{sub}-{버전}
export function buildSimpleCode(form: {
  category?: string
  subCategory?: string
  revisionNumber?: number | string
}): string {
  const catCode = CATEGORY_CODE[form.category ?? ''] ?? '?'
  const subCode = getCode('subCategory', form.subCategory ?? '')
  const version = String(form.revisionNumber || 1).padStart(3, '0')
  return `${catCode}-${subCode}-${version}`
}

export function isBatteryPack(category?: string, subCategory?: string) {
  return (category === 'PRODUCT' && subCategory === 'BP') ||
         (category === 'ASSEMBLY' && subCategory === 'PO')
}

export function isBmsItem(category?: string, subCategory?: string) {
  return category === 'PRODUCT' && (subCategory === 'BM' || subCategory === 'PC')
}
