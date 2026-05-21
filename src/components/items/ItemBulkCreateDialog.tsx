'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { TagSelect } from '@/components/ui/tag-select'
import { TagMultiSelect } from '@/components/ui/tag-multi-select'
import { SUB_OPTIONS, THIRD_LEVEL } from '@/lib/classification'
import {
  getOptions, addOption, SelectOption,
  getCellModelGroups, CellModelGroup,
  addCellModelGroup, addCellModelEntry,
  ensureServerSync, saveToServer,
} from '@/lib/select-options'
import {
  buildItemCode, buildCodeParts,
  buildBmsCode, buildCellCode, buildComponentCode, buildSimpleCode,
} from '@/lib/item-code'

// ── 품목 유형 ──────────────────────────────────────────────
type BulkType = 'BATTERY' | 'BMS' | 'ASSEMBLY_OTHER' | 'CELL' | 'COMPONENT_OTHER' | 'CHARGER'

const TYPE_INFO: Record<BulkType, {
  label: string; desc: string; category: string; btnCls: string; badgeCls: string
}> = {
  BATTERY:         { label: '배터리팩',    desc: '완제품 배터리팩',          category: 'PRODUCT',   btnCls: 'border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700',     badgeCls: 'bg-blue-100 text-blue-700' },
  BMS:             { label: 'BMS/PCM',     desc: 'BMS, PCM 반제품',          category: 'ASSEMBLY',  btnCls: 'border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700', badgeCls: 'bg-purple-100 text-purple-700' },
  ASSEMBLY_OTHER:  { label: '그 외 반제품', desc: 'BMS/PCM 제외 반제품',       category: 'ASSEMBLY',  btnCls: 'border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700', badgeCls: 'bg-indigo-100 text-indigo-700' },
  CELL:            { label: '셀',          desc: '배터리 셀 (CL)',            category: 'COMPONENT', btnCls: 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700', badgeCls: 'bg-emerald-100 text-emerald-700' },
  COMPONENT_OTHER: { label: '그 외 자재',  desc: '셀 제외 자재',               category: 'COMPONENT', btnCls: 'border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700',       badgeCls: 'bg-gray-100 text-gray-700' },
  CHARGER:         { label: '충전기',      desc: '자재 EL > 충전기(CH)',        category: 'COMPONENT', btnCls: 'border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700', badgeCls: 'bg-orange-100 text-orange-700' },
}

const CAT_BADGE: Record<string, string> = {
  PRODUCT:   'bg-blue-100 text-blue-700',
  ASSEMBLY:  'bg-purple-100 text-purple-700',
  COMPONENT: 'bg-emerald-100 text-emerald-700',
}
const CAT_LABEL: Record<string, string> = { PRODUCT: '완제품', ASSEMBLY: '반제품', COMPONENT: '자재' }

function getSubOpts(type: BulkType, subMap: Record<string, SelectOption[]>): SelectOption[] {
  const asm  = subMap['ASSEMBLY']  ?? []
  const comp = subMap['COMPONENT'] ?? []
  switch (type) {
    case 'BATTERY':         return subMap['PRODUCT'] ?? []
    case 'BMS':             return asm.filter(o => ['BM', 'PC'].includes(o.value))
    case 'ASSEMBLY_OTHER':  return asm.filter(o => !['BM', 'PC', 'PO'].includes(o.value))
    case 'CELL':            return comp.filter(o => o.value === 'CL')
    case 'COMPONENT_OTHER': return comp.filter(o => o.value !== 'CL')
    case 'CHARGER':         return comp.filter(o => o.value === 'EL')
  }
}

const DIALOG_W: Record<BulkType, number> = {
  BATTERY: 1500, BMS: 1360, ASSEMBLY_OTHER: 1020, CELL: 1760, COMPONENT_OTHER: 1870, CHARGER: 1190,
}

// ── 행 구조 ────────────────────────────────────────────────
let _keyCounter = 0
const newKey = () => `r${++_keyCounter}`

interface BulkRow {
  _key: string
  subCategory: string
  thirdLevel: string
  itemName: string
  unit: string
  memo: string
  // BATTERY / CELL
  chemistryType: string
  cellManufacturer: string
  cellModel: string
  seriesCount: string
  parallelCount: string
  layerCount: string
  circuit: string
  specialOptions: string[]
  certifications: string[]
  drawings: string[]
  specSheets: string[]
  vendors: string[]
  // BMS
  manufacturer: string
  maxSeriesCount: string
  continuousDischargeCurrent: string
  // CELL 전기 사양
  dischargeCutoffVoltage: string
  nominalVoltage: string
  chargeCutoffVoltage: string
  nominalCapacity: string
  energy: string
  maxChargeCurrent: string
  maxDischargeCurrent: string
  continuousChargeCurrent: string
  chargeCRate: string
  dischargeCRate: string
  // COMPONENT_OTHER 물리 규격
  length: string; width: string; height: string
  diameter: string
  innerLength: string; innerWidth: string; innerHeight: string
  weight: string; thickness: string
  material: string; color: string
  ratedCurrent: string
  bomParent?: { id: string; itemCode: string; itemName: string } | null
  _cellSpecs?: {
    dischargeCutoffVoltage: number | null; nominalVoltage: number | null
    chargeCutoffVoltage: number | null; nominalCapacity: number | null
    maxChargeCurrent: number | null; maxDischargeCurrent: number | null
  } | null
  error?: string
}

function emptyRow(): BulkRow {
  return {
    _key: newKey(),
    subCategory: '', thirdLevel: '', itemName: '', unit: 'EA', memo: '',
    chemistryType: '', cellManufacturer: '', cellModel: '',
    seriesCount: '', parallelCount: '', layerCount: '', circuit: '',
    specialOptions: [], certifications: [], drawings: [], specSheets: [], vendors: [],
    manufacturer: '', maxSeriesCount: '', continuousDischargeCurrent: '',
    dischargeCutoffVoltage: '', nominalVoltage: '', chargeCutoffVoltage: '',
    nominalCapacity: '', energy: '', maxChargeCurrent: '', maxDischargeCurrent: '',
    continuousChargeCurrent: '', chargeCRate: '', dischargeCRate: '',
    length: '', width: '', height: '', diameter: '',
    innerLength: '', innerWidth: '', innerHeight: '',
    weight: '', thickness: '', material: '', color: '', ratedCurrent: '',
    bomParent: null,
    _cellSpecs: null,
  }
}

function computeElecSpecs(
  seriesCount: string,
  parallelCount: string,
  specs: BulkRow['_cellSpecs'],
  layerCount?: string,
): Partial<BulkRow> {
  if (!specs) return {}
  const s = parseFloat(seriesCount) || 0
  const p = parseFloat(parallelCount) || 0
  const l = parseFloat(layerCount ?? '') || 1  // 단 수 NULL → 1
  const calc = (factor: number, val: number | null): string => {
    if (!factor || val == null) return ''
    return String(Math.round(factor * val * 10000) / 10000)
  }
  const nomV = (s && specs.nominalVoltage != null) ? s * specs.nominalVoltage : null
  const nomC = (p && l && specs.nominalCapacity != null) ? p * l * specs.nominalCapacity : null
  return {
    dischargeCutoffVoltage: calc(s,     specs.dischargeCutoffVoltage),
    nominalVoltage:         calc(s,     specs.nominalVoltage),
    chargeCutoffVoltage:    calc(s,     specs.chargeCutoffVoltage),
    nominalCapacity:        calc(p * l, specs.nominalCapacity),
    energy: (nomV != null && nomC != null) ? String(Math.round(nomV * nomC * 10000) / 10000) : '',
    maxChargeCurrent:    calc(p * l, specs.maxChargeCurrent),
    maxDischargeCurrent: calc(p * l, specs.maxDischargeCurrent),
  }
}

// ── 코드 미리보기 ──────────────────────────────────────────
function previewCode(row: BulkRow, type: BulkType, revisionNumber = 1): string {
  const { category } = TYPE_INFO[type]
  const sub = type === 'CELL' ? 'CL' : row.subCategory
  if (!sub) return '—'
  switch (type) {
    case 'BATTERY':
      return buildItemCode(buildCodeParts({
        category, subCategory: sub,
        chemistryType: row.chemistryType || undefined,
        cellModel: row.cellModel || undefined,
        seriesCount: row.seriesCount ? Number(row.seriesCount) : undefined,
        parallelCount: row.parallelCount ? Number(row.parallelCount) : undefined,
        circuit: row.circuit || undefined,
        revisionNumber,
      }))
    case 'BMS':
      return buildBmsCode({
        category, subCategory: sub,
        manufacturer: row.manufacturer || undefined,
        maxSeriesCount: row.maxSeriesCount ? Number(row.maxSeriesCount) : undefined,
        continuousDischargeCurrent: row.continuousDischargeCurrent ? Number(row.continuousDischargeCurrent) : undefined,
        revisionNumber,
      })
    case 'CELL':
      return buildCellCode({ category, chemistryType: row.chemistryType || undefined, cellModel: row.cellModel || undefined })
    case 'COMPONENT_OTHER':
      return buildComponentCode({ category, subCategory: sub, formFactor: row.thirdLevel || undefined, revisionNumber })
    case 'CHARGER':
      return buildComponentCode({ category, subCategory: 'EL', formFactor: 'CH', revisionNumber })
    default:
      return buildSimpleCode({ category, subCategory: sub, revisionNumber })
  }
}

// 버전 접미사를 제거한 베이스 코드 반환 (CELL은 버전 없으므로 전체 코드)
function computeBaseCode(row: BulkRow, type: BulkType): string | null {
  const code1 = previewCode(row, type, 1)
  if (code1 === '—') return null
  return type === 'CELL' ? code1 : code1.split('-').slice(0, -1).join('-')
}

const n  = (v: string) => v ? parseFloat(v) : null
const ni = (v: string) => v ? parseInt(v)   : null

type OptStore = Record<string, SelectOption[]>

interface Props { open: boolean; onClose: () => void; onSaved: () => void }

export default function ItemBulkCreateDialog({ open, onClose, onSaved }: Props) {
  const [bulkType,     setBulkType]     = useState<BulkType | null>(null)
  const [fixedSub,     setFixedSub]     = useState<string>('')
  const [rows,         setRows]         = useState<BulkRow[]>([])
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [saving,       setSaving]       = useState(false)
  const [opts,         setOpts]         = useState<OptStore>({})
  const [subMap,       setSubMap]       = useState<Record<string, SelectOption[]>>({})
  const [cellMfrGroups, setCellMfrGroups] = useState<CellModelGroup[]>([])
  const [pendingCellModel, setPendingCellModel] = useState<{ rowKey: string; mfr: string; label: string; code: string } | null>(null)
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
  const [uploadingSpecKey, setUploadingSpecKey] = useState<string | null>(null)
  const [dbNextRevMap, setDbNextRevMap] = useState<Record<string, number>>({})
  const [bomSearches, setBomSearches] = useState<Record<string, { query: string; results: any[]; open: boolean }>>({})
  const [clSearches, setClSearches] = useState<Record<string, { query: string; results: any[]; open: boolean; selected: any | null }>>({})
  const drawingsInputRef    = useRef<HTMLInputElement>(null)
  const specSheetInputRef   = useRef<HTMLInputElement>(null)
  const uploadTargetKey     = useRef<string | null>(null)
  const specSheetTargetKey  = useRef<string | null>(null)
  const nameRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const revFetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bomDropdownRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const bomSearchTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const clDropdownRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const clSearchTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const reloadOpts = useCallback(() => {
    const keys = ['unit', 'chemistryType', 'circuit', 'manufacturer',
      'material', 'color', 'formFactor', 'vendor', 'specialOption', 'certification',
      'elComponentType', 'meComponentType', 'cdComponentType',
      'fsComponentType', 'smComponentType', 'rmComponentType', 'otComponentType']
    const store: OptStore = {}
    keys.forEach(k => {
      store[k] = (getOptions(k) as any[]).map(o => ({ value: o.value, label: o.label, colorIndex: o.colorIndex ?? 0, code: o.code ?? o.value }))
    })
    setOpts(store)
    setCellMfrGroups([...getCellModelGroups()])
    setSubMap({
      PRODUCT:   SUB_OPTIONS['PRODUCT']   ?? [],
      ASSEMBLY:  SUB_OPTIONS['ASSEMBLY']  ?? [],
      COMPONENT: SUB_OPTIONS['COMPONENT'] ?? [],
    })
  }, [])

  useEffect(() => {
    if (!open) return
    setBulkType(null); setRows([]); setSelectedKeys(new Set()); setDbNextRevMap({}); setBomSearches({}); setClSearches({})
    ensureServerSync().then(reloadOpts)
  }, [open, reloadOpts])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      Object.entries(bomDropdownRefs.current).forEach(([key, ref]) => {
        if (ref && !ref.contains(e.target as Node)) {
          setBomSearches(prev => {
            if (!prev[key]?.open) return prev
            return { ...prev, [key]: { ...prev[key], open: false } }
          })
        }
      })
      Object.entries(clDropdownRefs.current).forEach(([key, ref]) => {
        if (ref && !ref.contains(e.target as Node)) {
          setClSearches(prev => {
            if (!prev[key]?.open) return prev
            return { ...prev, [key]: { ...prev[key], open: false } }
          })
        }
      })
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const doClSearch = useCallback((rowKey: string, q: string, showAll = false) => {
    clearTimeout(clSearchTimers.current[rowKey])
    clSearchTimers.current[rowKey] = setTimeout(async () => {
      if (!q.trim() && !showAll) {
        setClSearches(prev => ({ ...prev, [rowKey]: { ...(prev[rowKey] ?? { query: '', results: [], open: false, selected: null }), results: [], open: false } }))
        return
      }
      try {
        const url = q.trim()
          ? `/api/items?category=COMPONENT&subCategory=CL&search=${encodeURIComponent(q)}&limit=20`
          : `/api/items?category=COMPONENT&subCategory=CL&limit=100&sortBy=itemCode&sortOrder=asc`
        const res = await fetch(url)
        const json = await res.json()
        if (json.success) {
          setClSearches(prev => ({ ...prev, [rowKey]: { ...(prev[rowKey] ?? { query: q, results: [], open: true, selected: null }), results: json.data.items, open: true } }))
        }
      } catch {}
    }, q.trim() ? 300 : 0)
  }, [])

  const doBomSearch = useCallback((rowKey: string, q: string) => {
    clearTimeout(bomSearchTimers.current[rowKey])
    bomSearchTimers.current[rowKey] = setTimeout(async () => {
      try {
        const url = q.trim()
          ? `/api/items?search=${encodeURIComponent(q)}&category=PRODUCT,ASSEMBLY&limit=12`
          : `/api/items?category=PRODUCT,ASSEMBLY&limit=12&sortBy=createdAt&sortOrder=desc`
        const res = await fetch(url)
        const json = await res.json()
        if (json.success) {
          setBomSearches(prev => ({ ...prev, [rowKey]: { ...(prev[rowKey] ?? { query: q, results: [], open: true }), results: json.data.items, open: true } }))
        }
      } catch {}
    }, q.trim() ? 250 : 0)
  }, [])

  // rows 또는 bulkType이 바뀔 때마다 고유 베이스 코드의 다음 리비전을 DB에서 조회 (debounce 600ms)
  useEffect(() => {
    if (!bulkType || bulkType === 'CELL') return
    if (revFetchTimer.current) clearTimeout(revFetchTimer.current)
    revFetchTimer.current = setTimeout(async () => {
      const baseCodes = new Set<string>()
      for (const row of rows) {
        const base = computeBaseCode(row, bulkType)
        if (base) baseCodes.add(base)
      }
      if (baseCodes.size === 0) return
      const entries: Record<string, number> = {}
      await Promise.all([...baseCodes].map(async bc => {
        try {
          const res = await fetch(`/api/items/next-revision?baseCode=${encodeURIComponent(bc)}`)
          const json = await res.json()
          if (json.success) entries[bc] = json.data.nextRevision
        } catch {}
      }))
      setDbNextRevMap(prev => ({ ...prev, ...entries }))
    }, 600)
    return () => { if (revFetchTimer.current) clearTimeout(revFetchTimer.current) }
  }, [rows, bulkType])

  const makeRowForType = useCallback((type: BulkType, sub: string) => (): BulkRow => {
    if (type === 'CHARGER') return { ...emptyRow(), subCategory: 'EL', thirdLevel: 'CH' }
    return { ...emptyRow(), subCategory: sub }
  }, [])

  const selectType = (type: BulkType, sub = '') => {
    setBulkType(type)
    setFixedSub(sub)
    setRows(Array.from({ length: 10 }, makeRowForType(type, sub)))
    setSelectedKeys(new Set())
  }

  const upd = (key: string, field: keyof Omit<BulkRow, '_key' | 'error'>, val: any) =>
    setRows(prev => prev.map(r => r._key === key ? { ...r, [field]: val, error: undefined } : r))

  const updSub = (key: string, sub: string) =>
    setRows(prev => prev.map(r => r._key === key ? { ...r, subCategory: sub, thirdLevel: '', error: undefined } : r))

  const updCellMfr = (key: string, mfr: string) =>
    setRows(prev => prev.map(r => r._key === key ? { ...r, cellManufacturer: mfr, cellModel: '', error: undefined } : r))

  const updBatteryCount = (key: string, field: 'seriesCount' | 'parallelCount', val: string) =>
    setRows(prev => prev.map(r => {
      if (r._key !== key) return r
      const newS = field === 'seriesCount' ? val : r.seriesCount
      const newP = field === 'parallelCount' ? val : r.parallelCount
      const autoName = (newS && newP) ? `${newS}S ${newP}P 배터리팩` : ''
      const nameIsAuto = !r.itemName || /^\d+S \d+P 배터리팩$/.test(r.itemName)
      const elecSpecs = computeElecSpecs(newS, newP, r._cellSpecs ?? null, r.layerCount ?? '')
      return {
        ...r,
        [field]: val,
        itemName: (nameIsAuto && autoName) ? autoName : r.itemName,
        ...elecSpecs,
        error: undefined,
      }
    }))

  const updChargerField = (key: string, field: 'chemistryType' | 'seriesCount' | 'chargeCutoffVoltage' | 'continuousChargeCurrent', val: string) =>
    setRows(prev => prev.map(r => {
      if (r._key !== key) return r
      const newChem = field === 'chemistryType' ? val : r.chemistryType
      const newS = field === 'seriesCount' ? val : r.seriesCount
      const newV = field === 'chargeCutoffVoltage' ? val : r.chargeCutoffVoltage
      const newA = field === 'continuousChargeCurrent' ? val : r.continuousChargeCurrent
      const parts = [newS && `${newS}S`, newV && `${newV}V`, newA && `${newA}A`].filter(Boolean)
      const prefix = newChem ? `${newChem} ` : ''
      const autoName = (newChem || parts.length > 0) ? `${prefix}충전기${parts.length ? ' ' + parts.join(' ') : ''}` : ''
      const nameIsAuto = !r.itemName || /^(\S+ )?충전기( \d+(\.\d+)?[SVA])*$/.test(r.itemName)
      return { ...r, [field]: val, itemName: nameIsAuto && autoName ? autoName : r.itemName, error: undefined }
    }))

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    setRows(prev => {
      if (idx >= prev.length - 1) {
        const row = bulkType ? makeRowForType(bulkType, fixedSub)() : emptyRow()
        setTimeout(() => nameRefs.current[row._key]?.focus(), 30)
        return [...prev, row]
      }
      const next = prev[idx + 1]
      if (next) setTimeout(() => nameRefs.current[next._key]?.focus(), 0)
      return prev
    })
  }

  const deleteSelected = () => {
    if (!confirm(`${selectedKeys.size}개 행을 삭제하시겠습니까?`)) return
    setRows(prev => prev.filter(r => !selectedKeys.has(r._key)))
    setSelectedKeys(new Set())
  }

  const filledRows = rows.filter(r => r.itemName.trim())
  const allSel = rows.length > 0 && rows.every(r => selectedKeys.has(r._key))
  const toggleAll = () => setSelectedKeys(allSel ? new Set() : new Set(rows.map(r => r._key)))
  const toggleRow = (key: string) => setSelectedKeys(prev => {
    const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s
  })

  const triggerDrawingUpload = (rowKey: string) => {
    uploadTargetKey.current = rowKey
    drawingsInputRef.current?.click()
  }

  const triggerSpecSheetUpload = (rowKey: string) => {
    specSheetTargetKey.current = rowKey
    specSheetInputRef.current?.click()
  }

  const handleSpecSheetFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    const key = specSheetTargetKey.current
    e.target.value = ''
    if (!files?.length || !key) return
    setUploadingSpecKey(key)
    try {
      const fd = new FormData()
      Array.from(files).forEach(f => fd.append('files', f))
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.success) {
        setRows(prev => prev.map(r => r._key === key ? { ...r, specSheets: [...r.specSheets, ...json.data.urls] } : r))
        toast.success(`${json.data.urls.length}개 스펙시트 업로드됨`)
      } else toast.error(json.message)
    } catch { toast.error('업로드 실패') }
    finally { setUploadingSpecKey(null); specSheetTargetKey.current = null }
  }

  const handleDrawingFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    const key = uploadTargetKey.current
    e.target.value = ''
    if (!files?.length || !key) return
    setUploadingKey(key)
    try {
      const fd = new FormData()
      Array.from(files).forEach(f => fd.append('files', f))
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.success) {
        setRows(prev => prev.map(r => r._key === key ? { ...r, drawings: [...r.drawings, ...json.data.urls] } : r))
        toast.success(`${json.data.urls.length}개 도면 업로드됨`)
      } else toast.error(json.message)
    } catch { toast.error('업로드 실패') }
    finally { setUploadingKey(null); uploadTargetKey.current = null }
  }

  const handleSubmit = async () => {
    if (!bulkType) return
    if (filledRows.length === 0) { toast.error('등록할 품목이 없습니다.'); return }
    const needSub = bulkType !== 'CELL' && bulkType !== 'CHARGER'
    const invalid = filledRows.filter(r =>
      !r.unit ||
      (needSub && !r.subCategory) ||
      (bulkType === 'CHARGER' && (!r.chemistryType || !r.seriesCount || !r.chargeCutoffVoltage || !r.continuousChargeCurrent))
    )
    if (invalid.length > 0) {
      setRows(prev => prev.map(r => {
        if (!r.itemName.trim()) return r
        if (needSub && !r.subCategory) return { ...r, error: '중분류 필수' }
        if (!r.unit) return { ...r, error: '단위 필수' }
        if (bulkType === 'CHARGER' && (!r.chemistryType || !r.seriesCount || !r.chargeCutoffVoltage || !r.continuousChargeCurrent))
          return { ...r, error: '화학계·직렬 수·충전종료전압·충전전류 필수' }
        return r
      }))
      toast.error('필수 항목을 입력해주세요.')
      return
    }

    setSaving(true)
    const { category } = TYPE_INFO[bulkType]

    // Step 1: 각 행의 베이스 코드 계산 (버전 접미사 제거)
    const baseCodeByKey = new Map<string, string>()
    for (const row of filledRows) {
      const sub = bulkType === 'CELL' ? 'CL' : row.subCategory
      let code1: string
      switch (bulkType) {
        case 'BATTERY':
          code1 = buildItemCode(buildCodeParts({ category, subCategory: sub, chemistryType: row.chemistryType || undefined, cellModel: row.cellModel || undefined, seriesCount: row.seriesCount ? Number(row.seriesCount) : undefined, parallelCount: row.parallelCount ? Number(row.parallelCount) : undefined, circuit: row.circuit || undefined, revisionNumber: 1 }))
          break
        case 'BMS':
          code1 = buildBmsCode({ category, subCategory: sub, manufacturer: row.manufacturer || undefined, maxSeriesCount: row.maxSeriesCount ? Number(row.maxSeriesCount) : undefined, continuousDischargeCurrent: row.continuousDischargeCurrent ? Number(row.continuousDischargeCurrent) : undefined, revisionNumber: 1 })
          break
        case 'CELL':
          code1 = buildCellCode({ category, chemistryType: row.chemistryType || undefined, cellModel: row.cellModel || undefined })
          break
        case 'COMPONENT_OTHER':
          code1 = buildComponentCode({ category, subCategory: sub, formFactor: row.thirdLevel || undefined, revisionNumber: 1 })
          break
        case 'CHARGER':
          code1 = buildComponentCode({ category, subCategory: 'EL', formFactor: 'CH', revisionNumber: 1 })
          break
        default:
          code1 = buildSimpleCode({ category, subCategory: sub, revisionNumber: 1 })
      }
      // CELL은 버전이 없으므로 전체 코드가 베이스, 나머지는 마지막 세그먼트 제거
      const base = bulkType === 'CELL' ? code1 : code1.split('-').slice(0, -1).join('-')
      baseCodeByKey.set(row._key, base)
    }

    // Step 2: 고유 베이스 코드에 대해 DB(히스토리 포함)에서 다음 리비전 일괄 조회
    const nextRevMap: Record<string, number> = {}
    if (bulkType !== 'CELL') {
      const uniqueBases = [...new Set(baseCodeByKey.values())]
      await Promise.all(uniqueBases.map(async bc => {
        try {
          const res = await fetch(`/api/items/next-revision?baseCode=${encodeURIComponent(bc)}`)
          const json = await res.json()
          nextRevMap[bc] = json.success ? json.data.nextRevision : 1
        } catch {
          nextRevMap[bc] = 1
        }
      }))
    }

    // Step 3: 배치 내 동일 베이스 코드 오프셋 (배치 내 중복 시 순차 증가)
    const batchOffset: Record<string, number> = {}
    let successCount = 0

    for (const row of filledRows) {
      const sub = bulkType === 'CELL' ? 'CL' : row.subCategory
      const base = baseCodeByKey.get(row._key)!

      let itemCode: string
      let revisionNumber: number

      if (bulkType === 'CELL') {
        itemCode = base
        revisionNumber = 1
      } else {
        const dbNext = nextRevMap[base] ?? 1
        const offset = batchOffset[base] ?? 0
        revisionNumber = dbNext + offset
        batchOffset[base] = offset + 1

        switch (bulkType) {
          case 'BATTERY':
            itemCode = buildItemCode(buildCodeParts({ category, subCategory: sub, chemistryType: row.chemistryType || undefined, cellModel: row.cellModel || undefined, seriesCount: row.seriesCount ? Number(row.seriesCount) : undefined, parallelCount: row.parallelCount ? Number(row.parallelCount) : undefined, circuit: row.circuit || undefined, revisionNumber }))
            break
          case 'BMS':
            itemCode = buildBmsCode({ category, subCategory: sub, manufacturer: row.manufacturer || undefined, maxSeriesCount: row.maxSeriesCount ? Number(row.maxSeriesCount) : undefined, continuousDischargeCurrent: row.continuousDischargeCurrent ? Number(row.continuousDischargeCurrent) : undefined, revisionNumber })
            break
          case 'COMPONENT_OTHER':
            itemCode = buildComponentCode({ category, subCategory: sub, formFactor: row.thirdLevel || undefined, revisionNumber })
            break
          case 'CHARGER':
            itemCode = buildComponentCode({ category, subCategory: 'EL', formFactor: 'CH', revisionNumber })
            break
          default:
            itemCode = buildSimpleCode({ category, subCategory: sub, revisionNumber })
        }
      }

      const payload: Record<string, any> = {
        category, subCategory: sub,
        itemName: row.itemName.trim(), unit: row.unit,
        memo: row.memo || null, revisionNumber, itemCode, status: 'ACTIVE',
        vendors: row.vendors,
      }

      switch (bulkType) {
        case 'BATTERY':
          Object.assign(payload, {
            chemistryType: row.chemistryType || null, cellModel: row.cellModel || null,
            seriesCount: ni(row.seriesCount), parallelCount: ni(row.parallelCount),
            circuit: row.circuit || null, specialOptions: row.specialOptions,
            certifications: row.certifications, drawings: row.drawings,
            dischargeCutoffVoltage: n(row.dischargeCutoffVoltage),
            nominalVoltage:         n(row.nominalVoltage),
            chargeCutoffVoltage:    n(row.chargeCutoffVoltage),
            nominalCapacity:        n(row.nominalCapacity),
            energy:                 n(row.energy),
            maxChargeCurrent:       n(row.maxChargeCurrent),
            maxDischargeCurrent:    n(row.maxDischargeCurrent),
          })
          break
        case 'BMS':
          Object.assign(payload, { manufacturer: row.manufacturer || null, maxSeriesCount: ni(row.maxSeriesCount), continuousDischargeCurrent: n(row.continuousDischargeCurrent), specialOptions: row.specialOptions })
          break
        case 'CELL':
          Object.assign(payload, {
            chemistryType: row.chemistryType || null,
            cellModel: row.cellModel || null,
            dischargeCutoffVoltage: n(row.dischargeCutoffVoltage),
            nominalVoltage: n(row.nominalVoltage),
            chargeCutoffVoltage: n(row.chargeCutoffVoltage),
            nominalCapacity: n(row.nominalCapacity),
            energy: n(row.energy),
            maxChargeCurrent: n(row.maxChargeCurrent),
            maxDischargeCurrent: n(row.maxDischargeCurrent),
            continuousChargeCurrent: n(row.continuousChargeCurrent),
            continuousDischargeCurrent: n(row.continuousDischargeCurrent),
            chargeCRate: n(row.chargeCRate),
            dischargeCRate: n(row.dischargeCRate),
            weight: n(row.weight),
            specSheets: row.specSheets,
          })
          break
        case 'COMPONENT_OTHER': {
          const thirdDef = THIRD_LEVEL[sub]
          const thirdField = thirdDef?.field
          Object.assign(payload, {
            ...(thirdField ? { [thirdField]: row.thirdLevel || null } : {}),
            length: n(row.length), width: n(row.width), height: n(row.height),
            diameter: n(row.diameter),
            innerLength: n(row.innerLength), innerWidth: n(row.innerWidth), innerHeight: n(row.innerHeight),
            weight: n(row.weight), thickness: n(row.thickness),
            material: row.material || null, color: row.color || null,
            ratedCurrent: n(row.ratedCurrent),
          })
          break
        }
        case 'CHARGER':
          Object.assign(payload, {
            formFactor: 'CH',
            chemistryType: row.chemistryType || null,
            seriesCount: ni(row.seriesCount),
            chargeCutoffVoltage: n(row.chargeCutoffVoltage),
            continuousChargeCurrent: n(row.continuousChargeCurrent),
          })
          break
      }

      try {
        const res = await fetch('/api/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        const json = await res.json()
        if (json.success) {
          successCount++
          if (row.bomParent?.id) {
            try {
              await fetch(`/api/items/${row.bomParent.id}/bom`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ childId: json.data.id, quantity: 1, unit: row.unit }),
              })
            } catch {}
          }
        } else {
          setRows(prev => prev.map(r => r._key === row._key ? { ...r, error: json.message } : r))
        }
      } catch {
        setRows(prev => prev.map(r => r._key === row._key ? { ...r, error: '서버 오류' } : r))
      }
    }

    setSaving(false)
    const errCount = filledRows.length - successCount
    if (successCount > 0) {
      toast.success(`${successCount}개 품목 등록됨${errCount > 0 ? ` (${errCount}개 실패)` : ''}`)
      onSaved()
      if (errCount === 0) onClose()
    } else {
      toast.error('등록에 실패했습니다.')
    }
  }

  if (!open) return null

  const subOpts   = bulkType ? getSubOpts(bulkType, subMap) : []

  // COMPONENT_OTHER 소분류 전체 옵션 (CL 제외, 정적+동적 모두 포함) — runtime 계산
  const compOtherSubs = (subMap['COMPONENT'] ?? []).filter(o => o.value !== 'CL').map(o => o.value)
  const allThirdOpts: SelectOption[] = compOtherSubs.flatMap(sub => {
    const def = THIRD_LEVEL[sub]
    if (!def) return []
    if (def.staticOptions) return def.staticOptions
    if (def.optKey) return opts[def.optKey] ?? []
    return []
  })
  // 소분류 값 → 중분류 역방향 맵
  const thirdToSubMap: Record<string, string> = {}
  compOtherSubs.forEach(sub => {
    const def = THIRD_LEVEL[sub]
    if (!def) return
    const options = def.staticOptions ?? (def.optKey ? opts[def.optKey] ?? [] : [])
    options.forEach(o => { thirdToSubMap[o.value] = sub })
  })
  const info      = bulkType ? TYPE_INFO[bulkType] : null
  const dialogW   = bulkType ? DIALOG_W[bulkType] : 780
  const codeColW  = bulkType === 'BATTERY' ? 185
                  : bulkType === 'BMS'      ? 140
                  : bulkType === 'CELL'     ? 130
                  : bulkType === 'COMPONENT_OTHER' ? 100
                  : bulkType === 'CHARGER'  ? 120
                  : 90 // ASSEMBLY_OTHER
  // ASSEMBLY_OTHER: 영문 긴 라벨(Power Relay Assembly 등) 대응
  // COMPONENT_OTHER: 한글 라벨 + 소분류까지 고려 (코드 포함 표시로 길어짐)
  const subColW   = bulkType === 'ASSEMBLY_OTHER'   ? 200
                  : bulkType === 'COMPONENT_OTHER'  ? 170
                  : 110

  const thL  = 'px-1.5 py-2.5 text-left text-[11px] text-gray-600 font-semibold whitespace-nowrap'
  const thSm = 'px-1 py-2.5 text-center text-[11px] text-gray-600 font-semibold whitespace-nowrap'
  const cellCls = 'h-7 w-full rounded border-0 bg-transparent px-1.5 text-xs focus:bg-white focus:ring-1 focus:ring-blue-400 focus:outline-none hover:bg-gray-50 transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: dialogW, maxWidth: '97vw', height: 740 }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-gray-50 to-white shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-gray-900">품목 일괄 등록</h2>
            {info && (
              <>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${info.badgeCls}`}>
                  {({ BP: '배터리팩', PO: '소프트팩', BM: 'BMS', PC: 'PCM' } as Record<string,string>)[fixedSub] ?? info.label}
                </span>
                <button className="text-xs text-gray-400 hover:text-gray-600 underline" onClick={() => { setBulkType(null); setFixedSub(''); setRows([]) }}>유형 변경</button>
              </>
            )}
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 text-lg leading-none">×</button>
        </div>

        {/* 유형 선택 화면 */}
        {!bulkType ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-8 px-8">
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-800">등록할 품목 유형을 선택하세요</p>
              <p className="text-xs text-gray-400 mt-1">같은 유형의 품목만 동시에 등록할 수 있습니다</p>
            </div>
            <div className="flex flex-col gap-4 w-full max-w-2xl">
              {/* 완제품 */}
              <div className="flex items-center gap-4">
                <span className="w-16 text-right text-xs font-bold text-blue-500 shrink-0">완제품</span>
                <div className="flex gap-2">
                  <button onClick={() => selectType('BATTERY', 'BP')}
                    className="w-28 py-4 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 hover:shadow-md transition-all text-sm font-bold">
                    배터리팩
                  </button>
                </div>
              </div>
              {/* 반제품 */}
              <div className="flex items-center gap-4">
                <span className="w-16 text-right text-xs font-bold text-purple-500 shrink-0">반제품</span>
                <div className="flex gap-2">
                  {[
                    { label: '소프트팩', type: 'ASSEMBLY_OTHER' as BulkType, sub: 'PO' },
                    { label: 'BMS',    type: 'BMS' as BulkType,            sub: 'BM' },
                    { label: 'PCM',    type: 'BMS' as BulkType,            sub: 'PC' },
                    { label: '그 외',  type: 'ASSEMBLY_OTHER' as BulkType, sub: ''   },
                  ].map(({ label, type, sub }) => (
                    <button key={label} onClick={() => selectType(type, sub)}
                      className="w-28 py-4 rounded-xl border-2 border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 hover:shadow-md transition-all text-sm font-bold">
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {/* 자재 */}
              <div className="flex items-center gap-4">
                <span className="w-16 text-right text-xs font-bold text-emerald-500 shrink-0">자재</span>
                <div className="flex gap-2">
                  <button onClick={() => selectType('CELL', 'CL')}
                    className="w-28 py-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:shadow-md transition-all text-sm font-bold">
                    셀
                  </button>
                  <button onClick={() => selectType('CHARGER')}
                    className="w-28 py-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:shadow-md transition-all text-sm font-bold">
                    충전기
                  </button>
                  <button onClick={() => selectType('COMPONENT_OTHER')}
                    className="w-28 py-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:shadow-md transition-all text-sm font-bold">
                    그 외
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* 툴바 */}
            <div className="px-5 py-2 border-b bg-gray-50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">
                  {filledRows.length > 0 ? `${filledRows.length}개 입력됨` : ''}
                </span>
                {selectedKeys.size > 0 && (
                  <>
                    <span className="text-xs text-blue-600 font-medium">{selectedKeys.size}개 선택</span>
                    <Button variant="destructive" size="sm" className="h-6 text-xs px-3" onClick={deleteSelected}>선택 삭제</Button>
                    <button className="text-xs text-gray-400 hover:text-gray-600" onClick={() => setSelectedKeys(new Set())}>선택 해제</button>
                  </>
                )}
              </div>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" className="h-7 text-xs px-3" onClick={() => { const mk = bulkType ? makeRowForType(bulkType, fixedSub) : emptyRow; setRows(p => [...p, ...Array.from({ length: 5 }, mk)]) }}>+ 5행</Button>
                <Button variant="outline" size="sm" className="h-7 text-xs px-3" onClick={() => { const mk = bulkType ? makeRowForType(bulkType, fixedSub) : emptyRow; setRows(p => [...p, ...Array.from({ length: 10 }, mk)]) }}>+ 10행</Button>
              </div>
            </div>

            {/* 테이블 */}
            <div className="flex-1 overflow-auto min-h-0">
              <input type="file" ref={drawingsInputRef} multiple accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg,.svg,.xlsx,.xls,.step,.stp" className="hidden" onChange={handleDrawingFileChange} />
              <input type="file" ref={specSheetInputRef} multiple accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg" className="hidden" onChange={handleSpecSheetFileChange} />

              <table className="text-xs border-collapse" style={{ tableLayout: 'fixed', minWidth: DIALOG_W[bulkType] + 176 }}>
                <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="py-2.5 px-1 text-center" style={{ width: 30 }}>
                      <input type="checkbox" checked={allSel} onChange={toggleAll} className="rounded" />
                    </th>
                    <th className={thSm} style={{ width: 30 }}>NO</th>
                    <th className={thL}  style={{ width: codeColW }}>품목코드</th>
                    <th className={thL}  style={{ width: 64 }}>대분류</th>

                    {/* 중분류: CELL 제외 선택 가능, CELL은 고정 */}
                    {bulkType !== 'CELL' && <th className={thL} style={{ width: subColW }}>중분류 <span className="text-red-400">*</span></th>}
                    {bulkType === 'CELL'  && <th className={thL} style={{ width: 70 }}>중분류</th>}

                    {/* 소분류: COMPONENT_OTHER만 */}
                    {bulkType === 'COMPONENT_OTHER' && <th className={thL} style={{ width: subColW }}>소분류</th>}

                    {bulkType !== 'CELL' && <th className={thL} style={{ width: bulkType === 'BATTERY' || bulkType === 'CHARGER' ? 220 : undefined }}>품명 <span className="text-red-400">*</span></th>}

                    {/* BATTERY 전용 */}
                    {bulkType === 'BATTERY' && <th className={thSm} style={{ width: 220 }}>셀(CL) 선택</th>}
                    {bulkType === 'BATTERY' && <th className={thSm} style={{ width: 60 }}>직렬(S)</th>}
                    {bulkType === 'BATTERY' && <th className={thSm} style={{ width: 60 }}>병렬(P)</th>}
                    {bulkType === 'BATTERY' && <th className={thSm} style={{ width: 90 }}>회로</th>}

                    {/* BMS 전용 */}
                    {bulkType === 'BMS' && <th className={thSm} style={{ width: 110 }}>제조사</th>}
                    {bulkType === 'BMS' && <th className={thSm} style={{ width: 74 }}>최대직렬(S)</th>}
                    {bulkType === 'BMS' && <th className={thSm} style={{ width: 80 }}>연속방전(A)</th>}

                    {/* CELL 전용 */}
                    {bulkType === 'CELL' && <th className={thSm} style={{ width: 110 }}>화학계</th>}
                    {bulkType === 'CELL' && <th className={thSm} style={{ width: 110 }}>제조사</th>}
                    {bulkType === 'CELL' && <th className={thSm} style={{ width: 120 }}>셀 모델</th>}
                    {bulkType === 'CELL' && <th className={thL} style={{ width: 220 }}>품명 <span className="text-red-400">*</span></th>}
                    {bulkType === 'CELL' && <th className={thSm} style={{ width: 68 }}>방전종료전압(V)</th>}
                    {bulkType === 'CELL' && <th className={thSm} style={{ width: 68 }}>공칭전압(V)</th>}
                    {bulkType === 'CELL' && <th className={thSm} style={{ width: 68 }}>충전종료전압(V)</th>}
                    {bulkType === 'CELL' && <th className={thSm} style={{ width: 68 }}>공칭용량(Ah)</th>}
                    {bulkType === 'CELL' && <th className={thSm} style={{ width: 68 }}>에너지(Wh)</th>}
                    {bulkType === 'CELL' && <th className={thSm} style={{ width: 68 }}>피크충전(A)</th>}
                    {bulkType === 'CELL' && <th className={thSm} style={{ width: 68 }}>피크방전(A)</th>}
                    {bulkType === 'CELL' && <th className={thSm} style={{ width: 68 }}>연속충전(A)</th>}
                    {bulkType === 'CELL' && <th className={thSm} style={{ width: 68 }}>연속방전(A)</th>}
                    {bulkType === 'CELL' && <th className={thSm} style={{ width: 68 }}>충전C-rate</th>}
                    {bulkType === 'CELL' && <th className={thSm} style={{ width: 68 }}>방전C-rate</th>}
                    {bulkType === 'CELL' && <th className={thSm} style={{ width: 72 }}>무게(g)</th>}
                    {bulkType === 'CELL' && <th className={thSm} style={{ width: 80 }}>스펙시트</th>}

                    {/* COMPONENT_OTHER 전용 */}
                    {bulkType === 'COMPONENT_OTHER' && <th className={thSm} style={{ width: 64 }}>가로</th>}
                    {bulkType === 'COMPONENT_OTHER' && <th className={thSm} style={{ width: 64 }}>세로</th>}
                    {bulkType === 'COMPONENT_OTHER' && <th className={thSm} style={{ width: 64 }}>높이</th>}
                    {bulkType === 'COMPONENT_OTHER' && <th className={thSm} style={{ width: 64 }}>직경</th>}
                    {bulkType === 'COMPONENT_OTHER' && <th className={thSm} style={{ width: 70 }}>내경가로</th>}
                    {bulkType === 'COMPONENT_OTHER' && <th className={thSm} style={{ width: 70 }}>내경세로</th>}
                    {bulkType === 'COMPONENT_OTHER' && <th className={thSm} style={{ width: 70 }}>내경높이</th>}
                    {bulkType === 'COMPONENT_OTHER' && <th className={thSm} style={{ width: 64 }}>무게</th>}
                    {bulkType === 'COMPONENT_OTHER' && <th className={thSm} style={{ width: 64 }}>두께</th>}
                    {bulkType === 'COMPONENT_OTHER' && <th className={thSm} style={{ width: 90 }}>재질</th>}
                    {bulkType === 'COMPONENT_OTHER' && <th className={thSm} style={{ width: 90 }}>색상</th>}
                    {bulkType === 'COMPONENT_OTHER' && <th className={thSm} style={{ width: 70 }}>정격전류(A)</th>}

                    {/* CHARGER 전용 */}
                    {bulkType === 'CHARGER' && <th className={thSm} style={{ width: 110 }}>화학계 <span className="text-red-400">*</span></th>}
                    {bulkType === 'CHARGER' && <th className={thSm} style={{ width: 70 }}>직렬 수(S) <span className="text-red-400">*</span></th>}
                    {bulkType === 'CHARGER' && <th className={thSm} style={{ width: 90 }}>충전종료전압(V) <span className="text-red-400">*</span></th>}
                    {bulkType === 'CHARGER' && <th className={thSm} style={{ width: 80 }}>충전전류(A) <span className="text-red-400">*</span></th>}

                    {/* 공통 */}
                    <th className={thL} style={{ width: 80 }}>단위 <span className="text-red-400">*</span></th>
                    {(bulkType === 'BATTERY' || bulkType === 'BMS') && <th className={thSm} style={{ width: 130 }}>특수옵션</th>}
                    {bulkType === 'BATTERY' && <th className={thSm} style={{ width: 120 }}>인증</th>}
                    {bulkType === 'BATTERY' && <th className={thSm} style={{ width: 64 }}>도면</th>}
                    {bulkType !== 'COMPONENT_OTHER' && bulkType !== 'CELL' && <th className={thSm} style={{ width: 130 }}>고객사</th>}
                    <th className={thL} style={{ width: 120 }}>비고</th>
                    <th className={thL} style={{ width: 180 }}>BOM 연결 <span className="text-gray-400 font-normal">(완제품/반제품)</span></th>
                    <th className={thSm} style={{ width: 52 }}>작업</th>
                  </tr>
                </thead>

                <tbody>
                  {(() => {
                    // 행별 미리보기 리비전: DB 기준 다음 번호 + 배치 내 오프셋
                    const rowPreviewRevs = new Map<string, number>()
                    if (bulkType && bulkType !== 'CELL') {
                      const batchOffset: Record<string, number> = {}
                      for (const row of rows) {
                        const base = computeBaseCode(row, bulkType)
                        if (!base) continue
                        const dbNext = dbNextRevMap[base] ?? 1
                        const offset = batchOffset[base] ?? 0
                        rowPreviewRevs.set(row._key, dbNext + offset)
                        batchOffset[base] = offset + 1
                      }
                    }
                    return rows.map((row, idx) => {
                    const filled = !!row.itemName.trim()
                    const isSel  = selectedKeys.has(row._key)
                    const bg = row.error ? 'bg-red-50' : isSel ? 'bg-blue-50' : filled ? 'bg-blue-50/20' : ''
                    const previewRev = rowPreviewRevs.get(row._key) ?? 1
                    const code = previewCode(row, bulkType, previewRev)
                    const codeGrey = code.includes('?') || code === '—'

                    // 셀모델 옵션 (manufacturer 기준 필터)
                    const mfrOpts: SelectOption[] = cellMfrGroups.map(g => ({ value: g.manufacturer, label: g.manufacturer, colorIndex: g.colorIndex ?? 0 }))
                    const mfrGroup  = cellMfrGroups.find(g => g.manufacturer === row.cellManufacturer)
                    const modelOpts: SelectOption[] = mfrGroup ? mfrGroup.models.map(m => ({ value: m.value, label: m.label, colorIndex: m.colorIndex ?? 0 })) : []

                    // 소분류(3분류) 옵션 for COMPONENT_OTHER
                    const thirdDef  = row.subCategory ? (THIRD_LEVEL[row.subCategory] ?? null) : null
                    const thirdOpts: SelectOption[] = !row.subCategory
                      ? allThirdOpts
                      : thirdDef
                        ? (thirdDef.staticOptions ?? (thirdDef.optKey ? opts[thirdDef.optKey] ?? [] : []))
                        : []
                    const canAddThird = !!row.subCategory && thirdDef && !thirdDef.staticOptions && !!thirdDef.optKey

                    // 셀 헬퍼: TagSelect cell
                    const ts = (w: number, val: string, onChange: (v: string) => void, optList: SelectOption[], optKey: string, ph = '—', disabled = false) => (
                      <td className="px-0.5 py-0.5 border-r border-gray-100" style={{ width: w }}>
                        <TagSelect value={val} onChange={onChange} options={optList} disabled={disabled}
                          onAdd={(lbl, code) => { addOption(optKey, lbl, code); reloadOpts() }}
                          placeholder={ph} portal size="sm" />
                      </td>
                    )
                    // 셀 헬퍼: TagMultiSelect cell
                    const tms = (w: number, val: string[], onChange: (v: string[]) => void, optList: SelectOption[], optKey: string, ph = '—') => (
                      <td className="px-0.5 py-0.5 border-r border-gray-100" style={{ width: w }}>
                        <TagMultiSelect value={val} onChange={onChange} options={optList}
                          onAdd={lbl => { addOption(optKey, lbl); reloadOpts() }}
                          placeholder={ph} portal size="sm" />
                      </td>
                    )
                    // 셀 헬퍼: number input
                    type UpdField = keyof Omit<BulkRow, '_key' | 'error'>
                    const num = (w: number, field: UpdField, ph = '') => (
                      <td className="px-0.5 py-0.5 border-r border-gray-100" style={{ width: w }}>
                        <input type="number" step="any" value={row[field] as string} onChange={e => upd(row._key, field, e.target.value)} onWheel={e => e.currentTarget.blur()} placeholder={ph} className={cellCls + ' text-right'} />
                      </td>
                    )

                    return (
                      <tr key={row._key} className={`border-b border-gray-100 transition-colors ${bg}`}>
                        {/* ☐ */}
                        <td className="py-1 text-center" style={{ width: 30 }}>
                          <input type="checkbox" checked={isSel} onChange={() => toggleRow(row._key)} className="rounded" />
                        </td>
                        {/* NO */}
                        <td className="py-1 text-center text-gray-400 text-[11px] tabular-nums" style={{ width: 30 }}>{idx + 1}</td>

                        {/* 품목코드 미리보기 */}
                        <td className="px-2 py-1 border-r border-gray-100" style={{ width: codeColW }}>
                          <span className={`font-mono text-[10px] break-all ${codeGrey ? 'text-gray-300' : 'text-gray-600'}`}>{code}</span>
                        </td>

                        {/* 대분류 static badge */}
                        <td className="px-1.5 py-1" style={{ width: 64 }}>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${CAT_BADGE[info!.category]}`}>{CAT_LABEL[info!.category]}</span>
                        </td>

                        {/* 중분류 */}
                        {bulkType !== 'CELL' && bulkType !== 'CHARGER' && (
                          <td className="px-0.5 py-0.5 border-r border-gray-100" style={{ width: subColW }}>
                            <TagSelect value={row.subCategory} onChange={v => updSub(row._key, v)} options={subOpts}
                              onAdd={() => {}} placeholder="선택" portal size="sm"
                              minDropdownWidth={bulkType === 'ASSEMBLY_OTHER' ? 240 : 180} />
                          </td>
                        )}
                        {bulkType === 'CHARGER' && (
                          <td className="px-1.5 py-1" style={{ width: subColW }}>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-emerald-100 text-emerald-700">전장(EL)</span>
                          </td>
                        )}
                        {bulkType === 'CELL' && (
                          <td className="px-1.5 py-1" style={{ width: 70 }}>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-emerald-100 text-emerald-700">셀(CL)</span>
                          </td>
                        )}

                        {/* 소분류 (COMPONENT_OTHER) */}
                        {bulkType === 'COMPONENT_OTHER' && (
                          <td className="px-0.5 py-0.5 border-r border-gray-100" style={{ width: subColW }}>
                            {thirdOpts.length > 0
                              ? <TagSelect value={row.thirdLevel}
                                  onChange={v => {
                                    const autoSub = !row.subCategory ? (thirdToSubMap[v] ?? '') : ''
                                    if (autoSub) {
                                      setRows(prev => prev.map(r => r._key === row._key
                                        ? { ...r, subCategory: autoSub, thirdLevel: v, error: undefined } : r))
                                    } else {
                                      upd(row._key, 'thirdLevel', v)
                                    }
                                  }}
                                  options={thirdOpts}
                                  onAdd={canAddThird ? (lbl, code) => { addOption(thirdDef!.optKey!, lbl, code); reloadOpts() } : () => {}}
                                  requireCode={!!(canAddThird && (thirdDef?.optKey === 'elComponentType' || thirdDef?.optKey === 'meComponentType'))}
                                  placeholder="—" portal size="sm" minDropdownWidth={280} />
                              : <span className="text-gray-300 text-xs px-2 block py-1.5">—</span>}
                          </td>
                        )}

                        {/* 품명 (CELL 제외) */}
                        {bulkType !== 'CELL' && (
                          <td className="px-0.5 py-0.5 border-r border-gray-100" style={{ width: bulkType === 'BATTERY' || bulkType === 'CHARGER' ? 220 : undefined }}>
                            {row.error
                              ? <span className="px-2 text-xs text-red-500 block py-1.5">{row.error}</span>
                              : <input
                                  ref={el => { nameRefs.current[row._key] = el }}
                                  value={row.itemName}
                                  onChange={e => upd(row._key, 'itemName', e.target.value)}
                                  onKeyDown={e => handleKeyDown(e, idx)}
                                  placeholder="품목명 입력"
                                  className={cellCls}
                                />}
                          </td>
                        )}

                        {/* ── BATTERY 전용: CL 품목 선택 ── */}
                        {bulkType === 'BATTERY' && (() => {
                          const clState = clSearches[row._key]
                          const selectedCL = clState?.selected ?? null
                          return (
                            <td className="px-0.5 py-0.5 border-r border-gray-100" style={{ width: 220 }}>
                              <div className="relative" ref={el => { clDropdownRefs.current[row._key] = el }}>
                                {selectedCL ? (
                                  <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 border border-blue-200 rounded text-[10px]">
                                    <span className="font-mono text-blue-700 truncate flex-1">{selectedCL.itemCode}</span>
                                    <button type="button"
                                      onClick={() => setClSearches(prev => ({ ...prev, [row._key]: { query: '', results: [], open: false, selected: null } }))}
                                      className="text-blue-400 hover:text-blue-600 shrink-0">×</button>
                                  </div>
                                ) : (
                                  <input
                                    value={clState?.query ?? ''}
                                    onChange={e => {
                                      const q = e.target.value
                                      setClSearches(prev => ({ ...prev, [row._key]: { ...(prev[row._key] ?? { query: '', results: [], open: false, selected: null }), query: q } }))
                                      doClSearch(row._key, q)
                                    }}
                                    onFocus={() => {
                                      doClSearch(row._key, clState?.query ?? '', true)
                                    }}
                                    onBlur={() => setTimeout(() => {
                                      setClSearches(prev => {
                                        if (!prev[row._key]?.open) return prev
                                        return { ...prev, [row._key]: { ...prev[row._key], open: false } }
                                      })
                                    }, 200)}
                                    placeholder="클릭 시 목록 표시 · 입력 검색"
                                    className={cellCls}
                                  />
                                )}
                                {!selectedCL && clState?.open && clState.results.length > 0 && (
                                  <div className="absolute left-0 top-full mt-0.5 bg-white border rounded shadow-lg z-50 w-64 max-h-40 overflow-auto">
                                    {clState.results.map((item: any) => (
                                      <button key={item.id} type="button"
                                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2"
                                        onClick={() => {
                                          setClSearches(prev => ({ ...prev, [row._key]: { query: '', results: [], open: false, selected: item } }))
                                          const cellSpecs = {
                                            dischargeCutoffVoltage: item.dischargeCutoffVoltage ?? null,
                                            nominalVoltage:         item.nominalVoltage         ?? null,
                                            chargeCutoffVoltage:    item.chargeCutoffVoltage    ?? null,
                                            nominalCapacity:        item.nominalCapacity        ?? null,
                                            maxChargeCurrent:       item.maxChargeCurrent       ?? null,
                                            maxDischargeCurrent:    item.maxDischargeCurrent    ?? null,
                                          }
                                          const elecSpecs = computeElecSpecs(row.seriesCount, row.parallelCount, cellSpecs, row.layerCount)
                                          setRows(prev => prev.map(r => r._key === row._key ? {
                                            ...r,
                                            chemistryType: item.chemistryType || r.chemistryType,
                                            cellModel:     item.cellModel     || r.cellModel,
                                            _cellSpecs: cellSpecs,
                                            ...elecSpecs,
                                          } : r))
                                        }}
                                      >
                                        <span className="font-mono text-gray-500 shrink-0 text-[10px]">{item.itemCode}</span>
                                        <span className="text-gray-700 truncate">{item.itemName}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                          )
                        })()}
                        {/* ── BATTERY 전용 ── */}
                        {bulkType === 'BATTERY' && (
                          <td className="px-0.5 py-0.5 border-r border-gray-100" style={{ width: 60 }}>
                            <input type="number" step="any" value={row.seriesCount} onChange={e => updBatteryCount(row._key, 'seriesCount', e.target.value)} onWheel={e => e.currentTarget.blur()} placeholder="S" className={cellCls + ' text-right'} />
                          </td>
                        )}
                        {bulkType === 'BATTERY' && (
                          <td className="px-0.5 py-0.5 border-r border-gray-100" style={{ width: 60 }}>
                            <input type="number" step="any" value={row.parallelCount} onChange={e => updBatteryCount(row._key, 'parallelCount', e.target.value)} onWheel={e => e.currentTarget.blur()} placeholder="P" className={cellCls + ' text-right'} />
                          </td>
                        )}
                        {bulkType === 'BATTERY' && ts(90, row.circuit, v => upd(row._key, 'circuit', v), opts.circuit ?? [], 'circuit', '회로')}

                        {/* ── BMS 전용 ── */}
                        {bulkType === 'BMS' && ts(110, row.manufacturer, v => upd(row._key, 'manufacturer', v), opts.manufacturer ?? [], 'manufacturer', '제조사')}
                        {bulkType === 'BMS' && num(74, 'maxSeriesCount', 'S')}
                        {bulkType === 'BMS' && num(80, 'continuousDischargeCurrent', 'A')}

                        {/* ── CELL 전용 ── */}
                        {bulkType === 'CELL' && ts(110, row.chemistryType, v => upd(row._key, 'chemistryType', v), opts.chemistryType ?? [], 'chemistryType', '화학계')}
                        {bulkType === 'CELL' && (
                          <td className="px-0.5 py-0.5 border-r border-gray-100" style={{ width: 110 }}>
                            <TagSelect value={row.cellManufacturer} onChange={v => updCellMfr(row._key, v)} options={mfrOpts}
                              onAdd={mfr => { addCellModelGroup(mfr); setCellMfrGroups([...getCellModelGroups()]); updCellMfr(row._key, mfr); saveToServer() }}
                              placeholder="셀제조사" portal size="sm" />
                          </td>
                        )}
                        {bulkType === 'CELL' && (
                          <td className="px-0.5 py-0.5 border-r border-gray-100" style={{ width: 120 }}>
                            <TagSelect value={row.cellModel} onChange={v => upd(row._key, 'cellModel', v)} options={modelOpts} disabled={!row.cellManufacturer}
                              onAdd={lbl => { if (row.cellManufacturer) setPendingCellModel({ rowKey: row._key, mfr: row.cellManufacturer, label: lbl, code: '' }) }}
                              placeholder="셀모델" portal size="sm" />
                          </td>
                        )}
                        {/* 품명 (CELL — 셀모델 오른쪽) */}
                        {bulkType === 'CELL' && (
                          <td className="px-0.5 py-0.5 border-r border-gray-100" style={{ width: 220 }}>
                            {row.error
                              ? <span className="px-2 text-xs text-red-500 block py-1.5">{row.error}</span>
                              : <input
                                  ref={el => { nameRefs.current[row._key] = el }}
                                  value={row.itemName}
                                  onChange={e => upd(row._key, 'itemName', e.target.value)}
                                  onKeyDown={e => handleKeyDown(e, idx)}
                                  placeholder="SDI INR21700-40T"
                                  className={cellCls}
                                />}
                          </td>
                        )}
                        {bulkType === 'CELL' && num(68, 'dischargeCutoffVoltage', '0.00')}
                        {bulkType === 'CELL' && num(68, 'nominalVoltage', '0.00')}
                        {bulkType === 'CELL' && num(68, 'chargeCutoffVoltage', '0.00')}
                        {bulkType === 'CELL' && num(68, 'nominalCapacity', '0.000')}
                        {bulkType === 'CELL' && num(68, 'energy', '0.00')}
                        {bulkType === 'CELL' && num(68, 'maxChargeCurrent', '0.00')}
                        {bulkType === 'CELL' && num(68, 'maxDischargeCurrent', '0.00')}
                        {bulkType === 'CELL' && num(68, 'continuousChargeCurrent', '0.00')}
                        {bulkType === 'CELL' && num(68, 'continuousDischargeCurrent', '0.00')}
                        {bulkType === 'CELL' && num(68, 'chargeCRate', '0.00')}
                        {bulkType === 'CELL' && num(68, 'dischargeCRate', '0.00')}
                        {bulkType === 'CELL' && num(72, 'weight', '0.00')}
                        {bulkType === 'CELL' && (
                          <td className="px-0.5 py-0.5 border-r border-gray-100 text-center" style={{ width: 80 }}>
                            <button onClick={() => triggerSpecSheetUpload(row._key)} disabled={uploadingSpecKey === row._key}
                              className="text-xs font-medium text-blue-500 hover:text-blue-700 disabled:opacity-50 py-1">
                              {uploadingSpecKey === row._key ? '...' : `📎 ${row.specSheets.length}`}
                            </button>
                          </td>
                        )}

                        {/* ── COMPONENT_OTHER 전용 ── */}
                        {bulkType === 'COMPONENT_OTHER' && num(64, 'length', '0.00')}
                        {bulkType === 'COMPONENT_OTHER' && num(64, 'width', '0.00')}
                        {bulkType === 'COMPONENT_OTHER' && num(64, 'height', '0.00')}
                        {bulkType === 'COMPONENT_OTHER' && num(64, 'diameter', '0.00')}
                        {bulkType === 'COMPONENT_OTHER' && num(70, 'innerLength', '0.00')}
                        {bulkType === 'COMPONENT_OTHER' && num(70, 'innerWidth', '0.00')}
                        {bulkType === 'COMPONENT_OTHER' && num(70, 'innerHeight', '0.00')}
                        {bulkType === 'COMPONENT_OTHER' && num(64, 'weight', '0.00')}
                        {bulkType === 'COMPONENT_OTHER' && num(64, 'thickness', '0.00')}
                        {bulkType === 'COMPONENT_OTHER' && ts(90, row.material, v => upd(row._key, 'material', v), opts.material ?? [], 'material', '재질')}
                        {bulkType === 'COMPONENT_OTHER' && ts(90, row.color, v => upd(row._key, 'color', v), opts.color ?? [], 'color', '색상')}
                        {bulkType === 'COMPONENT_OTHER' && num(70, 'ratedCurrent', '0.00')}

                        {/* ── CHARGER 전용 ── */}
                        {bulkType === 'CHARGER' && (
                          <td className="px-0.5 py-0.5 border-r border-gray-100" style={{ width: 110 }}>
                            <TagSelect value={row.chemistryType} onChange={v => updChargerField(row._key, 'chemistryType', v)}
                              options={opts.chemistryType ?? []}
                              onAdd={(lbl, code) => { addOption('chemistryType', lbl, code); reloadOpts() }}
                              placeholder="예) NMC" portal size="sm" />
                          </td>
                        )}
                        {bulkType === 'CHARGER' && (
                          <td className="px-0.5 py-0.5 border-r border-gray-100" style={{ width: 70 }}>
                            <input type="number" step="any" value={row.seriesCount}
                              onChange={e => updChargerField(row._key, 'seriesCount', e.target.value)}
                              onWheel={e => e.currentTarget.blur()} placeholder="S" className={cellCls + ' text-right'} />
                          </td>
                        )}
                        {bulkType === 'CHARGER' && (
                          <td className="px-0.5 py-0.5 border-r border-gray-100" style={{ width: 90 }}>
                            <input type="number" step="any" value={row.chargeCutoffVoltage}
                              onChange={e => updChargerField(row._key, 'chargeCutoffVoltage', e.target.value)}
                              onWheel={e => e.currentTarget.blur()} placeholder="0.00" className={cellCls + ' text-right'} />
                          </td>
                        )}
                        {bulkType === 'CHARGER' && (
                          <td className="px-0.5 py-0.5 border-r border-gray-100" style={{ width: 80 }}>
                            <input type="number" step="any" value={row.continuousChargeCurrent}
                              onChange={e => updChargerField(row._key, 'continuousChargeCurrent', e.target.value)}
                              onWheel={e => e.currentTarget.blur()} placeholder="0.00" className={cellCls + ' text-right'} />
                          </td>
                        )}

                        {/* 단위 (공통) */}
                        <td className="px-0.5 py-0.5 border-r border-gray-100" style={{ width: 80 }}>
                          <TagSelect value={row.unit} onChange={v => upd(row._key, 'unit', v)} options={opts.unit ?? []}
                            onAdd={(lbl, code) => { addOption('unit', lbl, code); reloadOpts() }}
                            placeholder="단위" portal size="sm" />
                        </td>

                        {/* 특수옵션 (BATTERY, BMS) */}
                        {(bulkType === 'BATTERY' || bulkType === 'BMS') && tms(130, row.specialOptions, v => upd(row._key, 'specialOptions', v), opts.specialOption ?? [], 'specialOption', '특수옵션')}

                        {/* 인증 (BATTERY) */}
                        {bulkType === 'BATTERY' && tms(120, row.certifications, v => upd(row._key, 'certifications', v), opts.certification ?? [], 'certification', '인증')}

                        {/* 도면 (BATTERY) */}
                        {bulkType === 'BATTERY' && (
                          <td className="px-0.5 py-0.5 border-r border-gray-100 text-center" style={{ width: 64 }}>
                            <button onClick={() => triggerDrawingUpload(row._key)} disabled={uploadingKey === row._key}
                              className="text-xs font-medium text-blue-500 hover:text-blue-700 disabled:opacity-50 py-1">
                              {uploadingKey === row._key ? '...' : `📎 ${row.drawings.length}`}
                            </button>
                          </td>
                        )}

                        {/* 고객사 (COMPONENT_OTHER, CELL 제외) */}
                        {bulkType !== 'COMPONENT_OTHER' && bulkType !== 'CELL' && tms(130, row.vendors, v => upd(row._key, 'vendors', v), opts.vendor ?? [], 'vendor', '고객사')}

                        {/* 비고 */}
                        <td className="px-0.5 py-0.5 border-r border-gray-100" style={{ width: 120 }}>
                          <input value={row.memo} onChange={e => upd(row._key, 'memo', e.target.value)} placeholder="비고" className={cellCls} />
                        </td>

                        {/* BOM 연결 */}
                        <td className="px-0.5 py-0.5 border-r border-gray-100" style={{ width: 180 }}>
                          {row.bomParent ? (
                            <div className="flex items-center h-7 px-1.5 gap-1 min-w-0">
                              <span className="font-mono text-[10px] text-gray-600 truncate min-w-0">{row.bomParent.itemCode}</span>
                              <button onClick={() => setRows(prev => prev.map(ro => ro._key === row._key ? { ...ro, bomParent: null } : ro))}
                                className="shrink-0 w-3.5 h-3.5 flex items-center justify-center text-gray-300 hover:text-red-400 text-xs leading-none">×</button>
                            </div>
                          ) : (
                            <div ref={el => { bomDropdownRefs.current[row._key] = el }} className="relative">
                              <div className="relative">
                                <svg className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-300 pointer-events-none"
                                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                  value={bomSearches[row._key]?.query ?? ''}
                                  onChange={e => {
                                    const q = e.target.value
                                    setBomSearches(prev => ({ ...prev, [row._key]: { ...(prev[row._key] ?? { query: '', results: [], open: false }), query: q, open: true } }))
                                    doBomSearch(row._key, q)
                                  }}
                                  onFocus={() => doBomSearch(row._key, bomSearches[row._key]?.query ?? '')}
                                  onBlur={() => setTimeout(() => {
                                    setBomSearches(prev => {
                                      if (!prev[row._key]?.open) return prev
                                      return { ...prev, [row._key]: { ...prev[row._key], open: false } }
                                    })
                                  }, 200)}
                                  placeholder="품번·품명 검색"
                                  className={cellCls + ' pl-5'}
                                />
                              </div>
                              {bomSearches[row._key]?.open && (
                                <div className="absolute top-full left-0 z-50 mt-1 border border-gray-200 rounded-lg bg-white shadow-xl overflow-hidden" style={{ width: 360, maxHeight: 200 }}>
                                  {!bomSearches[row._key]?.results?.length ? (
                                    <div className="px-3 py-2 text-xs text-gray-400 text-center">
                                      {bomSearches[row._key]?.query?.trim() ? '검색 결과 없음' : '불러오는 중...'}
                                    </div>
                                  ) : (
                                    <div className="overflow-y-auto" style={{ maxHeight: 200 }}>
                                      {bomSearches[row._key].results.map((sr: any) => (
                                        <div key={sr.id}
                                          onMouseDown={() => {
                                            setRows(prev => prev.map(ro => ro._key === row._key ? { ...ro, bomParent: { id: sr.id, itemCode: sr.itemCode, itemName: sr.itemName } } : ro))
                                            setBomSearches(prev => ({ ...prev, [row._key]: { query: '', results: [], open: false } }))
                                          }}
                                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0"
                                        >
                                          <span className={`text-[9px] px-1 py-0.5 rounded font-semibold shrink-0 ${sr.category === 'PRODUCT' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                            {sr.category === 'PRODUCT' ? '완' : '반'}
                                          </span>
                                          <span className="font-mono text-[10px] text-gray-700 w-36 shrink-0 truncate">{sr.itemCode}</span>
                                          <span className="text-[10px] text-gray-600 flex-1 truncate">{sr.itemName}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 행 작업 */}
                        <td className="py-0.5 text-center" style={{ width: 52 }}>
                          <div className="flex items-center justify-center gap-0.5">
                            <button title="복제"
                              onClick={() => setRows(prev => {
                                const idx = prev.findIndex(r => r._key === row._key)
                                if (idx === -1) return prev
                                const next = [...prev]
                                next.splice(idx + 1, 0, {
                                  ...row,
                                  _key: newKey(),
                                  error: undefined,
                                  specialOptions: [...row.specialOptions],
                                  certifications: [...row.certifications],
                                  drawings: [...row.drawings],
                                  specSheets: [...row.specSheets],
                                  vendors: [...row.vendors],
                                })
                                return next
                              })}
                              className="w-5 h-5 flex items-center justify-center rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                            <button title="삭제"
                              onClick={() => setRows(prev => prev.length > 1 ? prev.filter(r => r._key !== row._key) : prev)}
                              className="w-5 h-5 flex items-center justify-center rounded text-gray-300 hover:text-red-400 hover:bg-red-50">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                  })()}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* 셀모델 코드 입력 모달 */}
        {pendingCellModel && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/30 rounded-2xl">
            <div className="bg-white rounded-xl shadow-xl p-5 w-72" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-semibold text-gray-800 mb-1">새 셀모델 추가</h3>
              <p className="text-xs text-gray-500 mb-3">셀모델명: <span className="font-medium text-gray-700">{pendingCellModel.label}</span></p>
              <label className="text-xs text-gray-500 block mb-1">코드 <span className="text-red-400">*</span></label>
              <input
                autoFocus
                value={pendingCellModel.code}
                onChange={e => setPendingCellModel(prev => prev ? { ...prev, code: e.target.value } : null)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && pendingCellModel.code.trim()) {
                    const { rowKey, mfr, label, code } = pendingCellModel
                    addCellModelEntry(mfr, label, code.trim())
                    setCellMfrGroups([...getCellModelGroups()])
                    upd(rowKey, 'cellModel', `${mfr} ${label}`)
                    setPendingCellModel(null)
                    saveToServer()
                  } else if (e.key === 'Escape') {
                    setPendingCellModel(null)
                  }
                }}
                placeholder="예: INR21700-M50L"
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm mb-4 outline-none focus:border-blue-400"
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setPendingCellModel(null)}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
                <button
                  disabled={!pendingCellModel.code.trim()}
                  onClick={() => {
                    const { rowKey, mfr, label, code } = pendingCellModel
                    addCellModelEntry(mfr, label, code.trim())
                    setCellMfrGroups([...getCellModelGroups()])
                    upd(rowKey, 'cellModel', `${mfr} ${label}`)
                    setPendingCellModel(null)
                    saveToServer()
                  }}
                  className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40">
                  추가
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 푸터 */}
        <div className="px-6 py-3.5 border-t bg-white shrink-0 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {bulkType
              ? filledRows.length > 0 ? `${filledRows.length}개 품목 등록 예정` : ''
              : '품목 유형을 선택하세요'}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs px-4" onClick={onClose}>취소</Button>
            {bulkType && (
              <Button size="sm" className="h-8 text-xs px-5" onClick={handleSubmit} disabled={saving || filledRows.length === 0}>
                {saving ? '등록 중...' : `${filledRows.length}개 등록`}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
