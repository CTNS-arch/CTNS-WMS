'use client'

import { useEffect, useState, useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const CATEGORY_LABEL: Record<string, string> = {
  PRODUCT: '제품', ASSEMBLY: '어셈블리', COMPONENT: '부자재',
}

interface BomLine {
  id: string
  childId: string
  quantity: number
  unit: string
  memo?: string | null
  child: {
    id: string
    itemCode: string
    itemName: string
    unit: string
    category: string
    subCategory?: string | null
  }
}

interface Props {
  open: boolean
  item: any
  onClose: () => void
}

export default function BomDialog({ open, item, onClose }: Props) {
  const [lines, setLines] = useState<BomLine[]>([])
  const [loading, setLoading] = useState(false)

  // 추가 폼
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [dropOpen, setDropOpen] = useState(false)
  const [selectedChild, setSelectedChild] = useState<any>(null)
  const [addQty, setAddQty] = useState('')
  const [addUnit, setAddUnit] = useState('')
  const [addMemo, setAddMemo] = useState('')
  const [saving, setSaving] = useState(false)

  // 인라인 수정
  const [editId, setEditId] = useState<string | null>(null)
  const [editQty, setEditQty] = useState('')
  const [editUnit, setEditUnit] = useState('')
  const [editMemo, setEditMemo] = useState('')

  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const searchRef = useRef<HTMLDivElement>(null)

  /* ── 데이터 로드 ── */
  const fetchBom = async () => {
    if (!item?.id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/items/${item.id}/bom`)
      const json = await res.json()
      if (json.success) setLines(json.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) { fetchBom(); resetAdd(); setEditId(null) }
  }, [open, item?.id])

  /* ── 검색 드롭다운 외부 클릭 닫기 ── */
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setDropOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  /* ── 품목 검색 ── */
  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); setDropOpen(false); return }
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/items?search=${encodeURIComponent(search)}&limit=30`)
        const json = await res.json()
        if (json.success) {
          const already = new Set(lines.map(l => l.childId))
          setSearchResults(
            json.data.items.filter((i: any) => i.id !== item?.id && !already.has(i.id))
          )
          setDropOpen(true)
        }
      } catch {}
    }, 250)
  }, [search, item?.id, lines])

  /* ── 리셋 ── */
  const resetAdd = () => {
    setSearch(''); setSearchResults([]); setDropOpen(false)
    setSelectedChild(null); setAddQty(''); setAddUnit(''); setAddMemo('')
  }

  /* ── 추가 ── */
  const handleAdd = async () => {
    if (!selectedChild) { toast.error('품목을 선택하세요.'); return }
    if (!addQty || parseFloat(addQty) <= 0) { toast.error('수량을 입력하세요.'); return }
    if (!addUnit.trim()) { toast.error('단위를 입력하세요.'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/items/${item.id}/bom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId: selectedChild.id, quantity: addQty, unit: addUnit, memo: addMemo }),
      })
      const json = await res.json()
      if (json.success) { toast.success('추가되었습니다.'); resetAdd(); fetchBom() }
      else toast.error(json.message)
    } finally { setSaving(false) }
  }

  /* ── 수정 ── */
  const startEdit = (l: BomLine) => {
    setEditId(l.id); setEditQty(String(l.quantity)); setEditUnit(l.unit); setEditMemo(l.memo ?? '')
  }
  const handleEdit = async () => {
    if (!editQty || parseFloat(editQty) <= 0) { toast.error('수량을 입력하세요.'); return }
    if (!editUnit.trim()) { toast.error('단위를 입력하세요.'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/items/${item.id}/bom/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: editQty, unit: editUnit, memo: editMemo }),
      })
      const json = await res.json()
      if (json.success) { toast.success('수정되었습니다.'); setEditId(null); fetchBom() }
      else toast.error(json.message)
    } finally { setSaving(false) }
  }

  /* ── 삭제 ── */
  const handleDelete = async (lineId: string, code: string) => {
    if (!confirm(`"${code}" 항목을 BOM에서 삭제하시겠습니까?`)) return
    const res = await fetch(`/api/items/${item.id}/bom/${lineId}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.success) { toast.success('삭제되었습니다.'); fetchBom() }
    else toast.error(json.message)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl flex flex-col"
        style={{ width: 900, maxHeight: '88vh' }}
        onClick={e => e.stopPropagation()}
      >

        {/* ── 헤더 ── */}
        <div className="flex items-start justify-between px-6 py-4 border-b shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-800">BOM 관리</h2>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded font-mono">
                {lines.length}개 구성 품목
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 font-mono">
              {item?.itemCode} — <span className="text-gray-700">{item?.itemName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-gray-600 text-xl leading-none transition-colors"
          >
            ×
          </button>
        </div>

        {/* ── BOM 목록 (항상 표시) ── */}
        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-center px-4 py-2.5 text-gray-400 font-medium w-10">#</th>
                <th className="text-left px-3 py-2.5 text-gray-500 font-medium">품번</th>
                <th className="text-left px-3 py-2.5 text-gray-500 font-medium">품명</th>
                <th className="text-center px-3 py-2.5 text-gray-500 font-medium w-20">분류</th>
                <th className="text-right px-3 py-2.5 text-gray-500 font-medium w-20">수량</th>
                <th className="text-left px-3 py-2.5 text-gray-500 font-medium w-16">단위</th>
                <th className="text-left px-3 py-2.5 text-gray-500 font-medium">비고</th>
                <th className="w-28 px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">불러오는 중...</td>
                </tr>
              ) : lines.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">
                    <p className="mb-1">등록된 BOM 항목이 없습니다.</p>
                    <p className="text-gray-300">아래 입력창에서 품목을 검색하여 추가하세요.</p>
                  </td>
                </tr>
              ) : (
                lines.map((line, idx) => (
                  <tr
                    key={line.id}
                    className={`border-b border-gray-100 transition-colors ${
                      editId === line.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="text-center px-4 py-2.5 text-gray-400">{idx + 1}</td>

                    {editId === line.id ? (
                      <>
                        <td className="px-3 py-1.5 font-mono text-gray-700 whitespace-nowrap">
                          {line.child.itemCode}
                        </td>
                        <td className="px-3 py-1.5 text-gray-600">{line.child.itemName}</td>
                        <td className="px-3 py-1.5 text-center text-gray-500">
                          {CATEGORY_LABEL[line.child.category] ?? line.child.category}
                        </td>
                        <td className="px-3 py-1.5">
                          <Input
                            type="number" min="0" step="any" autoFocus
                            value={editQty} onChange={e => setEditQty(e.target.value)}
                            className="h-7 text-xs text-right w-full"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <Input
                            value={editUnit} onChange={e => setEditUnit(e.target.value)}
                            className="h-7 text-xs w-full"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <Input
                            value={editMemo} onChange={e => setEditMemo(e.target.value)}
                            placeholder="비고" className="h-7 text-xs"
                          />
                        </td>
                        <td className="px-4 py-1.5 text-right whitespace-nowrap space-x-1">
                          <Button size="sm" className="h-6 text-xs px-2.5" onClick={handleEdit} disabled={saving}>
                            저장
                          </Button>
                          <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => setEditId(null)}>
                            취소
                          </Button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2.5 font-mono text-gray-700 whitespace-nowrap">
                          {line.child.itemCode}
                        </td>
                        <td className="px-3 py-2.5 text-gray-700">{line.child.itemName}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">
                            {CATEGORY_LABEL[line.child.category] ?? line.child.category}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-800 font-medium">
                          {line.quantity}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600">{line.unit}</td>
                        <td className="px-3 py-2.5 text-gray-400 max-w-[120px] truncate" title={line.memo ?? ''}>
                          {line.memo || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap space-x-1">
                          <Button
                            size="sm" variant="outline"
                            className="h-6 text-xs px-2"
                            onClick={() => startEdit(line)}
                          >
                            수정
                          </Button>
                          <Button
                            size="sm" variant="destructive"
                            className="h-6 text-xs px-2"
                            onClick={() => handleDelete(line.id, line.child.itemCode)}
                          >
                            삭제
                          </Button>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── 품목 추가 폼 (항상 표시) ── */}
        <div className="border-t bg-gray-50 px-6 py-4 shrink-0">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">품목 추가</p>

          <div className="flex items-center gap-2">

            {/* 품목 검색/선택 */}
            <div ref={searchRef} className="relative flex-[2]">
              {selectedChild ? (
                <div className="flex items-center gap-2 h-8 px-3 border border-gray-300 rounded-md bg-white text-xs shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                  <span className="font-mono text-gray-700 shrink-0 max-w-[140px] truncate">
                    {selectedChild.itemCode}
                  </span>
                  <span className="text-gray-500 truncate flex-1">{selectedChild.itemName}</span>
                  <button
                    onClick={resetAdd}
                    className="text-gray-300 hover:text-red-500 shrink-0 ml-1 text-sm transition-colors"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <svg
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <Input
                      value={search}
                      onChange={e => { setSearch(e.target.value); if (e.target.value.trim()) setDropOpen(true) }}
                      onFocus={() => { if (search.trim() && searchResults.length > 0) setDropOpen(true) }}
                      placeholder="품번 또는 품명으로 검색 후 선택…"
                      className="h-8 text-xs pl-8"
                    />
                  </div>
                  {dropOpen && (
                    <div className="absolute bottom-full left-0 right-0 z-50 mb-1 border border-gray-200 rounded-md bg-white shadow-lg overflow-hidden">
                      {searchResults.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-gray-400 text-center">
                          {search.trim() ? '검색 결과가 없습니다.' : '검색어를 입력하세요.'}
                        </div>
                      ) : (
                        <>
                          <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 text-[10px] text-gray-400 font-medium uppercase tracking-wide">
                            {searchResults.length}개 결과
                          </div>
                          <div className="max-h-44 overflow-y-auto">
                            {searchResults.map(r => (
                              <div
                                key={r.id}
                                onMouseDown={() => {
                                  setSelectedChild(r)
                                  setAddUnit(r.unit || '')
                                  setSearch(''); setSearchResults([]); setDropOpen(false)
                                }}
                                className="flex items-center gap-3 px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0 transition-colors"
                              >
                                <span className="font-mono text-gray-700 text-xs shrink-0 w-40 truncate">
                                  {r.itemCode}
                                </span>
                                <span className="text-xs text-gray-600 flex-1 truncate">{r.itemName}</span>
                                <span className="text-[10px] text-gray-400 shrink-0 bg-gray-100 px-1.5 py-0.5 rounded">
                                  {CATEGORY_LABEL[r.category] ?? r.category}
                                </span>
                                <span className="text-xs text-gray-400 shrink-0 w-8 text-right">{r.unit}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 수량 */}
            <Input
              type="number" min="0" step="any"
              value={addQty} onChange={e => setAddQty(e.target.value)}
              placeholder="수량"
              className="h-8 text-xs w-20 text-right shrink-0"
            />

            {/* 단위 */}
            <Input
              value={addUnit} onChange={e => setAddUnit(e.target.value)}
              placeholder="단위"
              className="h-8 text-xs w-20 shrink-0"
            />

            {/* 비고 */}
            <Input
              value={addMemo} onChange={e => setAddMemo(e.target.value)}
              placeholder="비고 (선택)"
              className="h-8 text-xs flex-1 min-w-0"
            />

            {/* 추가 버튼 */}
            <Button
              size="sm"
              className="h-8 text-xs px-5 shrink-0"
              onClick={handleAdd}
              disabled={saving || !selectedChild}
            >
              {saving ? '추가 중…' : '추가'}
            </Button>
          </div>
        </div>

        {/* ── 푸터 ── */}
        <div className="px-6 py-3 border-t bg-white shrink-0 flex items-center justify-between">
          <span className="text-xs text-gray-400">총 {lines.length}개 구성 품목</span>
          <Button size="sm" variant="outline" className="text-xs h-8" onClick={onClose}>닫기</Button>
        </div>
      </div>
    </div>
  )
}
