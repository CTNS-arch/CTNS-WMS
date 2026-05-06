'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { getOptions, addOption, deleteOption, resetToDefault, updateOption, type SelectOption } from '@/lib/select-options'

const CATEGORIES: { key: string; label: string; hasDefault: boolean; hasCode: boolean }[] = [
  { key: 'vendor',        label: '거래처',   hasDefault: false, hasCode: false },
  { key: 'specialOption', label: '특수옵션', hasDefault: true,  hasCode: false },
  { key: 'certification', label: '인증',     hasDefault: true,  hasCode: false },
  { key: 'chemistryType', label: '화학계',   hasDefault: true,  hasCode: true  },
  { key: 'packType',      label: '팩타입',   hasDefault: true,  hasCode: false },
  { key: 'material',      label: '재질',     hasDefault: true,  hasCode: false },
  { key: 'color',         label: '색상',     hasDefault: true,  hasCode: false },
  { key: 'formFactor',    label: '폼팩터',   hasDefault: true,  hasCode: false },
  { key: 'unit',          label: '단위',     hasDefault: true,  hasCode: false },
  { key: 'manufacturer',  label: '제조사',   hasDefault: true,  hasCode: true  },
]

interface EditState {
  label: string
  code: string
}

export default function OptionsPage() {
  const [selected, setSelected] = useState(CATEGORIES[0].key)
  const [options, setOptions] = useState<Record<string, SelectOption[]>>({})
  const [newLabel, setNewLabel] = useState('')
  const [newCode, setNewCode] = useState('')
  const [editingValue, setEditingValue] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState>({ label: '', code: '' })

  const reload = () => {
    const next: Record<string, SelectOption[]> = {}
    for (const c of CATEGORIES) next[c.key] = getOptions(c.key)
    setOptions(next)
  }

  useEffect(() => { reload() }, [])

  const current = options[selected] ?? []
  const currentCat = CATEGORIES.find(c => c.key === selected)!

  const handleAdd = () => {
    const trimmed = newLabel.trim()
    if (!trimmed) return
    addOption(selected, trimmed, newCode.trim() || undefined)
    setNewLabel('')
    setNewCode('')
    reload()
    toast.success(`"${trimmed}" 추가되었습니다.`)
  }

  const handleDelete = (value: string, label: string) => {
    deleteOption(selected, value)
    reload()
    toast.success(`"${label}" 삭제되었습니다.`)
  }

  const handleReset = () => {
    resetToDefault(selected)
    setEditingValue(null)
    reload()
    toast.success(`${currentCat.label} 옵션이 기본값으로 초기화되었습니다.`)
  }

  const startEdit = (opt: SelectOption) => {
    setEditingValue(opt.value)
    setEditState({ label: opt.label, code: opt.code ?? '' })
  }

  const cancelEdit = () => {
    setEditingValue(null)
  }

  const saveEdit = (value: string) => {
    const trimmedLabel = editState.label.trim()
    if (!trimmedLabel) return
    updateOption(selected, value, {
      label: trimmedLabel,
      code: editState.code.trim() || undefined,
    })
    setEditingValue(null)
    reload()
    toast.success('수정되었습니다.')
  }

  // when switching categories, cancel any in-progress edit
  const selectCategory = (key: string) => {
    setSelected(key)
    setNewLabel('')
    setNewCode('')
    setEditingValue(null)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* 페이지 타이틀 */}
      <div className="px-6 py-3 border-b bg-white shrink-0">
        <h1 className="text-sm font-semibold text-gray-800">옵션 관리</h1>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* 왼쪽: 카테고리 목록 */}
        <aside className="w-52 shrink-0 border-r bg-gray-50 flex flex-col">
          <div className="px-4 min-h-[52px] flex items-center border-b shrink-0">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">컬럼</span>
          </div>
          <nav className="flex-1 overflow-y-auto py-2">
            {CATEGORIES.map(c => {
              const count = (options[c.key] ?? []).length
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => selectCategory(c.key)}
                  className={`w-full flex items-center justify-between px-4 py-2 text-sm transition-colors ${
                    selected === c.key
                      ? 'bg-white text-gray-900 font-medium border-r-2 border-gray-800'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span>{c.label}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    selected === c.key ? 'bg-gray-100 text-gray-600' : 'bg-gray-200 text-gray-500'
                  }`}>{count}</span>
                </button>
              )
            })}
          </nav>
        </aside>

        {/* 오른쪽: 옵션 편집 */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="px-6 min-h-[52px] flex items-center justify-between border-b bg-white shrink-0">
            <span className="text-sm font-medium text-gray-800">{currentCat.label}</span>
            {currentCat.hasDefault && (
              <Button size="sm" variant="outline" className="text-xs h-7 px-3 text-gray-500" onClick={handleReset}>
                기본값으로 초기화
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">

            {/* 새 옵션 추가 */}
            <div className="flex gap-2 mb-6">
              <input
                type="text"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="옵션명"
                className="flex-1 text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
              <input
                type="text"
                value={newCode}
                onChange={e => setNewCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="코드 (선택)"
                className="w-28 text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
              <Button size="sm" className="text-xs px-4" onClick={handleAdd} disabled={!newLabel.trim()}>
                추가
              </Button>
            </div>

            {/* 컬럼 헤더 */}
            {current.length > 0 && (
              <div className="flex items-center gap-2 px-3 pb-1.5 mb-1 border-b border-gray-100">
                <span className="flex-1 text-xs font-medium text-gray-400 uppercase tracking-wide">옵션명</span>
                <span className="w-24 text-xs font-medium text-gray-400 uppercase tracking-wide">코드</span>
                <span className="w-16" />
              </div>
            )}

            {/* 옵션 목록 */}
            {current.length === 0 ? (
              <p className="text-sm text-gray-400 mt-4">등록된 옵션이 없습니다.</p>
            ) : (
              <div className="space-y-1">
                {current.map(opt => (
                  <div key={opt.value} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-50 group">
                    {editingValue === opt.value ? (
                      /* 인라인 편집 모드 */
                      <>
                        <input
                          type="text"
                          value={editState.label}
                          onChange={e => setEditState(s => ({ ...s, label: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && saveEdit(opt.value)}
                          autoFocus
                          className="flex-1 text-sm border border-blue-300 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                        <input
                          type="text"
                          value={editState.code}
                          onChange={e => setEditState(s => ({ ...s, code: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && saveEdit(opt.value)}
                          placeholder="코드"
                          className="w-24 text-sm border border-blue-300 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                        <div className="flex gap-1 w-16 justify-end">
                          <button
                            type="button"
                            onClick={() => saveEdit(opt.value)}
                            className="text-xs px-2 py-0.5 rounded bg-gray-800 text-white hover:bg-gray-700"
                          >
                            저장
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="text-xs px-2 py-0.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-100"
                          >
                            취소
                          </button>
                        </div>
                      </>
                    ) : (
                      /* 표시 모드 */
                      <>
                        <span className="flex-1 text-sm text-gray-800">{opt.label}</span>
                        <span className="w-24 text-xs text-gray-400 font-mono">
                          {opt.code ?? <span className="text-gray-200">—</span>}
                        </span>
                        <div className="flex gap-1 w-16 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => startEdit(opt)}
                            className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
                            title="수정"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(opt.value, opt.label)}
                            className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="삭제"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
