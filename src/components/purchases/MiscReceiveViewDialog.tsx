'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

const STATUS_LABEL: Record<string, string> = {
  PENDING:  '요청',
  ORDERED:  '발주완료',
  RECEIVED: '입고완료',
  REJECTED: '반려',
}
const STATUS_COLOR: Record<string, string> = {
  PENDING:  'bg-amber-100 text-amber-700',
  ORDERED:  'bg-blue-100 text-blue-700',
  RECEIVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-500',
}

interface Props {
  open: boolean
  request: any | null
  onClose: () => void
}

export default function MiscReceiveViewDialog({ open, request, onClose }: Props) {
  const [files,   setFiles]   = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !request?.id) { setFiles([]); return }
    setLoading(true)
    fetch(`/api/purchases/${request.id}/files`)
      .then(r => r.json())
      .then(json => { if (json.success) setFiles(json.data ?? []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, request?.id])

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
            <h2 className="text-sm font-bold text-gray-900">입고 확인</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">{request.documentNo} · {request.title}</p>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 text-lg font-light">
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* 현재 상태 */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-gray-500">현재 상태</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_COLOR[request.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {STATUS_LABEL[request.status] ?? request.status}
            </span>
          </div>

          {/* 첨부 파일 */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">첨부 파일</label>
            {loading ? (
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-4 text-xs text-gray-400 text-center">
                불러오는 중...
              </div>
            ) : files.length === 0 ? (
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-4 text-xs text-gray-400 text-center">
                첨부된 파일이 없습니다.
              </div>
            ) : (
              <div className="space-y-1.5">
                {files.map(f => (
                  <div key={f.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white border border-gray-200 text-gray-500 shrink-0">
                      {f.fileType ?? '기타'}
                    </span>
                    <a
                      href={f.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-xs text-blue-600 hover:underline truncate"
                    >
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
            )}
          </div>

        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 border-t bg-gray-50/70 flex justify-end shrink-0">
          <Button variant="outline" size="sm" className="h-8 text-xs px-5" onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </div>
  )
}
