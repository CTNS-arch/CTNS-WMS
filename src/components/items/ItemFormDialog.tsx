'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TagSelect } from '@/components/ui/tag-select'
import { TagMultiSelect } from '@/components/ui/tag-multi-select'
import { getOptions, addOption, SelectOption, getCellModelGroups, addCellModelGroup, addCellModelEntry, CellModelGroup, ensureServerSync, saveToServer } from '@/lib/select-options'
import {
  buildCodeParts, buildItemCode, buildSimpleCode, buildCellCode,
  buildComponentCode, buildBmsCode, isBatteryPack,
  getItemCodeType, ItemCodeType,
} from '@/lib/item-code'
import {
  CATEGORY_OPTIONS, SUB_OPTIONS, THIRD_LEVEL,
  showElec, showBms, showProductOptions,
} from '@/lib/classification'

interface Props {
  open: boolean
  item?: any
  initialValues?: Partial<typeof EMPTY>
  viewOnly?: boolean
  onClose: () => void
  onSaved: () => void
}

const EMPTY: any = {
  itemCode: '', itemName: '', unit: '', category: '', subCategory: '',
  revisionNumber: 1, status: 'ACTIVE', memo: '',
  length: '', width: '', height: '', diameter: '', weight: '',
  innerLength: '', innerWidth: '', innerHeight: '', thickness: '',
  material: '', packType: '', color: '', formFactor: '', ratedCurrent: '',
  chemistryType: '', cellModel: '', seriesCount: '', parallelCount: '',
  circuit: '', layerCount: '',
  dischargeCutoffVoltage: '', nominalVoltage: '', chargeCutoffVoltage: '',
  nominalCapacity: '', energy: '', maxChargeCurrent: '', maxDischargeCurrent: '',
  continuousChargeCurrent: '', continuousDischargeCurrent: '',
  chargeCRate: '', dischargeCRate: '',
  manufacturer: '', ratedVoltage: '', minSeriesCount: '', maxSeriesCount: '', maxVoltage: '',
  vendors: [] as string[],
  specialOptions: [], certifications: [],
  drawings: [] as string[],
  specSheets: [] as string[],
  images: [] as string[],
}

function SectionHeader({ title, required }: { title: string; required?: boolean }) {
  return (
    <div className="-mx-6 px-6 py-2.5 bg-gray-100 border-t border-b border-gray-200 flex items-center gap-2">
      <div className="w-0.5 h-3.5 bg-blue-500 rounded-full shrink-0" />
      <span className="text-xs font-bold text-gray-600 tracking-wide">{title}{required && <span className="text-red-500 ml-0.5">*</span>}</span>
    </div>
  )
}

function Field({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm text-gray-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  )
}

function LevelRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 relative">
      <div className="absolute bg-gray-300" style={{ left: '-16px', width: '16px', height: '2px', top: '50%', transform: 'translateY(-50%)' }} />
      <span className="text-xs text-gray-400 w-14 shrink-0 text-right">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

function Branch({ children }: { children: React.ReactNode }) {
  return (
    <div className="ml-5 pl-4 border-l-2 border-gray-200 space-y-3">
      {children}
    </div>
  )
}

function CellModelPicker({
  value, groups, onChange, onAddGroup, onAddModel,
}: {
  value: string
  groups: CellModelGroup[]
  onChange: (v: string) => void
  onAddGroup: (mfr: string) => void
  onAddModel: (mfr: string, label: string, code: string) => void
}) {
  const detectedMfr = useMemo(() =>
    groups.find(g => g.models.some(m => m.value === value))?.manufacturer ?? '',
    [value, groups]
  )
  const [selMfr, setSelMfr] = useState(detectedMfr)
  const [addingModel, setAddingModel] = useState(false)
  const [newModelLabel, setNewModelLabel] = useState('')
  const [newModelCode, setNewModelCode] = useState('')

  useEffect(() => { setSelMfr(detectedMfr) }, [detectedMfr])

  const mfrOpts: SelectOption[] = groups.map(g => ({
    value: g.manufacturer, label: g.manufacturer, colorIndex: g.colorIndex,
  }))
  const selectedGroup = groups.find(g => g.manufacturer === selMfr)
  const modelOpts: SelectOption[] = selectedGroup?.models.map(m => ({
    value: m.value, label: m.label, colorIndex: m.colorIndex, code: m.code,
  })) ?? []

  const confirmAddModel = () => {
    if (!newModelCode.trim()) return
    onAddModel(selMfr, newModelLabel, newModelCode.trim())
    onChange(`${selMfr} ${newModelLabel}`)
    setAddingModel(false); setNewModelLabel(''); setNewModelCode('')
  }

  return (
    <>
      <LevelRow label="제조사">
        <TagSelect
          value={selMfr}
          onChange={v => { setSelMfr(v); onChange('') }}
          options={mfrOpts}
          onAdd={mfr => onAddGroup(mfr)}
          placeholder="제조사 선택"
        />
      </LevelRow>
      {selMfr && (
        <LevelRow label="셀 모델">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <TagSelect
                  value={value}
                  onChange={v => {
                    if (modelOpts.find(m => m.value === v)) onChange(v)
                  }}
                  options={modelOpts}
                  onAdd={label => { setNewModelLabel(label); setNewModelCode(''); setAddingModel(true) }}
                  placeholder="모델 선택"
                />
              </div>
            </div>
            {addingModel && (
              <div className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-50 border rounded-md">
                <span className="text-xs font-medium text-gray-600 shrink-0">{newModelLabel}</span>
                <span className="text-gray-300 shrink-0">·</span>
                <input
                  value={newModelCode}
                  onChange={e => setNewModelCode(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') confirmAddModel()
                    if (e.key === 'Escape') setAddingModel(false)
                  }}
                  placeholder="품번 코드 (예: S50E)"
                  autoFocus
                  className="flex-1 text-xs font-mono border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400"
                />
                <button type="button" onClick={confirmAddModel}
                  className="text-xs px-2 py-1 bg-gray-800 text-white rounded hover:bg-gray-700 shrink-0">확인</button>
                <button type="button" onClick={() => setAddingModel(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 shrink-0">취소</button>
              </div>
            )}
          </div>
        </LevelRow>
      )}
    </>
  )
}

function ClassificationTree({
  category, subCategory, thirdValue, opts,
  cellModel, seriesCount, parallelCount, circuit,
  isBP, isCL, isBms,
  manufacturer, minSeriesCount, maxSeriesCount, ratedCurrent,
  bmsRangeMode, onToggleBmsRange,
  cellModelGroups, onAddCellModelGroup, onAddCellModelEntry,
  onCategory, onSub, onThird, onAddOpt, onSet,
  onSelectCLItem, onSelectBMSItem,
  readOnly,
}: {
  category: string; subCategory: string; thirdValue: string
  opts: Record<string, SelectOption[]>
  cellModel: string; seriesCount: string; parallelCount: string; circuit: string
  isBP: boolean; isCL: boolean; isBms: boolean
  manufacturer: string; minSeriesCount: string; maxSeriesCount: string; ratedCurrent: string
  bmsRangeMode: boolean; onToggleBmsRange: () => void
  cellModelGroups: CellModelGroup[]
  onAddCellModelGroup: (mfr: string) => void
  onAddCellModelEntry: (mfr: string, label: string, code: string) => void
  onCategory: (v: string) => void
  onSub: (v: string) => void
  onThird: (field: string, v: string) => void
  onSelectCLItem?: (item: {
    id: string; unit: string
    chemistryType: string | null; cellModel: string | null
    dischargeCutoffVoltage?: number | null; nominalVoltage?: number | null
    chargeCutoffVoltage?: number | null; nominalCapacity?: number | null
    maxChargeCurrent?: number | null; maxDischargeCurrent?: number | null
  }) => void
  onSelectBMSItem?: (item: { id: string; unit: string; subCategory: string }) => void
  onAddOpt: (key: string) => (label: string, code?: string) => void
  onSet: (key: string, val: any) => void
  readOnly?: boolean
}) {
  const subOpts = SUB_OPTIONS[category] ?? []
  const third = subCategory ? THIRD_LEVEL[subCategory] : null
  const thirdOptions = third?.staticOptions ?? (third?.optKey ? opts[third.optKey] : undefined) ?? []
  const canAddThird = !third?.staticOptions && !!third?.optKey

  // BP용 CL 품목 검색 상태
  const [clSearch, setClSearch] = useState('')
  const [clResults, setClResults] = useState<any[]>([])
  const [clAllItems, setClAllItems] = useState<any[]>([])
  const [clSearching, setClSearching] = useState(false)
  const [clShowDropdown, setClShowDropdown] = useState(false)
  const [selectedCL, setSelectedCL] = useState<any | null>(null)
  const clDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const clContainerRef = useRef<HTMLDivElement>(null)

  // BP용 BMS/PCM 품목 검색 상태
  const [bmSearch, setBmSearch] = useState('')
  const [bmResults, setBmResults] = useState<any[]>([])
  const [bmAllItems, setBmAllItems] = useState<any[]>([])
  const [bmSearching, setBmSearching] = useState(false)
  const [bmShowDropdown, setBmShowDropdown] = useState(false)
  const [selectedBM, setSelectedBM] = useState<any | null>(null)
  const bmDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const bmContainerRef = useRef<HTMLDivElement>(null)

  // 클릭 외부 시 드롭다운 닫기 (CL)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clContainerRef.current && !clContainerRef.current.contains(e.target as Node)) {
        setClShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // 클릭 외부 시 드롭다운 닫기 (BMS/PCM)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bmContainerRef.current && !bmContainerRef.current.contains(e.target as Node)) {
        setBmShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // 포커스 시 전체 CL 품목 로드
  const loadAllClItems = async () => {
    setClShowDropdown(true)
    if (clAllItems.length > 0) { setClResults(clSearch.trim() ? clResults : clAllItems); return }
    setClSearching(true)
    try {
      const res = await fetch('/api/items?category=COMPONENT&subCategory=CL&limit=100&sortBy=itemCode&sortOrder=asc')
      const json = await res.json()
      if (json.success) {
        setClAllItems(json.data.items)
        if (!clSearch.trim()) setClResults(json.data.items)
      }
    } catch {}
    setClSearching(false)
  }

  // 포커스 시 전체 BMS/PCM 품목 로드
  const loadAllBmItems = async () => {
    setBmShowDropdown(true)
    if (bmAllItems.length > 0) { setBmResults(bmSearch.trim() ? bmResults : bmAllItems); return }
    setBmSearching(true)
    try {
      const res = await fetch('/api/items?category=ASSEMBLY&subCategory=BM,PC&limit=100&sortBy=itemCode&sortOrder=asc')
      const json = await res.json()
      if (json.success) {
        setBmAllItems(json.data.items)
        if (!bmSearch.trim()) setBmResults(json.data.items)
      }
    } catch {}
    setBmSearching(false)
  }

  useEffect(() => {
    if (!bmSearch.trim()) {
      setBmResults(bmAllItems)
      return
    }
    const filtered = bmAllItems.filter(item =>
      item.itemCode.toLowerCase().includes(bmSearch.toLowerCase()) ||
      item.itemName.toLowerCase().includes(bmSearch.toLowerCase())
    )
    setBmResults(filtered)
    clearTimeout(bmDebounceRef.current)
    bmDebounceRef.current = setTimeout(async () => {
      setBmSearching(true)
      try {
        const res = await fetch(`/api/items?category=ASSEMBLY&subCategory=BM,PC&search=${encodeURIComponent(bmSearch)}&limit=20`)
        const json = await res.json()
        if (json.success) {
          const merged = [...filtered]
          for (const item of json.data.items) {
            if (!merged.some((i: any) => i.id === item.id)) merged.push(item)
          }
          setBmResults(merged)
        }
      } catch {}
      setBmSearching(false)
    }, 300)
  }, [bmSearch, bmAllItems])

  useEffect(() => {
    if (!clSearch.trim()) {
      setClResults(clAllItems)
      return
    }
    const filtered = clAllItems.filter(item =>
      item.itemCode.toLowerCase().includes(clSearch.toLowerCase()) ||
      item.itemName.toLowerCase().includes(clSearch.toLowerCase())
    )
    setClResults(filtered)
    clearTimeout(clDebounceRef.current)
    clDebounceRef.current = setTimeout(async () => {
      setClSearching(true)
      try {
        const res = await fetch(`/api/items?category=COMPONENT&subCategory=CL&search=${encodeURIComponent(clSearch)}&limit=20`)
        const json = await res.json()
        if (json.success) {
          const merged = [...filtered]
          for (const item of json.data.items) {
            if (!merged.some((i: any) => i.id === item.id)) merged.push(item)
          }
          setClResults(merged)
        }
      } catch {}
      setClSearching(false)
    }, 300)
  }, [clSearch, clAllItems])

  if (readOnly) {
    const catLabel = CATEGORY_OPTIONS.find(o => o.value === category)?.label ?? category
    const subLabel = subOpts.find(o => o.value === subCategory)?.label ?? subCategory
    const thirdLabel = thirdOptions.find((o: SelectOption) => o.value === thirdValue)?.label ?? thirdValue
    const circuitLabel = (opts.circuit ?? []).find(o => o.value === circuit)?.label ?? circuit
    const mfrLabel = (opts.manufacturer ?? []).find(o => o.value === manufacturer)?.label ?? manufacturer
    const row = (label: string, value: string) => value ? (
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400 w-20 shrink-0 text-right">{label}</span>
        <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 font-medium">{value}</span>
      </div>
    ) : null
    return (
      <div className="space-y-2">
        {row('1분류', catLabel)}
        {row('2분류', subLabel)}
        {third && row(third.label, thirdLabel)}
        {(isBP || isCL) && cellModel && row('셀 모델', cellModel)}
        {isBP && seriesCount && row('직렬(S)', `${seriesCount}S`)}
        {isBP && parallelCount && row('병렬(P)', `${parallelCount}P`)}
        {isBP && circuit && row('회로', circuitLabel)}
        {isBms && manufacturer && row('제조사', mfrLabel)}
        {isBms && maxSeriesCount && (
          bmsRangeMode && minSeriesCount
            ? row('직렬범위', `${minSeriesCount}S ~ ${maxSeriesCount}S`)
            : row('최대직렬(S)', `${maxSeriesCount}S`)
        )}
        {isBms && ratedCurrent && row('정격전류(A)', `${ratedCurrent}A`)}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400 w-14 shrink-0 text-right">1분류</span>
        <div className="flex-1">
          <TagSelect value={category} onChange={onCategory} options={CATEGORY_OPTIONS} onAdd={() => {}} placeholder="대분류 선택" />
        </div>
      </div>

      {category && (
        <Branch>
          <LevelRow label="2분류">
            {subOpts.length > 0 ? (
              <TagSelect value={subCategory} onChange={onSub} options={subOpts} onAdd={() => {}} placeholder="소분류 선택" />
            ) : (
              <span className="text-xs text-gray-400 px-3 py-2 border rounded-md bg-gray-50 block">미정 (추후 추가 예정)</span>
            )}
          </LevelRow>

          {subCategory && (third || isBP || isCL || isBms) && (
            <Branch>
              {third && !(isBP && onSelectCLItem) && (
                <LevelRow label={third.label}>
                  <TagSelect
                    value={thirdValue}
                    onChange={v => onThird(third.field, v)}
                    options={thirdOptions}
                    onAdd={canAddThird ? onAddOpt(third.optKey!) : () => {}}
                    placeholder={`${third.label} 선택`}
                    requireCode={canAddThird && (third.optKey === 'elComponentType' || third.optKey === 'meComponentType')}
                  />
                </LevelRow>
              )}
              {isBP && onSelectCLItem && (
                <LevelRow label="셀">
                  <div className="relative" ref={clContainerRef}>
                    {selectedCL ? (
                      <div className="flex items-center gap-2 px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-md text-xs">
                        <span className="font-mono text-blue-700">{selectedCL.itemCode}</span>
                        <span className="text-blue-600 flex-1 truncate">{selectedCL.itemName}</span>
                        <button
                          type="button"
                          onClick={() => { setSelectedCL(null); setClSearch(''); setClShowDropdown(false) }}
                          className="text-blue-400 hover:text-blue-600 shrink-0"
                        >×</button>
                      </div>
                    ) : (
                      <Input
                        value={clSearch}
                        onChange={e => setClSearch(e.target.value)}
                        onFocus={loadAllClItems}
                        placeholder="클릭하면 셀 목록 표시 · 입력하여 검색"
                        className="h-8 text-xs"
                      />
                    )}
                    {!selectedCL && clShowDropdown && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border rounded-md shadow-lg z-30 max-h-48 overflow-y-auto">
                        {clSearching ? (
                          <p className="text-xs text-gray-400 px-3 py-2">불러오는 중...</p>
                        ) : clResults.length === 0 ? (
                          <p className="text-xs text-gray-400 px-3 py-2">셀(CL) 품목이 없습니다.</p>
                        ) : clResults.map((item: any) => (
                          <button
                            key={item.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2"
                            onClick={() => {
                              setSelectedCL(item)
                              setClSearch('')
                              setClResults([])
                              setClShowDropdown(false)
                              onSelectCLItem({
                                id: item.id,
                                unit: item.unit ?? 'EA',
                                chemistryType: item.chemistryType ?? null,
                                cellModel: item.cellModel ?? null,
                                dischargeCutoffVoltage: item.dischargeCutoffVoltage ?? null,
                                nominalVoltage: item.nominalVoltage ?? null,
                                chargeCutoffVoltage: item.chargeCutoffVoltage ?? null,
                                nominalCapacity: item.nominalCapacity ?? null,
                                maxChargeCurrent: item.maxChargeCurrent ?? null,
                                maxDischargeCurrent: item.maxDischargeCurrent ?? null,
                              })
                            }}
                          >
                            <span className="font-mono text-gray-500 shrink-0">{item.itemCode}</span>
                            <span className="text-gray-800 truncate">{item.itemName}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </LevelRow>
              )}
              {(isBP || isCL) && !(isBP && onSelectCLItem) && (
                <CellModelPicker
                  value={cellModel}
                  groups={cellModelGroups}
                  onChange={v => onSet('cellModel', v)}
                  onAddGroup={onAddCellModelGroup}
                  onAddModel={onAddCellModelEntry}
                />
              )}
              {isBP && (
                <>
                  <LevelRow label="직렬(S)">
                    <Input type="number" value={seriesCount} onChange={e => onSet('seriesCount', e.target.value)} placeholder="예) 12" />
                  </LevelRow>
                  <LevelRow label="병렬(P)">
                    <Input type="number" value={parallelCount} onChange={e => onSet('parallelCount', e.target.value)} placeholder="예) 5" />
                  </LevelRow>
                  <LevelRow label="회로">
                    {onSelectBMSItem ? (
                      <div className="relative" ref={bmContainerRef}>
                        {selectedBM ? (
                          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-violet-50 border border-violet-200 rounded-md text-xs">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${selectedBM.subCategory === 'BM' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                              {selectedBM.subCategory === 'BM' ? 'BMS' : 'PCM'}
                            </span>
                            <span className="font-mono text-violet-700 shrink-0">{selectedBM.itemCode}</span>
                            <span className="text-violet-600 flex-1 truncate">{selectedBM.itemName}</span>
                            <button
                              type="button"
                              onClick={() => { setSelectedBM(null); setBmSearch(''); setBmShowDropdown(false); onSet('circuit', '') }}
                              className="text-violet-400 hover:text-violet-600 shrink-0"
                            >×</button>
                          </div>
                        ) : (
                          <Input
                            value={bmSearch}
                            onChange={e => setBmSearch(e.target.value)}
                            onFocus={loadAllBmItems}
                            placeholder="클릭하면 BMS/PCM 목록 표시 · 입력하여 검색"
                            className="h-8 text-xs"
                          />
                        )}
                        {!selectedBM && bmShowDropdown && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white border rounded-md shadow-lg z-30 max-h-48 overflow-y-auto">
                            {bmSearching ? (
                              <p className="text-xs text-gray-400 px-3 py-2">불러오는 중...</p>
                            ) : bmResults.length === 0 ? (
                              <p className="text-xs text-gray-400 px-3 py-2">BMS/PCM 품목이 없습니다.</p>
                            ) : bmResults.map((item: any) => (
                              <button
                                key={item.id}
                                type="button"
                                className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2"
                                onClick={() => {
                                  setSelectedBM(item)
                                  setBmSearch('')
                                  setBmResults([])
                                  setBmShowDropdown(false)
                                  onSelectBMSItem({ id: item.id, unit: item.unit ?? 'EA', subCategory: item.subCategory })
                                }}
                              >
                                <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${item.subCategory === 'BM' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                  {item.subCategory === 'BM' ? 'BMS' : 'PCM'}
                                </span>
                                <span className="font-mono text-gray-500 shrink-0">{item.itemCode}</span>
                                <span className="text-gray-800 truncate">{item.itemName}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <TagSelect value={circuit} onChange={v => onSet('circuit', v)} options={opts.circuit ?? []} onAdd={onAddOpt('circuit')} placeholder="BMS / PCM" />
                    )}
                  </LevelRow>
                </>
              )}
              {isBms && (
                <>
                  <LevelRow label="제조사">
                    <TagSelect value={manufacturer} onChange={v => onSet('manufacturer', v)} options={opts.manufacturer ?? []} onAdd={onAddOpt('manufacturer')} placeholder="제조사 선택" />
                  </LevelRow>
                  {bmsRangeMode && (
                    <LevelRow label="최소직렬(S)">
                      <Input type="number" value={minSeriesCount} onChange={e => onSet('minSeriesCount', e.target.value)} placeholder="예) 7" />
                    </LevelRow>
                  )}
                  <LevelRow label={bmsRangeMode ? '최대직렬(S)' : '직렬(S)'}>
                    <div className="flex items-center gap-2">
                      <Input type="number" value={maxSeriesCount} onChange={e => onSet('maxSeriesCount', e.target.value)} placeholder="예) 16" className="flex-1" />
                      <button
                        type="button"
                        onClick={onToggleBmsRange}
                        className={`text-xs px-2 py-1 rounded border shrink-0 transition-colors ${bmsRangeMode ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-gray-100 border-gray-300 text-gray-500 hover:bg-gray-200'}`}
                      >
                        범위
                      </button>
                    </div>
                  </LevelRow>
                  <LevelRow label="정격전류(A)">
                    <Input type="number" step="0.01" value={ratedCurrent} onChange={e => onSet('ratedCurrent', e.target.value)} placeholder="예) 100" />
                  </LevelRow>
                </>
              )}
            </Branch>
          )}
        </Branch>
      )}
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
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-hidden"
        style={{ cursor: dragging ? 'grabbing' : 'grab' }}
        onClick={e => e.stopPropagation()}
        onMouseDown={startDrag}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onDoubleClick={reset}
      >
        <img
          src={url}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: `translate(calc(-50% + ${transform.x}px), calc(-50% + ${transform.y}px)) scale(${transform.scale})`,
            transformOrigin: 'center center',
            maxWidth: transform.scale <= 1 ? '90vw' : 'none',
            maxHeight: transform.scale <= 1 ? '90vh' : 'none',
            userSelect: 'none',
            pointerEvents: 'none',
            display: 'block',
          }}
        />
      </div>
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10" onClick={e => e.stopPropagation()}>
        <span className="bg-black/60 text-white/80 text-xs px-2.5 py-1 rounded-full">
          {Math.round(transform.scale * 100)}%
        </span>
        <button onClick={reset} className="bg-black/60 text-white text-xs px-2.5 py-1 rounded-full hover:bg-black/80">
          초기화
        </button>
        <button
          onClick={onClose}
          className="w-8 h-8 bg-white text-gray-800 rounded-full flex items-center justify-center shadow-lg hover:bg-gray-100 text-sm font-bold"
        >×</button>
      </div>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/40 text-xs whitespace-nowrap pointer-events-none">
        스크롤: 확대/축소 · 드래그: 이동 · 더블클릭: 초기화
      </div>
    </div>,
    document.body
  )
}

const CODE_LABELS: Record<ItemCodeType, string[]> = {
  bp:        ['1분류', '2분류', '화학계', '셀모델', '직병렬', '회로', '버전'],
  bms:       ['1분류', '2분류', '제조사', '최대직렬', '정격전류', '버전'],
  cell:      ['1분류', '2분류', '화학계', '셀모델'],
  component: ['1분류', '2분류', '3분류', '일련번호'],
  simple:    [],
}
const BMS_LABELS_RANGE = ['1분류', '2분류', '제조사', '최소직렬', '최대직렬', '정격전류', '버전']

function CodePreviewPanel({ itemCode, codeType }: { itemCode: string; codeType: ItemCodeType }) {
  const segs = itemCode ? itemCode.split('-') : []
  let labels = CODE_LABELS[codeType]
  if (codeType === 'bms' && segs.length === 7) labels = BMS_LABELS_RANGE
  const isSegmented = labels.length > 0 && segs.length === labels.length

  if (isSegmented) {
    return (
      <div className="bg-gray-900 text-white px-6 py-4 shrink-0 border-b border-gray-700">
        <p className="text-xs text-gray-400 mb-2">품번 자동생성 미리보기</p>
        <div className="flex items-end gap-1 flex-wrap font-mono">
          {segs.map((s, i) => (
            <span key={i} className="flex items-center gap-0.5">
              <span className="flex flex-col items-center gap-0.5">
                <span className={`px-1.5 py-0.5 rounded font-bold text-sm ${s === '?' || s === '?S?P' || s === '?S' || s === '?A' || s === '??' ? 'text-red-400' : 'text-green-300'}`}>
                  {s}
                </span>
                <span className="text-[9px] text-gray-500">{labels[i]}</span>
              </span>
              {i < segs.length - 1 && <span className="text-gray-600 pb-3">-</span>}
            </span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 text-white px-6 py-4 shrink-0 border-b border-gray-700">
      <p className="text-xs text-gray-400 mb-1">품번 자동생성 미리보기</p>
      <span className={`font-mono text-base font-bold ${!itemCode || itemCode.includes('?') ? 'text-red-400' : 'text-green-300'}`}>
        {itemCode || '분류를 선택하세요'}
      </span>
    </div>
  )
}

export default function ItemFormDialog({ open, item, initialValues, viewOnly, onClose, onSaved }: Props) {
  const [form, setForm] = useState<any>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadingSpec, setUploadingSpec] = useState(false)
  const [uploadingImages, setUploadingImages] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [dragOverDrawing, setDragOverDrawing] = useState(false)
  const [dragOverSpec, setDragOverSpec] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const [opts, setOpts] = useState<Record<string, SelectOption[]>>({})
  const [cellModelGroups, setCellModelGroups] = useState<CellModelGroup[]>([])
  const drawingsInputRef = useRef<HTMLInputElement>(null)
  const specSheetsInputRef = useRef<HTMLInputElement>(null)
  const imagesInputRef = useRef<HTMLInputElement>(null)
  const nameManuallyEdited = useRef(false)
  const [selectedCLSpecs, setSelectedCLSpecs] = useState<{
    dischargeCutoffVoltage: number | null; nominalVoltage: number | null
    chargeCutoffVoltage: number | null; nominalCapacity: number | null
    maxChargeCurrent: number | null; maxDischargeCurrent: number | null
  } | null>(null)
  const [selectedCLItem, setSelectedCLItem] = useState<{ id: string; unit: string } | null>(null)
  const [selectedBMSItem, setSelectedBMSItem] = useState<{ id: string; unit: string } | null>(null)
  const [bmsRangeMode, setBmsRangeMode] = useState(false)

  const handleDrawingFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files)
    if (arr.length === 0) return
    setUploading(true)
    try {
      const fd = new FormData()
      arr.forEach(f => fd.append('files', f))
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.success) {
        setForm((f: any) => ({ ...f, drawings: [...(f.drawings || []), ...json.data.urls] }))
        toast.success(`${json.data.urls.length}개 파일이 업로드되었습니다.`)
      } else {
        toast.error(json.message)
      }
    } catch {
      toast.error('파일 업로드에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }, [])

  const handleDrawingUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) await handleDrawingFiles(e.target.files)
    e.target.value = ''
  }, [handleDrawingFiles])

  const handleSpecSheetFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files)
    if (arr.length === 0) return
    setUploadingSpec(true)
    try {
      const fd = new FormData()
      arr.forEach(f => fd.append('files', f))
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.success) {
        setForm((f: any) => ({ ...f, specSheets: [...(f.specSheets || []), ...json.data.urls] }))
        toast.success(`${json.data.urls.length}개 파일이 업로드되었습니다.`)
      } else {
        toast.error(json.message)
      }
    } catch {
      toast.error('파일 업로드에 실패했습니다.')
    } finally {
      setUploadingSpec(false)
    }
  }, [])

  const handleSpecSheetUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) await handleSpecSheetFiles(e.target.files)
    e.target.value = ''
  }, [handleSpecSheetFiles])

  const handleImageFiles = useCallback(async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (imageFiles.length === 0) return
    setUploadingImages(true)
    try {
      const fd = new FormData()
      imageFiles.forEach(f => fd.append('files', f))
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.success) {
        setForm((f: any) => ({ ...f, images: [...(f.images || []), ...json.data.urls] }))
        toast.success(`${json.data.urls.length}개 이미지가 업로드되었습니다.`)
      } else {
        toast.error(json.message)
      }
    } catch {
      toast.error('이미지 업로드에 실패했습니다.')
    } finally {
      setUploadingImages(false)
    }
  }, [])

  const reload = () => {
    setOpts({
      chemistryType:   getOptions('chemistryType'),
      cellModel:       getOptions('cellModel'),
      circuit:         getOptions('circuit'),
      material:        getOptions('material'),
      packType:        getOptions('packType'),
      manufacturer:    getOptions('manufacturer'),
      color:           getOptions('color'),
      formFactor:      getOptions('formFactor'),
      unit:            getOptions('unit'),
      vendor:          getOptions('vendor'),
      specialOption:   getOptions('specialOption'),
      certification:   getOptions('certification'),
      elComponentType: getOptions('elComponentType'),
      meComponentType: getOptions('meComponentType'),
    })
    setCellModelGroups([...getCellModelGroups()])
  }

  useEffect(() => { reload() }, [])

  useEffect(() => {
    if (!open) return
    nameManuallyEdited.current = false
    setSelectedCLSpecs(null)
    setSelectedCLItem(null)
    setSelectedBMSItem(null)
    setForm(item
      ? { ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map(k => [k, item[k] ?? EMPTY[k]])),
          vendors: item.vendors ?? [],
          specialOptions: item.specialOptions ?? [],
          certifications: item.certifications ?? [],
          drawings: item.drawings ?? [],
          specSheets: item.specSheets ?? [],
          images: item.images ?? [],
          // 기존 BMS/PCM: ratedCurrent 미입력 시 continuousDischargeCurrent 값으로 폴백
          ratedCurrent: item.ratedCurrent ?? item.continuousDischargeCurrent ?? '' }
      : { ...EMPTY, ...(initialValues ?? {}) }
    )
    setBmsRangeMode(!!(item?.minSeriesCount))
    ensureServerSync().then(reload)
  }, [item, open])

  const set = (key: string, val: any) => setForm((f: any) => ({ ...f, [key]: val }))

  const handleCategory = (v: string) => setForm((f: any) => ({ ...f, category: v, subCategory: '', chemistryType: '', formFactor: '', itemCode: '' }))
  const handleSub = (v: string) => setForm((f: any) => ({ ...f, subCategory: v, chemistryType: '', formFactor: '', ...(v === 'CL' ? { unit: 'EA' } : {}) }))
  const handleThird = (field: string, v: string) => set(field, v)
  const addOpt = (key: string) => (label: string, code?: string) => { addOption(key, label, code); reload(); saveToServer() }

  const isBP = isBatteryPack(form.category, form.subCategory)
  const isCL = form.category === 'COMPONENT' && form.subCategory === 'CL'
  const isCharger = form.category === 'COMPONENT' && form.subCategory === 'EL'
    && (form.formFactor === 'CH' || item?.formFactor === 'CH')
  const codeType = getItemCodeType(form.category, form.subCategory)

  const codeParts = useMemo(() => buildCodeParts(form), [
    form.category, form.subCategory, form.chemistryType, form.cellModel,
    form.seriesCount, form.parallelCount, form.circuit, form.revisionNumber,
  ])

  useEffect(() => {
    if (item?.id) return
    if (codeType === 'bp') {
      set('itemCode', buildItemCode(codeParts))
    } else if (codeType === 'bms') {
      set('itemCode', buildBmsCode({ ...form, minSeriesCount: bmsRangeMode ? form.minSeriesCount : '' }))
    } else if (codeType === 'cell') {
      set('itemCode', buildCellCode(form))
    } else if (codeType === 'component') {
      set('itemCode', buildComponentCode(form))
    } else if (form.category && form.subCategory) {
      set('itemCode', buildSimpleCode(form))
    }
  }, [
    codeType, codeParts,
    form.category, form.subCategory, form.revisionNumber,
    form.manufacturer, form.minSeriesCount, form.maxSeriesCount, form.ratedCurrent,
    form.chemistryType, form.cellModel, form.formFactor, bmsRangeMode,
  ])

  const revCheckTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    if (item?.id) return
    if (codeType === 'cell') return
    if (!form.itemCode || form.itemCode.includes('?')) return
    const segments = (form.itemCode as string).split('-')
    if (segments.length < 2) return
    const baseCode = segments.slice(0, -1).join('-')
    clearTimeout(revCheckTimer.current)
    revCheckTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/items/next-revision?baseCode=${encodeURIComponent(baseCode)}`)
        const json = await res.json()
        if (!json.success) return
        const next: number = json.data.nextRevision
        setForm((f: any) => next !== f.revisionNumber ? { ...f, revisionNumber: next } : f)
      } catch {}
    }, 350)
  }, [form.itemCode, codeType])

  // BP 품목명 자동 설정: {S}S {P}P 배터리팩
  useEffect(() => {
    if (!isBP || item?.id) return
    if (nameManuallyEdited.current) return
    if (!form.seriesCount || !form.parallelCount) return
    set('itemName', `${form.seriesCount}S ${form.parallelCount}P 배터리팩`)
  }, [form.seriesCount, form.parallelCount, isBP])

  // 충전기 품목명 자동 설정: {화학계} 충전기 {S}S {V}V {A}A
  useEffect(() => {
    if (!isCharger || item?.id) return
    if (nameManuallyEdited.current) return
    const chem = form.chemistryType
    const s = form.seriesCount
    const v = form.chargeCutoffVoltage
    const a = form.continuousChargeCurrent
    if (!chem && !s && !v && !a) return
    const parts = [s && `${s}S`, v && `${v}V`, a && `${a}A`].filter(Boolean)
    const prefix = chem ? `${chem} ` : ''
    set('itemName', `${prefix}충전기${parts.length ? ' ' + parts.join(' ') : ''}`)
  }, [form.chemistryType, form.seriesCount, form.chargeCutoffVoltage, form.continuousChargeCurrent, isCharger])

  // 셀 선택 + S/P/L 변경 시 전기 사양 자동 계산
  useEffect(() => {
    if (!isBP || !selectedCLSpecs) return
    const s = parseFloat(String(form.seriesCount)) || 0
    const p = parseFloat(String(form.parallelCount)) || 0
    const l = parseFloat(String(form.layerCount)) || 1  // 단 수 NULL → 1
    const calc = (factor: number, val: number | null): string => {
      if (!factor || val == null) return ''
      return String(Math.round(factor * val * 10000) / 10000)
    }
    const nomV = (s && selectedCLSpecs.nominalVoltage != null) ? s * selectedCLSpecs.nominalVoltage : null
    const nomC = (p && l && selectedCLSpecs.nominalCapacity != null) ? p * l * selectedCLSpecs.nominalCapacity : null
    setForm((f: any) => ({
      ...f,
      dischargeCutoffVoltage: calc(s,     selectedCLSpecs.dischargeCutoffVoltage) || f.dischargeCutoffVoltage,
      nominalVoltage:         calc(s,     selectedCLSpecs.nominalVoltage)         || f.nominalVoltage,
      chargeCutoffVoltage:    calc(s,     selectedCLSpecs.chargeCutoffVoltage)    || f.chargeCutoffVoltage,
      nominalCapacity:        calc(p * l, selectedCLSpecs.nominalCapacity)        || f.nominalCapacity,
      energy: (nomV != null && nomC != null) ? String(Math.round(nomV * nomC * 10000) / 10000) : f.energy,
      maxChargeCurrent:    calc(p * l, selectedCLSpecs.maxChargeCurrent)    || f.maxChargeCurrent,
      maxDischargeCurrent: calc(p * l, selectedCLSpecs.maxDischargeCurrent) || f.maxDischargeCurrent,
    }))
  }, [form.seriesCount, form.parallelCount, form.layerCount, selectedCLSpecs])

  const thirdValue = (() => {
    const t = form.subCategory ? THIRD_LEVEL[form.subCategory] : null
    return t ? form[t.field] : ''
  })()

  const formTitle = viewOnly ? '품목 상세' : item?.id ? '품목 수정' : item ? `리비전 등록 (Rev.${item.revisionNumber})` : '품목 등록'

  const handleSubmit = async () => {
    if (!form.itemName || !form.category || !form.subCategory) {
      toast.error('품명, 1분류, 2분류는 필수입니다.')
      return
    }
    if (form.itemCode.includes('?') && (codeType === 'bp' || codeType === 'bms' || codeType === 'component')) {
      const typeLabel = codeType === 'bp' ? '배터리팩' : codeType === 'bms' ? 'BMS/PCM' : '부자재'
      toast.error(`${typeLabel} 분류 정보를 모두 입력해주세요.`)
      return
    }
    if (isCharger) {
      if (!form.chemistryType || !form.seriesCount || !form.chargeCutoffVoltage || !form.continuousChargeCurrent) {
        toast.error('충전기 품목은 화학계, 직렬 수(S), 충전종료전압(V), 충전전류(A)를 모두 입력해야 합니다.')
        return
      }
    }
    if (isCL) {
      const clRequiredFields = ['dischargeCutoffVoltage', 'nominalVoltage', 'chargeCutoffVoltage', 'nominalCapacity', 'energy', 'maxChargeCurrent', 'maxDischargeCurrent', 'continuousChargeCurrent', 'continuousDischargeCurrent', 'chargeCRate', 'dischargeCRate']
      if (clRequiredFields.some(k => !form[k])) {
        toast.error('셀 품목은 전기 사양 모든 항목을 입력해야 합니다.')
        return
      }
      if (!form.specSheets || form.specSheets.length === 0) {
        toast.error('셀 품목은 스펙시트를 1개 이상 첨부해야 합니다.')
        return
      }
    }
    setSaving(true)
    const payload = { ...form }
    const numF = ['revisionNumber', 'seriesCount', 'parallelCount', 'minSeriesCount', 'maxSeriesCount']
    // 배터리팩에서 단 수가 비어있으면 1로 취급
    payload.layerCount = payload.layerCount !== '' ? Number(payload.layerCount) || 1 : (isBP ? 1 : null)
    const decF = ['length', 'width', 'height', 'diameter', 'weight',
      'innerLength', 'innerWidth', 'innerHeight', 'thickness',
      'dischargeCutoffVoltage', 'nominalVoltage',
      'chargeCutoffVoltage', 'nominalCapacity', 'energy', 'maxChargeCurrent', 'maxDischargeCurrent',
      'continuousChargeCurrent', 'continuousDischargeCurrent', 'chargeCRate', 'dischargeCRate',
      'maxVoltage', 'ratedVoltage', 'ratedCurrent']
    numF.forEach(k => { payload[k] = payload[k] !== '' ? Number(payload[k]) || null : null })
    decF.forEach(k => { payload[k] = payload[k] !== '' ? parseFloat(payload[k]) || null : null })

    const isEdit = Boolean(item?.id)
    const res = await fetch(isEdit ? `/api/items/${item.id}` : '/api/items', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    setSaving(false)
    if (json.success) {
      // 신규 배터리팩 생성 시 선택된 셀·회로 품목을 BOM에 자동 등록
      if (!isEdit && isBP) {
        const newId = json.data.id
        const addBom = async (childId: string, quantity: number, unit: string) => {
          try {
            await fetch(`/api/items/${newId}/bom`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ childId, quantity, unit }),
            })
          } catch {}
        }
        if (selectedCLItem) {
          const s = Number(payload.seriesCount) || 0
          const p = Number(payload.parallelCount) || 0
          const l = Number(payload.layerCount) || 1
          const cellQty = s && p ? s * p * l : 1
          await addBom(selectedCLItem.id, cellQty, selectedCLItem.unit)
        }
        if (selectedBMSItem) {
          await addBom(selectedBMSItem.id, 1, selectedBMSItem.unit)
        }
      }
      toast.success(isEdit ? '수정되었습니다.' : '등록되었습니다.')
      onSaved()
    } else {
      toast.error(json.message)
    }
  }

  const elec = showElec(form.subCategory)
  const bms  = showBms(form.subCategory)
  const prod = showProductOptions(form.category)

  return (
    <>
    <Sheet open={open} onOpenChange={o => !o && onClose()}>
      <SheetContent side="right" className="w-[800px] max-w-[800px] h-screen flex flex-col p-0 gap-0">

        <SheetHeader className="px-6 py-4 border-b shrink-0">
          <SheetTitle>{formTitle}</SheetTitle>
        </SheetHeader>

        <CodePreviewPanel itemCode={form.itemCode} codeType={codeType} />

        {/* viewOnly 오버레이: 클릭 차단, 스크롤은 컨테이너에서 처리 */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 relative">
          {viewOnly && (
            <div className="absolute inset-0 z-10 cursor-default" style={{ pointerEvents: 'all' }} />
          )}

          {/* ── 분류 체계 ── */}
          <div className="space-y-3">
            <SectionHeader title="분류 체계" />
            <ClassificationTree
              category={form.category}
              subCategory={form.subCategory}
              thirdValue={thirdValue}
              opts={opts}
              cellModel={form.cellModel}
              seriesCount={form.seriesCount}
              parallelCount={form.parallelCount}
              circuit={form.circuit}
              isBP={isBP}
              isCL={isCL}
              isBms={bms}
              manufacturer={form.manufacturer}
              minSeriesCount={form.minSeriesCount}
              maxSeriesCount={form.maxSeriesCount}
              ratedCurrent={form.ratedCurrent}
              bmsRangeMode={bmsRangeMode}
              onToggleBmsRange={() => {
                if (bmsRangeMode) { setBmsRangeMode(false); set('minSeriesCount', '') }
                else setBmsRangeMode(true)
              }}
              cellModelGroups={cellModelGroups}
              onAddCellModelGroup={mfr => { addCellModelGroup(mfr); setCellModelGroups([...getCellModelGroups()]); saveToServer() }}
              onAddCellModelEntry={(mfr, label, code) => { addCellModelEntry(mfr, label, code); setCellModelGroups([...getCellModelGroups()]); setOpts(prev => ({ ...prev, cellModel: getOptions('cellModel') })); saveToServer() }}
              onCategory={handleCategory}
              onSub={handleSub}
              onThird={handleThird}
              onAddOpt={addOpt}
              onSet={set}
              readOnly={!!item?.id}
              onSelectCLItem={!item?.id ? (clItem) => {
                setForm((f: any) => ({
                  ...f,
                  ...(clItem.chemistryType ? { chemistryType: clItem.chemistryType } : {}),
                  ...(clItem.cellModel ? { cellModel: clItem.cellModel } : {}),
                }))
                setSelectedCLSpecs({
                  dischargeCutoffVoltage: clItem.dischargeCutoffVoltage ?? null,
                  nominalVoltage:         clItem.nominalVoltage         ?? null,
                  chargeCutoffVoltage:    clItem.chargeCutoffVoltage    ?? null,
                  nominalCapacity:        clItem.nominalCapacity        ?? null,
                  maxChargeCurrent:       clItem.maxChargeCurrent       ?? null,
                  maxDischargeCurrent:    clItem.maxDischargeCurrent    ?? null,
                })
                setSelectedCLItem({ id: clItem.id, unit: clItem.unit })
              } : undefined}
              onSelectBMSItem={!item?.id ? (bmsItem) => {
                set('circuit', bmsItem.subCategory)
                setSelectedBMSItem({ id: bmsItem.id, unit: bmsItem.unit })
              } : undefined}
            />
          </div>

          {/* ── 기본 정보 ── */}
          <div className="space-y-3">
            <SectionHeader title="기본 정보" />
            <Field label="상태">
              <TagSelect
                value={form.status}
                onChange={v => set('status', v)}
                options={[
                  { value: 'ACTIVE',       label: '사용',     colorIndex: 1 },
                  { value: 'INACTIVE',     label: '미사용',   colorIndex: 9 },
                  { value: 'RESTRICTED',   label: '사용금지', colorIndex: 5 },
                  { value: 'DISCONTINUED', label: '단종',     colorIndex: 4 },
                ]}
                onAdd={() => {}}
                placeholder="상태 선택"
              />
            </Field>
            <Field label="품명" required>
              <Input value={form.itemName} onChange={e => {
                if ((isBP || isCharger) && !item?.id) nameManuallyEdited.current = true
                set('itemName', e.target.value)
              }} placeholder="예) 배터리팩 48V100Ah" />
            </Field>
            <Field label="단위">
              <TagSelect value={form.unit} onChange={v => set('unit', v)} options={opts.unit ?? []} onAdd={addOpt('unit')} placeholder="단위 선택" />
            </Field>
            <Field label="고객사">
              <TagMultiSelect value={form.vendors} onChange={v => set('vendors', v)} options={opts.vendor ?? []} onAdd={addOpt('vendor')} placeholder="고객사 선택 또는 입력 후 만들기" />
            </Field>
          </div>

          {/* ── 물리 규격 ── */}
          {!isCharger && <div className="space-y-3">
            <SectionHeader title="물리 규격" />
            {([
              ['length', '가로/길이 (mm)'], ['width', '세로/폭 (mm)'], ['height', '높이 (mm)'],
              ['diameter', '직경 (mm)'], ['weight', '무게 (g)'],
              ['innerLength', '내경 가로 (mm)'], ['innerWidth', '내경 세로 (mm)'],
              ['innerHeight', '내경 높이 (mm)'], ['thickness', '두께 (mm)'],
            ] as [string, string][]).map(([k, lb]) => (
              <Field key={k} label={lb}>
                <Input type="number" step="0.01" value={form[k]} onChange={e => set(k, e.target.value)} placeholder="0.00" />
              </Field>
            ))}
            <Field label="재질">
              <TagSelect value={form.material} onChange={v => set('material', v)} options={opts.material ?? []} onAdd={addOpt('material')} placeholder="재질 선택" />
            </Field>
            {isBP && (
              <Field label="팩타입">
                <TagSelect value={form.packType} onChange={v => set('packType', v)} options={opts.packType ?? []} onAdd={addOpt('packType')} placeholder="소프트팩 / 하드팩" />
              </Field>
            )}
            <Field label="색상">
              <TagSelect value={form.color} onChange={v => set('color', v)} options={opts.color ?? []} onAdd={addOpt('color')} placeholder="색상 선택" />
            </Field>
          </div>}

          {/* ── 전기 사양 (EL 컴포넌트) ── */}
          {form.subCategory === 'EL' && (
            <div className="space-y-3">
              <SectionHeader title="전기 사양" />
              {!isCharger && <Field label="정격전류 (A)">
                <Input type="number" step="0.01" value={form.ratedCurrent} onChange={e => set('ratedCurrent', e.target.value)} placeholder="0.00" />
              </Field>}
              {isCharger && (<>
                <Field label="화학계" required>
                  <TagSelect value={form.chemistryType} onChange={v => set('chemistryType', v)} options={opts.chemistryType ?? []} onAdd={addOpt('chemistryType')} placeholder="예) NMC" />
                </Field>
                <Field label="직렬 수 (S)" required>
                  <Input type="number" value={form.seriesCount} onChange={e => set('seriesCount', e.target.value)} placeholder="예) 12" />
                </Field>
                <Field label="충전종료전압 (V)" required>
                  <Input type="number" step="0.01" value={form.chargeCutoffVoltage} onChange={e => set('chargeCutoffVoltage', e.target.value)} placeholder="0.00" />
                </Field>
                <Field label="충전전류 (A)" required>
                  <Input type="number" step="0.01" value={form.continuousChargeCurrent} onChange={e => set('continuousChargeCurrent', e.target.value)} placeholder="0.00" />
                </Field>
              </>)}
            </div>
          )}

          {/* ── 전기 사양 ── */}
          {elec && (
            <div className="space-y-3">
              <SectionHeader title="전기 사양" />
              {isBP && (
                <Field label="단 수">
                  <Input type="number" value={form.layerCount} onChange={e => set('layerCount', e.target.value)} />
                </Field>
              )}
              {([
                ['dischargeCutoffVoltage', '방전종료전압 (V)'],
                ['nominalVoltage', '공칭전압 (V)'],
                ['chargeCutoffVoltage', '충전종료전압 (V)'],
                ['nominalCapacity', '공칭용량 (Ah)'],
                ['energy', '에너지 (Wh)'],
                ['maxChargeCurrent', '피크충전전류 (A)'],
                ['maxDischargeCurrent', '피크방전전류 (A)'],
                ['continuousChargeCurrent', '연속충전전류 (A)'],
                ...(!bms ? [['continuousDischargeCurrent', '연속방전전류 (A)']] : []),
                ['chargeCRate', '충전 C-rate'],
                ['dischargeCRate', '방전 C-rate'],
              ] as [string, string][]).map(([k, lb]) => (
                <Field key={k} label={lb} required={isCL}>
                  <Input type="number" step="0.01" value={form[k]} onChange={e => set(k, e.target.value)} placeholder="0.00" />
                </Field>
              ))}
            </div>
          )}

          {/* ── 회로 정보 ── */}
          {bms && (
            <div className="space-y-3">
              <SectionHeader title="회로 정보" />
              <Field label="화학계">
                <TagSelect value={form.chemistryType} onChange={v => set('chemistryType', v)} options={opts.chemistryType ?? []} onAdd={addOpt('chemistryType')} placeholder="예) NMC" />
              </Field>
              <Field label="정격전압 (V)">
                <Input type="number" step="0.01" value={form.ratedVoltage} onChange={e => set('ratedVoltage', e.target.value)} placeholder="0.00" />
              </Field>
              <Field label="최대허용전압 (V)">
                <Input type="number" step="0.01" value={form.maxVoltage} onChange={e => set('maxVoltage', e.target.value)} placeholder="0.00" />
              </Field>
              <Field label="최소 직렬 수 (S)">
                <Input type="number" value={form.minSeriesCount} onChange={e => set('minSeriesCount', e.target.value)} />
              </Field>
            </div>
          )}

          {/* ── 제품 옵션 ── */}
          {(prod || bms) && (
            <div className="space-y-3">
              <SectionHeader title="제품 옵션" />
              <Field label="특수옵션">
                <TagMultiSelect value={form.specialOptions} onChange={v => set('specialOptions', v)} options={opts.specialOption ?? []} onAdd={addOpt('specialOption')} placeholder="특수옵션 선택" />
              </Field>
              {prod && (
                <Field label="인증">
                  <TagMultiSelect value={form.certifications} onChange={v => set('certifications', v)} options={opts.certification ?? []} onAdd={addOpt('certification')} placeholder="인증 선택" />
                </Field>
              )}
            </div>
          )}

          {/* ── 이미지 ── */}
          <div className="space-y-3">
            <SectionHeader title="이미지" />
            {!viewOnly && (
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragEnter={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={async e => {
                  e.preventDefault(); setDragOver(false)
                  if (e.dataTransfer.files.length > 0) await handleImageFiles(e.dataTransfer.files)
                }}
                className={`border-2 border-dashed rounded-lg px-4 py-5 text-center transition-colors ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-gray-50/50'}`}
              >
                <input
                  ref={imagesInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={e => { if (e.target.files) handleImageFiles(e.target.files); e.target.value = '' }}
                />
                <p className="text-xs text-gray-400 mb-2">이미지를 드래그하거나 클릭하여 업로드</p>
                <p className="text-[10px] text-gray-300 mb-2.5">JPG, PNG, GIF, WEBP, SVG 지원</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={uploadingImages}
                  onClick={() => imagesInputRef.current?.click()}
                >
                  {uploadingImages ? '업로드 중...' : '+ 이미지 선택'}
                </Button>
              </div>
            )}
            {form.images && form.images.length > 0 && (
              <div className="space-y-1.5">
                {form.images.map((url: string, i: number) => {
                  const filename = url.split('/').pop()?.replace(/^\d+-[\w-]+-/, '') ?? url
                  return (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 border rounded-md bg-gray-50 text-xs">
                      <span className="text-gray-500 shrink-0">🖼</span>
                      <span className="text-gray-700 flex-1 truncate" title={filename}>{filename}</span>
                      <button
                        type="button"
                        onClick={() => setPreviewImageUrl(url)}
                        className="text-blue-500 hover:underline shrink-0"
                      >미리보기</button>
                      {!viewOnly && (
                        <button
                          type="button"
                          onClick={() => set('images', form.images.filter((_: string, j: number) => j !== i))}
                          className="text-gray-400 hover:text-red-500 shrink-0"
                        >✕</button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── 도면 (자재 제외) ── */}
          {form.category !== 'COMPONENT' && <div className="space-y-3">
            <SectionHeader title="도면" />
            {!viewOnly && (
              <div
                onDragOver={e => { e.preventDefault(); setDragOverDrawing(true) }}
                onDragEnter={e => { e.preventDefault(); setDragOverDrawing(true) }}
                onDragLeave={() => setDragOverDrawing(false)}
                onDrop={async e => {
                  e.preventDefault(); setDragOverDrawing(false)
                  if (e.dataTransfer.files.length > 0) await handleDrawingFiles(e.dataTransfer.files)
                }}
                className={`border-2 border-dashed rounded-lg px-4 py-5 text-center transition-colors ${dragOverDrawing ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-gray-50/50'}`}
              >
                <input
                  ref={drawingsInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg,.svg,.xlsx,.xls,.step,.stp,.igs,.iges"
                  className="hidden"
                  onChange={handleDrawingUpload}
                />
                <p className="text-xs text-gray-400 mb-2">파일을 드래그하거나 클릭하여 업로드</p>
                <p className="text-[10px] text-gray-300 mb-2.5">PDF, DWG, DXF, PNG, JPG, SVG, Excel, STEP, IGES 지원</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={uploading}
                  onClick={() => drawingsInputRef.current?.click()}
                >
                  {uploading ? '업로드 중...' : '+ 파일 선택'}
                </Button>
              </div>
            )}
            {form.drawings && form.drawings.length > 0 && (
              <div className="space-y-1.5">
                {form.drawings.map((url: string, i: number) => {
                  const filename = url.split('/').pop()?.replace(/^\d+-[\w-]+-/, '') ?? url
                  return (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 border rounded-md bg-gray-50 text-xs">
                      <span className="text-gray-500 shrink-0">📄</span>
                      <span className="text-gray-700 flex-1 truncate" title={filename}>{filename}</span>
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline shrink-0">열기</a>
                      {!viewOnly && (
                        <button
                          type="button"
                          onClick={() => set('drawings', form.drawings.filter((_: string, j: number) => j !== i))}
                          className="text-gray-400 hover:text-red-500 shrink-0"
                        >✕</button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>}

          {/* ── 스펙시트 (셀 전용) ── */}
          {isCL && (
            <div className="space-y-3">
              <SectionHeader title="스펙시트" required />
              {!viewOnly && (
                <div
                  onDragOver={e => { e.preventDefault(); setDragOverSpec(true) }}
                  onDragEnter={e => { e.preventDefault(); setDragOverSpec(true) }}
                  onDragLeave={() => setDragOverSpec(false)}
                  onDrop={async e => {
                    e.preventDefault(); setDragOverSpec(false)
                    if (e.dataTransfer.files.length > 0) await handleSpecSheetFiles(e.dataTransfer.files)
                  }}
                  className={`border-2 border-dashed rounded-lg px-4 py-5 text-center transition-colors ${dragOverSpec ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-gray-50/50'}`}
                >
                  <input
                    ref={specSheetsInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={handleSpecSheetUpload}
                  />
                  <p className="text-xs text-gray-400 mb-2">파일을 드래그하거나 클릭하여 업로드</p>
                  <p className="text-[10px] text-gray-300 mb-2.5">PDF, Excel, CSV, 이미지 지원</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={uploadingSpec}
                    onClick={() => specSheetsInputRef.current?.click()}
                  >
                    {uploadingSpec ? '업로드 중...' : '+ 파일 선택'}
                  </Button>
                </div>
              )}
              {form.specSheets && form.specSheets.length > 0 && (
                <div className="space-y-1.5">
                  {form.specSheets.map((url: string, i: number) => {
                    const filename = url.split('/').pop()?.replace(/^\d+-[\w-]+-/, '') ?? url
                    return (
                      <div key={i} className="flex items-center gap-2 px-3 py-1.5 border rounded-md bg-gray-50 text-xs">
                        <span className="text-gray-500 shrink-0">📄</span>
                        <span className="text-gray-700 flex-1 truncate" title={filename}>{filename}</span>
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline shrink-0">열기</a>
                        {!viewOnly && (
                          <button
                            type="button"
                            onClick={() => set('specSheets', form.specSheets.filter((_: string, j: number) => j !== i))}
                            className="text-gray-400 hover:text-red-500 shrink-0"
                          >✕</button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── 비고 ── */}
          <div className="space-y-3">
            <SectionHeader title="비고" />
            <textarea
              value={form.memo}
              onChange={e => set('memo', e.target.value)}
              placeholder="비고를 입력하세요"
              rows={5}
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[100px]"
            />
          </div>

          <div className="h-4" />
        </div>

        <SheetFooter className="px-6 py-4 border-t shrink-0 flex gap-2 justify-end">
          {viewOnly ? (
            <Button variant="outline" onClick={onClose}>닫기</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>취소</Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? '저장 중...' : item?.id ? '수정' : '등록'}
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>

    {/* 이미지 미리보기 팝업 */}
    {previewImageUrl && <ImagePreviewModal url={previewImageUrl} onClose={() => setPreviewImageUrl(null)} />}
    </>
  )
}
