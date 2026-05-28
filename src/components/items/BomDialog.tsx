'use client'

import { useEffect, useState, useRef, useCallback, Fragment } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import ItemFormDialog from '@/components/items/ItemFormDialog'
import { THIRD_OPTIONS, SUB_OPTIONS, THIRD_LEVEL } from '@/lib/classification'
import { getOptions, SelectOption } from '@/lib/select-options'
import { TagSelect } from '@/components/ui/tag-select'

const CAT_LABEL: Record<string, string> = { PRODUCT: '완제품', ASSEMBLY: '반제품', COMPONENT: '자재' }
const CAT_COLOR: Record<string, string> = {
  PRODUCT:   'bg-blue-100 text-blue-700',
  ASSEMBLY:  'bg-purple-100 text-purple-700',
  COMPONENT: 'bg-emerald-100 text-emerald-700',
}
const STATUS_LABEL: Record<string, string> = { ACTIVE: '사용', INACTIVE: '미사용', RESTRICTED: '사용금지', DISCONTINUED: '단종' }
const STATUS_COLOR: Record<string, string> = {
  ACTIVE:       'bg-green-100 text-green-700',
  INACTIVE:     'bg-gray-100 text-gray-600',
  RESTRICTED:   'bg-yellow-100 text-yellow-700',
  DISCONTINUED: 'bg-red-100 text-red-700',
}
const SUB_LABEL: Record<string, string> = {
  BP: '배터리팩', BM: 'BMS', PC: 'PCM',
  CL: '셀', EL: '전장/전기부품', ME: '기구/외장부품',
  CD: '도전재', PK: '포장자재', FS: '체결부품',
  SM: '부자재/소모품', RM: '일반자재', OT: '샘플/기타',
  PO: 'Soft pack', CAS: 'Case', PRA: 'Power Relay Assembly',
  DST: 'Distribution Board', SWB: 'Switch Box', DRV: 'Driver',
  CMB: 'Communication Board', JTB: 'Junction Box', HRN: 'Harness',
}

// ASSEMBLY + COMPONENT 중분류 옵션
const ALL_SUB_OPTS = [...SUB_OPTIONS.ASSEMBLY, ...SUB_OPTIONS.COMPONENT]

// 중분류별 소분류 옵션
function getThirdOpts(subCat: string): SelectOption[] {
  const def = THIRD_LEVEL[subCat]
  if (!def) return []
  if (def.staticOptions) return def.staticOptions as SelectOption[]
  if (def.optKey) return getOptions(def.optKey)
  return []
}

// 소분류 값 → {field, subCats} 역방향 맵 (전체 소분류 독립 선택 지원)
function buildThirdValueMap(): Record<string, { field: string; subCats: string[]; label: string }> {
  const map: Record<string, { field: string; subCats: string[]; label: string }> = {}
  for (const [subCat, def] of Object.entries(THIRD_LEVEL)) {
    if (!def) continue
    for (const opt of getThirdOpts(subCat)) {
      if (!map[opt.value]) map[opt.value] = { field: def.field, subCats: [], label: opt.label }
      if (!map[opt.value].subCats.includes(subCat)) map[opt.value].subCats.push(subCat)
    }
  }
  return map
}

// 전체 소분류 옵션 목록 (중복 제거)
function buildAllThirdOpts(): SelectOption[] {
  const seen = new Set<string>()
  const result: SelectOption[] = []
  for (const [subCat, def] of Object.entries(THIRD_LEVEL)) {
    if (!def) continue
    for (const opt of getThirdOpts(subCat)) {
      if (!seen.has(opt.value)) {
        seen.add(opt.value)
        result.push(opt)
      }
    }
  }
  return result
}

interface BomRow {
  _key: string
  id?: string
  childId?: string
  child?: {
    id: string; itemCode: string; itemName: string; unit: string
    category: string; subCategory?: string | null
    formFactor?: string | null; chemistryType?: string | null
  }
  quantity: string
  unit: string
  memo: string
  filterSubCat: string  // 중분류 필터
  filterThird: string   // 소분류 필터
}

interface SearchState {
  query: string
  results: any[]
  open: boolean
}

let _keyCounter = 0
const newKey = () => `row-${++_keyCounter}`
const makeEmptyRow = (): BomRow => ({ _key: newKey(), quantity: '', unit: '', memo: '', filterSubCat: '', filterThird: '' })

interface Props {
  open: boolean
  item: any
  readOnly?: boolean
  onClose: () => void
  onBomChanged?: (count: number) => void
}

interface PrintRow {
  child: any; childId: string; quantity: string; unit: string; memo: string; level: number
}

async function buildLeveledRows(items: PrintRow[], level: number, visited: Set<string>): Promise<PrintRow[]> {
  const result: PrintRow[] = []
  for (const item of items) {
    if (!item.child) continue
    result.push({ ...item, level })
    if (item.child.category === 'ASSEMBLY' && !visited.has(item.childId)) {
      visited.add(item.childId)
      try {
        const res = await fetch(`/api/items/${item.childId}/bom`)
        const json = await res.json()
        if (json.success && json.data.length > 0) {
          const subItems: PrintRow[] = json.data.map((l: any) => ({
            child: l.child, childId: l.childId, quantity: String(l.quantity),
            unit: l.unit ?? '', memo: l.memo ?? '', level: level + 1,
          }))
          result.push(...await buildLeveledRows(subItems, level + 1, visited))
        }
      } catch {}
    }
  }
  return result
}

export default function BomDialog({ open, item, readOnly = false, onClose, onBomChanged }: Props) {
  const [rows, setRows] = useState<BomRow[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [searches, setSearches] = useState<Record<string, SearchState>>({})
  const [viewItem, setViewItem] = useState<any>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [childBoms, setChildBoms] = useState<Record<string, { items: any[]; loading: boolean }>>({})
  const [rootMemo, setRootMemo] = useState('')

  const searchTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const thirdValueMap = buildThirdValueMap()
  const allThirdOpts = buildAllThirdOpts()

  const fetchChildBom = useCallback(async (rowKey: string, childId: string) => {
    setChildBoms(prev => ({ ...prev, [rowKey]: { items: [], loading: true } }))
    try {
      const res = await fetch(`/api/items/${childId}/bom`)
      const json = await res.json()
      setChildBoms(prev => ({ ...prev, [rowKey]: { items: json.success ? json.data : [], loading: false } }))
    } catch {
      setChildBoms(prev => ({ ...prev, [rowKey]: { items: [], loading: false } }))
    }
  }, [])

  const fetchBom = useCallback(async () => {
    if (!item?.id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/items/${item.id}/bom`)
      const json = await res.json()
      if (json.success) {
        const existingRows: BomRow[] = json.data.map((l: any) => ({
          _key: newKey(), id: l.id, childId: l.childId, child: l.child,
          quantity: String(l.quantity), unit: l.unit, memo: l.memo ?? '',
          filterSubCat: l.child?.subCategory ?? '', filterThird: '',
        }))
        setRows([...existingRows, makeEmptyRow()])
        for (const row of existingRows) {
          if (row.child?.category === 'ASSEMBLY' && row.childId) fetchChildBom(row._key, row.childId)
        }
      }
    } finally { setLoading(false) }
  }, [item?.id, fetchChildBom])

  useEffect(() => {
    if (open) { fetchBom(); setSelectedKeys(new Set()); setSearches({}); setIsDirty(false); setDeletedIds(new Set()); setChildBoms({}) }
  }, [open, fetchBom])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      Object.entries(dropdownRefs.current).forEach(([key, ref]) => {
        if (ref && !ref.contains(e.target as Node)) {
          setSearches(prev => { if (!prev[key]?.open) return prev; return { ...prev, [key]: { ...prev[key], open: false } } })
        }
      })
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const doSearch = useCallback((rowKey: string, q: string, excludeIds: Set<string>, parentId: string, filterSubCat: string, filterThird: string) => {
    clearTimeout(searchTimers.current[rowKey])
    searchTimers.current[rowKey] = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ category: 'ASSEMBLY,COMPONENT', limit: '12', sortBy: 'createdAt', sortOrder: 'desc' })
        if (q.trim()) params.set('search', q.trim())
        if (filterSubCat) params.set('subCategory', filterSubCat)
        if (filterThird) {
          // 중분류 선택됐으면 해당 field로, 아니면 역방향 맵에서 추론
          let field = filterSubCat ? (THIRD_LEVEL[filterSubCat]?.field ?? '') : (thirdValueMap[filterThird]?.field ?? '')
          if (field === 'chemistryType') params.set('chemistryType', filterThird)
          else if (field === 'formFactor') params.set('formFactor', filterThird)
        }
        const res = await fetch(`/api/items?${params}`)
        const json = await res.json()
        if (json.success) {
          const results = json.data.items.filter((i: any) => i.id !== parentId && !excludeIds.has(i.id))
          setSearches(prev => ({ ...prev, [rowKey]: { ...(prev[rowKey] ?? { query: q, results: [], open: true }), results, open: true } }))
        }
      } catch {}
    }, q.trim() ? 250 : 0)
  }, [thirdValueMap])

  const handleItemSelect = (rowKey: string, selectedItem: any) => {
    setSearches(prev => ({ ...prev, [rowKey]: { query: '', results: [], open: false } }))
    setRows(prev => {
      const idx = prev.findIndex(r => r._key === rowKey)
      if (idx === -1) return prev
      const newRows = [...prev]
      newRows[idx] = { ...newRows[idx], childId: selectedItem.id, child: selectedItem, unit: selectedItem.unit || '', quantity: '1', filterSubCat: selectedItem.subCategory ?? newRows[idx].filterSubCat }
      if (idx === prev.length - 1) newRows.push(makeEmptyRow())
      return newRows
    })
    setIsDirty(true)
    if (selectedItem.category === 'ASSEMBLY') fetchChildBom(rowKey, selectedItem.id)
  }

  const updateField = (rowKey: string, field: 'quantity' | 'unit' | 'memo', value: string) => {
    setRows(prev => prev.map(r => r._key === rowKey ? { ...r, [field]: value } : r))
    setIsDirty(true)
  }

  const updateClassFilter = (rowKey: string, field: 'filterSubCat' | 'filterThird', value: string) => {
    setRows(prev => prev.map(r => {
      if (r._key !== rowKey) return r
      if (field === 'filterSubCat') {
        // 중분류 바뀌면 소분류 초기화 (새 중분류의 옵션에 없으면)
        const newThirdOpts = value ? getThirdOpts(value) : []
        const keepThird = newThirdOpts.some(o => o.value === r.filterThird)
        return { ...r, filterSubCat: value, filterThird: keepThird ? r.filterThird : '' }
      }
      // 소분류 선택 시 중분류 자동 추론 (단일 부모면 자동 설정)
      if (field === 'filterThird' && value && !r.filterSubCat) {
        const info = thirdValueMap[value]
        // ASSEMBLY+COMPONENT 에만 해당하는 subCats 필터
        const validSubCats = info?.subCats.filter(s => ALL_SUB_OPTS.some(o => o.value === s)) ?? []
        const autoSubCat = validSubCats.length === 1 ? validSubCats[0] : ''
        return { ...r, filterThird: value, filterSubCat: autoSubCat }
      }
      return { ...r, filterThird: value }
    }))
    setSearches(prev => { if (!prev[rowKey]) return prev; return { ...prev, [rowKey]: { ...prev[rowKey], open: false } } })
  }

  const handleCloneRow = (row: BomRow) => {
    const newRow: BomRow = { _key: newKey(), childId: row.childId, child: row.child, quantity: row.quantity, unit: row.unit, memo: row.memo, filterSubCat: row.filterSubCat, filterThird: row.filterThird }
    setRows(prev => {
      const idx = prev.findIndex(r => r._key === row._key)
      if (idx === -1) return prev
      const next = [...prev]; next.splice(idx + 1, 0, newRow); return next
    })
    setIsDirty(true)
  }

  const handleDeleteRow = (row: BomRow) => {
    if (row.id) setDeletedIds(prev => new Set([...prev, row.id!]))
    setChildBoms(prev => { const n = { ...prev }; delete n[row._key]; return n })
    setRows(prev => {
      const remaining = prev.filter(r => r._key !== row._key)
      const last = remaining[remaining.length - 1]
      if (!last || last.childId) remaining.push(makeEmptyRow())
      return remaining
    })
    if (row.child) { setSelectedKeys(prev => { const s = new Set(prev); s.delete(row._key); return s }); setIsDirty(true) }
  }

  const handleDeleteSelected = () => {
    const toDelete = rows.filter(r => selectedKeys.has(r._key) && r.child)
    if (toDelete.length === 0) return
    if (!confirm(`선택한 ${toDelete.length}개 항목을 삭제하시겠습니까?`)) return
    const idsToMark = toDelete.filter(r => r.id).map(r => r.id!)
    if (idsToMark.length > 0) setDeletedIds(prev => new Set([...prev, ...idsToMark]))
    setChildBoms(prev => { const n = { ...prev }; toDelete.forEach(r => delete n[r._key]); return n })
    setRows(prev => {
      const remaining = prev.filter(r => !selectedKeys.has(r._key) || !r.child)
      const last = remaining[remaining.length - 1]
      if (!last || last.childId) remaining.push(makeEmptyRow())
      return remaining
    })
    setSelectedKeys(new Set()); setIsDirty(true)
  }

  const handlePrint = async () => {
    const w = window.open('', '_blank', 'width=1100,height=700')
    if (!w) return

    // 루트 BOM 직접 항목: 반제품 먼저, 직접 자재는 마지막
    const directItems = rows.filter(r => r.child)
    const assemblies = directItems.filter(r => r.child!.category === 'ASSEMBLY')
    const directComponents = directItems.filter(r => r.child!.category !== 'ASSEMBLY')

    // 각 반제품의 하위 BOM 가져오기
    const visited = new Set<string>([item?.id ?? ''])
    type SubItem = { child: any; quantity: string; unit: string; memo: string }
    const asmGroups: Array<{ asm: BomRow; subItems: SubItem[] }> = []

    for (const asmRow of assemblies) {
      const subItems: SubItem[] = []
      if (asmRow.childId && !visited.has(asmRow.childId)) {
        visited.add(asmRow.childId)
        try {
          const res = await fetch(`/api/items/${asmRow.childId}/bom`)
          const json = await res.json()
          if (json.success) {
            for (const l of json.data) {
              subItems.push({ child: l.child, quantity: String(l.quantity), unit: l.unit ?? '', memo: l.memo ?? '' })
            }
          }
        } catch {}
      }
      asmGroups.push({ asm: asmRow, subItems })
    }

    const CAT_BG: Record<string, string> = { PRODUCT: '#FFD966', ASSEMBLY: '#C6EFCE', COMPONENT: '#BDD7EE' }
    const CAT_TEXT: Record<string, string> = { PRODUCT: '#7D5A00', ASSEMBLY: '#375623', COMPONENT: '#1F4E79' }
    const cell = (content: string, extra = '') =>
      `<td style="border:1px solid #aaa;padding:5px 8px;${extra}">${content}</td>`

    const makeRow = (cat: string, lv1: string, lv2: string, lv3: string,
                     itemCode: string, itemName: string, qty: string, unit: string, memo: string) => {
      const bg = CAT_BG[cat] ?? '#fff'
      const tc = CAT_TEXT[cat] ?? '#111'
      return `<tr style="background:${bg};color:${tc}">
        ${cell(lv1, 'text-align:center;font-weight:700')}
        ${cell(lv2, 'text-align:center;font-weight:700')}
        ${cell(lv3, 'text-align:center;font-weight:700')}
        ${cell(itemCode, 'font-family:monospace;font-size:10px')}
        ${cell(itemName)}
        ${cell(qty || '-', 'text-align:center')}
        ${cell(unit || '-', 'text-align:center')}
        ${cell(memo)}
      </tr>`
    }

    let rowsHtml = ''

    // 완제품 (루트)
    if (item) {
      rowsHtml += makeRow(item.category ?? 'PRODUCT', '1', '', '', item.itemCode ?? '', item.itemName ?? '', '-', '-', '')
    }

    // 반제품 → 반제품별 하위 자재 (자재 번호 반제품마다 재시작)
    let asmCounter = 0
    for (const { asm, subItems } of asmGroups) {
      asmCounter++
      let subCounter = 0
      rowsHtml += makeRow('ASSEMBLY', '', String(asmCounter), '', asm.child?.itemCode ?? '', asm.child?.itemName ?? '', asm.quantity, asm.unit, asm.memo)
      for (const sub of subItems) {
        subCounter++
        rowsHtml += makeRow(sub.child?.category ?? 'COMPONENT', '', '', String(subCounter), sub.child?.itemCode ?? '', sub.child?.itemName ?? '', sub.quantity, sub.unit, sub.memo)
      }
    }

    // 직접 자재 (루트에 직접 연결된 자재, 번호 재시작)
    let directCounter = 0
    for (const comp of directComponents) {
      directCounter++
      rowsHtml += makeRow(comp.child?.category ?? 'COMPONENT', '', '', String(directCounter), comp.child?.itemCode ?? '', comp.child?.itemName ?? '', comp.quantity, comp.unit, comp.memo)
    }

    const totalCount = asmGroups.reduce((s, g) => s + 1 + g.subItems.length, 0) + directComponents.length

    w.document.write(`<!DOCTYPE html><html><head>
      <title>BOM - ${item?.itemCode ?? ''}</title>
      <style>
        body{font-family:'Malgun Gothic',sans-serif;font-size:12px;padding:20px;color:#111}
        .bom-title{background:#4472C4;color:white;text-align:center;font-size:13px;font-weight:700;padding:8px;border:1px solid #2F5496}
        .bom-sub{font-size:11px;color:#555;margin:6px 0 14px;text-align:center}
        table{border-collapse:collapse;width:100%}
        th{background:#4472C4;color:white;font-weight:600;text-align:center;padding:5px 8px;border:1px solid #2F5496;font-size:11px}
        td{font-size:11px}
        @media print{body{padding:10px}}
      </style>
    </head><body>
      <div class="bom-title">BOM</div>
      <div class="bom-sub">${item?.itemCode ?? ''} &nbsp;—&nbsp; ${item?.itemName ?? ''} &nbsp;|&nbsp; 총 ${totalCount}개 구성 품목</div>
      <table>
        <colgroup>
          <col style="width:54px"><col style="width:54px"><col style="width:54px">
          <col style="width:130px"><col style="width:180px">
          <col style="width:52px"><col style="width:52px"><col style="width:150px">
        </colgroup>
        <thead>
          <tr>
            <th colspan="3">레벨</th>
            <th rowspan="2">품목코드</th>
            <th rowspan="2">품목명</th>
            <th rowspan="2">수량</th>
            <th rowspan="2">단위</th>
            <th rowspan="2">비고</th>
          </tr>
          <tr>
            <th style="background:#FFD966;color:#7D5A00;font-size:9px;padding:3px 2px">완제품</th>
            <th style="background:#C6EFCE;color:#375623;font-size:9px;padding:3px 2px">반제품</th>
            <th style="background:#BDD7EE;color:#1F4E79;font-size:9px;padding:3px 2px">자재</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </body></html>`)
    w.document.close(); w.print()
  }

  const handleViewItem = async (child: any) => {
    try {
      const res = await fetch(`/api/items/${child.id}`)
      const json = await res.json()
      if (json.success) setViewItem(json.data)
      else toast.error('품목 정보를 불러오지 못했습니다.')
    } catch { toast.error('품목 정보를 불러오지 못했습니다.') }
  }

  const handleSave = async () => {
    if (!isDirty || saving) return
    setSaving(true)
    try {
      for (const id of deletedIds) await fetch(`/api/items/${item.id}/bom/${id}`, { method: 'DELETE' })
      for (const row of rows.filter(r => !r.id && r.childId && r.child)) {
        const qty = parseFloat(row.quantity) || 1
        const res = await fetch(`/api/items/${item.id}/bom`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ childId: row.childId, quantity: qty, unit: row.unit || '', memo: row.memo || '' }),
        })
        const json = await res.json()
        if (json.success) setRows(prev => prev.map(r => r._key === row._key ? { ...r, id: json.data.id } : r))
        else toast.error(json.message ?? '일부 항목 저장 실패')
      }
      for (const row of rows.filter(r => r.id && r.childId && r.quantity && parseFloat(r.quantity) > 0)) {
        await fetch(`/api/items/${item.id}/bom/${row.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quantity: row.quantity, unit: row.unit, memo: row.memo }),
        })
      }
      setDeletedIds(new Set()); setIsDirty(false)
      onBomChanged?.(rows.filter(r => r.child).length)
      toast.success('BOM이 저장되었습니다.')
    } catch { toast.error('저장 중 오류가 발생했습니다.') }
    finally { setSaving(false) }
  }

  if (!open) return null

  // 소분류 값 → 레이블 맵 (formFactor + chemistryType 모두 포함)
  const thirdLabelMap: Record<string, string> = {}
  Object.values(THIRD_OPTIONS).forEach(opts => opts.forEach(o => { thirdLabelMap[o.value] = o.label }))
  ;['elComponentType', 'meComponentType', 'cdComponentType',
    'fsComponentType', 'smComponentType', 'rmComponentType', 'otComponentType', 'chemistryType']
    .forEach(key => getOptions(key).forEach(o => { thirdLabelMap[o.value] = o.label }))

  const activeRows = rows.filter(r => r.child)
  const allSelected = activeRows.length > 0 && activeRows.every(r => selectedKeys.has(r._key))
  const existingChildIds = new Set(rows.filter(r => r.childId).map(r => r.childId!))

  // 정렬: 반제품 → 직접 자재 → 빈 행 (입력용)
  const asmBomRows = rows.filter(r => r.child?.category === 'ASSEMBLY')
  const compBomRows = rows.filter(r => r.child && r.child.category !== 'ASSEMBLY')
  const emptyBomRows = rows.filter(r => !r.child)
  const sortedRows = [...asmBomRows, ...compBomRows, ...emptyBomRows]

  // 레벨 번호 계산
  let _asmNum = 0
  const rowLevels = new Map<string, { lv1: string; lv2: string; lv3: string }>()
  asmBomRows.forEach(r => rowLevels.set(r._key, { lv1: '', lv2: String(++_asmNum), lv3: '' }))
  compBomRows.forEach((r, i) => rowLevels.set(r._key, { lv1: '', lv2: '', lv3: String(i + 1) }))
  emptyBomRows.forEach(r => rowLevels.set(r._key, { lv1: '', lv2: '', lv3: '' }))

  const cell = 'h-7 w-full bg-transparent px-2 text-xs focus:bg-white focus:ring-1 focus:ring-blue-400 focus:outline-none hover:bg-gray-50 transition-colors rounded border-0 disabled:opacity-30 disabled:cursor-not-allowed'

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ width: 1200, height: 720 }} onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="flex items-start justify-between px-6 py-4 border-b bg-gradient-to-r from-gray-50 to-white shrink-0">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-bold text-gray-900">BOM 구성 관리</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CAT_COLOR[item?.category] ?? 'bg-gray-100 text-gray-600'}`}>
                {CAT_LABEL[item?.category] ?? item?.category}
              </span>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{activeRows.length}개 구성 품목</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-8 text-xs px-3 gap-1.5" onClick={handlePrint}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              PDF 출력
            </Button>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-lg leading-none">×</button>
          </div>
        </div>

        {/* 선택 서브헤더 */}
        {selectedKeys.size > 0 && !readOnly && (
          <div className="flex items-center gap-2.5 px-6 py-2 bg-blue-50 border-b shrink-0">
            <span className="text-xs text-blue-700 font-medium">{selectedKeys.size}개 선택됨</span>
            <Button size="sm" variant="destructive" className="h-6 text-xs px-3" onClick={handleDeleteSelected}>선택 삭제</Button>
            <button className="text-xs text-gray-400 hover:text-gray-600" onClick={() => setSelectedKeys(new Set())}>선택 해제</button>
          </div>
        )}

        {/* 테이블 */}
        <div className="flex-1 overflow-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-xs gap-2">
              <svg className="animate-spin w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              불러오는 중...
            </div>
          ) : (
            <table className="w-full text-xs border-collapse" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 36 }} />   {/* 체크 */}
                <col style={{ width: 38 }} />   {/* 레벨: 완제품 */}
                <col style={{ width: 38 }} />   {/* 레벨: 반제품 */}
                <col style={{ width: 38 }} />   {/* 레벨: 자재 */}
                <col style={{ width: 130 }} />  {/* 중분류 */}
                <col style={{ width: 115 }} />  {/* 소분류 */}
                <col style={{ width: 215 }} />  {/* 품목코드 */}
                <col style={{ width: 240 }} />  {/* 품목명 */}
                <col style={{ width: 68 }} />   {/* 수량 */}
                <col style={{ width: 52 }} />   {/* 단위 */}
                <col />                          {/* 비고 */}
                <col style={{ width: 72 }} />   {/* 작업 */}
              </colgroup>
              <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="py-2.5 text-center border-r border-gray-200" rowSpan={2}>
                    {!readOnly && (
                      <input type="checkbox" checked={allSelected}
                        onChange={() => allSelected ? setSelectedKeys(new Set()) : setSelectedKeys(new Set(activeRows.map(r => r._key)))}
                        className="rounded" />
                    )}
                  </th>
                  <th className="py-2 text-center text-gray-500 font-medium text-[10px] border-r border-gray-200" colSpan={3}>레벨</th>
                  <th className="px-2 py-2.5 text-left text-gray-500 font-medium border-r border-gray-200" rowSpan={2}>중분류</th>
                  <th className="px-2 py-2.5 text-left text-gray-500 font-medium border-r border-gray-200" rowSpan={2}>소분류</th>
                  <th className="px-2 py-2.5 text-left text-gray-500 font-medium border-r border-gray-200" rowSpan={2}>품목코드</th>
                  <th className="px-2 py-2.5 text-left text-gray-500 font-medium border-r border-gray-200" rowSpan={2}>품목명</th>
                  <th className="px-2 py-2.5 text-right text-gray-500 font-medium border-r border-gray-200" rowSpan={2}>수량 <span className="text-red-400">*</span></th>
                  <th className="px-2 py-2.5 text-center text-gray-500 font-medium border-r border-gray-200" rowSpan={2}>단위</th>
                  <th className="px-2 py-2.5 text-left text-gray-500 font-medium border-r border-gray-200" rowSpan={2}>비고</th>
                  <th className="py-2.5 text-center text-gray-400 font-medium text-[10px]" rowSpan={2}>작업</th>
                </tr>
                <tr>
                  <th className="py-1.5 text-center text-[9px] font-semibold text-yellow-700 bg-yellow-50 border-t border-r border-gray-200">완제품</th>
                  <th className="py-1.5 text-center text-[9px] font-semibold text-green-700 bg-green-50 border-t border-r border-gray-200">반제품</th>
                  <th className="py-1.5 text-center text-[9px] font-semibold text-sky-700 bg-sky-50 border-t border-r border-gray-200">자재</th>
                </tr>
              </thead>
              <tbody>
                {/* 완제품 (레벨 1) 고정 행 */}
                {item && (() => {
                  const itemThirdVal = THIRD_LEVEL[item.subCategory ?? '']?.field === 'chemistryType'
                    ? item.chemistryType : item.formFactor
                  return (
                    <tr className="bg-yellow-50/70 border-b border-yellow-100" style={{ height: 36 }}>
                      <td className="py-1.5"></td>
                      <td className="py-1.5 text-center border-r border-gray-100">
                        <span className="text-xs font-bold text-yellow-700">1</span>
                      </td>
                      <td className="py-1.5 text-center border-r border-gray-100"></td>
                      <td className="py-1.5 text-center border-r border-gray-100"></td>
                      <td className="px-1 py-1.5 border-r border-gray-100">
                        {item.subCategory && (
                          <span className="text-[10px] bg-gray-100 text-gray-900 px-1.5 py-0.5 rounded whitespace-nowrap">
                            {SUB_LABEL[item.subCategory] ?? item.subCategory}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 border-r border-gray-100 text-xs text-gray-300">—</td>
                      <td className="px-2 py-1.5 border-r border-gray-100">
                        <span className="font-mono text-gray-700 text-xs">{item.itemCode}</span>
                      </td>
                      <td className="px-2 py-1.5 text-gray-700 truncate border-r border-gray-100 text-xs">{item.itemName}</td>
                      <td className="px-2 py-1.5 border-r border-gray-100 text-xs text-center text-gray-700 font-medium">1</td>
                      <td className="px-2 py-1.5 border-r border-gray-100 text-xs text-center text-gray-700">{item.unit || '—'}</td>
                      <td className="px-0.5 py-0.5 border-r border-gray-100">
                        <input value={rootMemo} onChange={e => setRootMemo(e.target.value)}
                          placeholder="비고" disabled={readOnly} className={cell} />
                      </td>
                      <td className="py-1.5 px-1">
                        <div className="flex items-center justify-center">
                          <button onClick={() => handleViewItem(item)} title="보기" className="w-6 h-6 flex items-center justify-center rounded text-blue-400 hover:text-blue-600 hover:bg-blue-50">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })()}
                {sortedRows.map(row => {
                  const isSel = selectedKeys.has(row._key)
                  const search = searches[row._key]
                  const lvl = rowLevels.get(row._key) ?? { lv1: '', lv2: '', lv3: '' }
                  const isAssembly = row.child?.category === 'ASSEMBLY' && !!row.id
                  const childBom = childBoms[row._key]
                  const isCell = row.filterSubCat === 'CL'

                  // 현재 행의 소분류 옵션: 중분류 선택 시 해당 옵션, 없으면 전체
                  const currentThirdOpts = row.filterSubCat ? getThirdOpts(row.filterSubCat) : allThirdOpts

                  // 선택된 item의 소분류 표시값
                  const childThirdVal = row.child
                    ? (THIRD_LEVEL[row.child.subCategory ?? '']?.field === 'chemistryType'
                        ? row.child.chemistryType
                        : row.child.formFactor)
                    : null

                  return (
                    <Fragment key={row._key}>
                      <tr className={`border-b border-gray-100 transition-colors ${
                        isSel ? 'bg-indigo-100' :
                        row.child?.category === 'ASSEMBLY' ? 'bg-green-50 hover:bg-green-100/60' :
                        row.child?.category === 'COMPONENT' ? 'bg-sky-50/60 hover:bg-sky-50' :
                        'hover:bg-gray-50/60'
                      }`}>

                        {/* 체크 */}
                        <td className="py-1 text-center">
                          {row.child && !readOnly && (
                            <input type="checkbox" checked={isSel}
                              onChange={() => setSelectedKeys(prev => { const s = new Set(prev); s.has(row._key) ? s.delete(row._key) : s.add(row._key); return s })}
                              className="rounded" />
                          )}
                        </td>

                        {/* 레벨: 완제품 */}
                        <td className="py-1 text-center border-r border-gray-100">
                          <span className="text-xs font-bold text-yellow-700">{lvl.lv1}</span>
                        </td>
                        {/* 레벨: 반제품 */}
                        <td className="py-1 text-center border-r border-gray-100">
                          <span className="text-xs font-bold text-green-700">{lvl.lv2}</span>
                        </td>
                        {/* 레벨: 자재 */}
                        <td className="py-1 text-center border-r border-gray-100">
                          <span className="text-xs font-bold text-sky-700">{lvl.lv3}</span>
                        </td>

                        {/* 중분류 */}
                        <td className="px-1 py-1 border-r border-gray-100">
                          {row.child ? (
                            <span className="text-[10px] bg-gray-100 text-gray-900 px-1.5 py-0.5 rounded whitespace-nowrap">
                              {SUB_LABEL[row.child.subCategory ?? ''] ?? row.child.subCategory ?? '—'}
                            </span>
                          ) : (
                            <TagSelect
                              value={row.filterSubCat}
                              onChange={v => updateClassFilter(row._key, 'filterSubCat', v)}
                              options={ALL_SUB_OPTS}
                              onAdd={() => {}}
                              placeholder="전체"
                              size="sm"
                              portal
                              noCreate
                            />
                          )}
                        </td>

                        {/* 소분류 */}
                        <td className="px-1 py-1 border-r border-gray-100">
                          {row.child ? (
                            childThirdVal ? (
                              <span className="text-[10px] bg-gray-50 text-gray-900 px-1.5 py-0.5 rounded border border-gray-200 whitespace-nowrap">
                                {thirdLabelMap[childThirdVal] ?? childThirdVal}
                              </span>
                            ) : <span className="text-gray-200 text-xs px-1">—</span>
                          ) : currentThirdOpts.length > 0 ? (
                            <TagSelect
                              value={row.filterThird}
                              onChange={v => updateClassFilter(row._key, 'filterThird', v)}
                              options={currentThirdOpts}
                              onAdd={() => {}}
                              placeholder="전체"
                              size="sm"
                              portal
                              noCreate
                            />
                          ) : (
                            <span className="text-gray-200 text-xs px-1">—</span>
                          )}
                        </td>

                        {/* 품목코드 (검색 or 표시) */}
                        <td className="px-0.5 py-0.5 border-r border-gray-100">
                          {row.child ? (
                            <div className="flex items-center h-7 px-2">
                              <span className="font-mono text-gray-700 truncate text-xs">{row.child.itemCode}</span>
                            </div>
                          ) : (
                            <div ref={el => { dropdownRefs.current[row._key] = el }} className="relative">
                              <div className="relative">
                                <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-300 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                  value={search?.query ?? ''}
                                  onChange={e => {
                                    const q = e.target.value
                                    setSearches(prev => ({ ...prev, [row._key]: { ...(prev[row._key] ?? { query: '', results: [], open: false }), query: q, open: true } }))
                                    doSearch(row._key, q, existingChildIds, item?.id, row.filterSubCat, row.filterThird)
                                  }}
                                  onFocus={() => doSearch(row._key, search?.query ?? '', existingChildIds, item?.id, row.filterSubCat, row.filterThird)}
                                  placeholder="품번·품명 검색"
                                  className={cell + ' pl-6'}
                                />
                              </div>

                              {/* 검색 드롭다운 */}
                              {search?.open && (
                                <div className="absolute top-full left-0 z-50 mt-1 border border-gray-200 rounded-lg bg-white shadow-xl"
                                  style={{ maxHeight: 340, overflowY: 'auto', overflowX: 'auto', ...(isCell ? { width: 1160 } : { width: 740 }) }}>
                                  {search.results.length === 0 ? (
                                    <div className="px-4 py-3 text-xs text-gray-400 text-center">
                                      {search.query.trim() ? '검색 결과 없음' : '불러오는 중...'}
                                    </div>
                                  ) : isCell ? (
                                    /* CL 셀 전용 검색 결과 */
                                    <table style={{ minWidth: 1160, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                                      <colgroup>
                                        <col style={{ width: 52 }} />
                                        <col style={{ width: 128 }} />
                                        <col />
                                        <col style={{ width: 52 }} />
                                        <col style={{ width: 78 }} />
                                        <col style={{ width: 52 }} />
                                        <col style={{ width: 52 }} />
                                        <col style={{ width: 60 }} />
                                        <col style={{ width: 56 }} />
                                        <col style={{ width: 60 }} />
                                        <col style={{ width: 60 }} />
                                        <col style={{ width: 52 }} />
                                        <col style={{ width: 60 }} />
                                        <col style={{ width: 60 }} />
                                        <col style={{ width: 60 }} />
                                        <col style={{ width: 60 }} />
                                        <col style={{ width: 56 }} />
                                        <col style={{ width: 56 }} />
                                      </colgroup>
                                      <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                                        <tr>
                                          {['상태','품번','품명','화학계','셀 모델','직경(mm)','높이(mm)','방전종료(V)','공칭전압(V)','충전종료(V)','공칭용량(Ah)','에너지(Wh)','피크충전(A)','피크방전(A)','연속충전(A)','연속방전(A)','충전C-rate','방전C-rate'].map(h => (
                                            <th key={h} className="px-1.5 py-2 text-[10px] font-semibold text-gray-400 whitespace-nowrap text-left">{h}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {search.results.map((r: any) => (
                                          <tr key={r.id} onMouseDown={() => handleItemSelect(row._key, r)} className="cursor-pointer hover:bg-blue-50 border-b border-gray-100 last:border-0 transition-colors">
                                            <td className="px-1.5 py-1.5"><span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold whitespace-nowrap ${STATUS_COLOR[r.status] ?? 'bg-gray-100 text-gray-600'}`}>{STATUS_LABEL[r.status] ?? r.status}</span></td>
                                            <td className="px-1.5 py-1.5 font-mono text-[11px] text-gray-700 truncate">{r.itemCode}</td>
                                            <td className="px-1.5 py-1.5 text-xs text-gray-800 truncate">{r.itemName}</td>
                                            <td className="px-1.5 py-1.5 text-xs text-gray-500 truncate">{r.chemistryType || <span className="text-gray-300">—</span>}</td>
                                            <td className="px-1.5 py-1.5 text-xs text-gray-500 truncate">{r.cellModel || <span className="text-gray-300">—</span>}</td>
                                            <td className="px-1.5 py-1.5 text-xs text-gray-500 text-right tabular-nums">{r.diameter ?? <span className="text-gray-300">—</span>}</td>
                                            <td className="px-1.5 py-1.5 text-xs text-gray-500 text-right tabular-nums">{r.height ?? <span className="text-gray-300">—</span>}</td>
                                            <td className="px-1.5 py-1.5 text-xs text-gray-500 text-right tabular-nums">{r.dischargeCutoffVoltage ?? <span className="text-gray-300">—</span>}</td>
                                            <td className="px-1.5 py-1.5 text-xs text-gray-500 text-right tabular-nums">{r.nominalVoltage ?? <span className="text-gray-300">—</span>}</td>
                                            <td className="px-1.5 py-1.5 text-xs text-gray-500 text-right tabular-nums">{r.chargeCutoffVoltage ?? <span className="text-gray-300">—</span>}</td>
                                            <td className="px-1.5 py-1.5 text-xs text-gray-500 text-right tabular-nums">{r.nominalCapacity ?? <span className="text-gray-300">—</span>}</td>
                                            <td className="px-1.5 py-1.5 text-xs text-gray-500 text-right tabular-nums">{r.energy ?? <span className="text-gray-300">—</span>}</td>
                                            <td className="px-1.5 py-1.5 text-xs text-gray-500 text-right tabular-nums">{r.maxChargeCurrent ?? <span className="text-gray-300">—</span>}</td>
                                            <td className="px-1.5 py-1.5 text-xs text-gray-500 text-right tabular-nums">{r.maxDischargeCurrent ?? <span className="text-gray-300">—</span>}</td>
                                            <td className="px-1.5 py-1.5 text-xs text-gray-500 text-right tabular-nums">{r.continuousChargeCurrent ?? <span className="text-gray-300">—</span>}</td>
                                            <td className="px-1.5 py-1.5 text-xs text-gray-500 text-right tabular-nums">{r.continuousDischargeCurrent ?? <span className="text-gray-300">—</span>}</td>
                                            <td className="px-1.5 py-1.5 text-xs text-gray-500 text-right tabular-nums">{r.chargeCRate ?? <span className="text-gray-300">—</span>}</td>
                                            <td className="px-1.5 py-1.5 text-xs text-gray-500 text-right tabular-nums">{r.dischargeCRate ?? <span className="text-gray-300">—</span>}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  ) : (
                                    /* 일반 검색 결과 */
                                    <table style={{ minWidth: 740, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                                      <colgroup>
                                        <col style={{ width: 52 }} />
                                        <col style={{ width: 150 }} />
                                        <col />
                                        <col style={{ width: 110 }} />
                                        <col style={{ width: 100 }} />
                                        <col style={{ width: 44 }} />
                                      </colgroup>
                                      <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                                        <tr>
                                          {['상태','품번','품명','중분류','소분류','단위'].map(h => (
                                            <th key={h} className="px-2 py-2 text-left text-[10px] font-semibold text-gray-400 whitespace-nowrap">{h}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {search.results.map((r: any) => (
                                          <tr key={r.id} onMouseDown={() => handleItemSelect(row._key, r)} className="cursor-pointer hover:bg-blue-50 border-b border-gray-100 last:border-0 transition-colors">
                                            <td className="px-2 py-1.5"><span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold whitespace-nowrap ${STATUS_COLOR[r.status] ?? 'bg-gray-100 text-gray-600'}`}>{STATUS_LABEL[r.status] ?? r.status}</span></td>
                                            <td className="px-2 py-1.5 font-mono text-[11px] text-gray-700 truncate">{r.itemCode}</td>
                                            <td className="px-2 py-1.5 text-xs text-gray-800 truncate">{r.itemName}</td>
                                            <td className="px-2 py-1.5 text-xs text-gray-600 truncate">{r.subCategory ? (SUB_LABEL[r.subCategory] ?? r.subCategory) : <span className="text-gray-300">—</span>}</td>
                                            <td className="px-2 py-1.5 text-xs text-gray-500 truncate">{r.formFactor ? (thirdLabelMap[r.formFactor] ?? r.formFactor) : r.chemistryType ? (thirdLabelMap[r.chemistryType] ?? r.chemistryType) : <span className="text-gray-300">—</span>}</td>
                                            <td className="px-2 py-1.5 text-xs text-gray-500">{r.unit || <span className="text-gray-300">—</span>}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 품명 */}
                        <td className="px-2 py-1 text-gray-700 truncate border-r border-gray-100 text-xs">
                          {row.child?.itemName ?? <span className="text-gray-200">—</span>}
                        </td>

                        {/* 수량 */}
                        <td className="px-0.5 py-0.5 border-r border-gray-100">
                          <input type="number" min="0" step="any" value={row.quantity}
                            onChange={e => updateField(row._key, 'quantity', e.target.value)}
                            onWheel={e => e.currentTarget.blur()}
                            placeholder="수량" disabled={!row.child || readOnly}
                            className={cell + ' text-right'} />
                        </td>

                        {/* 단위 */}
                        <td className="px-0.5 py-0.5 border-r border-gray-100">
                          <input value={row.unit} onChange={e => updateField(row._key, 'unit', e.target.value)}
                            placeholder="단위" disabled={!row.child || readOnly} className={cell + ' text-center'} />
                        </td>

                        {/* 비고 */}
                        <td className="px-0.5 py-0.5">
                          <input value={row.memo} onChange={e => updateField(row._key, 'memo', e.target.value)}
                            placeholder="비고" disabled={!row.child || readOnly} className={cell} />
                        </td>

                        {/* 작업 버튼 */}
                        <td className="py-1 px-1">
                          <div className="flex items-center justify-center gap-0.5">
                            {row.child && (
                              <button onClick={() => handleViewItem(row.child!)} title="보기" className="w-6 h-6 flex items-center justify-center rounded text-blue-400 hover:text-blue-600 hover:bg-blue-50">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                              </button>
                            )}
                            {row.child && !readOnly && (
                              <button onClick={() => handleCloneRow(row)} title="복제" className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                              </button>
                            )}
                            {row.child && !readOnly && (
                              <button onClick={() => handleDeleteRow(row)} title="삭제" className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* 반제품 하위 BOM 펼침 */}
                      {isAssembly && childBom && (
                        childBom.loading ? (
                          <tr key={`${row._key}-loading`}>
                            <td colSpan={12} className="py-2 text-center text-xs text-gray-400 bg-sky-50/20">불러오는 중...</td>
                          </tr>
                        ) : childBom.items.length > 0 ? (
                          childBom.items.map((sub: any, si: number) => (
                            <tr key={`${row._key}-s${si}`} className="bg-sky-50/40 border-b border-sky-100/50">
                              <td className="py-1"></td>
                              <td className="py-1 text-center border-r border-gray-100"></td>
                              <td className="py-1 text-center border-r border-gray-100"></td>
                              <td className="py-1 text-center border-r border-gray-100">
                                <span className="text-xs font-bold text-sky-700">{si + 1}</span>
                              </td>
                              <td className="px-2 py-1 border-r border-gray-100">
                                {sub.child?.subCategory && <span className="text-[10px] bg-gray-100 text-gray-900 px-1.5 py-0.5 rounded">{SUB_LABEL[sub.child.subCategory] ?? sub.child.subCategory}</span>}
                              </td>
                              <td className="px-2 py-1 border-r border-gray-100">
                                {(() => {
                                  const v = THIRD_LEVEL[sub.child?.subCategory ?? '']?.field === 'chemistryType' ? sub.child?.chemistryType : sub.child?.formFactor
                                  return v ? <span className="text-[10px] bg-gray-50 text-gray-900 px-1.5 py-0.5 rounded border border-gray-200">{thirdLabelMap[v] ?? v}</span> : null
                                })()}
                              </td>
                              <td className="px-2 py-1 pl-5 border-r border-gray-100">
                                <span className="font-mono text-gray-600 truncate text-xs">{sub.child?.itemCode}</span>
                              </td>
                              <td className="px-2 py-1 text-gray-600 truncate border-r border-gray-100 text-xs">{sub.child?.itemName}</td>
                              <td className="px-2 py-1 text-right text-xs text-gray-500 border-r border-gray-100 tabular-nums">{sub.quantity}</td>
                              <td className="px-2 py-1 text-center text-xs text-gray-500 border-r border-gray-100">{sub.unit}</td>
                              <td className="px-2 py-1 text-xs text-gray-400">{sub.memo}</td>
                              <td></td>
                            </tr>
                          ))
                        ) : null
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 푸터 */}
        <div className="px-6 py-3 border-t bg-white shrink-0 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {activeRows.length === 0 ? '구성 품목 없음' : `총 ${activeRows.length}개 구성 품목`}
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="text-xs h-8 rounded-lg px-5" onClick={onClose}>닫기</Button>
            {!readOnly && (
              <Button size="sm" className="text-xs h-8 rounded-lg px-5" onClick={handleSave} disabled={!isDirty || saving}>
                {saving ? '저장 중...' : '저장'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>

    {viewItem && (
      <ItemFormDialog open={!!viewItem} item={viewItem} viewOnly onClose={() => setViewItem(null)} onSaved={() => {}} />
    )}
  </>
  )
}
