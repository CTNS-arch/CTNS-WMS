'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import SupplierDialog from '@/components/suppliers/SupplierDialog'

type Approver = { order: number; role: string; name: string; userId?: string }
type UserItem = { id: string; name: string | null; email: string }

interface Props {
  open: boolean
  editReq?: any | null
  readOnly?: boolean
  onClose: () => void
  onSaved: (req: any) => void
  users: UserItem[]
  sessionName: string
}

const DELIVERY_OPTIONS  = ['창원', '부산']
const ORDER_METHODS     = ['온라인', '이메일', '전화']
const FILE_TYPE_OPTIONS = ['견적서', '발주서', '주문내역']

type AttachedFile = { file: File; fileType: string }

function loadDefaults() {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('erp-approval-etc') : null
    if (raw) return JSON.parse(raw)
  } catch {}
  return { reviewerId: '', reviewerName: '', approverId: '', approverName: '' }
}

function makeApprovalLine(drafterName: string): Approver[] {
  const d = loadDefaults()
  return [
    { order: 1, role: '기안자', name: drafterName },
    { order: 2, role: '검토자', name: d.reviewerName, userId: d.reviewerId || undefined },
    { order: 3, role: '승인자', name: d.approverName, userId: d.approverId || undefined },
  ]
}

export default function MiscPurchaseDialog({ open, editReq, readOnly = false, onClose, onSaved, users, sessionName }: Props) {
  const [orderMethod,      setOrderMethod]      = useState('')
  const [title,            setTitle]            = useState('')
  const [miscWorkCode,     setMiscWorkCode]      = useState('')
  const [miscSupplier,     setMiscSupplier]      = useState('')
  const [miscUrl,          setMiscUrl]           = useState('')
  const [miscDeliveryLoc,  setMiscDeliveryLoc]   = useState('')
  const [miscTotalAmount,  setMiscTotalAmount]   = useState('')
  const [miscDocumentRef,  setMiscDocumentRef]   = useState('')
  const [memo,             setMemo]              = useState('')
  const [approvalLine,     setApprovalLine]      = useState<Approver[]>([])
  const [files,            setFiles]             = useState<AttachedFile[]>([])
  const [saving,           setSaving]            = useState(false)
  const [isDragging,       setIsDragging]        = useState(false)

  // 공급처 검색
  const [supplierQuery,    setSupplierQuery]     = useState('')
  const [supplierResults,  setSupplierResults]   = useState<any[]>([])
  const [supplierOpen,     setSupplierOpen]      = useState(false)
  const [selectedSupplier, setSelectedSupplier]  = useState<any | null>(null)
  const [supplierCreate,   setSupplierCreate]    = useState(false)
  const [supplierDetail,   setSupplierDetail]    = useState(false)

  const supplierTimer = useRef<any>(null)
  const dropRef       = useRef<HTMLDivElement>(null)
  const fileRef       = useRef<HTMLInputElement>(null)

  const showDocRef        = Number(miscTotalAmount) >= 300000
  const showSupplierInfo  = (orderMethod === '이메일' || orderMethod === '전화') && !!selectedSupplier

  useEffect(() => {
    if (!open) return
    if (editReq) {
      setOrderMethod(editReq.miscOrderMethod || '')
      setTitle(editReq.title || '')
      setMiscWorkCode(editReq.miscWorkCode || '')
      setMiscSupplier(editReq.miscSupplier || '')
      setSupplierQuery(editReq.miscSupplier || '')
      setMiscUrl(editReq.miscUrl || '')
      setMiscDeliveryLoc(editReq.miscDeliveryLoc || '')
      setMiscTotalAmount(editReq.miscTotalAmount != null ? String(editReq.miscTotalAmount) : '')
      setMiscDocumentRef(editReq.miscDocumentRef || '')
      setMemo(editReq.memo || '')
      setSelectedSupplier(null)
      try {
        setApprovalLine(editReq.approvalLine ? JSON.parse(editReq.approvalLine) : makeApprovalLine(sessionName))
      } catch {
        setApprovalLine(makeApprovalLine(sessionName))
      }
      setFiles([])
    } else {
      setOrderMethod(''); setTitle(''); setMiscWorkCode(''); setMiscSupplier('')
      setSupplierQuery(''); setMiscUrl(''); setMiscDeliveryLoc('')
      setMiscTotalAmount(''); setMiscDocumentRef(''); setMemo('')
      setSelectedSupplier(null)
      setApprovalLine(makeApprovalLine(sessionName))
      setFiles([])
    }
  }, [open, editReq, sessionName])

  const fetchSuppliers = useCallback(async (q: string) => {
    try {
      const params = new URLSearchParams({ limit: '10' })
      if (q.trim()) params.set('search', q.trim())
      const res  = await fetch(`/api/suppliers?${params}`)
      const json = await res.json()
      setSupplierResults(json.success ? (json.data.suppliers ?? []) : [])
    } catch { setSupplierResults([]) }
  }, [])

  function handleSupplierInput(val: string) {
    setSupplierQuery(val)
    setMiscSupplier(val)
    setSelectedSupplier(null)
    setSupplierOpen(true)
    clearTimeout(supplierTimer.current)
    supplierTimer.current = setTimeout(() => fetchSuppliers(val), 150)
  }

  function selectSupplier(s: any) {
    setMiscSupplier(s.companyName)
    setSupplierQuery(s.companyName)
    setSelectedSupplier(s)
    if (s.url) setMiscUrl(s.url)
    setSupplierOpen(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const dropped = Array.from(e.dataTransfer.files)
    setFiles(prev => [...prev, ...dropped.map(f => ({ file: f, fileType: '견적서' }))])
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList) return
    setFiles(prev => [...prev, ...Array.from(fileList).map(f => ({ file: f, fileType: '견적서' }))])
  }

  async function handleSave() {
    if (!title.trim())        { toast.error('요청제목을 입력하세요.');    return }
    if (!miscWorkCode.trim()) { toast.error('프로젝트코드를 입력하세요.'); return }
    if (!miscSupplier.trim()) { toast.error('공급처를 입력하세요.');       return }
    if (!miscDeliveryLoc)     { toast.error('배송지를 선택하세요.');       return }
    if (!miscTotalAmount)     { toast.error('총금액을 입력하세요.');        return }

    setSaving(true)
    try {
      const payload = {
        title, requesterName: sessionName, memo, approvalLine,
        miscWorkCode, miscSupplier, miscUrl,
        miscTotalAmount: miscTotalAmount ? Number(miscTotalAmount) : null,
        miscDocumentRef: showDocRef ? miscDocumentRef : null,
        miscDeliveryLoc,
        miscOrderMethod: orderMethod || null,
      }

      let reqId: string
      if (editReq) {
        const res  = await fetch(`/api/purchases/${editReq.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (!json.success) { toast.error(json.message ?? '수정 실패'); return }
        toast.success('수정되었습니다.')
        onSaved(json.data)
      } else {
        const res  = await fetch('/api/purchases/misc', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (!json.success) { toast.error(json.message ?? '등록 실패'); return }
        reqId = json.data.id

        for (const af of files) {
          const fd = new FormData()
          fd.append('files', af.file)
          fd.append('fileType', af.fileType)
          await fetch(`/api/purchases/${reqId}/files`, { method: 'POST', body: fd }).catch(() => {})
        }

        const full = await fetch(`/api/purchases/${reqId}`).then(r => r.json())
        toast.success('일괄 구매 요청이 등록되었습니다.')
        onSaved(full.data ?? json.data)
      }
    } catch {
      toast.error('서버 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const inputCls = 'h-8 text-xs'
  const labelCls = 'text-[11px] font-semibold text-gray-500 uppercase tracking-wide'

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={onClose}>
        <div
          className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ width: 580, maxHeight: '92vh' }}
          onClick={e => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div className="px-6 py-4 border-b flex items-center justify-between shrink-0"
            style={{ background: 'linear-gradient(to right, #f0f9ff, #f8fafc)' }}>
            <div>
              <h2 className="text-sm font-bold text-gray-900">
                {readOnly ? '연구비 구매 요청 조회' : editReq ? '연구비 구매 요청 수정' : '일괄 구매 요청'}
              </h2>
              <p className="text-[11px] text-gray-400 mt-0.5">개별 품목 없이 요청 건 전체를 등록합니다</p>
            </div>
            <button onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 text-lg font-light">×</button>
          </div>

          {/* 폼 */}
          <div className={`flex-1 overflow-y-auto px-6 py-5 space-y-4 ${readOnly ? 'pointer-events-none select-none opacity-70' : ''}`}>

            {/* 주문방식 */}
            <div className="space-y-1.5">
              <label className={labelCls}>주문방식</label>
              <select value={orderMethod} onChange={e => setOrderMethod(e.target.value)}
                className="h-8 w-full rounded-lg border border-gray-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
                <option value="">선택하세요</option>
                {ORDER_METHODS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>

            {/* 요청제목 */}
            <div className="space-y-1.5">
              <label className={labelCls}>요청제목 <span className="text-red-400">*</span></label>
              <Input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="구매 요청 제목을 입력하세요" className={inputCls} />
            </div>

            {/* 프로젝트코드 + 공급처 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className={labelCls}>프로젝트코드 <span className="text-red-400">*</span></label>
                <Input value={miscWorkCode} onChange={e => setMiscWorkCode(e.target.value)}
                  placeholder="예) B26-1234" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className={labelCls}>공급처 <span className="text-red-400">*</span></label>
                  {selectedSupplier && (
                    <button type="button"
                      onClick={() => setSupplierDetail(true)}
                      className="text-[10px] text-blue-500 hover:text-blue-700 font-medium flex items-center gap-0.5">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      상세보기
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    value={supplierQuery}
                    onChange={e => handleSupplierInput(e.target.value)}
                    onFocus={() => { setSupplierOpen(true); fetchSuppliers(supplierQuery) }}
                    onBlur={() => setTimeout(() => setSupplierOpen(false), 180)}
                    placeholder="공급처 검색 또는 입력"
                    className="h-8 w-full rounded-lg border border-gray-200 px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  {supplierOpen && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                      {supplierResults.length > 0 && (
                        <div className="max-h-44 overflow-y-auto">
                          {supplierResults.map((s: any) => (
                            <button key={s.id} type="button"
                              onMouseDown={e => { e.preventDefault(); selectSupplier(s) }}
                              className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-2 border-b last:border-0 text-xs transition-colors">
                              <span className="text-gray-400 font-mono text-[10px] w-16 shrink-0">{s.supplierCode}</span>
                              <span className="font-medium text-gray-800 truncate">{s.companyName}</span>
                              {s.url && <span className="ml-auto text-[10px] text-blue-400 shrink-0">URL</span>}
                            </button>
                          ))}
                        </div>
                      )}
                      <button type="button"
                        onMouseDown={e => { e.preventDefault(); setSupplierOpen(false); setSupplierCreate(true) }}
                        className="w-full text-left px-3 py-2 hover:bg-green-50 flex items-center gap-1.5 text-xs text-green-700 font-medium border-t transition-colors">
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        신규 공급처 등록
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 이메일/전화 주문 시 공급처 금융정보 + 담당자 */}
            {showSupplierInfo && (
              <div className="rounded-xl border border-blue-100 bg-blue-50/40 px-4 py-3 space-y-3">
                {/* 금융정보 */}
                <div>
                  <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide mb-1.5">금융정보</p>
                  {selectedSupplier.bankName || selectedSupplier.accountNumber ? (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-700">
                      {selectedSupplier.bankName && (
                        <span><span className="text-gray-400 mr-1">은행</span>{selectedSupplier.bankName}</span>
                      )}
                      {selectedSupplier.accountNumber && (
                        <span><span className="text-gray-400 mr-1">계좌</span>{selectedSupplier.accountNumber}</span>
                      )}
                      {selectedSupplier.accountHolder && (
                        <span><span className="text-gray-400 mr-1">예금주</span>{selectedSupplier.accountHolder}</span>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">등록된 금융정보 없음</p>
                  )}
                </div>

                {/* 담당자 */}
                <div>
                  <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide mb-1.5">담당자</p>
                  {selectedSupplier.contacts?.length > 0 ? (
                    <div className="space-y-1">
                      {selectedSupplier.contacts.map((c: any, i: number) => (
                        <div key={i} className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-700">
                          <span className="font-medium text-gray-800">
                            {c.name}{c.title && <span className="font-normal text-gray-400 ml-1">({c.title})</span>}
                          </span>
                          {c.phone && (
                            <a href={`tel:${c.phone}`} className="text-gray-500 hover:text-blue-600">{c.phone}</a>
                          )}
                          {c.email && (
                            <a href={`mailto:${c.email}`} className="text-gray-500 hover:text-blue-600">{c.email}</a>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">등록된 담당자 없음</p>
                  )}
                </div>
              </div>
            )}

            {/* URL */}
            <div className="space-y-1.5">
              <label className={labelCls}>URL</label>
              <Input value={miscUrl} onChange={e => setMiscUrl(e.target.value)}
                placeholder="구매 링크 또는 참고 URL" className={inputCls} />
            </div>

            {/* 배송지 + 총금액 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className={labelCls}>배송지 <span className="text-red-400">*</span></label>
                <select value={miscDeliveryLoc} onChange={e => setMiscDeliveryLoc(e.target.value)}
                  className="h-8 w-full rounded-lg border border-gray-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
                  <option value="">선택하세요</option>
                  {DELIVERY_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>
                  총금액 (원) <span className="text-red-400">*</span>{' '}
                  <span className="text-[10px] font-normal text-gray-400 normal-case">VAT 포함</span>
                </label>
                <Input type="number" min={0} value={miscTotalAmount}
                  onChange={e => setMiscTotalAmount(e.target.value)}
                  placeholder="0" className={inputCls + ' text-right'} />
              </div>
            </div>

            {/* 품의서번호 */}
            {showDocRef && (
              <div className="space-y-1.5">
                <label className={labelCls}>
                  비즈플레이 품의서번호
                  <span className="ml-1.5 text-[10px] font-normal text-amber-500 normal-case">(30만원 이상 필수)</span>
                </label>
                <Input value={miscDocumentRef} onChange={e => setMiscDocumentRef(e.target.value)}
                  placeholder="품의서 번호를 입력하세요" className={inputCls} />
              </div>
            )}

            {/* 파일 첨부 */}
            <div className="space-y-1.5">
              <label className={labelCls}>파일 첨부</label>
              <div
                ref={dropRef}
                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl px-4 py-4 text-center transition-colors cursor-pointer ${
                  isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }`}
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" multiple className="hidden"
                  onChange={e => addFiles(e.target.files)} />
                <div className="flex flex-col items-center gap-1 pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-xs text-gray-500">파일을 드래그하거나 클릭하여 첨부</p>
                  <p className="text-[10px] text-gray-400">모든 파일 형식 지원 · 여러 파일 선택 가능</p>
                </div>
              </div>
              {files.length > 0 && (
                <div className="space-y-1.5 mt-1.5">
                  {files.map((af, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
                      <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      <span className="text-xs text-gray-700 truncate flex-1 min-w-0">{af.file.name}</span>
                      <span className="text-[10px] text-gray-400 shrink-0">{(af.file.size / 1024).toFixed(0)}KB</span>
                      <select value={af.fileType} onChange={e => {
                        const t = e.target.value
                        setFiles(prev => prev.map((f, j) => j === i ? { ...f, fileType: t } : f))
                      }} onClick={e => e.stopPropagation()}
                        className="h-6 rounded border border-gray-200 text-[10px] px-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 shrink-0">
                        {FILE_TYPE_OPTIONS.map(t => <option key={t}>{t}</option>)}
                      </select>
                      <button type="button"
                        onClick={e => { e.stopPropagation(); setFiles(prev => prev.filter((_, j) => j !== i)) }}
                        className="text-gray-300 hover:text-red-400 shrink-0 text-base leading-none">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 비고 */}
            <div className="space-y-1.5">
              <label className={labelCls}>비고</label>
              <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={2}
                placeholder="추가 내용을 입력하세요"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>

            {/* 결재 라인 */}
            <div className="space-y-1.5 pt-1 border-t border-gray-100">
              <label className={labelCls}>결재 라인</label>
              <div className="flex items-center gap-1.5 w-full">
                {approvalLine.map((approver, i) => (
                  <React.Fragment key={approver.order}>
                    {i > 0 && <span className="text-gray-300 text-xs shrink-0">→</span>}
                    <div className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg border border-gray-200 bg-white flex-1 min-w-0">
                      <span className="text-gray-400 font-medium text-[10px] uppercase tracking-wide whitespace-nowrap">{approver.role}</span>
                      {approver.order === 1 ? (
                        <span className="font-medium text-[10px] text-gray-700 truncate w-full text-center">{approver.name || '—'}</span>
                      ) : (
                        <select value={approver.userId ?? ''}
                          onChange={e => {
                            const sel = users.find(u => u.id === e.target.value)
                            setApprovalLine(prev => prev.map((a, ai) =>
                              ai === i ? { ...a, userId: sel?.id, name: sel?.name ?? '' } : a
                            ))
                          }}
                          className="text-[10px] font-medium text-gray-700 bg-transparent border-0 border-b border-gray-200 focus:outline-none focus:border-blue-400 py-0 px-0 w-full text-center cursor-pointer">
                          <option value="">미설정</option>
                          {users.map(u => <option key={u.id} value={u.id}>{u.name ?? u.email}</option>)}
                        </select>
                      )}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          {/* 푸터 */}
          <div className="px-6 py-4 border-t bg-gray-50/70 flex justify-end gap-2 shrink-0">
            {readOnly ? (
              <Button variant="outline" size="sm" className="h-8 text-xs px-5" onClick={onClose}>닫기</Button>
            ) : (
              <>
                <Button variant="outline" size="sm" className="h-8 text-xs px-5"
                  onClick={onClose} disabled={saving}>취소</Button>
                <Button size="sm" className="h-8 text-xs px-6 bg-blue-600 hover:bg-blue-700"
                  onClick={handleSave} disabled={saving}>
                  {saving ? '처리 중...' : editReq ? '수정' : '요청 등록'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 신규 공급처 등록 */}
      <SupplierDialog
        open={supplierCreate}
        onClose={() => setSupplierCreate(false)}
        onSaved={(saved?: any) => {
          if (saved?.companyName) {
            setMiscSupplier(saved.companyName)
            setSupplierQuery(saved.companyName)
            setSelectedSupplier(saved)
            if (saved.url) setMiscUrl(saved.url)
          }
          setSupplierCreate(false)
        }}
      />

      {/* 공급처 상세보기 */}
      {selectedSupplier && (
        <SupplierDialog
          open={supplierDetail}
          supplier={selectedSupplier}
          onClose={() => setSupplierDetail(false)}
          onSaved={(saved?: any) => {
            if (saved) setSelectedSupplier(saved)
            setSupplierDetail(false)
          }}
        />
      )}
    </>
  )
}
