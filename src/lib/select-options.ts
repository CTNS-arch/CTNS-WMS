export interface SelectOption {
  value: string
  label: string
  colorIndex: number
  code?: string // 품번 자동생성용 단축코드
}

export const PALETTE = [
  { bg: 'bg-blue-100',   text: 'text-blue-700'   },
  { bg: 'bg-green-100',  text: 'text-green-700'  },
  { bg: 'bg-orange-100', text: 'text-orange-700' },
  { bg: 'bg-purple-100', text: 'text-purple-700' },
  { bg: 'bg-red-100',    text: 'text-red-700'    },
  { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  { bg: 'bg-teal-100',   text: 'text-teal-700'   },
  { bg: 'bg-pink-100',   text: 'text-pink-700'   },
  { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  { bg: 'bg-cyan-100',   text: 'text-cyan-700'   },
]

const DEFAULTS: Record<string, SelectOption[]> = {
  vendor: [],   // 거래처는 사용자 정의 (기본값 없음)
  subCategory: [
    { value: 'BP', label: '배터리팩',     colorIndex: 0, code: 'BP' },
    { value: 'BM', label: 'BMS',          colorIndex: 3, code: 'BM' },
    { value: 'PC', label: 'PCM',          colorIndex: 6, code: 'PC' },
    { value: 'CL', label: '셀',           colorIndex: 1, code: 'CL' },
    { value: 'EL', label: '전장/전기부품', colorIndex: 0, code: 'EL' },
    { value: 'ME', label: '기구/외장부품', colorIndex: 3, code: 'ME' },
    { value: 'CD', label: '도전재',       colorIndex: 2, code: 'CD' },
    { value: 'FS', label: '체결부품',     colorIndex: 6, code: 'FS' },
    { value: 'SM', label: '부자재/소모품', colorIndex: 7, code: 'SM' },
    { value: 'OT', label: '샘플/기타',    colorIndex: 9, code: 'OT' },
  ],
  chemistryType: [
    { value: 'NMC',   label: 'NMC',   colorIndex: 0, code: 'NM' },
    { value: 'LFP',   label: 'LFP',   colorIndex: 1, code: 'LF' },
    { value: 'NCA',   label: 'NCA',   colorIndex: 2, code: 'NC' },
    { value: 'LTO',   label: 'LTO',   colorIndex: 3, code: 'LT' },
    { value: 'LMFP',  label: 'LMFP',  colorIndex: 4, code: 'LM' },
    { value: 'LMO',   label: 'LMO',   colorIndex: 5, code: 'LO' },
    { value: 'LCO',   label: 'LCO',   colorIndex: 6, code: 'LC' },
    { value: 'LNMO',  label: 'LNMO',  colorIndex: 7, code: 'NO' },
    { value: 'LCP',   label: 'LCP',   colorIndex: 8, code: 'LP' },
    { value: 'LI-PO', label: 'LI-PO', colorIndex: 9, code: 'LI' },
  ],
  cellModel: [
    // EVE
    { value: 'EVE E105',   label: 'EVE E105',   colorIndex: 6, code: 'E105'   },
    { value: 'EVE E230',   label: 'EVE E230',   colorIndex: 6, code: 'E230'   },
    { value: 'EVE E280K',  label: 'EVE E280K',  colorIndex: 6, code: 'E280K'  },
    { value: 'EVE E304',   label: 'EVE E304',   colorIndex: 6, code: 'E304'   },
    { value: 'EVE F32700', label: 'EVE F32700', colorIndex: 6, code: 'F32700' },
    // LGES
    { value: 'LGES H51',   label: 'LGES H51',   colorIndex: 0, code: 'LH51'   },
    { value: 'LGES H52A',  label: 'LGES H52A',  colorIndex: 0, code: 'LH52A'  },
    { value: 'LGES M50',   label: 'LGES M50',   colorIndex: 0, code: 'LM50'   },
    { value: 'LGES M50L',  label: 'LGES M50L',  colorIndex: 0, code: 'LM50L'  },
    { value: 'LGES M50LT', label: 'LGES M50LT', colorIndex: 0, code: 'LM50LT' },
    { value: 'LGES M52V',  label: 'LGES M52V',  colorIndex: 0, code: 'LM52V'  },
    { value: 'LGES M58T',  label: 'LGES M58T',  colorIndex: 0, code: 'LM58T'  },
    // SDI
    { value: 'SDI 45T',   label: 'SDI 45T',   colorIndex: 4, code: 'S45T'  },
    { value: 'SDI 48X',   label: 'SDI 48X',   colorIndex: 4, code: 'S48X'  },
    { value: 'SDI 50E',   label: 'SDI 50E',   colorIndex: 4, code: 'S50E'  },
    { value: 'SDI 50S',   label: 'SDI 50S',   colorIndex: 4, code: 'S50S'  },
    { value: 'SDI 50T',   label: 'SDI 50T',   colorIndex: 4, code: 'S50T'  },
    { value: 'SDI 51X',   label: 'SDI 51X',   colorIndex: 4, code: 'S51X'  },
    { value: 'SDI 53G',   label: 'SDI 53G',   colorIndex: 4, code: 'S53G'  },
    { value: 'SDI 58E',   label: 'SDI 58E',   colorIndex: 4, code: 'S58E'  },
    { value: 'SDI SM50',  label: 'SDI SM50',  colorIndex: 4, code: 'SM50'  },
    { value: 'SDI SM58T', label: 'SDI SM58T', colorIndex: 4, code: 'SM58T' },
  ],
  circuit: [
    { value: 'BM', label: 'BMS', colorIndex: 1, code: 'B' },
    { value: 'PC', label: 'PCM', colorIndex: 6, code: 'P' },
  ],
  material: [
    { value: '알루미늄', label: '알루미늄', colorIndex: 0 },
    { value: '플라스틱', label: '플라스틱', colorIndex: 2 },
    { value: '나무',     label: '나무',     colorIndex: 5 },
    { value: '스틸',     label: '스틸',     colorIndex: 9 },
    { value: '고무',     label: '고무',     colorIndex: 4 },
    { value: '실리콘',   label: '실리콘',   colorIndex: 6 },
  ],
  packType: [
    { value: '소프트팩', label: '소프트팩', colorIndex: 0 },
    { value: '하드팩',   label: '하드팩',   colorIndex: 3 },
  ],
  manufacturer: [
    { value: 'CTNS', label: 'CTNS', colorIndex: 0, code: 'CT' },
    { value: '달리',  label: '달리',  colorIndex: 2, code: 'DA' },
  ],
  color: [
    { value: '빨강', label: '빨강', colorIndex: 4 },
    { value: '주황', label: '주황', colorIndex: 2 },
    { value: '노랑', label: '노랑', colorIndex: 5 },
    { value: '초록', label: '초록', colorIndex: 1 },
    { value: '파랑', label: '파랑', colorIndex: 0 },
    { value: '남색', label: '남색', colorIndex: 8 },
    { value: '보라', label: '보라', colorIndex: 3 },
    { value: '검정', label: '검정', colorIndex: 9 },
    { value: '흰색', label: '흰색', colorIndex: 9 },
    { value: '혼합', label: '혼합', colorIndex: 6 },
  ],
  formFactor: [
    { value: '원통형', label: '원통형', colorIndex: 0 },
    { value: '각형',   label: '각형',   colorIndex: 3 },
    { value: '파우치', label: '파우치', colorIndex: 6 },
  ],
  unit: [
    { value: 'EA',  label: 'EA',  colorIndex: 0 },
    { value: 'kg',  label: 'kg',  colorIndex: 1 },
    { value: 'g',   label: 'g',   colorIndex: 1 },
    { value: 'm',   label: 'm',   colorIndex: 2 },
    { value: 'mm',  label: 'mm',  colorIndex: 2 },
    { value: 'L',   label: 'L',   colorIndex: 3 },
    { value: 'SET', label: 'SET', colorIndex: 6 },
  ],
  specialOption: [
    { value: '기본형',       label: '기본형',       colorIndex: 9 },
    { value: 'CAN 통신',     label: 'CAN 통신',     colorIndex: 0 },
    { value: '블루투스',     label: '블루투스',     colorIndex: 0 },
    { value: '저온 히터',    label: '저온 히터',    colorIndex: 4 },
    { value: '프리차지',     label: '프리차지',     colorIndex: 2 },
    { value: '병렬 운용',    label: '병렬 운용',    colorIndex: 1 },
    { value: '퓨즈',         label: '퓨즈',         colorIndex: 4 },
    { value: '와이파이',     label: '와이파이',     colorIndex: 8 },
    { value: '방진방수 IP',  label: '방진방수 IP',  colorIndex: 6 },
    { value: '팬 냉각',      label: '팬 냉각',      colorIndex: 7 },
    { value: '수냉',         label: '수냉',         colorIndex: 0 },
    { value: '디스플레이',   label: '디스플레이',   colorIndex: 3 },
    { value: '앱 모니터링',  label: '앱 모니터링',  colorIndex: 0 },
    { value: '열폭주 대응',  label: '열폭주 대응',  colorIndex: 4 },
    { value: '화재 대응',    label: '화재 대응',    colorIndex: 4 },
    { value: 'UART 통신',    label: 'UART 통신',    colorIndex: 0 },
    { value: 'SMBus',        label: 'SMBus',        colorIndex: 0 },
    { value: '데이터 기록',  label: '데이터 기록',  colorIndex: 9 },
    { value: '수동 밸런싱',  label: '수동 밸런싱',  colorIndex: 1 },
    { value: '능동 밸런싱',  label: '능동 밸런싱',  colorIndex: 1 },
    { value: '릴레이 제어',  label: '릴레이 제어',  colorIndex: 2 },
    { value: '병렬 슬레이브', label: '병렬 슬레이브', colorIndex: 6 },
    { value: '병렬 마스터',  label: '병렬 마스터',  colorIndex: 3 },
    { value: '온도 보호 강화', label: '온도 보호 강화', colorIndex: 4 },
    { value: '고급 SOC 계산', label: '고급 SOC 계산', colorIndex: 8 },
  ],
  certification: [
    { value: 'CE62619',  label: 'CE62619',  colorIndex: 0 },
    { value: 'EMC',      label: 'EMC',      colorIndex: 1 },
    { value: 'KC62133',  label: 'KC62133',  colorIndex: 4 },
    { value: 'KC62619',  label: 'KC62619',  colorIndex: 4 },
    { value: 'UL2054',   label: 'UL2054',   colorIndex: 2 },
    { value: 'UN38.3',   label: 'UN38.3',   colorIndex: 5 },
    { value: 'UL2271',   label: 'UL2271',   colorIndex: 2 },
    { value: 'UL2580',   label: 'UL2580',   colorIndex: 2 },
  ],
  // 전장/전기부품 부품 유형
  elComponentType: [
    { value: 'FU', label: '퓨즈',          colorIndex: 4, code: 'FU' },
    { value: 'FB', label: '퓨즈홀더',      colorIndex: 4, code: 'FB' },
    { value: 'HR', label: '하네스',        colorIndex: 2, code: 'HR' },
    { value: 'RS', label: '저항',          colorIndex: 9, code: 'RS' },
    { value: 'SS', label: '센서',          colorIndex: 6, code: 'SS' },
    { value: 'CA', label: '케이블',        colorIndex: 0, code: 'CA' },
    { value: 'CN', label: '커넥터',        colorIndex: 0, code: 'CN' },
    { value: 'TB', label: '단자대',        colorIndex: 3, code: 'TB' },
    { value: 'EQ', label: '이퀄라이저/액티브', colorIndex: 8, code: 'EQ' },
    { value: 'GS', label: '가스센서',      colorIndex: 6, code: 'GS' },
    { value: 'HO', label: '전장용홀더',    colorIndex: 3, code: 'HO' },
    { value: 'SK', label: '수축튜브',      colorIndex: 7, code: 'SK' },
    { value: 'SW', label: '스위치',        colorIndex: 1, code: 'SW' },
    { value: 'TC', label: '써미스터',      colorIndex: 6, code: 'TC' },
    { value: 'TS', label: '온도센서',      colorIndex: 6, code: 'TS' },
    { value: 'RE', label: '릴레이',        colorIndex: 4, code: 'RE' },
    { value: 'IV', label: '인버터/컨버터', colorIndex: 8, code: 'IV' },
    { value: 'CC', label: '도전재',        colorIndex: 9, code: 'CC' },
  ],
  // 기구/외장부품 부품 유형
  meComponentType: [
    { value: 'HD', label: '구조용홀더',      colorIndex: 3, code: 'HD' },
    { value: 'JS', label: '지그',            colorIndex: 9, code: 'JS' },
    { value: 'AL', label: '알루미늄케이스',  colorIndex: 9, code: 'AL' },
    { value: 'ST', label: '철/스틸케이스',   colorIndex: 9, code: 'ST' },
    { value: 'PL', label: '플라스틱케이스',  colorIndex: 2, code: 'PL' },
    { value: 'RB', label: '고무케이스',      colorIndex: 4, code: 'RB' },
    { value: 'SL', label: '실리콘케이스',    colorIndex: 6, code: 'SL' },
    { value: 'WD', label: '나무케이스',      colorIndex: 5, code: 'WD' },
  ],
  // 도전재 부품 유형
  cdComponentType: [
    { value: 'NI', label: '니켈스트립', colorIndex: 9, code: 'NI' },
    { value: 'BS', label: '버스바',     colorIndex: 9, code: 'BS' },
    { value: 'CT', label: '구리테이프', colorIndex: 2, code: 'CT' },
    { value: 'WT', label: '연결탭',     colorIndex: 9, code: 'WT' },
  ],
  // 체결부품 부품 유형
  fsComponentType: [
    { value: 'SC', label: '나사',   colorIndex: 9, code: 'SC' },
    { value: 'BT', label: '볼트',   colorIndex: 9, code: 'BT' },
    { value: 'NT', label: '너트',   colorIndex: 9, code: 'NT' },
    { value: 'WS', label: '와셔',   colorIndex: 9, code: 'WS' },
    { value: 'RI', label: '리벳',   colorIndex: 3, code: 'RI' },
  ],
  // 부자재/소모품 부품 유형
  smComponentType: [
    { value: 'TP', label: '테이프',     colorIndex: 5, code: 'TP' },
    { value: 'GL', label: '접착제',     colorIndex: 2, code: 'GL' },
    { value: 'SD', label: '솔더',       colorIndex: 9, code: 'SD' },
    { value: 'IB', label: '절연테이프', colorIndex: 7, code: 'IB' },
  ],
  // 샘플/기타 유형
  otComponentType: [],
}

const STORAGE_KEY = 'erp-select-options-v3'

function loadAll(): Record<string, SelectOption[]> {
  if (typeof window === 'undefined') return DEFAULTS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const merged: Record<string, SelectOption[]> = {}
      for (const key of Object.keys(DEFAULTS)) {
        merged[key] = parsed[key] ?? DEFAULTS[key]
      }
      return merged
    }
  } catch {}
  return { ...DEFAULTS }
}

function saveAll(data: Record<string, SelectOption[]>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch {}
}

// Singleton in-memory store (refreshed per page load from localStorage)
let _store: Record<string, SelectOption[]> | null = null

export function getOptions(field: string): SelectOption[] {
  if (!_store) _store = loadAll()
  return _store[field] ?? []
}

// ── 서버 동기화 ────────────────────────────────────────────

let _serverSynced = false

// 서버에서 받아온 데이터로 인메모리 스토어 초기화
export function initStore(data: Record<string, SelectOption[]>): void {
  const merged: Record<string, SelectOption[]> = {}
  for (const key of Object.keys(DEFAULTS)) {
    merged[key] = (data[key] ?? DEFAULTS[key]) as SelectOption[]
  }
  _store = merged
  _serverSynced = true
  saveAll(merged)
}

export function initGroups(data: CellModelGroup[]): void {
  _groups = data
  saveGroups(data)
}

export function serializeStore(): Record<string, SelectOption[]> {
  if (!_store) _store = loadAll()
  return _store
}

export function serializeGroups(): CellModelGroup[] {
  if (!_groups) _groups = loadGroups()
  return _groups
}

// 세션 내 최초 1회만 서버에서 옵션 동기화 (모든 컴포넌트에서 호출 가능)
export async function ensureServerSync(): Promise<void> {
  if (_serverSynced || typeof window === 'undefined') return
  try {
    const res  = await fetch('/api/options')
    const json = await res.json()
    if (json.success) {
      if (json.data.options)         initStore(json.data.options)
      if (json.data.cellModelGroups) initGroups(json.data.cellModelGroups)
      if (!json.data.options)        saveToServer() // 서버에 없으면 현재 localStorage 업로드
    }
  } catch {
    _serverSynced = true // 실패해도 재시도 방지 (localStorage 폴백 사용)
  }
}

// 현재 인메모리 스토어를 서버에 저장 (fire-and-forget)
export function saveToServer(): void {
  if (typeof window === 'undefined') return
  fetch('/api/options', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ options: serializeStore(), cellModelGroups: serializeGroups() }),
  }).catch(() => {})
}

// ── 셀모델 계층 구조 (제조사 → 모델) ─────────────────────

export interface CellModelEntry {
  value: string      // "SDI 45T" (DB 저장값)
  label: string      // "45T" (모델 드롭다운 표시)
  code: string       // "S45T" (품번 자동생성 코드)
  colorIndex: number
}

export interface CellModelGroup {
  manufacturer: string
  colorIndex: number
  models: CellModelEntry[]
}

const DEFAULT_CELL_MODEL_GROUPS: CellModelGroup[] = [
  { manufacturer: 'EVE', colorIndex: 6, models: [
    { value: 'EVE E105',   label: 'E105',   code: 'E105',   colorIndex: 6 },
    { value: 'EVE E230',   label: 'E230',   code: 'E230',   colorIndex: 6 },
    { value: 'EVE E280K',  label: 'E280K',  code: 'E280K',  colorIndex: 6 },
    { value: 'EVE E304',   label: 'E304',   code: 'E304',   colorIndex: 6 },
    { value: 'EVE F32700', label: 'F32700', code: 'F32700', colorIndex: 6 },
  ]},
  { manufacturer: 'LGES', colorIndex: 0, models: [
    { value: 'LGES H51',   label: 'H51',   code: 'LH51',   colorIndex: 0 },
    { value: 'LGES H52A',  label: 'H52A',  code: 'LH52A',  colorIndex: 0 },
    { value: 'LGES M50',   label: 'M50',   code: 'LM50',   colorIndex: 0 },
    { value: 'LGES M50L',  label: 'M50L',  code: 'LM50L',  colorIndex: 0 },
    { value: 'LGES M50LT', label: 'M50LT', code: 'LM50LT', colorIndex: 0 },
    { value: 'LGES M52V',  label: 'M52V',  code: 'LM52V',  colorIndex: 0 },
    { value: 'LGES M58T',  label: 'M58T',  code: 'LM58T',  colorIndex: 0 },
  ]},
  { manufacturer: 'SDI', colorIndex: 4, models: [
    { value: 'SDI 45T',   label: '45T',   code: 'S45T',  colorIndex: 4 },
    { value: 'SDI 48X',   label: '48X',   code: 'S48X',  colorIndex: 4 },
    { value: 'SDI 50E',   label: '50E',   code: 'S50E',  colorIndex: 4 },
    { value: 'SDI 50S',   label: '50S',   code: 'S50S',  colorIndex: 4 },
    { value: 'SDI 50T',   label: '50T',   code: 'S50T',  colorIndex: 4 },
    { value: 'SDI 51X',   label: '51X',   code: 'S51X',  colorIndex: 4 },
    { value: 'SDI 53G',   label: '53G',   code: 'S53G',  colorIndex: 4 },
    { value: 'SDI 58E',   label: '58E',   code: 'S58E',  colorIndex: 4 },
    { value: 'SDI SM50',  label: 'SM50',  code: 'SM50',  colorIndex: 4 },
    { value: 'SDI SM58T', label: 'SM58T', code: 'SM58T', colorIndex: 4 },
  ]},
]

const CELL_GROUPS_KEY = 'erp-cell-model-groups-v1'
let _groups: CellModelGroup[] | null = null

function loadGroups(): CellModelGroup[] {
  if (typeof window === 'undefined') return DEFAULT_CELL_MODEL_GROUPS
  try {
    const raw = localStorage.getItem(CELL_GROUPS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return JSON.parse(JSON.stringify(DEFAULT_CELL_MODEL_GROUPS))
}

function saveGroups(g: CellModelGroup[]) {
  try { localStorage.setItem(CELL_GROUPS_KEY, JSON.stringify(g)) } catch {}
}

export function getCellModelGroups(): CellModelGroup[] {
  if (!_groups) _groups = loadGroups()
  return _groups
}

export function addCellModelGroup(manufacturer: string): void {
  if (!_groups) _groups = loadGroups()
  if (_groups.find(g => g.manufacturer === manufacturer)) return
  _groups = [..._groups, { manufacturer, colorIndex: _groups.length % PALETTE.length, models: [] }]
  saveGroups(_groups)
}

export function isCellModelCodeTaken(code: string): boolean {
  if (!_groups) _groups = loadGroups()
  return _groups.flatMap(g => g.models).some(m => m.code.toUpperCase() === code.toUpperCase())
}

export function addCellModelEntry(manufacturer: string, modelLabel: string, code: string): void {
  if (!_groups) _groups = loadGroups()
  const value = `${manufacturer} ${modelLabel}`
  if (isCellModelCodeTaken(code)) return
  _groups = _groups.map(g => {
    if (g.manufacturer !== manufacturer) return g
    if (g.models.find(m => m.value === value)) return g
    return { ...g, models: [...g.models, { value, label: modelLabel, code, colorIndex: g.colorIndex }] }
  })
  saveGroups(_groups)
  // flat cellModel 동기화 (품번 코드 생성 + 필터 표시 용)
  if (!_store) _store = loadAll()
  const flat = _store.cellModel ?? []
  if (!flat.find(o => o.value === value)) {
    const ci = _groups.find(g => g.manufacturer === manufacturer)?.colorIndex ?? 0
    _store = { ..._store, cellModel: [...flat, { value, label: value, colorIndex: ci, code }] }
    saveAll(_store)
  }
}

export function deleteCellModelGroup(manufacturer: string): void {
  if (!_groups) _groups = loadGroups()
  _groups = _groups.filter(g => g.manufacturer !== manufacturer)
  saveGroups(_groups)
  if (!_store) _store = loadAll()
  _store = { ..._store, cellModel: (_store.cellModel ?? []).filter(o => !o.value.startsWith(manufacturer + ' ')) }
  saveAll(_store)
}

export function deleteCellModelEntry(manufacturer: string, value: string): void {
  if (!_groups) _groups = loadGroups()
  _groups = _groups.map(g =>
    g.manufacturer !== manufacturer ? g : { ...g, models: g.models.filter(m => m.value !== value) }
  )
  saveGroups(_groups)
  if (!_store) _store = loadAll()
  _store = { ..._store, cellModel: (_store.cellModel ?? []).filter(o => o.value !== value) }
  saveAll(_store)
}

export function deleteOption(field: string, value: string): SelectOption[] {
  if (!_store) _store = loadAll()
  const existing = _store[field] ?? []
  const updated = existing.filter(o => o.value !== value)
  _store = { ..._store, [field]: updated }
  saveAll(_store)
  return updated
}

export function resetToDefault(field: string): SelectOption[] {
  if (!_store) _store = loadAll()
  const defaults = DEFAULTS[field] ?? []
  const copy = JSON.parse(JSON.stringify(defaults)) as SelectOption[]
  _store = { ..._store, [field]: copy }
  saveAll(_store)
  return copy
}

export function isCodeTaken(field: string, code: string): boolean {
  if (!_store) _store = loadAll()
  return (_store[field] ?? []).some(o => o.code?.toUpperCase() === code.toUpperCase())
}

export function addOption(field: string, label: string, code?: string): SelectOption[] {
  if (!_store) _store = loadAll()
  const existing = _store[field] ?? []
  if (existing.find(o => o.label.toLowerCase() === label.toLowerCase())) return existing
  if (code && existing.find(o => o.code?.toUpperCase() === code.toUpperCase())) return existing
  const newOpt: SelectOption = {
    value: code ?? label,
    label,
    colorIndex: existing.length % PALETTE.length,
    ...(code ? { code } : {}),
  }
  const updated = [...existing, newOpt]
  _store = { ..._store, [field]: updated }
  saveAll(_store)
  return updated
}

export function updateOption(field: string, value: string, updates: { label?: string; code?: string }): SelectOption[] {
  if (!_store) _store = loadAll()
  const existing = _store[field] ?? []
  const updated = existing.map(o => o.value === value ? { ...o, ...updates } : o)
  _store = { ..._store, [field]: updated }
  saveAll(_store)
  return updated
}

export function reorderOptions(field: string, ordered: SelectOption[]): void {
  if (!_store) _store = loadAll()
  _store = { ..._store, [field]: ordered }
  saveAll(_store)
}
