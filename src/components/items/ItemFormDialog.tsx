'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TagSelect } from '@/components/ui/tag-select'
import { TagMultiSelect } from '@/components/ui/tag-multi-select'
import { getOptions, addOption, SelectOption, getCellModelGroups, addCellModelGroup, addCellModelEntry, CellModelGroup } from '@/lib/select-options'
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
  onClose: () => void
  onSaved: () => void
}

const EMPTY: any = {
  itemCode: '', itemName: '', unit: '', category: '', subCategory: '',
  revisionNumber: 1, status: 'ACTIVE', memo: '',
  length: '', width: '', height: '', diameter: '', weight: '',
  innerLength: '', innerWidth: '', innerHeight: '', thickness: '',
  material: '', packType: '', color: '', formFactor: '',
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
}

// ── 섹션 헤더 ────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return (
    <div className="-mx-6 px-6 py-2.5 bg-gray-100 border-t border-b border-gray-200 flex items-center gap-2">
      <div className="w-0.5 h-3.5 bg-blue-500 rounded-full shrink-0" />
      <span className="text-xs font-bold text-gray-600 tracking-wide">{title}</span>
    </div>
  )
}

// ── 폼 필드 래퍼 ─────────────────────────────────────────
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

// ── 분류 트리 ─────────────────────────────────────────────

// 컨테이너 안에서 부모 세로선과 연결되는 행
function LevelRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 relative">
      <div className="absolute bg-gray-300" style={{ left: '-16px', width: '16px', height: '2px', top: '50%', transform: 'translateY(-50%)' }} />
      <span className="text-xs text-gray-400 w-14 shrink-0 text-right">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

// 한 단계 들여쓰기 컨테이너 — 세로 연결선 포함
function Branch({ children }: { children: React.ReactNode }) {
  return (
    <div className="ml-5 pl-4 border-l-2 border-gray-200 space-y-3">
      {children}
    </div>
  )
}

// ── 셀모델 2단계 선택 (제조사 → 모델 + 코드 표시) ────────────────
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
  const selectedCode = selectedGroup?.models.find(m => m.value === value)?.code

  const confirmAddModel = () => {
    if (!newModelCode.trim()) return
    onAddModel(selMfr, newModelLabel, newModelCode.trim())
    onChange(`${selMfr} ${newModelLabel}`)
    setAddingModel(false); setNewModelLabel(''); setNewModelCode('')
  }

  return (
    <>
      {/* 셀제조사 행 */}
      <LevelRow label="셀제조사">
        <TagSelect
          value={selMfr}
          onChange={v => { setSelMfr(v); onChange('') }}
          options={mfrOpts}
          onAdd={mfr => onAddGroup(mfr)}
          placeholder="제조사 선택"
        />
      </LevelRow>
      {/* 셀모델 행 (제조사 선택 후) */}
      {selMfr && (
        <LevelRow label="셀모델">
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
  manufacturer, maxSeriesCount, continuousDischargeCurrent,
  cellModelGroups, onAddCellModelGroup, onAddCellModelEntry,
  onCategory, onSub, onThird, onAddOpt, onSet,
}: {
  category: string; subCategory: string; thirdValue: string
  opts: Record<string, SelectOption[]>
  cellModel: string; seriesCount: string; parallelCount: string; circuit: string
  isBP: boolean; isCL: boolean; isBms: boolean
  manufacturer: string; maxSeriesCount: string; continuousDischargeCurrent: string
  cellModelGroups: CellModelGroup[]
  onAddCellModelGroup: (mfr: string) => void
  onAddCellModelEntry: (mfr: string, label: string, code: string) => void
  onCategory: (v: string) => void
  onSub: (v: string) => void
  onThird: (field: string, v: string) => void
  onAddOpt: (key: string) => (label: string) => void
  onSet: (key: string, val: any) => void
}) {
  const subOpts = SUB_OPTIONS[category] ?? []
  const third = subCategory ? THIRD_LEVEL[subCategory] : null
  const thirdOptions = third?.staticOptions ?? (third?.optKey ? opts[third.optKey] : undefined) ?? []
  const canAddThird = !third?.staticOptions && !!third?.optKey

  return (
    <div className="space-y-3">
      {/* 1분류 */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400 w-14 shrink-0 text-right">1분류</span>
        <div className="flex-1">
          <TagSelect value={category} onChange={onCategory} options={CATEGORY_OPTIONS} onAdd={() => {}} placeholder="대분류 선택" />
        </div>
      </div>

      {/* 2분류 이하 */}
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
              {third && (
                <LevelRow label={third.label}>
                  <TagSelect
                    value={thirdValue}
                    onChange={v => onThird(third.field, v)}
                    options={thirdOptions}
                    onAdd={canAddThird ? onAddOpt(third.optKey!) : () => {}}
                    placeholder={`${third.label} 선택`}
                  />
                </LevelRow>
              )}
              {(isBP || isCL) && (
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
                    <TagSelect value={circuit} onChange={v => onSet('circuit', v)} options={opts.circuit ?? []} onAdd={onAddOpt('circuit')} placeholder="BMS / PCM" />
                  </LevelRow>
                </>
              )}
              {isBms && (
                <>
                  <LevelRow label="제조사">
                    <TagSelect value={manufacturer} onChange={v => onSet('manufacturer', v)} options={opts.manufacturer ?? []} onAdd={onAddOpt('manufacturer')} placeholder="제조사 선택" />
                  </LevelRow>
                  <LevelRow label="최대직렬(S)">
                    <Input type="number" value={maxSeriesCount} onChange={e => onSet('maxSeriesCount', e.target.value)} placeholder="예) 16" />
                  </LevelRow>
                  <LevelRow label="연속방전(A)">
                    <Input type="number" step="0.01" value={continuousDischargeCurrent} onChange={e => onSet('continuousDischargeCurrent', e.target.value)} placeholder="예) 100" />
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

// ── 품번 미리보기 (상단 고정) ──────────────────────────────
const CODE_LABELS: Record<ItemCodeType, string[]> = {
  bp:        ['1분류', '2분류', '화학계', '셀모델', '직병렬', '회로', '버전'],
  bms:       ['1분류', '2분류', '제조사', '최대직렬', '연속방전', '버전'],
  cell:      ['1분류', '2분류', '화학계', '셀모델'],
  component: ['1분류', '2분류', '3분류', '일련번호'],
  simple:    [],
}

function CodePreviewPanel({ itemCode, codeType }: { itemCode: string; codeType: ItemCodeType }) {
  const labels = CODE_LABELS[codeType]
  const segs = itemCode ? itemCode.split('-') : []
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

// ── 메인 컴포넌트 ────────────────────────────────────────
export default function ItemFormDialog({ open, item, initialValues, onClose, onSaved }: Props) {
  const [form, setForm] = useState<any>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadingSpec, setUploadingSpec] = useState(false)
  const [opts, setOpts] = useState<Record<string, SelectOption[]>>({})
  const [cellModelGroups, setCellModelGroups] = useState<CellModelGroup[]>([])
  const drawingsInputRef = useRef<HTMLInputElement>(null)
  const specSheetsInputRef = useRef<HTMLInputElement>(null)

  const handleDrawingUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const fd = new FormData()
      Array.from(files).forEach(f => fd.append('files', f))
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
      e.target.value = ''
    }
  }, [])

  const handleSpecSheetUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploadingSpec(true)
    try {
      const fd = new FormData()
      Array.from(files).forEach(f => fd.append('files', f))
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
      e.target.value = ''
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
    reload()
    setForm(item
      ? { ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map(k => [k, item[k] ?? EMPTY[k]])),
          vendors: item.vendors ?? [],
          specialOptions: item.specialOptions ?? [],
          certifications: item.certifications ?? [],
          drawings: item.drawings ?? [],
          specSheets: item.specSheets ?? [] }
      : { ...EMPTY, ...(initialValues ?? {}) }
    )
  }, [item, open])

  const set = (key: string, val: any) => setForm((f: any) => ({ ...f, [key]: val }))

  const handleCategory = (v: string) => setForm((f: any) => ({ ...f, category: v, subCategory: '', chemistryType: '', formFactor: '', itemCode: '' }))
  const handleSub = (v: string) => setForm((f: any) => ({ ...f, subCategory: v, chemistryType: '', formFactor: '' }))
  const handleThird = (field: string, v: string) => set(field, v)
  const addOpt = (key: string) => (label: string) => { addOption(key, label); reload() }

  const isBP = isBatteryPack(form.category, form.subCategory)
  const isCL = form.category === 'COMPONENT' && form.subCategory === 'CL'
  const codeType = getItemCodeType(form.category, form.subCategory)

  const codeParts = useMemo(() => buildCodeParts(form), [
    form.category, form.subCategory, form.chemistryType, form.cellModel,
    form.seriesCount, form.parallelCount, form.circuit, form.revisionNumber,
  ])

  // 품번 자동생성: 신규 등록 및 리비전(id 없음) 시
  useEffect(() => {
    if (item?.id) return
    if (codeType === 'bp') {
      set('itemCode', buildItemCode(codeParts))
    } else if (codeType === 'bms') {
      set('itemCode', buildBmsCode(form))
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
    form.manufacturer, form.maxSeriesCount, form.continuousDischargeCurrent,
    form.chemistryType, form.cellModel, form.formFactor,
  ])

  // 리비전 충돌 체크: 생성된 품번이 이미 존재하면 미리보기에 다음 번호 반영
  // 셀 코드는 고유해야 하므로 revision 체크 생략
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

  const thirdValue = (() => {
    const t = form.subCategory ? THIRD_LEVEL[form.subCategory] : null
    return t ? form[t.field] : ''
  })()

  // 폼 제목: 수정 / 리비전 등록 / 신규 등록 구분
  const formTitle = item?.id ? '품목 수정' : item ? `리비전 등록 (Rev.${item.revisionNumber})` : '품목 등록'

  const handleSubmit = async () => {
    if (!form.itemName || !form.unit || !form.category || !form.subCategory) {
      toast.error('품명, 단위, 1분류, 2분류는 필수입니다.')
      return
    }
    if (form.itemCode.includes('?') && (codeType === 'bp' || codeType === 'bms' || codeType === 'component')) {
      const typeLabel = codeType === 'bp' ? '배터리팩' : codeType === 'bms' ? 'BMS/PCM' : '부자재'
      toast.error(`${typeLabel} 분류 정보를 모두 입력해주세요.`)
      return
    }
    setSaving(true)
    const payload = { ...form }
    const numF = ['revisionNumber', 'seriesCount', 'parallelCount', 'layerCount', 'minSeriesCount', 'maxSeriesCount']
    const decF = ['length', 'width', 'height', 'diameter', 'weight',
      'innerLength', 'innerWidth', 'innerHeight', 'thickness',
      'dischargeCutoffVoltage', 'nominalVoltage',
      'chargeCutoffVoltage', 'nominalCapacity', 'energy', 'maxChargeCurrent', 'maxDischargeCurrent',
      'continuousChargeCurrent', 'continuousDischargeCurrent', 'chargeCRate', 'dischargeCRate',
      'maxVoltage', 'ratedVoltage']
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
    <Sheet open={open} onOpenChange={o => !o && onClose()}>
      <SheetContent side="right" className="w-[800px] max-w-[800px] h-screen flex flex-col p-0 gap-0">

        {/* 고정 헤더 */}
        <SheetHeader className="px-6 py-4 border-b shrink-0">
          <SheetTitle>{formTitle}</SheetTitle>
        </SheetHeader>

        {/* 품번 미리보기 - 스크롤해도 고정 */}
        <CodePreviewPanel itemCode={form.itemCode} codeType={codeType} />

        {/* 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

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
              maxSeriesCount={form.maxSeriesCount}
              continuousDischargeCurrent={form.continuousDischargeCurrent}
              cellModelGroups={cellModelGroups}
              onAddCellModelGroup={mfr => { addCellModelGroup(mfr); setCellModelGroups([...getCellModelGroups()]) }}
              onAddCellModelEntry={(mfr, label, code) => { addCellModelEntry(mfr, label, code); setCellModelGroups([...getCellModelGroups()]); setOpts(prev => ({ ...prev, cellModel: getOptions('cellModel') })) }}
              onCategory={handleCategory}
              onSub={handleSub}
              onThird={handleThird}
              onAddOpt={addOpt}
              onSet={set}
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
              <Input value={form.itemName} onChange={e => set('itemName', e.target.value)} placeholder="예) 배터리팩 48V100Ah" />
            </Field>
            <Field label="단위" required>
              <TagSelect value={form.unit} onChange={v => set('unit', v)} options={opts.unit ?? []} onAdd={addOpt('unit')} placeholder="단위 선택" />
            </Field>
            <Field label="고객사">
              <TagMultiSelect value={form.vendors} onChange={v => set('vendors', v)} options={opts.vendor ?? []} onAdd={addOpt('vendor')} placeholder="고객사 선택 또는 입력 후 만들기" />
            </Field>
          </div>

          {/* ── 물리 규격 ── */}
          <div className="space-y-3">
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
              <Field label="팩 타입">
                <TagSelect value={form.packType} onChange={v => set('packType', v)} options={opts.packType ?? []} onAdd={addOpt('packType')} placeholder="소프트팩 / 하드팩" />
              </Field>
            )}
            <Field label="색상">
              <TagSelect value={form.color} onChange={v => set('color', v)} options={opts.color ?? []} onAdd={addOpt('color')} placeholder="색상 선택" />
            </Field>
          </div>

          {/* ── 전기 사양 (BP, BMS, PCM, 셀) ── */}
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
                // BMS/PCM은 분류 체계에서 입력하므로 제외
                ...(!bms ? [['continuousDischargeCurrent', '연속방전전류 (A)']] : []),
                ['chargeCRate', '충전 C-rate'],
                ['dischargeCRate', '방전 C-rate'],
              ] as [string, string][]).map(([k, lb]) => (
                <Field key={k} label={lb}>
                  <Input type="number" step="0.01" value={form[k]} onChange={e => set(k, e.target.value)} placeholder="0.00" />
                </Field>
              ))}
            </div>
          )}

          {/* ── BMS 정보 (BMS, PCM 전용) ── */}
          {bms && (
            <div className="space-y-3">
              <SectionHeader title="BMS 정보" />
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

          {/* ── 도면 ── */}
          <div className="space-y-3">
            <SectionHeader title="도면" />
            {form.drawings && form.drawings.length > 0 && (
              <div className="space-y-1.5">
                {form.drawings.map((url: string, i: number) => {
                  const filename = url.split('/').pop()?.replace(/^\d+-[\w-]+-/, '') ?? url
                  return (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 border rounded-md bg-gray-50 text-xs">
                      <span className="text-gray-500 shrink-0">📄</span>
                      <span className="text-gray-700 flex-1 truncate" title={filename}>{filename}</span>
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline shrink-0">열기</a>
                      <button
                        type="button"
                        onClick={() => set('drawings', form.drawings.filter((_: string, j: number) => j !== i))}
                        className="text-gray-400 hover:text-red-500 shrink-0"
                      >✕</button>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="flex items-center gap-3">
              <input
                ref={drawingsInputRef}
                type="file"
                multiple
                accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg,.svg,.xlsx,.xls,.step,.stp,.igs,.iges"
                className="hidden"
                onChange={handleDrawingUpload}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={uploading}
                onClick={() => drawingsInputRef.current?.click()}
              >
                {uploading ? '업로드 중...' : '+ 파일 업로드'}
              </Button>
              <span className="text-xs text-gray-400">PDF, DWG, DXF, PNG, JPG, SVG, Excel, STEP, IGES 지원</span>
            </div>
          </div>

          {/* ── 스펙시트 (셀 전용) ── */}
          {isCL && (
            <div className="space-y-3">
              <SectionHeader title="스펙시트" />
              {form.specSheets && form.specSheets.length > 0 && (
                <div className="space-y-1.5">
                  {form.specSheets.map((url: string, i: number) => {
                    const filename = url.split('/').pop()?.replace(/^\d+-[\w-]+-/, '') ?? url
                    return (
                      <div key={i} className="flex items-center gap-2 px-3 py-1.5 border rounded-md bg-gray-50 text-xs">
                        <span className="text-gray-500 shrink-0">📄</span>
                        <span className="text-gray-700 flex-1 truncate" title={filename}>{filename}</span>
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline shrink-0">열기</a>
                        <button
                          type="button"
                          onClick={() => set('specSheets', form.specSheets.filter((_: string, j: number) => j !== i))}
                          className="text-gray-400 hover:text-red-500 shrink-0"
                        >✕</button>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="flex items-center gap-3">
                <input
                  ref={specSheetsInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={handleSpecSheetUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={uploadingSpec}
                  onClick={() => specSheetsInputRef.current?.click()}
                >
                  {uploadingSpec ? '업로드 중...' : '+ 스펙시트 업로드'}
                </Button>
                <span className="text-xs text-gray-400">PDF, Excel, CSV, 이미지 지원</span>
              </div>
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
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? '저장 중...' : item?.id ? '수정' : '등록'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
