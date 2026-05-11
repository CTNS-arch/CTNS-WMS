import { SelectOption } from './select-options'

export const CATEGORY_OPTIONS: SelectOption[] = [
  { value: 'PRODUCT',   label: '완제품', colorIndex: 0, code: '1' },
  { value: 'ASSEMBLY',  label: '반제품', colorIndex: 1, code: '2' },
  { value: 'COMPONENT', label: '자재',  colorIndex: 2, code: '3' },
]

export const SUB_OPTIONS: Record<string, SelectOption[]> = {
  PRODUCT: [
    { value: 'BP', label: '배터리팩', colorIndex: 0, code: 'BP' },
  ],
  ASSEMBLY: [
    { value: 'PO',  label: 'Soft pack',             colorIndex: 0, code: 'PO'  },
    { value: 'BM',  label: 'BMS',                    colorIndex: 3, code: 'BM'  },
    { value: 'PC',  label: 'PCM',                    colorIndex: 6, code: 'PC'  },
    { value: 'CAS', label: 'Case',                   colorIndex: 1, code: 'CAS' },
    { value: 'PRA', label: 'Power Relay Assembly',   colorIndex: 2, code: 'PRA' },
    { value: 'DST', label: 'Distribution Board',     colorIndex: 3, code: 'DST' },
    { value: 'SWB', label: 'Switch Box',             colorIndex: 4, code: 'SWB' },
    { value: 'DRV', label: 'Driver',                 colorIndex: 5, code: 'DRV' },
    { value: 'CMB', label: 'Communication Board',    colorIndex: 6, code: 'CMB' },
    { value: 'JTB', label: 'Junction Box',           colorIndex: 7, code: 'JTB' },
    { value: 'HRN', label: 'Harness',                colorIndex: 8, code: 'HRN' },
  ],
  COMPONENT: [
    { value: 'CL', label: '셀',           colorIndex: 1, code: 'CL' },
    { value: 'EL', label: '전장/전기부품', colorIndex: 0, code: 'EL' },
    { value: 'ME', label: '기구/외장부품', colorIndex: 3, code: 'ME' },
    { value: 'CD', label: '도전재',        colorIndex: 2, code: 'CD' },
    { value: 'PK', label: '포장자재',      colorIndex: 5, code: 'PK' },
    { value: 'FS', label: '체결부품',      colorIndex: 6, code: 'FS' },
    { value: 'SM', label: '부자재/소모품', colorIndex: 7, code: 'SM' },
    { value: 'OT', label: '샘플/기타',     colorIndex: 9, code: 'OT' },
  ],
}

// 정적 3분류 옵션 (사용자 편집 불가)
export const THIRD_OPTIONS: Record<string, SelectOption[]> = {
  CD: [
    { value: 'NI', label: '니켈',     colorIndex: 9, code: 'NI' },
    { value: 'NN', label: '니켈합금', colorIndex: 8, code: 'NN' },
    { value: 'RN', label: '순니켈',   colorIndex: 7, code: 'RN' },
    { value: 'CP', label: '구리',     colorIndex: 2, code: 'CP' },
    { value: 'BB', label: '버스바',   colorIndex: 0, code: 'BB' },
    { value: 'WI', label: '와이어',   colorIndex: 5, code: 'WI' },
  ],
  PK: [
    { value: 'BX', label: '박스',     colorIndex: 5, code: 'BX' },
    { value: 'ES', label: '스티로폼', colorIndex: 9, code: 'ES' },
    { value: 'FF', label: '에어캡',   colorIndex: 0, code: 'FF' },
    { value: 'SF', label: '완충재',   colorIndex: 6, code: 'SF' },
    { value: 'LB', label: '라벨',     colorIndex: 3, code: 'LB' },
  ],
  FS: [
    { value: 'BL', label: '볼트', colorIndex: 9, code: 'BL' },
    { value: 'NT', label: '너트', colorIndex: 8, code: 'NT' },
    { value: 'WS', label: '와셔', colorIndex: 7, code: 'WS' },
  ],
  SM: [
    { value: 'DF', label: '양면테이프',     colorIndex: 4, code: 'DF' },
    { value: 'GL', label: '본드/접착제',    colorIndex: 1, code: 'GL' },
    { value: 'HF', label: '핫멜트',         colorIndex: 2, code: 'HF' },
    { value: 'PD', label: '패드',           colorIndex: 6, code: 'PD' },
    { value: 'TA', label: '테이프',         colorIndex: 3, code: 'TA' },
    { value: 'TP', label: '방열패드',       colorIndex: 0, code: 'TP' },
    { value: 'SP', label: '스펀지',         colorIndex: 7, code: 'SP' },
    { value: 'PA', label: '도료/페인트',    colorIndex: 5, code: 'PA' },
    { value: 'TY', label: '케이블타이',     colorIndex: 9, code: 'TY' },
    { value: 'BA', label: '배터리팩테이프', colorIndex: 4, code: 'BA' },
    { value: 'HT', label: '히트건',         colorIndex: 4, code: 'HT' },
  ],
  RM: [
    { value: 'AB', label: '일반자재', colorIndex: 9, code: 'AB' },
  ],
  OT: [
    { value: 'ZZ', label: '기타', colorIndex: 9, code: 'ZZ' },
  ],
}

export interface ThirdLevelDef {
  field: string
  label: string
  optKey?: string              // 편집 가능 옵션 (select-options 스토어에서 가져옴)
  staticOptions?: SelectOption[] // 고정 옵션 (편집 불가)
}

export const THIRD_LEVEL: Record<string, ThirdLevelDef | null> = {
  // PRODUCT
  BP: { field: 'chemistryType', label: '화학계', optKey: 'chemistryType' },
  // ASSEMBLY
  PO:  { field: 'chemistryType', label: '화학계', optKey: 'chemistryType' },
  BM: null, // BMS: 3분류 없음 (제조사·직렬·용량으로 코드 생성)
  PC: null, // PCM: 동일
  CAS: null, PRA: null, DST: null, SWB: null, DRV: null,
  CMB: null, JTB: null, HRN: null, ETC: null,
  // COMPONENT
  CL: { field: 'chemistryType', label: '화학계',    optKey: 'chemistryType' },
  EL: { field: 'formFactor',    label: '부품 유형', optKey: 'elComponentType' },
  ME: { field: 'formFactor',    label: '부품 유형', optKey: 'meComponentType' },
  CD: { field: 'formFactor',    label: '도전재 종류', optKey: 'cdComponentType', staticOptions: THIRD_OPTIONS.CD },
  PK: { field: 'formFactor',    label: '포장 종류',   optKey: 'pkComponentType', staticOptions: THIRD_OPTIONS.PK },
  FS: { field: 'formFactor',    label: '체결 종류',   optKey: 'fsComponentType', staticOptions: THIRD_OPTIONS.FS },
  SM: { field: 'formFactor',    label: '소모품 종류', optKey: 'smComponentType', staticOptions: THIRD_OPTIONS.SM },
  RM: { field: 'formFactor',    label: '자재 종류',   optKey: 'rmComponentType', staticOptions: THIRD_OPTIONS.RM },
  OT: { field: 'formFactor',    label: '기타 종류',   optKey: 'otComponentType', staticOptions: THIRD_OPTIONS.OT },
}

export function showElec(sub: string) {
  return ['BP', 'BM', 'PC', 'CL', 'PO'].includes(sub)
}
export function showBms(sub: string) {
  return ['BM', 'PC'].includes(sub)
}
export function showProductOptions(cat: string) {
  return cat === 'PRODUCT'
}
