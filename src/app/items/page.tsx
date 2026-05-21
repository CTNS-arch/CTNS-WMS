'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import ItemFormDialog from '@/components/items/ItemFormDialog'
import ItemRequestDialog from '@/components/items/ItemRequestDialog'
import BomDialog from '@/components/items/BomDialog'
import ItemBulkCreateDialog from '@/components/items/ItemBulkCreateDialog'
import { CATEGORY_OPTIONS, SUB_OPTIONS, THIRD_LEVEL, THIRD_OPTIONS } from '@/lib/classification'
import { getOptions, ensureServerSync, type SelectOption } from '@/lib/select-options'

const CATEGORY_LABEL: Record<string, string> = { PRODUCT: '완제품', ASSEMBLY: '반제품', COMPONENT: '자재' }
const STATUS_LABEL: Record<string, string> = { ACTIVE: '사용', INACTIVE: '미사용', RESTRICTED: '사용금지', DISCONTINUED: '단종' }
const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  INACTIVE: 'bg-gray-100 text-gray-600',
  RESTRICTED: 'bg-yellow-100 text-yellow-700',
  DISCONTINUED: 'bg-red-100 text-red-700',
}
const CIRCUIT_LABEL: Record<string, string> = { BM: 'BMS', PC: 'PCM' }

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: '사용' },
  { value: 'INACTIVE', label: '미사용' },
  { value: 'RESTRICTED', label: '사용금지' },
  { value: 'DISCONTINUED', label: '단종' },
]
const SORT_OPTIONS = [
  { value: 'createdAt', label: '등록일' },
  { value: 'updatedAt', label: '수정일' },
  { value: 'itemCode', label: '품번' },
  { value: 'itemName', label: '품명' },
  { value: 'status', label: '상태' },
  { value: 'revisionNumber', label: '리비전' },
]

const ALL_SUB_OPTIONS = [
  ...(SUB_OPTIONS.PRODUCT ?? []),
  ...(SUB_OPTIONS.ASSEMBLY ?? []),
  ...(SUB_OPTIONS.COMPONENT ?? []),
]

const toParam = (arr: string[]) => arr.length > 0 ? arr.join(',') : undefined

export default function ItemsPage() {
  const { data: session } = useSession()
  const canWrite = (session?.user?.roles?.includes('ITEM_WRITE') || session?.user?.roles?.includes('MASTER_ADMIN')) ?? false

  const [requestFormOpen, setRequestFormOpen] = useState(false)

  // ── 필터 ──
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')   // 단일 선택
  const [filterSubCategory, setFilterSubCategory] = useState<string[]>([])
  const [filterStatus, setFilterStatus] = useState<string[]>([])
  const [filterChemistry, setFilterChemistry] = useState<string[]>([])
  const [filterCellModel, setFilterCellModel] = useState<string[]>([])
  const [filterCircuit, setFilterCircuit] = useState<string[]>([])
  const [filterPackType, setFilterPackType] = useState<string[]>([])
  const [filterMaterial, setFilterMaterial] = useState<string[]>([])
  const [filterVendor, setFilterVendor] = useState<string[]>([])
  const [filterSeriesCount, setFilterSeriesCount] = useState('')
  const [filterParallelCount, setFilterParallelCount] = useState('')
  const [filterLayerCount, setFilterLayerCount] = useState('')
  const [filterLengthMin, setFilterLengthMin] = useState('')
  const [filterWidthMin, setFilterWidthMin] = useState('')
  const [filterHeightMin, setFilterHeightMin] = useState('')
  const [filterDiameterMin, setFilterDiameterMin] = useState('')
  const [filterWeightMin, setFilterWeightMin] = useState('')
  const [filterFormFactor, setFilterFormFactor] = useState<string[]>([])
  const [filterCertification, setFilterCertification] = useState<string[]>([])
  const [filterSpecialOption, setFilterSpecialOption] = useState<string[]>([])
  const [filterBMSItems, setFilterBMSItems] = useState<string[]>([])   // UI용 (item IDs)
  const [filterCLItems, setFilterCLItems] = useState<string[]>([])     // UI용 (item IDs)
  // 셀(CL) 전기사양 필터 (이상)
  const [filterDischargeCutoffMin, setFilterDischargeCutoffMin] = useState('')
  const [filterNominalVoltageMin, setFilterNominalVoltageMin] = useState('')
  const [filterChargeCutoffMin, setFilterChargeCutoffMin] = useState('')
  const [filterNominalCapacityMin, setFilterNominalCapacityMin] = useState('')
  const [filterEnergyMin, setFilterEnergyMin] = useState('')
  const [filterMaxChargeCurrentMin, setFilterMaxChargeCurrentMin] = useState('')
  const [filterMaxDischargeCurrentMin, setFilterMaxDischargeCurrentMin] = useState('')
  const [filterContinuousChargeCurrentMin, setFilterContinuousChargeCurrentMin] = useState('')
  const [filterContinuousDischargeCurrentMin, setFilterContinuousDischargeCurrentMin] = useState('')
  const [filterChargeCRateMin, setFilterChargeCRateMin] = useState('')
  const [filterDischargeCRateMin, setFilterDischargeCRateMin] = useState('')

  // ── 정렬 ──
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // ── 데이터 ──
  const [items, setItems] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const limit = 20

  // ── 선택 ──
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // ── 다이얼로그 ──
  const [formOpen, setFormOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteBomEntries, setDeleteBomEntries] = useState<any[]>([])
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false)
  const [batchStatusOpen, setBatchStatusOpen] = useState(false)
  const [batchStatus, setBatchStatus] = useState('')
  const [bomItem, setBomItem] = useState<any>(null)
  const [bulkFormOpen, setBulkFormOpen] = useState(false)

  // ── 옵션 ──
  const [chemistryOpts, setChemistryOpts] = useState<SelectOption[]>([])
  const [cellModelOpts, setCellModelOpts] = useState<SelectOption[]>([])
  const [circuitOpts, setCircuitOpts] = useState<SelectOption[]>([])
  const [packTypeOpts, setPackTypeOpts] = useState<SelectOption[]>([])
  const [materialOpts, setMaterialOpts] = useState<SelectOption[]>([])
  const [vendorOpts, setVendorOpts] = useState<SelectOption[]>([])
  const [certificationOpts, setCertificationOpts] = useState<SelectOption[]>([])
  const [specialOptionOpts, setSpecialOptionOpts] = useState<SelectOption[]>([])
  const [bmsItemOpts, setBmsItemOpts] = useState<{ value: string; label: string; subCat: string }[]>([])
  const [clItemOpts, setClItemOpts] = useState<{ value: string; label: string; cellModel: string; chemistryType: string }[]>([])

  useEffect(() => {
    ensureServerSync().then(() => {
      setChemistryOpts(getOptions('chemistryType'))
      setCellModelOpts(getOptions('cellModel'))
      setCircuitOpts(getOptions('circuit'))
      setPackTypeOpts(getOptions('packType'))
      setMaterialOpts(getOptions('material'))
      setVendorOpts(getOptions('vendor'))
      setCertificationOpts(getOptions('certification'))
      setSpecialOptionOpts(getOptions('specialOption'))
    })
  }, [])

  useEffect(() => {
    fetch('/api/items?category=ASSEMBLY&subCategory=BM,PC&limit=200&sortBy=itemCode&sortOrder=asc')
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setBmsItemOpts(json.data.items.map((item: any) => ({
            value: item.id,
            label: `${item.itemName} (${item.subCategory === 'BM' ? 'BMS' : 'PCM'})`,
            subCat: item.subCategory,
          })))
        }
      }).catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/items?category=COMPONENT&subCategory=CL&limit=200&sortBy=itemCode&sortOrder=asc')
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setClItemOpts(json.data.items
            .filter((item: any) => item.cellModel)
            .map((item: any) => ({
              value: item.id,
              label: item.itemName,
              cellModel: item.cellModel,
              chemistryType: item.chemistryType ?? '',
            }))
          )
        }
      }).catch(() => {})
  }, [])

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const subOpts = filterCategory ? (SUB_OPTIONS[filterCategory] ?? []) : ALL_SUB_OPTIONS

  // 뷰 타입
  const isProd = filterCategory === 'PRODUCT'
  const isAsm  = filterCategory === 'ASSEMBLY'
  const isComp = filterCategory === 'COMPONENT'
  const isAll  = !filterCategory
  // 반제품 세부 뷰 (중분류 기반)
  const isPO       = isAsm && filterSubCategory.length > 0 && filterSubCategory.every(s => s === 'PO')
  const isBmsPcm   = isAsm && filterSubCategory.length > 0 && filterSubCategory.every(s => ['BM', 'PC'].includes(s))
  const isAsmGeneric = isAsm && !isPO && !isBmsPcm
  const isCell      = isComp && filterSubCategory.length > 0 && filterSubCategory.every(s => s === 'CL')
  const isCompOther = isComp && !isCell
  const isElComp    = isComp && filterSubCategory.length > 0 && filterSubCategory.every(s => s === 'EL')
  const isCharger   = isAsm && filterSubCategory.length > 0 && filterSubCategory.every(s => s === 'CHG')

  // 소분류(3분류) 필터: COMPONENT + CL 제외 단일 중분류 선택 시
  const singleNonClSub = isComp && filterSubCategory.length === 1 && filterSubCategory[0] !== 'CL'
    ? filterSubCategory[0] : null
  const thirdDef = singleNonClSub ? (THIRD_LEVEL[singleNonClSub] ?? null) : null
  const formFactorOpts = thirdDef
    ? (thirdDef.optKey ? getOptions(thirdDef.optKey) : (thirdDef.staticOptions ?? []))
    : []

  // 화학계 선택 시 셀 품목/모델 옵션 캐스케이딩 (실제 등록된 CL 품목 기반)
  const filteredClItemOpts = filterChemistry.length > 0
    ? clItemOpts.filter(o => filterChemistry.includes(o.chemistryType))
    : clItemOpts
  // 셀 모델 필터 옵션: 등록된 CL 품목의 cellModel 값에서 dedup (화학계 필터 적용)
  const cellModelFilterOpts = (() => {
    const source = filterChemistry.length > 0 ? filteredClItemOpts : clItemOpts
    const seen = new Set<string>()
    return source
      .filter(o => o.cellModel && !seen.has(o.cellModel) && seen.add(o.cellModel))
      .map(o => ({ value: o.cellModel, label: o.cellModel, colorIndex: 0 as number }))
  })()

  // 뷰별 총 컬럼 수 (colSpan 계산용) — BOM 컬럼은 isComp 제외
  const hasBomCol = !isComp
  const colCount = isAll ? 11 : (isProd || isPO) ? 24 : isBmsPcm ? 15 : isCharger ? 22 : isAsmGeneric ? 19 : isCell ? 26 : isElComp ? 23 : isCompOther ? 22 : 17

  const fetchItems = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: String(limit), sortBy, sortOrder })
    if (search) params.set('search', search)
    if (filterCategory) params.set('category', filterCategory)
    const subParam = toParam(filterSubCategory)
    const statusParam = toParam(filterStatus)
    const chemParam = toParam(filterChemistry)
    const cellParam = toParam(filterCellModel)
    const circuitParam = toParam(filterCircuit)
    const packParam = toParam(filterPackType)
    const matParam = toParam(filterMaterial)
    const vendorParam = toParam(filterVendor)
    const ffParam = toParam(filterFormFactor)
    if (subParam) params.set('subCategory', subParam)
    if (statusParam) params.set('status', statusParam)
    if (chemParam) params.set('chemistryType', chemParam)
    if (cellParam) params.set('cellModel', cellParam)
    if (circuitParam) params.set('circuit', circuitParam)
    if (packParam) params.set('packType', packParam)
    if (matParam) params.set('material', matParam)
    if (ffParam) params.set('formFactor', ffParam)
    if (vendorParam) params.set('vendor', vendorParam)
    const certParam = toParam(filterCertification)
    const spOptParam = toParam(filterSpecialOption)
    if (certParam) params.set('certification', certParam)
    if (spOptParam) params.set('specialOption', spOptParam)
    const bomChildIds = [...filterBMSItems, ...filterCLItems]
    if (bomChildIds.length > 0) params.set('bomChild', bomChildIds.join(','))
    if (filterSeriesCount) params.set('seriesCount', filterSeriesCount)
    if (filterParallelCount) params.set('parallelCount', filterParallelCount)
    if (filterLayerCount) params.set('layerCount', filterLayerCount)
    if (filterLengthMin) params.set('lengthMin', filterLengthMin)
    if (filterWidthMin) params.set('widthMin', filterWidthMin)
    if (filterHeightMin) params.set('heightMin', filterHeightMin)
    if (filterDiameterMin) params.set('diameterMin', filterDiameterMin)
    if (filterWeightMin) params.set('weightMin', filterWeightMin)
    if (filterDischargeCutoffMin) params.set('dischargeCutoffVoltageMin', filterDischargeCutoffMin)
    if (filterNominalVoltageMin) params.set('nominalVoltageMin', filterNominalVoltageMin)
    if (filterChargeCutoffMin) params.set('chargeCutoffVoltageMin', filterChargeCutoffMin)
    if (filterNominalCapacityMin) params.set('nominalCapacityMin', filterNominalCapacityMin)
    if (filterEnergyMin) params.set('energyMin', filterEnergyMin)
    if (filterMaxChargeCurrentMin) params.set('maxChargeCurrentMin', filterMaxChargeCurrentMin)
    if (filterMaxDischargeCurrentMin) params.set('maxDischargeCurrentMin', filterMaxDischargeCurrentMin)
    if (filterContinuousChargeCurrentMin) params.set('continuousChargeCurrentMin', filterContinuousChargeCurrentMin)
    if (filterContinuousDischargeCurrentMin) params.set('continuousDischargeCurrentMin', filterContinuousDischargeCurrentMin)
    if (filterChargeCRateMin) params.set('chargeCRateMin', filterChargeCRateMin)
    if (filterDischargeCRateMin) params.set('dischargeCRateMin', filterDischargeCRateMin)

    const res = await fetch(`/api/items?${params}`)
    const json = await res.json()
    if (json.success) { setItems(json.data.items); setTotal(json.data.total) }
    setLoading(false)
  }, [page, search, filterCategory, filterSubCategory, filterStatus,
    filterChemistry, filterCellModel, filterCircuit, filterPackType, filterMaterial,
    filterFormFactor, filterVendor, filterCertification, filterSpecialOption,
    filterBMSItems, filterCLItems,
    filterSeriesCount, filterParallelCount, filterLayerCount,
    filterLengthMin, filterWidthMin, filterHeightMin, filterDiameterMin, filterWeightMin,
    filterDischargeCutoffMin, filterNominalVoltageMin, filterChargeCutoffMin,
    filterNominalCapacityMin, filterEnergyMin,
    filterMaxChargeCurrentMin, filterMaxDischargeCurrentMin,
    filterContinuousChargeCurrentMin, filterContinuousDischargeCurrentMin,
    filterChargeCRateMin, filterDischargeCRateMin,
    sortBy, sortOrder])

  useEffect(() => { fetchItems() }, [fetchItems])

  const resetAndPage = () => { setPage(1); setSelected(new Set()) }

  const debounce = (setter: (v: string) => void) => (v: string) => {
    setter(v)
    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(resetAndPage, 300)
  }

  const handleBMSItemsChange = (selectedIds: string[]) => {
    setFilterBMSItems(selectedIds)
    resetAndPage()
  }

  const handleCLItemsChange = (selectedIds: string[]) => {
    setFilterCLItems(selectedIds)
    resetAndPage()
  }

  const resetFilters = () => {
    setSearch('')
    setFilterCategory(''); setFilterSubCategory([]); setFilterStatus([])
    setFilterChemistry([]); setFilterCellModel([]); setFilterCircuit([])
    setFilterPackType([]); setFilterMaterial([]); setFilterVendor([])
    setFilterFormFactor([])
    setFilterCertification([]); setFilterSpecialOption([])
    setFilterBMSItems([]); setFilterCLItems([])
    setFilterSeriesCount(''); setFilterParallelCount(''); setFilterLayerCount('')
    setFilterLengthMin(''); setFilterWidthMin(''); setFilterHeightMin(''); setFilterDiameterMin(''); setFilterWeightMin('')
    setFilterDischargeCutoffMin(''); setFilterNominalVoltageMin(''); setFilterChargeCutoffMin('')
    setFilterNominalCapacityMin(''); setFilterEnergyMin('')
    setFilterMaxChargeCurrentMin(''); setFilterMaxDischargeCurrentMin('')
    setFilterContinuousChargeCurrentMin(''); setFilterContinuousDischargeCurrentMin('')
    setFilterChargeCRateMin(''); setFilterDischargeCRateMin('')
    setPage(1); setSelected(new Set())
  }

  const handleCategoryChange = (val: string) => {
    const next = filterCategory === val ? '' : val
    setFilterCategory(next)
    const allowed = new Set((SUB_OPTIONS[next] ?? []).map((o: any) => o.value))
    setFilterSubCategory(prev => prev.filter(s => allowed.has(s)))
    if (next !== 'PRODUCT') {
      setFilterChemistry([]); setFilterCellModel([]); setFilterCircuit([])
      setFilterPackType([]); setFilterSeriesCount(''); setFilterParallelCount(''); setFilterLayerCount('')
      setFilterBMSItems([]); setFilterCLItems([])
      setFilterCertification([]); setFilterSpecialOption([])
    }
    setFilterFormFactor([])
    if (next === 'PRODUCT') {
      setFilterLengthMin(''); setFilterWidthMin(''); setFilterHeightMin(''); setFilterDiameterMin(''); setFilterWeightMin('')
    }
    if (next === 'COMPONENT') setFilterVendor([])
    if (next !== 'COMPONENT') setFilterMaterial([])
    resetAndPage()
  }

  const buildInitialValues = () => {
    const vals: Record<string, any> = {}
    if (filterCategory) vals.category = filterCategory
    if (filterSubCategory.length === 1) vals.subCategory = filterSubCategory[0]
    if (filterStatus.length === 1) vals.status = filterStatus[0]
    if (filterChemistry.length === 1) vals.chemistryType = filterChemistry[0]
    if (filterCellModel.length === 1) vals.cellModel = filterCellModel[0]
    if (filterCircuit.length === 1) vals.circuit = filterCircuit[0]
    if (filterPackType.length === 1) vals.packType = filterPackType[0]
    if (filterMaterial.length === 1) vals.material = filterMaterial[0]
    if (filterSeriesCount) vals.seriesCount = filterSeriesCount
    if (filterParallelCount) vals.parallelCount = filterParallelCount
    if (filterLayerCount) vals.layerCount = filterLayerCount
    return vals
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }
  const toggleAll = () => {
    setSelected(prev => prev.size === items.length && items.length > 0 ? new Set() : new Set(items.map(i => i.id)))
  }

  const openDeleteDialog = async (id: string) => {
    setDeleteBomEntries([])
    setDeleteId(id)
    try {
      const res = await fetch(`/api/items/${id}`)
      const json = await res.json()
      if (json.success) {
        const entries = [...(json.data.bomAsParent ?? []), ...(json.data.bomAsChild ?? [])]
        setDeleteBomEntries(entries)
      }
    } catch {}
  }

  const handleDelete = async () => {
    if (!deleteId) return
    const force = deleteBomEntries.length > 0
    const res = await fetch(`/api/items/${deleteId}?force=${force}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.success) { toast.success('삭제되었습니다.'); fetchItems() }
    else toast.error(json.message)
    setDeleteId(null)
    setDeleteBomEntries([])
  }

  const handleBatchDelete = async () => {
    const res = await fetch('/api/items/batch', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selected) }),
    })
    const json = await res.json()
    if (json.success) { toast.success(json.message); setSelected(new Set()); fetchItems() }
    else toast.error(json.message)
    setBatchDeleteOpen(false)
  }

  const handleBatchStatus = async () => {
    if (!batchStatus) return
    const res = await fetch('/api/items/batch', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selected), status: batchStatus }),
    })
    const json = await res.json()
    if (json.success) { toast.success(json.message); setSelected(new Set()); fetchItems() }
    else toast.error(json.message)
    setBatchStatusOpen(false); setBatchStatus('')
  }

  const handleRevise = async (id: string) => {
    const res = await fetch(`/api/items/${id}/revise`)
    const json = await res.json()
    if (json.success) { setEditItem(json.data); setFormOpen(true) }
    else toast.error(json.message ?? '리비전 정보를 불러오지 못했습니다.')
  }

  const handleExport = () => {
    const exportItems = selected.size > 0 ? items.filter(i => selected.has(i.id)) : items
    if (exportItems.length === 0) { toast.error('내보낼 품목이 없습니다.'); return }
    const headers = ['품번', '품명', '대분류', '중분류', '단위', '상태', '화학계', '셀모델', '회로', '팩타입', '직렬', '병렬', '단수', '재질', '리비전', '비고']
    const rows = exportItems.map(i => [
      i.itemCode, i.itemName,
      CATEGORY_LABEL[i.category] ?? i.category,
      i.subCategory ?? '', i.unit,
      STATUS_LABEL[i.status] ?? i.status,
      i.chemistryType ?? '', i.cellModel ?? '', i.circuit ?? '',
      i.packType ?? '',
      i.seriesCount ?? '', i.parallelCount ?? '', i.layerCount ?? '',
      i.material ?? '', i.revisionNumber ?? 1, i.memo ?? '',
    ])
    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `품목목록_${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
    toast.success(`${exportItems.length}개 품목을 내보냈습니다.`)
  }

  const totalPages = Math.ceil(total / limit)
  const hasActiveFilters = !!(
    search || filterCategory || filterSubCategory.length || filterStatus.length ||
    filterChemistry.length || filterCellModel.length || filterCircuit.length ||
    filterPackType.length || filterMaterial.length || filterFormFactor.length || filterVendor.length ||
    filterCertification.length || filterSpecialOption.length ||
    filterSeriesCount || filterParallelCount || filterLayerCount ||
    filterLengthMin || filterWidthMin || filterHeightMin || filterDiameterMin || filterWeightMin ||
    filterDischargeCutoffMin || filterNominalVoltageMin || filterChargeCutoffMin ||
    filterNominalCapacityMin || filterEnergyMin ||
    filterMaxChargeCurrentMin || filterMaxDischargeCurrentMin ||
    filterContinuousChargeCurrentMin || filterContinuousDischargeCurrentMin ||
    filterChargeCRateMin || filterDischargeCRateMin
  )
  const hasBom = (cat: string) => cat === 'PRODUCT' || cat === 'ASSEMBLY'

  // 중분류 코드 → 한글명
  const subLabelMap: Record<string, string> = {}
  Object.values(SUB_OPTIONS).forEach(opts => opts.forEach(o => { subLabelMap[o.value] = o.label }))

  // formFactor 코드 → 한글명 조회 맵 (정적 기본값 + 동적 localStorage 우선)
  const formFactorLabelMap: Record<string, string> = {}
  Object.values(THIRD_OPTIONS).forEach(opts => opts.forEach(o => { formFactorLabelMap[o.value] = o.label }))
  ;['elComponentType', 'meComponentType', 'cdComponentType', 'pkComponentType',
    'fsComponentType', 'smComponentType', 'rmComponentType', 'otComponentType']
    .forEach(key => getOptions(key).forEach((o: SelectOption) => { formFactorLabelMap[o.value] = o.label }))

  // 뷰별 테이블 너비
  const tableWidth = isAll ? 1385 : (isProd || isPO) ? 2410 : isBmsPcm ? 1740 : isCharger ? 2250 : isAsmGeneric ? 1980 : isCell ? 2750 : isElComp ? 2310 : isCompOther ? 2240 : 1820

  return (
    <div className="flex flex-col h-full overflow-hidden">

      <div className="px-6 py-3 border-b bg-white shrink-0">
        <h1 className="text-sm font-semibold text-gray-800">품목 관리</h1>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ── 필터 사이드바 ── */}
        <aside className="w-52 shrink-0 border-r bg-gray-50 flex flex-col">
          <div className="px-4 min-h-[52px] flex items-center border-b shrink-0">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">필터</span>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
            <FilterSection label="대분류">
              <SinglePillGroup
                options={CATEGORY_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                value={filterCategory}
                onChange={handleCategoryChange}
                wrap
              />
            </FilterSection>

            <FilterSection label="중분류">
              <MultiPillGroup
                options={subOpts.map((o: any) => ({ value: o.value, label: o.label }))}
                value={filterSubCategory}
                onChange={v => {
                  setFilterSubCategory(v)
                  setFilterFormFactor([])
                  if (!filterCategory && v.length > 0) {
                    const newSub = v.find(s => !filterSubCategory.includes(s)) ?? v[v.length - 1]
                    for (const [cat, opts] of Object.entries(SUB_OPTIONS)) {
                      if ((opts as any[]).some((o: any) => o.value === newSub)) {
                        setFilterCategory(cat)
                        break
                      }
                    }
                  }
                  resetAndPage()
                }}
                wrap
              />
            </FilterSection>

            {singleNonClSub && formFactorOpts.length > 0 && (
              <FilterSection label={thirdDef!.label}>
                <MultiPillGroup
                  options={formFactorOpts.map(o => ({ value: o.value, label: o.label }))}
                  value={filterFormFactor}
                  onChange={v => { setFilterFormFactor(v); resetAndPage() }}
                  wrap
                />
              </FilterSection>
            )}

            <FilterSection label="상태">
              <MultiPillGroup
                options={STATUS_OPTIONS}
                value={filterStatus}
                onChange={v => { setFilterStatus(v); resetAndPage() }}
                wrap
              />
            </FilterSection>

            {/* 완제품/소프트팩/셀 공통 필터 */}
            {(isAll || isProd || isPO || isCell) && chemistryOpts.length > 0 && (
              <FilterSection label="화학계">
                <SearchableMultiSelect
                  value={filterChemistry}
                  onChange={v => { setFilterChemistry(v); resetAndPage() }}
                  options={chemistryOpts}
                  placeholder="화학계 선택"
                />
              </FilterSection>
            )}

            {isCell && (
              <FilterSection label="셀 모델">
                <SearchableMultiSelect
                  value={filterCellModel}
                  onChange={v => { setFilterCellModel(v); resetAndPage() }}
                  options={cellModelFilterOpts}
                  placeholder="셀 모델 선택"
                />
              </FilterSection>
            )}

            {(isAll || isProd || isPO) && clItemOpts.length > 0 && (
              <FilterSection label="셀 품목">
                <SearchableMultiSelect
                  value={filterCLItems}
                  onChange={handleCLItemsChange}
                  options={filteredClItemOpts.map(o => ({ value: o.value, label: o.label, colorIndex: 0 }))}
                  placeholder="셀 품목 선택"
                />
              </FilterSection>
            )}

            {(isAll || isProd || isPO) && (
              <FilterSection label="회로 품목">
                <SearchableMultiSelect
                  value={filterBMSItems}
                  onChange={handleBMSItemsChange}
                  options={bmsItemOpts.map(o => ({ value: o.value, label: o.label, colorIndex: 0 }))}
                  placeholder="BMS/PCM 품목 선택"
                />
              </FilterSection>
            )}

            {(isAll || isProd || isPO) && packTypeOpts.length > 0 && (
              <FilterSection label="팩타입">
                <MultiPillGroup
                  options={packTypeOpts.map(o => ({ value: o.value, label: o.label }))}
                  value={filterPackType}
                  onChange={v => { setFilterPackType(v); resetAndPage() }}
                  wrap
                />
              </FilterSection>
            )}

            {(isAll || isProd || isPO) && (
              <>
                <FilterSection label="직렬 수 (S)">
                  <input type="number" min="1" value={filterSeriesCount}
                    onChange={e => debounce(setFilterSeriesCount)(e.target.value)}
                    placeholder="예) 12"
                    onWheel={e => e.currentTarget.blur()} className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  />
                </FilterSection>
                <FilterSection label="병렬 수 (P)">
                  <input type="number" min="1" value={filterParallelCount}
                    onChange={e => debounce(setFilterParallelCount)(e.target.value)}
                    placeholder="예) 5"
                    onWheel={e => e.currentTarget.blur()} className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  />
                </FilterSection>
                <FilterSection label="단 수">
                  <input type="number" min="1" value={filterLayerCount}
                    onChange={e => debounce(setFilterLayerCount)(e.target.value)}
                    placeholder="예) 2"
                    onWheel={e => e.currentTarget.blur()} className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  />
                </FilterSection>
              </>
            )}

            {/* 일반반제품/자재(셀 제외) 물리규격 필터 */}
            {(isAsmGeneric || (isComp && !isCell)) && (
              <>
                <FilterSection label="길이 이상(mm)">
                  <input type="number" min="0" value={filterLengthMin}
                    onChange={e => debounce(setFilterLengthMin)(e.target.value)}
                    placeholder="예) 100"
                    onWheel={e => e.currentTarget.blur()} className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  />
                </FilterSection>
                <FilterSection label="폭 이상(mm)">
                  <input type="number" min="0" value={filterWidthMin}
                    onChange={e => debounce(setFilterWidthMin)(e.target.value)}
                    placeholder="예) 50"
                    onWheel={e => e.currentTarget.blur()} className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  />
                </FilterSection>
                <FilterSection label="높이 이상(mm)">
                  <input type="number" min="0" value={filterHeightMin}
                    onChange={e => debounce(setFilterHeightMin)(e.target.value)}
                    placeholder="예) 20"
                    onWheel={e => e.currentTarget.blur()} className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  />
                </FilterSection>
                <FilterSection label="직경 이상(mm)">
                  <input type="number" min="0" value={filterDiameterMin}
                    onChange={e => debounce(setFilterDiameterMin)(e.target.value)}
                    placeholder="예) 18"
                    onWheel={e => e.currentTarget.blur()} className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  />
                </FilterSection>
                <FilterSection label="무게 이상(g)">
                  <input type="number" min="0" value={filterWeightMin}
                    onChange={e => debounce(setFilterWeightMin)(e.target.value)}
                    placeholder="예) 50"
                    onWheel={e => e.currentTarget.blur()} className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  />
                </FilterSection>
              </>
            )}

            {/* 셀(CL) 전용: 물리 + 전기사양 필터 */}
            {isCell && (() => {
              const numCls = 'w-full text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400'
              const cellElecFilters: [string, string, string, (v: string) => void][] = [
                ['직경 이상(mm)',       '예) 18',  filterDiameterMin,                  setFilterDiameterMin],
                ['높이 이상(mm)',       '예) 65',  filterHeightMin,                    setFilterHeightMin],
                ['방전종료전압 이상(V)', '예) 2.5', filterDischargeCutoffMin,           setFilterDischargeCutoffMin],
                ['공칭전압 이상(V)',    '예) 3.2', filterNominalVoltageMin,            setFilterNominalVoltageMin],
                ['충전종료전압 이상(V)', '예) 3.65',filterChargeCutoffMin,             setFilterChargeCutoffMin],
                ['공칭용량 이상(Ah)',   '예) 100', filterNominalCapacityMin,           setFilterNominalCapacityMin],
                ['에너지 이상(Wh)',     '예) 320', filterEnergyMin,                    setFilterEnergyMin],
                ['피크충전전류 이상(A)', '예) 100', filterMaxChargeCurrentMin,          setFilterMaxChargeCurrentMin],
                ['피크방전전류 이상(A)', '예) 200', filterMaxDischargeCurrentMin,       setFilterMaxDischargeCurrentMin],
                ['연속충전전류 이상(A)', '예) 50',  filterContinuousChargeCurrentMin,   setFilterContinuousChargeCurrentMin],
                ['연속방전전류 이상(A)', '예) 100', filterContinuousDischargeCurrentMin,setFilterContinuousDischargeCurrentMin],
                ['충전C-rate 이상',    '예) 0.5', filterChargeCRateMin,               setFilterChargeCRateMin],
                ['방전C-rate 이상',    '예) 1.0', filterDischargeCRateMin,            setFilterDischargeCRateMin],
              ]
              return cellElecFilters.map(([label, ph, val, setter]) => (
                <FilterSection key={label} label={label}>
                  <input type="number" min="0" value={val}
                    onChange={e => debounce(setter)(e.target.value)}
                    onWheel={e => e.currentTarget.blur()}
                    placeholder={ph}
                    className={numCls}
                  />
                </FilterSection>
              ))
            })()}

            {/* 자재(셀 제외): 재질 */}
            {materialOpts.length > 0 && (isAll || (isComp && !isCell)) && (
              <FilterSection label="재질">
                <SearchableMultiSelect
                  value={filterMaterial}
                  onChange={v => { setFilterMaterial(v); resetAndPage() }}
                  options={materialOpts}
                  placeholder="재질 선택"
                />
              </FilterSection>
            )}

            {/* 인증 */}
            {certificationOpts.length > 0 && (isAll || isProd || isPO || isBmsPcm) && (
              <FilterSection label="인증">
                <SearchableMultiSelect
                  value={filterCertification}
                  onChange={v => { setFilterCertification(v); resetAndPage() }}
                  options={certificationOpts}
                  placeholder="인증 선택"
                />
              </FilterSection>
            )}

            {/* 특수옵션 */}
            {specialOptionOpts.length > 0 && (isAll || isProd || isPO || isBmsPcm) && (
              <FilterSection label="특수옵션">
                <SearchableMultiSelect
                  value={filterSpecialOption}
                  onChange={v => { setFilterSpecialOption(v); resetAndPage() }}
                  options={specialOptionOpts}
                  placeholder="특수옵션 선택"
                />
              </FilterSection>
            )}

            {/* 고객사: 자재·BMS/PCM 제외 */}
            {vendorOpts.length > 0 && !isComp && !isBmsPcm && (
              <FilterSection label="고객사">
                <SearchableMultiSelect
                  value={filterVendor}
                  onChange={v => { setFilterVendor(v); resetAndPage() }}
                  options={vendorOpts}
                  placeholder="고객사 선택"
                />
              </FilterSection>
            )}
          </div>

          <div className="px-3 py-3 border-t shrink-0 bg-gray-50">
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={resetFilters} disabled={!hasActiveFilters}>
                  초기화
                </Button>
                {canWrite ? (
                  <Button size="sm" className="flex-1 text-xs" disabled={!filterCategory} onClick={() => { setEditItem(null); setFormOpen(true) }}>
                    + 등록
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="flex-1 text-xs border-blue-200 text-blue-600 hover:bg-blue-50"
                    onClick={() => setRequestFormOpen(true)}>
                    + 등록 요청
                  </Button>
                )}
              </div>
              {canWrite && (
                <Button variant="outline" size="sm" className="w-full text-xs" disabled={!filterCategory} onClick={() => setBulkFormOpen(true)}>
                  일괄 등록
                </Button>
              )}
            </div>
          </div>
        </aside>

        {/* ── 메인 콘텐츠 ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* 검색 + 정렬 */}
          <div className="px-4 py-2.5 border-b bg-white flex items-center gap-2 flex-wrap min-h-[52px]">
            <Input
              placeholder="품번 또는 품명 검색"
              value={search}
              onChange={e => debounce(setSearch)(e.target.value)}
              className="w-80 h-8 text-sm"
            />
            {selected.size > 0 && (
              <div className="flex items-center gap-1.5 pl-2 border-l">
                <span className="text-xs text-gray-500 font-medium">{selected.size}개 선택</span>
                <Select value="" onValueChange={v => { if (v) { setBatchStatus(v); setBatchStatusOpen(true) } }}>
                  <SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder="상태 변경" /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" className="h-8 text-xs px-3" onClick={handleExport}>CSV 내보내기</Button>
                <Button size="sm" variant="destructive" className="h-8 text-xs px-3" onClick={() => setBatchDeleteOpen(true)}>삭제</Button>
              </div>
            )}
            <div className="ml-auto flex items-center gap-1.5">
              <Select value={sortBy} onValueChange={v => { setSortBy(v ?? 'createdAt'); setPage(1) }}>
                <SelectTrigger className="h-8 w-28 text-xs">
                  <span className="text-xs truncate">{SORT_OPTIONS.find(o => o.value === sortBy)?.label ?? sortBy}</span>
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" className="h-8 px-3 text-xs"
                onClick={() => { setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); setPage(1) }}>
                {sortOrder === 'asc' ? '오름차순' : '내림차순'}
              </Button>
            </div>
          </div>

          {/* 테이블 */}
          <div className="flex-1 overflow-auto min-h-0">
            <table className="caption-bottom text-sm subpixel-antialiased" style={{ tableLayout: 'fixed', width: `${tableWidth}px`, minWidth: `${tableWidth}px` }}>
              <colgroup>
                {/* 고정 4열 */}
                <col style={{ width: 40 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 200 }} />
                <col style={{ width: 200 }} />
                {/* 대분류, 중분류: 항상 */}
                <col style={{ width: 80 }} />
                <col style={{ width: 130 }} />
                {/* 소분류: 셀이외자재 전용 */}
                {isCompOther && <col style={{ width: 90 }} />}
                {/* 완제품/소프트팩: 화학계, 셀모델, 회로, 팩타입 */}
                {(isProd || isPO) && <><col style={{ width: 80 }} /><col style={{ width: 110 }} /><col style={{ width: 80 }} /><col style={{ width: 80 }} /></>}
                {/* BMS/PCM: 제조사, 최대직렬, 연속방전 */}
                {isBmsPcm && <><col style={{ width: 100 }} /><col style={{ width: 70 }} /><col style={{ width: 80 }} /></>}
                {/* 단위: BMS/PCM 제외 */}
                {!isBmsPcm && <col style={{ width: 55 }} />}
                {/* 이미지: 전체보기에서 단위 다음 */}
                {isAll && <col style={{ width: 100 }} />}
                {/* 완제품/소프트팩: 직렬, 병렬, 단수 */}
                {(isProd || isPO) && <><col style={{ width: 65 }} /><col style={{ width: 65 }} /><col style={{ width: 60 }} /></>}
                {/* 물리규격 */}
                {isAsmGeneric && <><col style={{ width: 70 }} /><col style={{ width: 70 }} /><col style={{ width: 70 }} /><col style={{ width: 70 }} /><col style={{ width: 70 }} /></>}
                {/* 셀: 화학계, 셀모델, 직경, 높이, 전기사양 11개, 스펙시트 */}
                {isCell && <><col style={{ width: 85 }} /><col style={{ width: 120 }} /><col style={{ width: 75 }} /><col style={{ width: 75 }} /><col style={{ width: 105 }} /><col style={{ width: 85 }} /><col style={{ width: 105 }} /><col style={{ width: 90 }} /><col style={{ width: 80 }} /><col style={{ width: 100 }} /><col style={{ width: 100 }} /><col style={{ width: 100 }} /><col style={{ width: 100 }} /><col style={{ width: 85 }} /><col style={{ width: 85 }} /><col style={{ width: 80 }} /></>}
                {/* 충전기: 직렬 수, 충전종료전압, 충전전류 */}
                {isCharger && <><col style={{ width: 65 }} /><col style={{ width: 105 }} /><col style={{ width: 100 }} /></>}
                {/* 셀이외자재: 가로, 세로, 높이, 내경가로, 내경세로, 내경높이, 직경, 두께, 무게 */}
                {isCompOther && <><col style={{ width: 70 }} /><col style={{ width: 70 }} /><col style={{ width: 70 }} /><col style={{ width: 100 }} /><col style={{ width: 100 }} /><col style={{ width: 100 }} /><col style={{ width: 80 }} /><col style={{ width: 70 }} /><col style={{ width: 70 }} /></>}
                {/* 재질: 일반반제품·셀이외자재 */}
                {(isAsmGeneric || isCompOther) && <col style={{ width: 85 }} />}
                {/* 색상: 셀이외자재 */}
                {isCompOther && <col style={{ width: 85 }} />}
                {/* 정격전류: EL 컴포넌트 */}
                {isElComp && <col style={{ width: 80 }} />}
                {/* 이미지 */}
                {(isAsmGeneric || isComp || isBmsPcm) && <col style={{ width: 100 }} />}
                {/* 일반반제품: 고객사 */}
                {isAsmGeneric && <col style={{ width: 80 }} />}
                {/* 완제품/소프트팩: 특수옵션, 인증, 도면, 이미지 */}
                {(isProd || isPO) && <><col style={{ width: 80 }} /><col style={{ width: 80 }} /><col style={{ width: 80 }} /><col style={{ width: 100 }} /></>}
                {/* BMS/PCM: 특수옵션 */}
                {isBmsPcm && <col style={{ width: 80 }} />}
                {/* 완제품/소프트팩: 고객사 (이미지 다음) */}
                {(isProd || isPO) && <col style={{ width: 80 }} />}
                {/* 리비전: 자재·전체보기 제외 */}
                {!isComp && !isAll && <col style={{ width: 80 }} />}
                {/* 비고, BOM(isComp 제외), 관리: 항상 */}
                <col style={{ width: 200 }} />
                {hasBomCol && <col style={{ width: 80 }} />}
                <col style={{ width: 160 }} />
              </colgroup>

              <TableHeader className="sticky top-0 z-20 bg-gray-50 text-xs">
                <TableRow>
                  <TableHead style={{ left: 0 }} className="sticky z-20 bg-gray-50 pl-4">
                    <input type="checkbox"
                      checked={selected.size === items.length && items.length > 0}
                      onChange={toggleAll} className="rounded" />
                  </TableHead>
                  <TableHead style={{ left: 40 }} className="sticky z-20 bg-gray-50 whitespace-nowrap text-xs">상태</TableHead>
                  <TableHead style={{ left: 120 }} className="sticky z-20 bg-gray-50 whitespace-nowrap text-xs">품번 코드</TableHead>
                  <TableHead style={{ left: 320 }} className="sticky z-20 bg-gray-50 whitespace-nowrap text-xs border-r border-gray-300">품목명</TableHead>
                  <TableHead className="whitespace-nowrap text-xs">대분류</TableHead>
                  <TableHead className="whitespace-nowrap text-xs">중분류</TableHead>
                  {isCompOther && <TableHead className="whitespace-nowrap text-xs">소분류</TableHead>}
                  {(isProd || isPO) && <>
                    <TableHead className="whitespace-nowrap text-xs">화학계</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">셀 모델</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">회로</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">팩타입</TableHead>
                  </>}
                  {isBmsPcm && <>
                    <TableHead className="whitespace-nowrap text-xs">제조사</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">최대직렬(S)</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">연속방전(A)</TableHead>
                  </>}
                  {!isBmsPcm && <TableHead className="whitespace-nowrap text-xs">단위</TableHead>}
                  {isAll && <TableHead className="whitespace-nowrap text-xs">이미지</TableHead>}
                  {(isProd || isPO) && <>
                    <TableHead className="whitespace-nowrap text-xs">직렬(S)</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">병렬(P)</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">단수</TableHead>
                  </>}
                  {isAsmGeneric && <>
                    <TableHead className="whitespace-nowrap text-xs">길이(mm)</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">폭(mm)</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">높이(mm)</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">직경(mm)</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">무게(g)</TableHead>
                  </>}
                  {isCell && <>
                    <TableHead className="whitespace-nowrap text-xs">화학계</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">셀 모델</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">직경(mm)</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">높이(mm)</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">방전종료전압(V)</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">공칭전압(V)</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">충전종료전압(V)</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">공칭용량(Ah)</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">에너지(Wh)</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">피크충전전류(A)</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">피크방전전류(A)</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">연속충전전류(A)</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">연속방전전류(A)</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">충전 C-rate</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">방전 C-rate</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">스펙시트</TableHead>
                  </>}
                  {isCharger && <>
                    <TableHead className="whitespace-nowrap text-xs">직렬 수(S)</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">충전종료전압(V)</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">충전전류(A)</TableHead>
                  </>}
                  {isCompOther && <>
                    <TableHead className="whitespace-nowrap text-xs">가로(mm)</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">세로(mm)</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">높이(mm)</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">내경 가로(mm)</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">내경 세로(mm)</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">내경 높이(mm)</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">직경(mm)</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">두께(mm)</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">무게(g)</TableHead>
                  </>}
                  {(isAsmGeneric || isCompOther) && <TableHead className="whitespace-nowrap text-xs">재질</TableHead>}
                  {isCompOther && <TableHead className="whitespace-nowrap text-xs">색상</TableHead>}
                  {isElComp && <TableHead className="whitespace-nowrap text-xs">정격전류(A)</TableHead>}
                  {(isAsmGeneric || isComp || isBmsPcm) && <TableHead className="whitespace-nowrap text-xs">이미지</TableHead>}
                  {isAsmGeneric && <TableHead className="whitespace-nowrap text-xs">고객사</TableHead>}
                  {(isProd || isPO) && <>
                    <TableHead className="whitespace-nowrap text-xs">특수옵션</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">인증</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">도면</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">이미지</TableHead>
                  </>}
                  {isBmsPcm && <TableHead className="whitespace-nowrap text-xs">특수옵션</TableHead>}
                  {(isProd || isPO) && <TableHead className="whitespace-nowrap text-xs">고객사</TableHead>}
                  {!isComp && !isAll && <TableHead className="whitespace-nowrap text-xs">리비전</TableHead>}
                  <TableHead className="whitespace-nowrap text-xs">비고</TableHead>
                  {hasBomCol && <TableHead className="whitespace-nowrap text-xs">BOM</TableHead>}
                  <TableHead className="whitespace-nowrap text-xs pr-4">관리</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={colCount} className="text-center py-16 text-gray-400 text-xs">불러오는 중...</TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={colCount} className="text-center py-16 text-gray-400 text-xs">품목이 없습니다.</TableCell>
                  </TableRow>
                ) : items.map(item => {
                  const sel = selected.has(item.id)
                  const stickyCls = `sticky z-10 transition-colors ${sel ? 'bg-blue-50 group-hover:bg-blue-50' : 'bg-white group-hover:bg-gray-50'}`
                  return (
                    <TableRow key={item.id} className={`group transition-colors ${sel ? 'bg-blue-50 hover:bg-blue-50' : 'hover:bg-gray-50'}`}>
                      <TableCell style={{ left: 0 }} className={`${stickyCls} pl-4`}>
                        <input type="checkbox" checked={sel} onChange={() => toggleSelect(item.id)} className="rounded" />
                      </TableCell>
                      <TableCell style={{ left: 40 }} className={stickyCls}>
                        <span className={`text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap ${STATUS_COLOR[item.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {STATUS_LABEL[item.status] ?? item.status}
                        </span>
                      </TableCell>
                      <TableCell style={{ left: 120 }} className={`${stickyCls} font-mono`}>
                        <TooltipCell value={item.itemCode} />
                      </TableCell>
                      <TableCell style={{ left: 320 }} className={`${stickyCls} border-r border-gray-300`}>
                        <TooltipCell value={item.itemName} />
                      </TableCell>
                      <TableCell><TooltipCell value={CATEGORY_LABEL[item.category] ?? item.category} /></TableCell>
                      <TableCell><TooltipCell value={item.subCategory ? (subLabelMap[item.subCategory] ?? item.subCategory) : null} /></TableCell>
                      {isCompOther && <TableCell><TooltipCell value={item.formFactor ? (formFactorLabelMap[item.formFactor] ?? item.formFactor) : null} /></TableCell>}
                      {(isProd || isPO) && <>
                        <TableCell><TooltipCell value={item.chemistryType} /></TableCell>
                        <TableCell><TooltipCell value={item.cellModel} /></TableCell>
                        <TableCell><TooltipCell value={item.circuit ? (CIRCUIT_LABEL[item.circuit] ?? item.circuit) : null} /></TableCell>
                        <TableCell><TooltipCell value={item.packType} /></TableCell>
                      </>}
                      {isBmsPcm && <>
                        <TableCell><TooltipCell value={item.manufacturer} /></TableCell>
                        <TableCell className="text-xs text-center text-gray-900">{item.maxSeriesCount ?? '-'}</TableCell>
                        <TableCell className="text-xs text-center text-gray-900">{item.continuousDischargeCurrent != null ? Number(item.continuousDischargeCurrent) : '-'}</TableCell>
                      </>}
                      {!isBmsPcm && <TableCell><TooltipCell value={item.unit} /></TableCell>}
                      {isAll && <TableCell><ImageCell urls={item.images ?? []} /></TableCell>}
                      {(isProd || isPO) && <>
                        <TableCell className="text-xs text-center text-gray-900">{item.seriesCount ?? '-'}</TableCell>
                        <TableCell className="text-xs text-center text-gray-900">{item.parallelCount ?? '-'}</TableCell>
                        <TableCell className="text-xs text-center text-gray-900">{item.layerCount ?? '-'}</TableCell>
                      </>}
                      {isAsmGeneric && <>
                        <TableCell className="text-xs text-center text-gray-900">{item.length != null ? Number(item.length) : '-'}</TableCell>
                        <TableCell className="text-xs text-center text-gray-900">{item.width != null ? Number(item.width) : '-'}</TableCell>
                        <TableCell className="text-xs text-center text-gray-900">{item.height != null ? Number(item.height) : '-'}</TableCell>
                        <TableCell className="text-xs text-center text-gray-900">{item.diameter != null ? Number(item.diameter) : '-'}</TableCell>
                        <TableCell className="text-xs text-center text-gray-900">{item.weight != null ? Number(item.weight) : '-'}</TableCell>
                      </>}
                      {isCell && <>
                        <TableCell><TooltipCell value={item.chemistryType} /></TableCell>
                        <TableCell><TooltipCell value={item.cellModel} /></TableCell>
                        <TableCell className="text-xs text-center text-gray-900">{item.diameter != null ? Number(item.diameter) : '-'}</TableCell>
                        <TableCell className="text-xs text-center text-gray-900">{item.height != null ? Number(item.height) : '-'}</TableCell>
                        <TableCell className="text-xs text-center text-gray-900">{item.dischargeCutoffVoltage != null ? Number(item.dischargeCutoffVoltage) : '-'}</TableCell>
                        <TableCell className="text-xs text-center text-gray-900">{item.nominalVoltage != null ? Number(item.nominalVoltage) : '-'}</TableCell>
                        <TableCell className="text-xs text-center text-gray-900">{item.chargeCutoffVoltage != null ? Number(item.chargeCutoffVoltage) : '-'}</TableCell>
                        <TableCell className="text-xs text-center text-gray-900">{item.nominalCapacity != null ? Number(item.nominalCapacity) : '-'}</TableCell>
                        <TableCell className="text-xs text-center text-gray-900">{item.energy != null ? Number(item.energy) : '-'}</TableCell>
                        <TableCell className="text-xs text-center text-gray-900">{item.maxChargeCurrent != null ? Number(item.maxChargeCurrent) : '-'}</TableCell>
                        <TableCell className="text-xs text-center text-gray-900">{item.maxDischargeCurrent != null ? Number(item.maxDischargeCurrent) : '-'}</TableCell>
                        <TableCell className="text-xs text-center text-gray-900">{item.continuousChargeCurrent != null ? Number(item.continuousChargeCurrent) : '-'}</TableCell>
                        <TableCell className="text-xs text-center text-gray-900">{item.continuousDischargeCurrent != null ? Number(item.continuousDischargeCurrent) : '-'}</TableCell>
                        <TableCell className="text-xs text-center text-gray-900">{item.chargeCRate != null ? Number(item.chargeCRate) : '-'}</TableCell>
                        <TableCell className="text-xs text-center text-gray-900">{item.dischargeCRate != null ? Number(item.dischargeCRate) : '-'}</TableCell>
                        <TableCell><DrawingsCell urls={(item as any).specSheets ?? []} /></TableCell>
                      </>}
                      {isCharger && <>
                        <TableCell className="text-xs text-center text-gray-900">{item.seriesCount ?? '-'}</TableCell>
                        <TableCell className="text-xs text-center text-gray-900">{item.chargeCutoffVoltage != null ? Number(item.chargeCutoffVoltage) : '-'}</TableCell>
                        <TableCell className="text-xs text-center text-gray-900">{item.continuousChargeCurrent != null ? Number(item.continuousChargeCurrent) : '-'}</TableCell>
                      </>}
                      {isCompOther && <>
                        <TableCell className="text-xs text-center text-gray-900">{item.length != null ? Number(item.length) : '-'}</TableCell>
                        <TableCell className="text-xs text-center text-gray-900">{item.width != null ? Number(item.width) : '-'}</TableCell>
                        <TableCell className="text-xs text-center text-gray-900">{item.height != null ? Number(item.height) : '-'}</TableCell>
                        <TableCell className="text-xs text-center text-gray-900">{item.innerLength != null ? Number(item.innerLength) : '-'}</TableCell>
                        <TableCell className="text-xs text-center text-gray-900">{item.innerWidth != null ? Number(item.innerWidth) : '-'}</TableCell>
                        <TableCell className="text-xs text-center text-gray-900">{item.innerHeight != null ? Number(item.innerHeight) : '-'}</TableCell>
                        <TableCell className="text-xs text-center text-gray-900">{item.diameter != null ? Number(item.diameter) : '-'}</TableCell>
                        <TableCell className="text-xs text-center text-gray-900">{item.thickness != null ? Number(item.thickness) : '-'}</TableCell>
                        <TableCell className="text-xs text-center text-gray-900">{item.weight != null ? Number(item.weight) : '-'}</TableCell>
                      </>}
                      {(isAsmGeneric || isCompOther) && <TableCell><TooltipCell value={item.material} /></TableCell>}
                      {isCompOther && <TableCell><TooltipCell value={item.color} /></TableCell>}
                      {isElComp && <TableCell className="text-xs text-center text-gray-900">{item.ratedCurrent != null ? Number(item.ratedCurrent) : '-'}</TableCell>}
                      {(isAsmGeneric || isComp || isBmsPcm) && <TableCell><ImageCell urls={item.images ?? []} /></TableCell>}
                      {isAsmGeneric && <TableCell><TagListCell values={item.vendors ?? []} /></TableCell>}
                      {(isProd || isPO) && <>
                        <TableCell><TagListCell values={item.specialOptions ?? []} /></TableCell>
                        <TableCell><TagListCell values={item.certifications ?? []} /></TableCell>
                        <TableCell><DrawingsCell urls={item.drawings ?? []} /></TableCell>
                        <TableCell><ImageCell urls={item.images ?? []} /></TableCell>
                      </>}
                      {isBmsPcm && <TableCell><TagListCell values={item.specialOptions ?? []} /></TableCell>}
                      {(isProd || isPO) && <TableCell><TagListCell values={item.vendors ?? []} /></TableCell>}
                      {!isComp && !isAll && <TableCell className="text-xs text-gray-900">rev.{item.revisionNumber ?? 1}</TableCell>}
                      <TableCell><TooltipCell value={item.memo} /></TableCell>
                      {hasBomCol && (
                        <TableCell className="pr-1">
                          {hasBom(item.category) ? (
                            <Button size="sm" variant="outline" className="text-xs h-7 px-2 text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => setBomItem(item)}>
                              BOM{(item as any)._count?.bomAsParent > 0 ? ` (${(item as any)._count.bomAsParent})` : ''}
                            </Button>
                          ) : null}
                        </TableCell>
                      )}
                      <TableCell className="pr-2">
                        <div className="flex items-center gap-1 flex-nowrap">
                          <Button size="sm" variant="outline" className="text-xs h-7 px-2" onClick={() => handleRevise(item.id)}>리비전</Button>
                          <Button size="sm" variant="outline" className="text-xs h-7 px-2" onClick={() => { setEditItem(item); setFormOpen(true) }}>수정</Button>
                          <Button size="sm" variant="destructive" className="text-xs h-7 px-2" onClick={() => openDeleteDialog(item.id)}>삭제</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </table>
          </div>

          {/* 페이지네이션 */}
          <div className="px-4 py-2.5 border-t bg-white flex items-center justify-between">
            <span className="text-xs text-gray-500">총 {total}개</span>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>이전</Button>
              <span className="px-2 text-xs text-gray-500">{page} / {totalPages || 1}</span>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>다음</Button>
            </div>
          </div>
        </div>

      </div>

      <ItemFormDialog
        open={formOpen}
        item={editItem}
        initialValues={editItem ? undefined : buildInitialValues()}
        onClose={() => { setFormOpen(false); setEditItem(null) }}
        onSaved={() => { setFormOpen(false); setEditItem(null); fetchItems() }}
      />
      <BomDialog
        open={!!bomItem}
        item={bomItem}
        onClose={() => setBomItem(null)}
        onBomChanged={count => {
          if (!bomItem) return
          setItems(prev => prev.map(it =>
            it.id === bomItem.id
              ? { ...it, _count: { ...(it._count ?? {}), bomAsParent: count } }
              : it
          ))
        }}
      />
      <ItemBulkCreateDialog
        open={bulkFormOpen}
        onClose={() => setBulkFormOpen(false)}
        onSaved={() => { setBulkFormOpen(false); fetchItems() }}
      />

      <ItemRequestDialog
        open={requestFormOpen}
        onClose={() => setRequestFormOpen(false)}
        onSubmitted={() => setRequestFormOpen(false)}
      />

      <AlertDialog open={!!deleteId} onOpenChange={open => { if (!open) { setDeleteId(null); setDeleteBomEntries([]) } }}>
        <AlertDialogContent size={deleteBomEntries.length > 0 ? 'lg' : 'default'}>
          <AlertDialogHeader>
            <AlertDialogTitle>품목을 삭제하시겠습니까?</AlertDialogTitle>
            {deleteBomEntries.length > 0 ? (
              <>
                <AlertDialogDescription className="text-amber-600">
                  아래 BOM 리스트도 삭제됩니다.
                </AlertDialogDescription>
                <div className="max-h-44 overflow-auto border rounded-md bg-gray-50 text-left">
                  <table className="text-xs w-full">
                    <thead className="sticky top-0 bg-gray-100 border-b">
                      <tr>
                        <th className="px-3 py-1.5 font-medium text-gray-500 whitespace-nowrap text-left">품번</th>
                        <th className="px-3 py-1.5 font-medium text-gray-500 whitespace-nowrap text-left">품명</th>
                        <th className="px-3 py-1.5 font-medium text-gray-500 whitespace-nowrap text-right">수량</th>
                        <th className="px-3 py-1.5 font-medium text-gray-500 whitespace-nowrap text-left">비고</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deleteBomEntries.map((e: any) => (
                        <tr key={e.id ?? `${e.parentId}-${e.childId}`} className="border-b border-gray-100 last:border-0">
                          <td className="px-3 py-1.5 font-mono text-gray-700 whitespace-nowrap">{e.child?.itemCode ?? e.childId}</td>
                          <td className="px-3 py-1.5 text-gray-600 max-w-[160px]"><span className="block truncate">{e.child?.itemName ?? '-'}</span></td>
                          <td className="px-3 py-1.5 text-gray-700 text-right whitespace-nowrap">{e.quantity ?? '-'} {e.unit ?? ''}</td>
                          <td className="px-3 py-1.5 text-gray-500 max-w-[120px]"><span className="block truncate">{e.memo ?? '-'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-500 text-left">계속하시겠습니까?</p>
              </>
            ) : (
              <AlertDialogDescription>이 작업은 되돌릴 수 없습니다.</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={batchDeleteOpen} onOpenChange={setBatchDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{selected.size}개 품목을 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>이 작업은 되돌릴 수 없습니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchDelete} className="bg-red-600 hover:bg-red-700">삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={batchStatusOpen} onOpenChange={open => { if (!open) { setBatchStatusOpen(false); setBatchStatus('') } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{selected.size}개 품목 상태 변경</AlertDialogTitle>
            <AlertDialogDescription>
              선택한 {selected.size}개 품목을 &ldquo;{STATUS_LABEL[batchStatus] ?? batchStatus}&rdquo; 상태로 변경합니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchStatus}>변경</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* ── 헬퍼 컴포넌트 ── */

function TagListCell({ values }: { values: string[] }) {
  if (!values || values.length === 0) return <span className="text-gray-400 text-xs">-</span>
  return (
    <div className="relative group/tag inline-flex items-center gap-0.5 cursor-help">
      <svg className="w-3 h-3 text-gray-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
      <span className="text-xs text-gray-500">{values.length}건</span>
      <div className="hidden group-hover/tag:block absolute top-full left-0 z-50 mt-0.5 border border-gray-200 rounded bg-white shadow-lg min-w-[140px] max-w-[240px] py-1 whitespace-normal">
        {values.map((v, i) => (
          <div key={i} className="px-3 py-1 text-xs text-gray-700 whitespace-nowrap">{v}</div>
        ))}
      </div>
    </div>
  )
}

function ImagePreviewModal({ url, onClose }: { url: string; onClose: () => void }) {
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 })
  const transformRef = useRef(transform)
  transformRef.current = transform
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const relX = e.clientX - rect.left - rect.width / 2
      const relY = e.clientY - rect.top - rect.height / 2
      const { scale, x, y } = transformRef.current
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
      const newScale = Math.max(0.1, Math.min(20, scale * factor))
      const ratio = newScale / scale
      setTransform({ scale: newScale, x: relX - (relX - x) * ratio, y: relY - (relY - y) * ratio })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const startDrag = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    setDragging(true)
    dragRef.current = { mx: e.clientX, my: e.clientY, ox: transform.x, oy: transform.y }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    const d = dragRef.current
    if (!d) return
    setTransform(prev => ({ ...prev, x: d.ox + e.clientX - d.mx, y: d.oy + e.clientY - d.my }))
  }
  const endDrag = () => { setDragging(false); dragRef.current = null }
  const reset = () => setTransform({ scale: 1, x: 0, y: 0 })

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/85" onClick={onClose}>
      <div ref={containerRef} className="absolute inset-0 overflow-hidden"
        style={{ cursor: dragging ? 'grabbing' : 'grab' }}
        onClick={e => e.stopPropagation()}
        onMouseDown={startDrag} onMouseMove={onMouseMove} onMouseUp={endDrag} onMouseLeave={endDrag}
        onDoubleClick={reset}
      >
        <img src={url} alt="" draggable={false} style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: `translate(calc(-50% + ${transform.x}px), calc(-50% + ${transform.y}px)) scale(${transform.scale})`,
          transformOrigin: 'center center',
          maxWidth: transform.scale <= 1 ? '90vw' : 'none',
          maxHeight: transform.scale <= 1 ? '90vh' : 'none',
          userSelect: 'none', pointerEvents: 'none', display: 'block',
        }} />
      </div>
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10" onClick={e => e.stopPropagation()}>
        <span className="bg-black/60 text-white/80 text-xs px-2.5 py-1 rounded-full">{Math.round(transform.scale * 100)}%</span>
        <button onClick={reset} className="bg-black/60 text-white text-xs px-2.5 py-1 rounded-full hover:bg-black/80">초기화</button>
        <button onClick={onClose} className="w-8 h-8 bg-white text-gray-800 rounded-full flex items-center justify-center shadow-lg hover:bg-gray-100 text-sm font-bold">×</button>
      </div>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/40 text-xs whitespace-nowrap pointer-events-none">
        스크롤: 확대/축소 · 드래그: 이동 · 더블클릭: 초기화
      </div>
    </div>,
    document.body
  )
}

function ImageCell({ urls }: { urls: string[] }) {
  const [open, setOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!urls || urls.length === 0) return <span className="text-gray-400 text-xs">-</span>

  return (
    <div ref={ref} className="relative inline-block">
      <button onClick={() => setOpen(v => !v)} className="inline-flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-700 cursor-pointer">
        <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="underline">{urls.length}개</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-0.5 border border-gray-200 rounded bg-white shadow-lg min-w-[180px] max-w-[260px] py-1">
          {urls.map((url, i) => {
            const filename = url.split('/').pop()?.replace(/^\d+-[\w-]+-/, '') ?? url
            return (
              <button key={i} type="button"
                onClick={() => { setPreviewUrl(url); setOpen(false) }}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 w-full text-left"
              >
                <img src={url} alt="" className="w-7 h-7 rounded object-cover shrink-0 border border-gray-100" />
                <span className="text-xs text-gray-700 truncate">{filename}</span>
              </button>
            )
          })}
        </div>
      )}

      {previewUrl && <ImagePreviewModal url={previewUrl} onClose={() => setPreviewUrl(null)} />}
    </div>
  )
}

function DrawingsCell({ urls }: { urls: string[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  if (!urls || urls.length === 0) return <span className="text-gray-400 text-xs">-</span>
  return (
    <div ref={ref} className="relative inline-block">
      <button onClick={() => setOpen(v => !v)} className="inline-flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-700 cursor-pointer">
        <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
        <span className="underline">{urls.length}건</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-0.5 border border-gray-200 rounded bg-white shadow-lg min-w-[180px] max-w-[260px] py-1">
          {urls.map((url, i) => {
            const filename = url.split('/').pop()?.replace(/^\d+-[\w-]+-/, '') ?? url
            return (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-xs text-gray-700 hover:text-blue-600 truncate"
                onClick={() => setOpen(false)}>
                <span className="shrink-0">📄</span>
                <span className="truncate">{filename}</span>
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TooltipCell({ value, className = '' }: { value: string | null | undefined; className?: string }) {
  const spanRef = useRef<HTMLSpanElement>(null)
  const [tooltip, setTooltip] = useState<{ top: number; left: number } | null>(null)
  const handleMouseEnter = () => {
    const el = spanRef.current
    if (el && el.scrollWidth > el.clientWidth) {
      const rect = el.getBoundingClientRect()
      setTooltip({ top: rect.bottom + 4, left: rect.left })
    }
  }
  if (!value) return <span className="text-gray-400 text-xs">-</span>
  return (
    <>
      <div onMouseEnter={handleMouseEnter} onMouseLeave={() => setTooltip(null)}>
        <span ref={spanRef} className={`block truncate text-xs text-gray-900 ${className}`}>{value}</span>
      </div>
      {tooltip && createPortal(
        <div style={{ position: 'fixed', top: tooltip.top, left: tooltip.left, zIndex: 9999 }}
          className="border border-gray-200 rounded bg-white shadow-lg py-1.5 px-3 text-xs text-gray-700 whitespace-normal break-words max-w-[280px] pointer-events-none">
          {value}
        </div>,
        document.body
      )}
    </>
  )
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">{label}</p>
      {children}
    </div>
  )
}

function SinglePillGroup({ options, value, onChange, wrap }: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
  wrap?: boolean
}) {
  return (
    <div className={`flex gap-1 ${wrap ? 'flex-wrap' : ''}`}>
      <button type="button" onClick={() => onChange('')}
        className={`text-xs px-2 py-0.5 rounded border transition-colors ${
          value === '' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700'
        }`}>
        전체
      </button>
      {options.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(value === o.value ? '' : o.value)}
          className={`text-xs px-2 py-0.5 rounded border transition-colors ${
            value === o.value ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700'
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function MultiPillGroup({ options, value, onChange, wrap }: {
  options: { value: string; label: string }[]
  value: string[]
  onChange: (v: string[]) => void
  wrap?: boolean
}) {
  const toggle = (val: string) => {
    onChange(value.includes(val) ? value.filter(v => v !== val) : [...value, val])
  }
  return (
    <div className={`flex gap-1 ${wrap ? 'flex-wrap' : ''}`}>
      <button type="button" onClick={() => onChange([])}
        className={`text-xs px-2 py-0.5 rounded border transition-colors ${
          value.length === 0 ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700'
        }`}>
        전체
      </button>
      {options.map(o => (
        <button key={o.value} type="button" onClick={() => toggle(o.value)}
          className={`text-xs px-2 py-0.5 rounded border transition-colors ${
            value.includes(o.value) ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700'
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function SearchableMultiSelect({ value, onChange, options, placeholder = '선택' }: {
  value: string[]
  onChange: (v: string[]) => void
  options: SelectOption[]
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery('') }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(query.toLowerCase()) ||
    o.value.toLowerCase().includes(query.toLowerCase())
  )
  const toggle = (val: string) => {
    onChange(value.includes(val) ? value.filter(v => v !== val) : [...value, val])
  }
  const displayLabel = value.length === 0 ? '전체'
    : value.length === 1 ? (options.find(o => o.value === value[0])?.label ?? value[0])
    : `${value.length}개 선택`
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-white text-left flex items-center justify-between text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400">
        <span className={`truncate ${value.length === 0 ? 'text-gray-400' : ''}`}>{displayLabel}</span>
        <svg className="w-3 h-3 text-gray-400 shrink-0 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-0.5 border border-gray-200 rounded bg-white shadow-lg">
          <div className="px-2 py-1.5 border-b border-gray-100">
            <input type="text" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="검색..." className="w-full text-xs focus:outline-none" autoFocus />
          </div>
          <div className="max-h-44 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-400 text-center">검색 결과 없음</div>
            ) : filtered.map(o => (
              <div key={o.value} onMouseDown={() => toggle(o.value)}
                className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-gray-50 ${value.includes(o.value) ? 'bg-blue-50' : ''}`}>
                <input type="checkbox" checked={value.includes(o.value)} readOnly className="rounded shrink-0 pointer-events-none" />
                <span className="text-xs text-gray-700 truncate">{o.label}</span>
              </div>
            ))}
          </div>
          {value.length > 0 && (
            <div className="border-t border-gray-100 px-2 py-1.5">
              <button onMouseDown={() => onChange([])} className="text-xs text-gray-400 hover:text-gray-600">전체 해제</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
