'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import {
  getOptions, addOption, deleteOption, resetToDefault, updateOption, reorderOptions,
  getCellModelGroups, addCellModelGroup, addCellModelEntry,
  deleteCellModelGroup, deleteCellModelEntry,
  isCodeTaken, isCellModelCodeTaken,
  initStore, initGroups, serializeStore, serializeGroups, saveToServer,
  type SelectOption, type CellModelGroup, PALETTE,
} from '@/lib/select-options'

// ─── Category & Nav definitions ───────────────────────────────────────────────

interface CategoryDef {
  key: string
  label: string
  hasDefault: boolean
  requireCode: boolean
}

const CAT: Record<string, CategoryDef> = {
  vendor:          { key: 'vendor',          label: '거래처',        hasDefault: false, requireCode: false },
  specialOption:   { key: 'specialOption',   label: '특수옵션',      hasDefault: true,  requireCode: false },
  certification:   { key: 'certification',   label: '인증',          hasDefault: true,  requireCode: false },
  unit:            { key: 'unit',            label: '단위',          hasDefault: true,  requireCode: false },
  packType:        { key: 'packType',        label: '팩타입',        hasDefault: true,  requireCode: false },
  formFactor:      { key: 'formFactor',      label: '폼팩터',        hasDefault: true,  requireCode: false },
  circuit:         { key: 'circuit',         label: '회로',          hasDefault: true,  requireCode: false },
  material:        { key: 'material',        label: '재질',          hasDefault: true,  requireCode: false },
  color:           { key: 'color',           label: '색상',          hasDefault: true,  requireCode: false },
  elComponentType: { key: 'elComponentType', label: '전장/전기부품',  hasDefault: true,  requireCode: true  },
  meComponentType: { key: 'meComponentType', label: '기구/외장부품',  hasDefault: true,  requireCode: true  },
  cdComponentType: { key: 'cdComponentType', label: '도전재',        hasDefault: true,  requireCode: true  },
  fsComponentType: { key: 'fsComponentType', label: '체결부품',      hasDefault: true,  requireCode: true  },
  smComponentType: { key: 'smComponentType', label: '부자재/소모품',  hasDefault: true,  requireCode: true  },
  otComponentType: { key: 'otComponentType', label: '기타',          hasDefault: false, requireCode: true  },
  chemistryType:   { key: 'chemistryType',   label: '화학계',        hasDefault: true,  requireCode: true  },
  manufacturer:    { key: 'manufacturer',    label: '제조사',        hasDefault: true,  requireCode: true  },
}

const ALL_CAT_KEYS = Object.keys(CAT)
const CELL_MODEL_KEY = '__cellModel__'

interface NavSection { label?: string; keys: string[] }
interface NavGroup   { label: string; sections: NavSection[] }

const NAV: NavGroup[] = [
  {
    label: '공통',
    sections: [{ keys: ['vendor', 'specialOption', 'certification', 'unit'] }],
  },
  {
    label: '완제품 / 반제품',
    sections: [{ keys: ['packType', 'formFactor', 'circuit'] }],
  },
  {
    label: '자재',
    sections: [
      { label: '일반',        keys: ['material', 'color'] },
      { label: '소분류 유형', keys: ['elComponentType', 'meComponentType', 'cdComponentType', 'fsComponentType', 'smComponentType', 'otComponentType'] },
    ],
  },
  {
    label: '셀',
    sections: [{ keys: ['chemistryType', 'manufacturer', CELL_MODEL_KEY] }],
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

interface EditState { label: string; code: string }

export default function OptionsPage() {
  const [selected,      setSelected]      = useState('vendor')
  const [options,       setOptions]       = useState<Record<string, SelectOption[]>>({})
  const [cellGroups,    setCellGroups]    = useState<CellModelGroup[]>([])

  const [newLabel,      setNewLabel]      = useState('')
  const [newCode,       setNewCode]       = useState('')
  const [editingValue,  setEditingValue]  = useState<string | null>(null)
  const [editState,     setEditState]     = useState<EditState>({ label: '', code: '' })

  const [dragIndex,     setDragIndex]     = useState<number | null>(null)
  const [overIndex,     setOverIndex]     = useState<number | null>(null)

  const [expandedMfr,   setExpandedMfr]  = useState<Set<string>>(new Set())
  const [newMfr,        setNewMfr]       = useState('')
  const [addingModel,   setAddingModel]  = useState<string | null>(null)
  const [newModelLabel, setNewModelLabel] = useState('')
  const [newModelCode,  setNewModelCode]  = useState('')

  const reload = useCallback(() => {
    const next: Record<string, SelectOption[]> = {}
    for (const k of ALL_CAT_KEYS) next[k] = getOptions(k)
    setOptions(next)
    setCellGroups(getCellModelGroups())
  }, [])

  // saveToServer는 select-options 모듈에서 직접 import하여 사용

  const loadFromServer = useCallback(async () => {
    try {
      const res  = await fetch('/api/options')
      const json = await res.json()
      if (json.success) {
        if (json.data.options)         initStore(json.data.options)
        if (json.data.cellModelGroups) initGroups(json.data.cellModelGroups)
        // 서버에 데이터가 없으면 현재 localStorage 값을 최초 업로드
        if (!json.data.options) saveToServer()
      }
    } catch {}
    reload()
  }, [reload])

  useEffect(() => { loadFromServer() }, [loadFromServer])

  const isCellModel = selected === CELL_MODEL_KEY
  const currentCat  = isCellModel ? null : CAT[selected]
  const current     = currentCat ? (options[selected] ?? []) : []
  const canAdd      = currentCat?.requireCode
    ? newLabel.trim().length > 0 && newCode.trim().length >= 2
    : newLabel.trim().length > 0

  // ── normal option handlers ──────────────────────────────────────────────

  const handleAdd = () => {
    const label = newLabel.trim()
    const code  = newCode.trim().toUpperCase()
    if (!label) return
    if (currentCat?.requireCode && code.length < 2) return
    if (code && isCodeTaken(selected, code)) { toast.error(`코드 "${code}"는 이미 사용 중입니다.`); return }
    addOption(selected, label, code || undefined)
    setNewLabel(''); setNewCode(''); reload(); saveToServer()
    toast.success(`"${label}" 추가되었습니다.`)
  }

  const handleDelete = (value: string, label: string) => {
    if (!window.confirm(`"${label}"을(를) 삭제하시겠습니까?`)) return
    deleteOption(selected, value); reload(); saveToServer()
    toast.success(`"${label}" 삭제되었습니다.`)
  }

  const handleReset = () => {
    if (!currentCat) return
    resetToDefault(selected); setEditingValue(null); reload(); saveToServer()
    toast.success(`${currentCat.label} 옵션이 기본값으로 초기화되었습니다.`)
  }

  const startEdit = (opt: SelectOption) => {
    setEditingValue(opt.value)
    setEditState({ label: opt.label, code: opt.code ?? '' })
  }

  const saveEdit = (value: string) => {
    const label = editState.label.trim()
    const code  = editState.code.trim().toUpperCase()
    if (!label) return
    if (code) {
      const dup = (options[selected] ?? []).find(o => o.code?.toUpperCase() === code && o.value !== value)
      if (dup) { toast.error(`코드 "${code}"는 이미 사용 중입니다.`); return }
    }
    updateOption(selected, value, { label, code: code || undefined })
    setEditingValue(null); reload(); saveToServer(); toast.success('수정되었습니다.')
  }

  // ── cell model handlers ─────────────────────────────────────────────────

  const handleAddManufacturer = () => {
    const name = newMfr.trim().toUpperCase()
    if (!name) return
    addCellModelGroup(name); setNewMfr('')
    setExpandedMfr(p => new Set([...p, name])); reload(); saveToServer()
    toast.success(`"${name}" 추가되었습니다.`)
  }

  const handleAddModel = (mfr: string) => {
    const label = newModelLabel.trim()
    const code  = newModelCode.trim().toUpperCase()
    if (!label || code.length < 2) return
    if (isCellModelCodeTaken(code)) { toast.error(`코드 "${code}"는 이미 사용 중입니다.`); return }
    addCellModelEntry(mfr, label, code)
    setAddingModel(null); setNewModelLabel(''); setNewModelCode(''); reload(); saveToServer()
    toast.success(`"${mfr} ${label}" 추가되었습니다.`)
  }

  const handleDeleteCellModelGroup = (manufacturer: string) => {
    if (!window.confirm(`"${manufacturer}" 제조사 및 모든 모델을 삭제하시겠습니까?`)) return
    deleteCellModelGroup(manufacturer); reload(); saveToServer()
    toast.success(`"${manufacturer}" 삭제되었습니다.`)
  }

  const handleDeleteCellModelEntry = (manufacturer: string, value: string, modelLabel: string) => {
    if (!window.confirm(`"${modelLabel}" 모델을 삭제하시겠습니까?`)) return
    deleteCellModelEntry(manufacturer, value); reload(); saveToServer()
    toast.success(`"${modelLabel}" 삭제되었습니다.`)
  }

  const selectCat = (key: string) => {
    setSelected(key)
    setNewLabel(''); setNewCode(''); setEditingValue(null)
    setAddingModel(null); setNewMfr(''); setNewModelLabel(''); setNewModelCode('')
    setDragIndex(null); setOverIndex(null)
  }

  const handleDrop = (toIndex: number) => {
    if (dragIndex === null || dragIndex === toIndex) { setDragIndex(null); setOverIndex(null); return }
    const reordered = [...current]
    const [moved] = reordered.splice(dragIndex, 1)
    reordered.splice(toIndex, 0, moved)
    reorderOptions(selected, reordered)
    setDragIndex(null); setOverIndex(null); reload(); saveToServer()
  }

  // ── render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-3 border-b bg-white shrink-0">
        <h1 className="text-sm font-semibold text-gray-800">옵션 관리</h1>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <aside className="w-52 shrink-0 border-r bg-gray-50 flex flex-col">
          <nav className="flex-1 overflow-y-auto py-2">
            {NAV.map(group => (
              <div key={group.label} className="mb-1">
                {/* Group header */}
                <div className="px-4 pt-3 pb-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{group.label}</span>
                </div>

                {group.sections.map((section, si) => (
                  <div key={si}>
                    {/* Section divider (코드필요/일반 구분) */}
                    {section.label && (
                      <div className="flex items-center gap-2 px-3 py-1.5 mx-1">
                        <span className="flex-1 h-px bg-gray-200" />
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">{section.label}</span>
                        <span className="flex-1 h-px bg-gray-200" />
                      </div>
                    )}

                    {section.keys.map(key => {
                      const isCM      = key === CELL_MODEL_KEY
                      const def       = isCM ? null : CAT[key]
                      const name      = isCM ? '셀 모델' : def!.label
                      const reqCode   = isCM ? true : def!.requireCode
                      const count     = isCM
                        ? cellGroups.reduce((s, g) => s + g.models.length, 0)
                        : (options[key]?.length ?? 0)
                      const isActive  = selected === key

                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => selectCat(key)}
                          className={`w-full flex items-center justify-between px-4 py-2 text-sm transition-colors ${
                            isActive
                              ? 'bg-white text-gray-900 font-medium border-r-2 border-gray-800'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className="truncate">{name}</span>
                            {reqCode && (
                              <span className="shrink-0 text-[9px] px-1 py-0.5 rounded bg-orange-100 text-orange-600 font-semibold leading-none">코드</span>
                            )}
                          </span>
                          <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded ml-1 ${
                            isActive ? 'bg-gray-100 text-gray-600' : 'bg-gray-200 text-gray-500'
                          }`}>{count}</span>
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        {/* ── Right panel ──────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Panel header */}
          <div className="px-6 min-h-[52px] flex items-center gap-2 border-b bg-white shrink-0">
            <span className="text-sm font-medium text-gray-800">
              {isCellModel ? '셀 모델' : currentCat?.label}
            </span>
            {!isCellModel && currentCat?.requireCode && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 font-semibold">코드 필수</span>
            )}
            {!isCellModel && currentCat?.hasDefault && (
              <button type="button" onClick={handleReset}
                className="ml-auto text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100 transition-colors">
                기본값으로 초기화
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">

            {/* ── Cell model panel ──────────────────────────────────── */}
            {isCellModel ? (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input type="text" value={newMfr}
                    onChange={e => setNewMfr(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && handleAddManufacturer()}
                    placeholder="제조사명 (예: PANASONIC)"
                    className="flex-1 text-sm border border-gray-200 rounded px-3 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-gray-300" />
                  <button type="button" onClick={handleAddManufacturer} disabled={!newMfr.trim()}
                    className="text-sm px-4 py-1.5 rounded bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">
                    + 제조사
                  </button>
                </div>

                {cellGroups.length === 0 ? (
                  <p className="text-sm text-gray-400 mt-4">등록된 제조사가 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {cellGroups.map(group => {
                      const isExp         = expandedMfr.has(group.manufacturer)
                      const pal           = PALETTE[group.colorIndex % PALETTE.length]
                      const isAddingModel = addingModel === group.manufacturer
                      return (
                        <div key={group.manufacturer} className="border rounded-lg overflow-hidden">
                          {/* Manufacturer row */}
                          <div
                            className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 cursor-pointer"
                            onClick={() => setExpandedMfr(prev => {
                              const next = new Set(prev)
                              if (next.has(group.manufacturer)) next.delete(group.manufacturer)
                              else next.add(group.manufacturer)
                              return next
                            })}
                          >
                            <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform shrink-0 ${isExp ? 'rotate-90' : ''}`}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${pal.bg} ${pal.text}`}>{group.manufacturer}</span>
                            <span className="text-xs text-gray-400">{group.models.length}개 모델</span>
                            <div className="ml-auto flex gap-1" onClick={e => e.stopPropagation()}>
                              <button type="button"
                                onClick={() => {
                                  setAddingModel(isAddingModel ? null : group.manufacturer)
                                  setNewModelLabel(''); setNewModelCode('')
                                  setExpandedMfr(p => new Set([...p, group.manufacturer]))
                                }}
                                className="text-xs px-2.5 py-1 rounded border border-gray-200 text-gray-500 hover:bg-white">
                                + 모델
                              </button>
                              <button type="button"
                                onClick={() => handleDeleteCellModelGroup(group.manufacturer)}
                                className="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>

                          {/* Model list */}
                          {isExp && (
                            <div>
                              {isAddingModel && (
                                <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border-b border-blue-100">
                                  <input type="text" value={newModelLabel}
                                    onChange={e => setNewModelLabel(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAddModel(group.manufacturer)}
                                    placeholder="모델명" autoFocus
                                    className="w-28 text-sm border border-gray-200 rounded px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                                  <input type="text" value={newModelCode}
                                    onChange={e => setNewModelCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                                    onKeyDown={e => e.key === 'Enter' && handleAddModel(group.manufacturer)}
                                    placeholder="코드" maxLength={6}
                                    className="w-24 text-sm border border-gray-200 rounded px-2.5 py-1 font-mono focus:outline-none focus:ring-2 focus:ring-blue-300" />
                                  <button type="button" onClick={() => handleAddModel(group.manufacturer)}
                                    disabled={!newModelLabel.trim() || newModelCode.trim().length < 2}
                                    className="text-xs px-3 py-1 rounded bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">등록</button>
                                  <button type="button" onClick={() => setAddingModel(null)}
                                    className="text-xs px-3 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50">취소</button>
                                </div>
                              )}
                              {group.models.length === 0 && !isAddingModel && (
                                <p className="px-6 py-2.5 text-xs text-gray-400">등록된 모델이 없습니다.</p>
                              )}
                              {group.models.length > 0 && (
                                <div className="flex items-center gap-3 px-6 py-1 bg-gray-50 border-b border-gray-100">
                                  <span className="flex-1 text-[10px] font-semibold text-gray-400 uppercase">모델명</span>
                                  <span className="w-20 text-[10px] font-semibold text-gray-400 uppercase">코드</span>
                                  <span className="w-6" />
                                </div>
                              )}
                              {group.models.map(model => (
                                <div key={model.value} className="flex items-center gap-3 px-6 py-2 hover:bg-gray-50 group border-b border-gray-50 last:border-0">
                                  <span className="flex-1 text-sm text-gray-800">{model.label}</span>
                                  <span className="w-20 text-xs text-gray-400 font-mono">{model.code}</span>
                                  <button type="button"
                                    onClick={() => handleDeleteCellModelEntry(group.manufacturer, model.value, model.label)}
                                    className="w-6 h-6 rounded flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

            ) : (
              /* ── Normal option panel ───────────────────────────────── */
              <>
                {/* Add form */}
                <div className="flex gap-2 mb-2">
                  <input type="text" value={newLabel}
                    onChange={e => setNewLabel(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    placeholder="옵션명"
                    className="flex-1 text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-300" />
                  <input type="text" value={newCode}
                    onChange={e => setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    placeholder={currentCat?.requireCode ? '코드 (필수)' : '코드 (선택)'}
                    className={`w-28 text-sm border rounded px-3 py-1.5 font-mono focus:outline-none focus:ring-2 ${
                      currentCat?.requireCode
                        ? 'border-orange-200 bg-orange-50 focus:ring-orange-200 placeholder:text-orange-300'
                        : 'border-gray-200 focus:ring-gray-300'
                    }`} />
                  <button type="button" onClick={handleAdd} disabled={!canAdd}
                    className="text-sm px-4 py-1.5 rounded bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">
                    추가
                  </button>
                </div>

                {currentCat?.requireCode ? (
                  <div className="flex items-center gap-1.5 mb-5 text-[11px] text-orange-500">
                    <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    코드는 품번 자동생성에 사용됩니다. 2~6자 영문+숫자 필수 입력.
                  </div>
                ) : (
                  <div className="mb-4" />
                )}

                {/* Column header */}
                {current.length > 0 && (
                  <div className="flex items-center gap-2 pl-7 pr-3 pb-1.5 mb-1 border-b border-gray-100">
                    <span className="flex-1 text-xs font-medium text-gray-400 uppercase tracking-wide">옵션명</span>
                    <span className="w-24 text-xs font-medium text-gray-400 uppercase tracking-wide">코드</span>
                    <span className="w-16" />
                  </div>
                )}

                {current.length === 0 ? (
                  <p className="text-sm text-gray-400 mt-4">등록된 옵션이 없습니다.</p>
                ) : (
                  <div
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); if (overIndex !== null) handleDrop(overIndex) }}
                  >
                    {current.map((opt, i) => {
                      const isDragging = dragIndex === i
                      const isOver = overIndex === i && dragIndex !== null && dragIndex !== i
                      const dropAbove = isOver && dragIndex !== null && i < dragIndex
                      return (
                        <div
                          key={opt.value}
                          draggable={editingValue !== opt.value}
                          onDragStart={() => { setDragIndex(i); setOverIndex(null) }}
                          onDragOver={e => { e.preventDefault(); setOverIndex(i) }}
                          onDrop={e => { e.preventDefault(); handleDrop(i) }}
                          onDragEnd={() => { setDragIndex(null); setOverIndex(null) }}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg group transition-colors
                            ${isDragging ? 'opacity-40' : 'hover:bg-gray-50'}
                            ${isOver && dropAbove  ? 'border-t-2 border-blue-400' : ''}
                            ${isOver && !dropAbove ? 'border-b-2 border-blue-400' : ''}
                          `}
                        >
                          {/* 드래그 핸들 */}
                          <span
                            className="w-4 shrink-0 flex flex-col items-center gap-[3px] opacity-0 group-hover:opacity-40 cursor-grab active:cursor-grabbing"
                            title="드래그하여 순서 변경"
                          >
                            <span className="w-3 h-px bg-gray-500 rounded" />
                            <span className="w-3 h-px bg-gray-500 rounded" />
                            <span className="w-3 h-px bg-gray-500 rounded" />
                          </span>

                          {editingValue === opt.value ? (
                            <>
                              <input type="text" value={editState.label}
                                onChange={e => setEditState(s => ({ ...s, label: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && saveEdit(opt.value)}
                                autoFocus
                                className="flex-1 text-sm border border-blue-300 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                              <input type="text" value={editState.code}
                                onChange={e => setEditState(s => ({ ...s, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) }))}
                                onKeyDown={e => e.key === 'Enter' && saveEdit(opt.value)}
                                placeholder="코드"
                                className="w-24 text-sm border border-blue-300 rounded px-2 py-0.5 font-mono focus:outline-none focus:ring-2 focus:ring-blue-200" />
                              <div className="flex gap-1 w-16 justify-end">
                                <button type="button" onClick={() => saveEdit(opt.value)}
                                  className="text-xs px-2 py-0.5 rounded bg-gray-800 text-white hover:bg-gray-700">저장</button>
                                <button type="button" onClick={() => setEditingValue(null)}
                                  className="text-xs px-2 py-0.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-100">취소</button>
                              </div>
                            </>
                          ) : (
                            <>
                              <span className="flex-1 text-sm text-gray-800">{opt.label}</span>
                              <span className="w-24 text-xs text-gray-400 font-mono">
                                {opt.code ?? <span className="text-gray-200">—</span>}
                              </span>
                              <div className="flex gap-1 w-16 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                <button type="button" onClick={() => startEdit(opt)}
                                  className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
                                  title="수정">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button type="button" onClick={() => handleDelete(opt.value, opt.label)}
                                  className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                  title="삭제">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
