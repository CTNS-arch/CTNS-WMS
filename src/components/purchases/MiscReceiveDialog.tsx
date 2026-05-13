'use client'

import React, { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

const FILE_TYPE_OPTIONS = ['견적서', '발주서', '주문내역', '기타']

type AttachedFile = { file: File; fileType: string }

interface Props {
  open: boolean
  request: any | null
  onClose: () => void
  onSaved: (req: any) => void
}

export default function MiscReceiveDialog({ open, request, onClose, onSaved }: Props) {
  const [files,      setFiles]      = useState<AttachedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [saving,     setSaving]     = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function addFiles(list: FileList | null) {
    if (!list) return
    setFiles(prev => [...prev, ...Array.from(list).map(f => ({ file: f, fileType: '기타' }))])
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    addFiles(e.dataTransfer.files)
  }

  function removeFile(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleConfirm() {
    if (!request) return
    setSaving(true)
    try {
      // 파일 업로드
      for (const af of files) {
        const fd = new FormData()
        fd.append('files', af.file)
        fd.append('fileType', af.fileType)
        await fetch(`/api/purchases/${request.id}/files`, { method: 'POST', body: fd }).catch(() => {})
      }

      // 상태 입고완료로 변경
      const res  = await fetch(`/api/purchases/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'RECEIVED' }),
      })
      const json = await res.json()
      if (!json.success) { toast.error(json.message ?? '처리 실패'); return }
      toast.success('입고 처리가 완료되었습니다.')
      setFiles([])
      onSaved(json.data)
    } catch { toast.error('서버 오류가 발생했습니다.') }
    finally { setSaving(false) }
  }

  if (!open || !request) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: 460, maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-6 py-4 border-b flex items-center justify-between shrink-0"
          style={{ background: 'linear-gradient(to right, #f0fdf4, #f8fafc)' }}>
          <div>
            <h2 className="text-sm font-bold text-gray-900">입고 처리</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">{request.documentNo} · {request.title}</p>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 text-lg font-light">
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* 파일 첨부 */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">파일 첨부</label>
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl px-4 py-6 text-center cursor-pointer transition-colors ${
                isDragging ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-gray-300 bg-gray-50/50'
              }`}
            >
              <p className="text-xs text-gray-400">파일을 드래그하거나 클릭하여 업로드</p>
              <p className="text-[10px] text-gray-300 mt-0.5">모든 파일 형식 지원</p>
              <input ref={fileRef} type="file" multiple className="hidden"
                onChange={e => addFiles(e.target.files)} />
            </div>

            {files.length > 0 && (
              <div className="space-y-1.5">
                {files.map((af, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
                    <span className="text-xs text-gray-700 flex-1 truncate">{af.file.name}</span>
                    <select
                      value={af.fileType}
                      onChange={e => setFiles(prev => prev.map((f, i) => i === idx ? { ...f, fileType: e.target.value } : f))}
                      className="h-6 text-[10px] rounded border border-gray-200 px-1 bg-white focus:outline-none"
                    >
                      {FILE_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <button type="button" onClick={() => removeFile(idx)}
                      className="text-gray-300 hover:text-red-400 text-sm leading-none">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-green-100 bg-green-50/60 px-3 py-2.5">
            <p className="text-xs text-green-700 font-medium">입고 처리 안내</p>
            <p className="text-[11px] text-green-600 mt-0.5">확인 버튼 클릭 시 상태가 <strong>입고완료</strong>로 변경됩니다.</p>
          </div>

        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 border-t bg-gray-50/70 flex justify-end gap-2 shrink-0">
          <Button variant="outline" size="sm" className="h-8 text-xs px-5"
            onClick={onClose} disabled={saving}>취소</Button>
          <Button size="sm" className="h-8 text-xs px-6 bg-green-600 hover:bg-green-700 text-white"
            onClick={handleConfirm} disabled={saving}>
            {saving ? '처리 중...' : '입고완료 확인'}
          </Button>
        </div>
      </div>
    </div>
  )
}
