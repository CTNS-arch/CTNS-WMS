'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SUB_OPTIONS } from '@/lib/classification'
import { getOptions } from '@/lib/select-options'
import { buildSimpleCode } from '@/lib/item-code'

const CAT_LABEL: Record<string, string> = { PRODUCT: '완제품', ASSEMBLY: '반제품', COMPONENT: '자재' }
const CAT_COLOR: Record<string, string> = {
  PRODUCT:   'bg-blue-100 text-blue-700',
  ASSEMBLY:  'bg-purple-100 text-purple-700',
  COMPONENT: 'bg-emerald-100 text-emerald-700',
}
const CAT_BG: Record<string, string> = {
  PRODUCT:   'border-blue-200 hover:bg-blue-50',
  ASSEMBLY:  'border-purple-200 hover:bg-purple-50',
  COMPONENT: 'border-emerald-200 hover:bg-emerald-50',
}

interface BulkRow {
  subCategory: string
  itemName: string
  unit: string
  material: string
  memo: string
  error?: string
}

const EMPTY_ROW: BulkRow = { subCategory: '', itemName: '', unit: 'EA', material: '', memo: '' }
const INIT_ROWS = 10

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export default function ItemBulkCreateDialog({ open, onClose, onSaved }: Props) {
  const [category, setCategory] = useState('')
  const [rows, setRows] = useState<BulkRow[]>(Array.from({ length: INIT_ROWS }, () => ({ ...EMPTY_ROW })))
  const [saving, setSaving] = useState(false)
  const [subOpts, setSubOpts] = useState<{ value: string; label: string }[]>([])
  const [unitOpts, setUnitOpts] = useState<{ value: string; label: string }[]>([])

  useEffect(() => {
    if (!open) return
    setCategory('')
    setRows(Array.from({ length: INIT_ROWS }, () => ({ ...EMPTY_ROW })))
    setUnitOpts(getOptions('unit').map(o => ({ value: o.value, label: o.label })))
  }, [open])

  useEffect(() => {
    if (!category) return
    setSubOpts((SUB_OPTIONS[category] ?? []).map(o => ({ value: o.value, label: o.label })))
    setRows(prev => prev.map(r => ({ ...r, subCategory: category === 'PRODUCT' ? 'BP' : '' })))
  }, [category])

  const updateRow = (idx: number, field: keyof BulkRow, value: string) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value, error: undefined } : r))
  }

  const addRows = (n: number) => {
    setRows(prev => [...prev, ...Array.from({ length: n }, () => ({
      ...EMPTY_ROW,
      subCategory: category === 'PRODUCT' ? 'BP' : '',
    }))])
  }

  const clearRow = (idx: number) => {
    setRows(prev => prev.map((r, i) => i === idx ? {
      ...EMPTY_ROW,
      subCategory: category === 'PRODUCT' ? 'BP' : '',
    } : r))
  }

  const filledRows = rows.filter(r => r.itemName.trim())
  const isProduct = category === 'PRODUCT'
  const isComp = category === 'COMPONENT'

  const handleSubmit = async () => {
    const valid = rows.map((r, i) => ({ ...r, _idx: i })).filter(r => r.itemName.trim())
    if (valid.length === 0) { toast.error('등록할 품목이 없습니다.'); return }

    const missing = valid.filter(r => !r.subCategory || !r.unit)
    if (missing.length > 0) {
      setRows(prev => prev.map((r, i) => {
        const v = valid.find(v => v._idx === i)
        if (!v) return r
        return { ...r, error: !r.subCategory ? '중분류 필수' : !r.unit ? '단위 필수' : undefined }
      }))
      toast.error('중분류와 단위를 입력해주세요.')
      return
    }

    setSaving(true)
    const subCounter: Record<string, number> = {}
    let successCount = 0
    const errors: string[] = []

    for (const row of valid) {
      const key = `${category}-${row.subCategory}`
      if (!subCounter[key]) subCounter[key] = 0
      subCounter[key]++
      const revisionNumber = subCounter[key]

      const itemCode = buildSimpleCode({ category, subCategory: row.subCategory, revisionNumber })
      const payload: Record<string, any> = {
        category,
        subCategory: row.subCategory,
        itemName: row.itemName.trim(),
        unit: row.unit,
        memo: row.memo || null,
        revisionNumber,
        itemCode,
        status: 'ACTIVE',
      }
      if (isComp && row.material) payload.material = row.material

      try {
        const res = await fetch('/api/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (json.success) {
          successCount++
        } else {
          errors.push(`${row.itemName}: ${json.message}`)
          setRows(prev => prev.map((r, i) => i === row._idx ? { ...r, error: json.message } : r))
        }
      } catch {
        errors.push(`${row.itemName}: 서버 오류`)
      }
    }

    setSaving(false)
    if (successCount > 0) {
      toast.success(`${successCount}개 품목이 등록되었습니다.${errors.length > 0 ? ` (${errors.length}개 실패)` : ''}`)
      if (errors.length === 0) { onSaved(); onClose() }
      else onSaved()
    } else {
      toast.error('등록에 실패했습니다.')
    }
  }

  if (!open) return null

  const cell = 'h-8 w-full rounded border-0 bg-transparent px-2 text-xs focus:bg-white focus:ring-1 focus:ring-blue-400 focus:outline-none hover:bg-gray-50 transition-colors'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: category ? 1100 : 520, height: 720 }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-gray-50 to-white shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-gray-900">품목 일괄 등록</h2>
            {category && (
              <>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CAT_COLOR[category]}`}>
                  {CAT_LABEL[category]}
                </span>
                <button
                  className="text-xs text-gray-400 hover:text-gray-600 underline"
                  onClick={() => { setCategory(''); setRows(Array.from({ length: INIT_ROWS }, () => ({ ...EMPTY_ROW }))) }}
                >
                  대분류 변경
                </button>
              </>
            )}
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-lg leading-none">
            ×
          </button>
        </div>

        {/* 대분류 선택 */}
        {!category ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-800">대분류를 선택하세요</p>
              <p className="text-xs text-gray-400 mt-1">같은 대분류의 품목만 동시에 등록할 수 있습니다</p>
            </div>
            <div className="flex gap-4 w-full max-w-sm">
              {(['PRODUCT', 'ASSEMBLY', 'COMPONENT'] as const).map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`flex-1 py-6 rounded-xl border-2 font-semibold text-sm transition-all ${CAT_BG[cat]} ${CAT_COLOR[cat]}`}
                >
                  {CAT_LABEL[cat]}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* 테이블 툴바 */}
            <div className="px-5 py-2.5 border-b bg-gray-50 flex items-center justify-between shrink-0">
              <span className="text-xs text-gray-500">
                {filledRows.length > 0 ? `${filledRows.length}개 입력됨` : '품목명을 입력하면 등록됩니다'}
              </span>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" className="h-7 text-xs px-3" onClick={() => addRows(5)}>+ 5행 추가</Button>
                <Button variant="outline" size="sm" className="h-7 text-xs px-3" onClick={() => addRows(10)}>+ 10행 추가</Button>
              </div>
            </div>

            {/* 테이블 */}
            <div className="flex-1 overflow-auto min-h-0">
              <table className="text-xs border-collapse w-full" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: 36 }} />
                  {!isProduct && <col style={{ width: 130 }} />}
                  <col />
                  <col style={{ width: 70 }} />
                  {isComp && <col style={{ width: 90 }} />}
                  <col style={{ width: 180 }} />
                  <col style={{ width: 32 }} />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-gray-50 border-b">
                  <tr>
                    <th className="px-2 py-2.5 text-center text-gray-400 font-medium">NO</th>
                    {!isProduct && (
                      <th className="px-2 py-2.5 text-left text-gray-600 font-semibold">
                        중분류 <span className="text-red-400">*</span>
                      </th>
                    )}
                    <th className="px-2 py-2.5 text-left text-gray-600 font-semibold">
                      품목명 <span className="text-red-400">*</span>
                    </th>
                    <th className="px-2 py-2.5 text-left text-gray-600 font-semibold">
                      단위 <span className="text-red-400">*</span>
                    </th>
                    {isComp && (
                      <th className="px-2 py-2.5 text-left text-gray-600 font-semibold">재질</th>
                    )}
                    <th className="px-2 py-2.5 text-left text-gray-600 font-semibold">비고</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const filled = !!row.itemName.trim()
                    const hasError = !!row.error
                    return (
                      <tr key={idx}
                        className={`border-b last:border-0 transition-colors ${
                          hasError ? 'bg-red-50' : filled ? 'bg-blue-50/30' : ''
                        }`}
                      >
                        <td className="px-2 py-0.5 text-center text-gray-400 border-r text-xs">
                          {idx + 1}
                        </td>

                        {/* 중분류 (PRODUCT 제외) */}
                        {!isProduct && (
                          <td className="px-0.5 py-0.5 border-r">
                            <Select
                              value={row.subCategory || '_none'}
                              onValueChange={v => updateRow(idx, 'subCategory', !v || v === '_none' ? '' : v)}
                            >
                              <SelectTrigger className="h-8 text-xs border-0 bg-transparent hover:bg-gray-50 focus:ring-1 focus:ring-blue-400">
                                <SelectValue placeholder="선택" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_none" className="text-xs text-gray-400">—</SelectItem>
                                {subOpts.map(o => (
                                  <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        )}

                        {/* 품목명 */}
                        <td className="px-0.5 py-0.5 border-r">
                          <input
                            value={row.itemName}
                            onChange={e => updateRow(idx, 'itemName', e.target.value)}
                            placeholder="품목명 입력"
                            className={cell}
                          />
                        </td>

                        {/* 단위 */}
                        <td className="px-0.5 py-0.5 border-r">
                          {unitOpts.length > 0 ? (
                            <Select
                              value={row.unit || '_none'}
                              onValueChange={v => updateRow(idx, 'unit', !v || v === '_none' ? '' : v)}
                            >
                              <SelectTrigger className="h-8 text-xs border-0 bg-transparent hover:bg-gray-50 focus:ring-1 focus:ring-blue-400">
                                <SelectValue placeholder="단위" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_none" className="text-xs text-gray-400">—</SelectItem>
                                {unitOpts.map(o => (
                                  <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <input
                              value={row.unit}
                              onChange={e => updateRow(idx, 'unit', e.target.value)}
                              placeholder="EA"
                              className={cell + ' text-center'}
                            />
                          )}
                        </td>

                        {/* 재질 (COMPONENT만) */}
                        {isComp && (
                          <td className="px-0.5 py-0.5 border-r">
                            <input
                              value={row.material}
                              onChange={e => updateRow(idx, 'material', e.target.value)}
                              placeholder="재질"
                              className={cell}
                            />
                          </td>
                        )}

                        {/* 비고 */}
                        <td className="px-0.5 py-0.5 border-r">
                          {hasError ? (
                            <span className="px-2 text-xs text-red-500">{row.error}</span>
                          ) : (
                            <input
                              value={row.memo}
                              onChange={e => updateRow(idx, 'memo', e.target.value)}
                              placeholder="비고"
                              className={cell}
                            />
                          )}
                        </td>

                        {/* 행 지우기 */}
                        <td className="py-0.5 text-center">
                          {filled && (
                            <button
                              onClick={() => clearRow(idx)}
                              className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-400 hover:bg-red-50 mx-auto transition-colors text-base"
                            >
                              ×
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* 푸터 */}
        <div className="px-6 py-3.5 border-t bg-white shrink-0 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {category
              ? filledRows.length > 0 ? `${filledRows.length}개 품목 등록 예정` : '품목명을 입력하세요'
              : '대분류를 선택하세요'}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs px-4" onClick={onClose}>취소</Button>
            {category && (
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
