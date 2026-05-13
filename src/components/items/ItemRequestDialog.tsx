'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CATEGORY_OPTIONS, SUB_OPTIONS } from '@/lib/classification'

interface Props {
  open: boolean
  onClose: () => void
  onSubmitted: () => void
}

const CATEGORY_LABEL: Record<string, string> = { PRODUCT: '완제품', ASSEMBLY: '반제품', COMPONENT: '자재' }

const UNIT_OPTIONS = ['EA', 'SET', 'BOX', 'PCS', 'KG', 'M', 'L', '기타']

export default function ItemRequestDialog({ open, onClose, onSubmitted }: Props) {
  const [category,    setCategory]    = useState('')
  const [subCategory, setSubCategory] = useState('')
  const [itemName,    setItemName]    = useState('')
  const [spec,        setSpec]        = useState('')
  const [quantity,    setQuantity]    = useState('')
  const [unit,        setUnit]        = useState('EA')
  const [workCode,    setWorkCode]    = useState('')
  const [memo,        setMemo]        = useState('')
  const [saving,      setSaving]      = useState(false)

  const subOpts = category ? (SUB_OPTIONS[category] ?? []) : []

  function reset() {
    setCategory(''); setSubCategory(''); setItemName(''); setSpec('')
    setQuantity(''); setUnit('EA'); setWorkCode(''); setMemo('')
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSubmit() {
    if (!category) { toast.error('대분류를 선택하세요.'); return }
    if (!itemName.trim()) { toast.error('품명/설명을 입력하세요.'); return }

    setSaving(true)
    try {
      const res  = await fetch('/api/item-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, subCategory, itemName, spec, quantity, unit, workCode, memo }),
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

          {/* 대분류 + 중분류 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                대분류 <span className="text-red-400">*</span>
              </label>
              <select
                value={category}
                onChange={e => { setCategory(e.target.value); setSubCategory('') }}
                className="h-8 rounded-lg border border-gray-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              >
                <option value="">선택하세요</option>
                {CATEGORY_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">중분류</label>
              <select
                value={subCategory}
                onChange={e => setSubCategory(e.target.value)}
                disabled={!category || subOpts.length === 0}
                className="h-8 rounded-lg border border-gray-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">선택하세요</option>
                {subOpts.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

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
              <select
                value={unit}
                onChange={e => setUnit(e.target.value)}
                className="h-8 rounded-lg border border-gray-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              >
                {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {/* 프로젝트코드 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">프로젝트코드</label>
            <Input
              value={workCode}
              onChange={e => setWorkCode(e.target.value)}
              placeholder="예) B26-1234"
              className="h-8 text-xs"
            />
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
