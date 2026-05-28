'use client'

import React, { useRef, useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

const FILE_TYPE_OPTIONS = ['견적서', '발주서', '주문내역', '기타']

type AttachedFile = { file: File; fileType: string }
type ServerFile  = { id: string; fileName: string; fileType: string; fileSize: number | null; fileUrl: string }

interface Props {
  open: boolean
  request: any | null
  onClose: () => void
  onSaved: (req: any) => void
}

export default function MiscReceiveDialog({ open, request, onClose, onSaved }: Props) {
  const [files,        setFiles]        = useState<AttachedFile[]>([])
  const [serverFiles,  setServerFiles]  = useState<ServerFile[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [isDragging,   setIsDragging]   = useState(false)
  const [saving,       setSaving]       = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // 팝업 열릴 때 서버에 이미 업로드된 파일 로드
  useEffect(() => {
    if (!open || !request?.id) { setServerFiles([]); setFiles([]); return }
    setLoadingFiles(true)
    fetch(`/api/purchases/${request.id}/files`)
      .then(r => r.json())
      .then(json => { if (json.success) setServerFiles(json.data ?? []) })
      .catch(() => {})
      .finally(() => setLoadingFiles(false))
  }, [open, request?.id])

  function addFiles(list: FileList | null) {
    if (!list) return
    setFiles(prev => [...prev, ...Array.from(list).map(f => ({ file: f, fileType: '기타' }))])
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files)
  }

  function removeFile(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleConfirm() {
    if (!request) return
    if (files.length === 0 && serverFiles.length === 0) {
      toast.error('첨부파일을 1개 이상 업로드해주세요.'); return
    }
    setSaving(true)
    try {
      for (const af of files) {
        const fd = new FormData()
        fd.append('files', af.file)
        fd.append('fileType', af.fileType)
        await fetch(`/api/purchases/${request.id}/files`, { method: 'POST', body: fd }).catch(() => {})
      }
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

          {/* 기존 업로드된 파일 */}
          {loadingFiles && (
            <p className="text-xs text-gray-400 text-center py-1">파일 목록 불러오는 중...</p>
          )}
          {!loadingFiles && serverFiles.length > 0 && (
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">업로드된 파일</label>
              <div className="space-y-1.5">
                {serverFiles.map(f => (
                  <div key={f.id} className="flex items-center gap-2 bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-100">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white border border-gray-200 text-gray-500 shrink-0">
                      {f.fileType ?? '기타'}
                    </span>
                    <a href={f.fileUrl} target="_blank" rel="noopener noreferrer"
                      className="flex-1 text-xs text-blue-600 hover:underline truncate">
                      {f.fileName}
                    </a>
                    {f.fileSize != null && (
                      <span className="text-[11px] text-gray-400 shrink-0">
                        {f.fileSize < 1024 * 1024
                          ? `${Math.round(f.fileSize / 1024)} KB`
                          : `${(f.fileSize / 1024 / 1024).toFixed(1)} MB`}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 새 파일 첨부 */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
              파일 첨부
              {serverFiles.length === 0 && <span className="text-red-400 normal-case font-normal ml-1">*필수</span>}
            </label>
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
