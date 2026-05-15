'use client'

import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const PAYMENT_TYPES = ['카드', '연구비 계좌이체', '자계좌 이체']

interface Props {
  open: boolean
  request: any | null
  onClose: () => void
  onSaved: (req: any) => void
}

export default function MiscBuyerDialog({ open, request, onClose, onSaved }: Props) {
  const [cards,        setCards]        = useState<{ id: string; name: string }[]>([])
  const [paymentType,  setPaymentType]  = useState('')
  const [cardUsed,     setCardUsed]     = useState('')
  const [cardInput,    setCardInput]    = useState('')
  const [cardDropOpen, setCardDropOpen] = useState(false)
  const [dropRect,     setDropRect]     = useState<{ top: number; left: number; width: number } | null>(null)
  const [creatingCard, setCreatingCard] = useState(false)
  const [expenseRef,   setExpenseRef]   = useState('')
  const [taxInvoice,   setTaxInvoice]   = useState('')
  const [supplier,     setSupplier]     = useState<any | null>(null)
  const [selectedStatus, setSelectedStatus] = useState('ORDERED')
  const [saving,       setSaving]       = useState(false)

  const cardInputRef = useRef<HTMLInputElement>(null)

  const showCard    = paymentType === '카드'
  const showAccount = paymentType === '연구비 계좌이체' || paymentType === '자계좌 이체'

  useEffect(() => {
    if (!open) return
    fetchCards()
    setPaymentType(request?.miscPaymentType ?? '')
    setCardUsed(request?.cardUsed ?? '')
    setCardInput(request?.cardUsed ?? '')
    setExpenseRef(request?.miscExpenseRef ?? '')
    setTaxInvoice(request?.miscTaxInvoice ?? '')
    setSelectedStatus(request?.status ?? 'ORDERED')
    setSupplier(null)
    if (request?.miscSupplier) fetchSupplier(request.miscSupplier)
  }, [open, request])

  function openCardDrop() {
    if (cardInputRef.current) {
      const r = cardInputRef.current.getBoundingClientRect()
      setDropRect({ top: r.bottom + 4, left: r.left, width: r.width })
    }
    setCardDropOpen(true)
  }

  async function fetchCards() {
    try {
      const res  = await fetch('/api/purchases/cards')
      const json = await res.json()
      if (json.success) setCards(json.data)
    } catch {}
  }

  async function fetchSupplier(name: string) {
    try {
      const res  = await fetch(`/api/suppliers?search=${encodeURIComponent(name)}&limit=1`)
      const json = await res.json()
      const list = json.data?.suppliers ?? []
      if (list.length > 0) setSupplier(list[0])
    } catch {}
  }

  async function createCard(name: string) {
    if (!name.trim()) return
    setCreatingCard(true)
    try {
      const res  = await fetch('/api/purchases/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const json = await res.json()
      if (json.success) {
        setCards(prev => [...prev, json.data])
        setCardUsed(json.data.name)
        setCardInput(json.data.name)
        setCardDropOpen(false)
        toast.success('카드가 등록되었습니다.')
      } else {
        toast.error(json.message ?? '카드 등록 실패')
      }
    } catch { toast.error('서버 오류가 발생했습니다.') }
    finally { setCreatingCard(false) }
  }

  async function handleSave() {
    if (!request) return
    setSaving(true)
    try {
      const res  = await fetch(`/api/purchases/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: selectedStatus,
          miscPaymentType: paymentType || null,
          cardUsed: showCard ? (cardUsed || null) : null,
          miscExpenseRef:  showAccount ? (expenseRef || null) : null,
          miscTaxInvoice:  showAccount ? (taxInvoice || null) : null,
        }),
      })
      const json = await res.json()
      if (!json.success) { toast.error(json.message ?? '저장 실패'); return }
      toast.success('저장되었습니다.')
      onSaved(json.data)
    } catch { toast.error('서버 오류가 발생했습니다.') }
    finally { setSaving(false) }
  }

  if (!open || !request) return null

  const filteredCards  = cards.filter(c =>
    !cardInput.trim() || c.name.toLowerCase().includes(cardInput.toLowerCase())
  )
  const cardExactMatch = cards.some(c => c.name.toLowerCase() === cardInput.trim().toLowerCase())

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: 480, maxHeight: '92vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-6 py-4 border-b flex items-center justify-between shrink-0"
          style={{ background: 'linear-gradient(to right, #faf5ff, #f8fafc)' }}>
          <div>
            <h2 className="text-sm font-bold text-gray-900">연구비 구매 처리</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">{request.documentNo} · {request.title}</p>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 text-lg font-light">
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* 상태 */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">상태</label>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="h-8 w-full rounded-lg border border-gray-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
            >
              <option value="ORDERED">주문완료</option>
              <option value="RECEIVED">입고완료</option>
              <option value="APPROVED">검토중</option>
              <option value="REJECTED">반려</option>
              <option value="PENDING">요청</option>
            </select>
          </div>

          {/* 결제 구분 */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">결제 구분</label>
            <select
              value={paymentType}
              onChange={e => setPaymentType(e.target.value)}
              className="h-8 w-full rounded-lg border border-gray-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
            >
              <option value="">선택</option>
              {PAYMENT_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* 카드 (결제 구분 = 카드인 경우만) */}
          {showCard && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">카드</label>
              <Input
                ref={cardInputRef}
                value={cardInput}
                onChange={e => {
                  setCardInput(e.target.value)
                  setCardUsed(e.target.value)
                  openCardDrop()
                }}
                onFocus={openCardDrop}
                onBlur={() => setTimeout(() => setCardDropOpen(false), 150)}
                placeholder="카드명 직접 입력 또는 선택"
                className="h-8 text-xs"
              />
            </div>
          )}

          {/* 계좌정보 / 지출결의서 / 세금계산서 (연구비 계좌이체 / 자계좌 이체인 경우만) */}
          {showAccount && (
            <>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">계좌정보</label>
                {supplier && (supplier.bankName || supplier.accountNumber) ? (
                  <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2.5 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-gray-700">
                      <span className="text-gray-400 w-14 shrink-0">은행</span>
                      <span className="font-medium">{supplier.bankName || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-700">
                      <span className="text-gray-400 w-14 shrink-0">계좌번호</span>
                      <span className="font-medium font-mono">{supplier.accountNumber || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-700">
                      <span className="text-gray-400 w-14 shrink-0">예금주</span>
                      <span className="font-medium">{supplier.accountHolder || '—'}</span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 text-xs text-gray-400">
                    {supplier ? '등록된 계좌정보가 없습니다.' : '공급처 정보를 불러오는 중...'}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">비즈플레이 지출결의서 번호</label>
                <Input
                  value={expenseRef}
                  onChange={e => setExpenseRef(e.target.value)}
                  placeholder="지출결의서 번호 입력"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">세금계산서 발행 여부</label>
                <select
                  value={taxInvoice}
                  onChange={e => setTaxInvoice(e.target.value)}
                  className="h-8 w-full rounded-lg border border-gray-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
                >
                  <option value="">선택</option>
                  <option value="Y">Y</option>
                  <option value="N">N</option>
                </select>
              </div>
            </>
          )}

        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 border-t bg-gray-50/70 flex justify-end gap-2 shrink-0">
          <Button variant="outline" size="sm" className="h-8 text-xs px-5"
            onClick={onClose} disabled={saving}>취소</Button>
          <Button size="sm" className="h-8 text-xs px-6 bg-purple-600 hover:bg-purple-700"
            onClick={handleSave} disabled={saving}>
            {saving ? '처리 중...' : `저장 · ${selectedStatus === 'ORDERED' ? '주문완료' : selectedStatus === 'RECEIVED' ? '입고완료' : selectedStatus === 'APPROVED' ? '검토중' : selectedStatus === 'REJECTED' ? '반려' : '요청'}`}
          </Button>
        </div>
      </div>

      {/* 카드 드롭다운 — 뷰포트 기준 fixed 렌더링으로 클리핑 방지 */}
      {showCard && cardDropOpen && dropRect && (
        <div
          className="bg-white border border-gray-200 rounded-lg shadow-xl overflow-y-auto"
          style={{
            position: 'fixed',
            top: dropRect.top,
            left: dropRect.left,
            width: dropRect.width,
            maxHeight: 220,
            zIndex: 9999,
          }}
        >
          {filteredCards.map(c => (
            <button
              key={c.id}
              type="button"
              onMouseDown={() => {
                setCardInput(c.name)
                setCardUsed(c.name)
                setCardDropOpen(false)
              }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-purple-50 text-gray-700"
            >
              {c.name}
            </button>
          ))}
          {cardInput.trim() && !cardExactMatch && (
            <button
              type="button"
              onMouseDown={() => createCard(cardInput)}
              disabled={creatingCard}
              className="w-full text-left px-3 py-2 text-xs hover:bg-green-50 text-green-600 font-medium border-t border-gray-100 disabled:opacity-50"
            >
              {creatingCard ? '등록 중...' : `"${cardInput.trim()}" 새 카드로 등록`}
            </button>
          )}
          {filteredCards.length === 0 && !cardInput.trim() && (
            <div className="px-3 py-2 text-xs text-gray-400">카드 없음</div>
          )}
        </div>
      )}
    </div>
  )
}
