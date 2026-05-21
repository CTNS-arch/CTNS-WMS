'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CATEGORY_OPTIONS, SUB_OPTIONS, THIRD_LEVEL } from '@/lib/classification'
import { getOptions, ensureServerSync, type SelectOption } from '@/lib/select-options'

interface Props {
  open: boolean
  onClose: () => void
  onSubmitted: () => void
}

const UNIT_OPTIONS = ['EA', 'SET', 'BOX', 'PCS', 'KG', 'M', 'L', '기타']

const SUB_TO_CATEGORY: Record<string, string> = Object.entries(SUB_OPTIONS).reduce(
  (acc, [cat, subs]) => { subs.forEach(s => { acc[s.value] = cat }); return acc },
  {} as Record<string, string>
)

const ALL_SUB_FLAT = Object.values(SUB_OPTIONS).flat()

// ── 검색 가능 드롭다운 ──────────────────────────────────────

interface SSOption { value: string; label: string }
interface SSGroup  { label: string; options: SSOption[] }

function SearchableSelect({
  value, onChange, options, groups, placeholder, disabled,
}: {
  value: string
  onChange: (val: string) => void
  options?: SSOption[]
  groups?: SSGroup[]
  placeholder?: string
  disabled?: boolean
}) {
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState('')
  const ref                 = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const allFlat: SSOption[] = options ?? groups?.flatMap(g => g.options) ?? []
  const selectedLabel = allFlat.find(o => o.value === value)?.label
  const q = search.toLowerCase()
  const filtered = q ? allFlat.filter(o => o.label.toLowerCase().includes(q)) : null

  function select(val: string) { onChange(val); setOpen(false); setSearch('') }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen(p => !p) }}
        className="w-full h-8 rounded-lg border border-gray-200 px-2.5 text-xs text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={selectedLabel ? 'text-gray-900 truncate' : 'text-gray-400 truncate'}>
          {selectedLabel ?? (placeholder ?? '선택하세요')}
        </span>
        <svg className="w-3 h-3 text-gray-400 flex-shrink-0 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && !disabled && (
        <div className="absolute z-[200] mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl">
          <div className="p-1.5 border-b border-gray-100">
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="검색..."
              className="w-full h-7 px-2 text-xs rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-gray-50"
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div className="overflow-y-auto max-h-52">
            <div
              onClick={() => select('')}
              className="px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-50 cursor-pointer"
            >
              선택 안함
            </div>

            {filtered ? (
              filtered.length === 0
                ? <div className="px-3 py-3 text-xs text-gray-400 text-center">검색 결과 없음</div>
                : filtered.map(o => (
                    <div key={o.value} onClick={() => select(o.value)}
                      className={`px-3 py-1.5 text-xs cursor-pointer hover:bg-blue-50 ${o.value === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}>
                      {o.label}
                    </div>
                  ))
            ) : groups ? (
              groups.map(g => (
                <div key={g.label}>
                  <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">
                    {g.label}
                  </div>
                  {g.options.map(o => (
                    <div key={o.value} onClick={() => select(o.value)}
                      className={`px-4 py-1.5 text-xs cursor-pointer hover:bg-blue-50 ${o.value === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}>
                      {o.label}
                    </div>
                  ))}
                </div>
              ))
            ) : (
              allFlat.map(o => (
                <div key={o.value} onClick={() => select(o.value)}
                  className={`px-3 py-1.5 text-xs cursor-pointer hover:bg-blue-50 ${o.value === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}>
                  {o.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── 메인 컴포넌트 ───────────────────────────────────────────

export default function ItemRequestDialog({ open, onClose, onSubmitted }: Props) {
  const [category,      setCategory]      = useState('')
  const [subCategory,   setSubCategory]   = useState('')
  const [thirdCategory, setThirdCategory] = useState('')
  const [itemName,      setItemName]      = useState('')
  const [spec,          setSpec]          = useState('')
  const [quantity,      setQuantity]      = useState('')
  const [unit,          setUnit]          = useState('EA')
  const [memo,          setMemo]          = useState('')
  const [saving,        setSaving]        = useState(false)
  const [optStore,      setOptStore]      = useState<Record<string, SelectOption[]>>({})

  useEffect(() => {
    ensureServerSync().then(() => {
      const store: Record<string, SelectOption[]> = {}
      for (const def of Object.values(THIRD_LEVEL)) {
        if (def?.optKey) store[def.optKey] = getOptions(def.optKey)
      }
      setOptStore(store)
    })
  }, [])

  const subOpts = category ? (SUB_OPTIONS[category] ?? []) : []

  // 소분류 그룹: subCategory 선택 시 해당 그룹만, 아닐 경우 전체
  const THIRD_HIDDEN_SUBS = new Set(['BP', 'PO', 'CL'])

  const thirdGroups: SSGroup[] = (() => {
    const entries = subCategory
      ? ([[subCategory, THIRD_LEVEL[subCategory]]] as [string, typeof THIRD_LEVEL[string]][])
      : (Object.entries(THIRD_LEVEL) as [string, typeof THIRD_LEVEL[string]][])

    return entries
      .filter(([sub, def]) => def != null && !THIRD_HIDDEN_SUBS.has(sub))
      .map(([sub, def]) => {
        const opts: SSOption[] = (def!.staticOptions ?? (def!.optKey ? (optStore[def!.optKey] ?? []) : []))
          .map(o => ({ value: o.value, label: o.label }))
        return { label: ALL_SUB_FLAT.find(s => s.value === sub)?.label ?? sub, options: opts }
      })
      .filter(g => g.options.length > 0)
  })()

  // 소분류 value → 중분류 역방향 맵 (로드된 옵션 기준)
  const thirdToSub = (() => {
    const map: Record<string, string> = {}
    for (const [sub, def] of Object.entries(THIRD_LEVEL)) {
      if (!def) continue
      const opts = def.staticOptions ?? (def.optKey ? (optStore[def.optKey] ?? []) : [])
      opts.forEach(o => { if (!map[o.value]) map[o.value] = sub })
    }
    return map
  })()

  function handleThirdChange(val: string) {
    setThirdCategory(val)
    if (!val) return
    const sub = thirdToSub[val]
    if (sub) {
      setSubCategory(sub)
      const cat = SUB_TO_CATEGORY[sub]
      if (cat) setCategory(cat)
    }
  }

  function handleCategoryChange(val: string) {
    setCategory(val)
    setSubCategory('')
    setThirdCategory('')
  }

  function handleSubChange(val: string) {
    setSubCategory(val)
    setThirdCategory('')
  }

  function reset() {
    setCategory(''); setSubCategory(''); setThirdCategory('')
    setItemName(''); setSpec(''); setQuantity(''); setUnit('EA'); setMemo('')
  }

  function handleClose() { reset(); onClose() }

  async function handleSubmit() {
    if (!category) { toast.error('대분류를 선택하세요.'); return }
    if (!itemName.trim()) { toast.error('품명/설명을 입력하세요.'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/item-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, subCategory, thirdCategory, itemName, spec, quantity, unit, memo }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('품목 생성 요청이 등록되었습니다.')
        reset()
        onSubmitted()
      } else {
        toast.error(json.message ?? '요청 등록에 실패했습니다.')
      }
    } catch {
      toast.error('서버 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-[520px] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-6 py-4 border-b flex items-center justify-between"
          style={{ background: 'linear-gradient(to right, #f0f9ff, #f8fafc)' }}>
          <div>
            <h2 className="text-sm font-bold text-gray-900">품목 생성 요청</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">요청한 내용을 관리자가 검토 후 품목을 등록합니다</p>
          </div>
          <button onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 text-lg font-light">
            ×
          </button>
        </div>

        {/* 폼 */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto" style={{ maxHeight: '70vh' }}>

          {/* 대분류 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
              대분류 <span className="text-red-400">*</span>
            </label>
            <SearchableSelect
              value={category}
              onChange={handleCategoryChange}
              options={CATEGORY_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
              placeholder="선택하세요"
            />
          </div>

          {/* 중분류 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">중분류</label>
            <SearchableSelect
              value={subCategory}
              onChange={handleSubChange}
              options={subOpts.map(o => ({ value: o.value, label: o.label }))}
              placeholder="선택하세요"
              disabled={!category || subOpts.length === 0}
            />
          </div>

          {/* 소분류: 자재(COMPONENT)일 때만 노출 */}
          {(!category || category === 'COMPONENT') && <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">소분류</label>
            <SearchableSelect
              value={thirdCategory}
              onChange={handleThirdChange}
              groups={thirdGroups.length > 0 ? thirdGroups : undefined}
              options={thirdGroups.length === 0 ? [] : undefined}
              placeholder="선택하세요 (선택 시 대·중분류 자동 입력)"
            />
          </div>}

          {/* 품명 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
              품명 / 설명 <span className="text-red-400">*</span>
            </label>
            <Input
              value={itemName}
              onChange={e => setItemName(e.target.value)}
              placeholder="등록이 필요한 품목의 이름 또는 설명을 입력하세요"
              className="h-8 text-xs"
            />
          </div>

          {/* 규격 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">규격 / 사양</label>
            <textarea
              value={spec}
              onChange={e => setSpec(e.target.value)}
              placeholder="치수, 용량, 재질, 기타 사양 등을 입력하세요"
              rows={2}
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            />
          </div>

          {/* 수량 + 단위 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">필요 수량</label>
              <Input
                type="number"
                min={0}
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder="0"
                className="h-8 text-xs text-right"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">단위</label>
              <SearchableSelect
                value={unit}
                onChange={setUnit}
                options={UNIT_OPTIONS.map(u => ({ value: u, label: u }))}
              />
            </div>
          </div>

          {/* 메모 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">메모</label>
            <textarea
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="추가적인 요청 사항을 입력하세요"
              rows={2}
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            />
          </div>
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 border-t bg-gray-50/70 flex justify-end gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs px-5"
            onClick={handleClose} disabled={saving}>취소</Button>
          <Button size="sm" className="h-8 text-xs px-6 bg-blue-600 hover:bg-blue-700"
            onClick={handleSubmit} disabled={saving}>
            {saving ? '요청 중...' : '등록 요청'}
          </Button>
        </div>
      </div>
    </div>
  )
}
