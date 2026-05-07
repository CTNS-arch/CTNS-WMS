'use client'

import { useEffect, useState, useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const CAT_LABEL: Record<string, string> = {
  PRODUCT: '완제품', ASSEMBLY: '반제품', COMPONENT: '자재',
}
const CAT_COLOR: Record<string, string> = {
  PRODUCT:   'bg-blue-100 text-blue-700',
  ASSEMBLY:  'bg-purple-100 text-purple-700',
  COMPONENT: 'bg-emerald-100 text-emerald-700',
}
const SUB_LABEL: Record<string, string> = {
  BP: '배터리팩', BM: 'BMS', PC: 'PCM',
  CL: '셀', EL: '전장/전기부품', ME: '기구/외장부품',
  CD: '도전재', PK: '포장자재', FS: '체결부품',
  SM: '부자재/소모품', RM: '일반자재', OT: '생품/기타',
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

  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [dropOpen, setDropOpen] = useState(false)
  const [selectedChild, setSelectedChild] = useState<any>(null)
  const [addQty, setAddQty] = useState('')
  const [addUnit, setAddUnit] = useState('')
  const [addMemo, setAddMemo] = useState('')
  const [saving, setSaving] = useState(false)

  const [editId, setEditId] = useState<string | null>(null)
  const [editQty, setEditQty] = useState('')
  const [editUnit, setEditUnit] = useState('')
  const [editMemo, setEditMemo] = useState('')

  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const searchRef = useRef<HTMLDivElement>(null)

  const fetchBom = async () => {
    if (!item?.id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/items/${item.id}/bom`)
      const json = await res.json()
      if (json.success) setLines(json.data)
    } finally { setLoading(false) }
  }

  useEffect(() => {
    if (open) { fetchBom(); resetAdd(); setEditId(null) }
  }, [open, item?.id])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setDropOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const doSearch = (q: string) => {
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      try {
        const url = q.trim()
          ? `/api/items?search=${encodeURIComponent(q)}&limit=12`
          : `/api/items?limit=12&sortBy=createdAt&sortOrder=desc`
        const res = await fetch(url)
        const json = await res.json()
        if (json.success) {
          const already = new Set(lines.map(l => l.childId))
          setSearchResults(json.data.items.filter((i: any) => i.id !== item?.id && !already.has(i.id)))
          setDropOpen(true)
        }
      } catch {}
    }, q.trim() ? 250 : 0)
  }

  const resetAdd = () => {
    setSearch(''); setSearchResults([]); setDropOpen(false)
    setSelectedChild(null); setAddQty(''); setAddUnit(''); setAddMemo('')
  }

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

  const handleDelete = async (lineId: string, code: string) => {
    if (!confirm(`"${code}" 항목을 BOM에서 삭제하시겠습니까?`)) return
    const res = await fetch(`/api/items/${item.id}/bom/${lineId}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.success) { toast.success('삭제되었습니다.'); fetchBom() }
    else toast.error(json.message)
  }

  const catCounts = lines.reduce<Record<string, number>>((acc, l) => {
    acc[l.child.category] = (acc[l.child.category] ?? 0) + 1
    return acc
  }, {})

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: 1100, maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between px-6 py-4 border-b bg-gradient-to-r from-gray-50 to-white shrink-0">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-bold text-gray-900">BOM 구성 관리</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CAT_COLOR[item?.category] ?? 'bg-gray-100 text-gray-600'}`}>
                {CAT_LABEL[item?.category] ?? item?.category}
              </span>
              {lines.length > 0 && (
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {lines.length}개 구성 품목
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 font-mono">
              <span className="font-semibold text-gray-700">{item?.itemCode}</span>
              <span className="mx-1.5 text-gray-300">—</span>
              {item?.itemName}
            </p>
            {lines.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {Object.entries(catCounts).map(([cat, cnt]) => (
                  <span key={cat} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${CAT_COLOR[cat] ?? 'bg-gray-100 text-gray-600'}`}>
                    {CAT_LABEL[cat] ?? cat} {cnt}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-lg leading-none">
            ×
          </button>
        </div>

        {/* BOM 목록 */}
        <div className="flex-1 overflow-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-xs gap-2">
              <svg className="animate-spin w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              불러오는 중...
            </div>
          ) : lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-52 gap-3">
              <svg className="w-12 h-12 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-500">등록된 BOM 항목이 없습니다</p>
                <p className="text-xs text-gray-400 mt-1">아래에서 품목을 검색하여 구성 품목을 추가하세요</p>
              </div>
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="w-10 px-4 py-2.5 text-center text-gray-400 font-medium">#</th>
                  <th className="px-3 py-2.5 text-left text-gray-500 font-medium w-44">품번</th>
                  <th className="px-3 py-2.5 text-left text-gray-500 font-medium">품명</th>
                  <th className="w-24 px-3 py-2.5 text-left text-gray-500 font-medium">대분류</th>
                  <th className="w-36 px-3 py-2.5 text-left text-gray-500 font-medium">중분류</th>
                  <th className="w-20 px-3 py-2.5 text-right text-gray-500 font-medium">수량</th>
                  <th className="w-14 px-3 py-2.5 text-left text-gray-500 font-medium">단위</th>
                  <th className="px-3 py-2.5 text-left text-gray-500 font-medium">비고</th>
                  <th className="w-28 px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={line.id}
                    className={`border-b border-gray-100 group transition-colors ${
                      editId === line.id ? 'bg-blue-50/60' : 'hover:bg-gray-50/80'
                    }`}
                  >
                    <td className="px-4 py-2.5 text-center text-gray-400 tabular-nums">{idx + 1}</td>

                    {editId === line.id ? (
                      <>
                        <td className="px-3 py-1.5 font-mono text-blue-700 font-medium whitespace-nowrap">
                          {line.child.itemCode}
                        </td>
                        <td className="px-3 py-1.5 text-gray-700">{line.child.itemName}</td>
                        <td className="px-3 py-1.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${CAT_COLOR[line.child.category] ?? 'bg-gray-100 text-gray-600'}`}>
                            {CAT_LABEL[line.child.category] ?? line.child.category}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-gray-500">
                          {line.child.subCategory
                            ? <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                                {SUB_LABEL[line.child.subCategory] ?? line.child.subCategory}
                              </span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-1.5">
                          <Input type="number" min="0" step="any" autoFocus
                            value={editQty} onChange={e => setEditQty(e.target.value)}
                            className="h-7 text-xs text-right w-full" />
                        </td>
                        <td className="px-3 py-1.5">
                          <Input value={editUnit} onChange={e => setEditUnit(e.target.value)}
                            className="h-7 text-xs w-full" />
                        </td>
                        <td className="px-3 py-1.5">
                          <Input value={editMemo} onChange={e => setEditMemo(e.target.value)}
                            placeholder="비고" className="h-7 text-xs" />
                        </td>
                        <td className="px-4 py-1.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" className="h-6 text-xs px-2.5" onClick={handleEdit} disabled={saving}>저장</Button>
                            <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => setEditId(null)}>취소</Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2.5 font-mono text-gray-700 font-medium whitespace-nowrap">
                          {line.child.itemCode}
                        </td>
                        <td className="px-3 py-2.5 text-gray-800">{line.child.itemName}</td>
                        <td className="px-3 py-2.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${CAT_COLOR[line.child.category] ?? 'bg-gray-100 text-gray-600'}`}>
                            {CAT_LABEL[line.child.category] ?? line.child.category}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          {line.child.subCategory
                            ? <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                {SUB_LABEL[line.child.subCategory] ?? line.child.subCategory}
                              </span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-gray-900 tabular-nums">
                          {line.quantity.toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-gray-500">{line.unit}</td>
                        <td className="px-3 py-2.5 text-gray-400 max-w-[150px] truncate" title={line.memo ?? ''}>
                          {line.memo || <span className="text-gray-200">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => startEdit(line)}>수정</Button>
                            <Button size="sm" variant="destructive" className="h-6 text-xs px-2"
                              onClick={() => handleDelete(line.id, line.child.itemCode)}>삭제</Button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 품목 추가 폼 */}
        <div className="border-t bg-gray-50/80 px-6 py-4 shrink-0">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">구성 품목 추가</p>
          <div className="flex items-center gap-2">
            <div ref={searchRef} className="relative flex-[2] min-w-0">
              {selectedChild ? (
                <div className="flex items-center gap-2 h-8 px-3 border border-blue-300 rounded-lg bg-white text-xs shadow-sm ring-1 ring-blue-200">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${CAT_COLOR[selectedChild.category] ?? 'bg-gray-100 text-gray-600'}`}>
                    {CAT_LABEL[selectedChild.category]?.[0]}
                  </span>
                  <span className="font-mono text-gray-700 shrink-0 max-w-[160px] truncate font-medium">{selectedChild.itemCode}</span>
                  <span className="text-gray-500 truncate flex-1">{selectedChild.itemName}</span>
                  <button onClick={resetAdd}
                    className="text-gray-300 hover:text-red-500 shrink-0 ml-1 text-sm transition-colors leading-none">×</button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <Input value={search}
                      onChange={e => setSearch(e.target.value)}
                      onFocus={() => doSearch(search)}
                      placeholder="품번·품명 검색 또는 클릭하여 전체 목록 보기"
                      className="h-8 text-xs pl-8 rounded-lg" />
                  </div>
                  {dropOpen && (
                    <div className="absolute bottom-full left-0 right-0 z-50 mb-1.5 border border-gray-200 rounded-xl bg-white shadow-xl overflow-hidden">
                      {searchResults.length === 0 ? (
                        <div className="px-4 py-4 text-xs text-gray-400 text-center">
                          {search.trim() ? '검색 결과가 없습니다.' : '불러오는 중...'}
                        </div>
                      ) : (
                        <>
                          <div className="px-3 py-1.5 bg-gray-50 border-b flex items-center justify-between">
                            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">검색 결과</span>
                            <span className="text-[10px] text-gray-400">{searchResults.length}건</span>
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {searchResults.map(r => (
                              <div key={r.id}
                                onMouseDown={() => {
                                  setSelectedChild(r); setAddUnit(r.unit || '')
                                  setSearch(''); setSearchResults([]); setDropOpen(false)
                                }}
                                className="flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0 transition-colors group"
                              >
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${CAT_COLOR[r.category] ?? 'bg-gray-100 text-gray-600'}`}>
                                  {CAT_LABEL[r.category]?.[0]}
                                </span>
                                <span className="font-mono text-gray-700 text-xs shrink-0 w-44 truncate font-medium group-hover:text-blue-700">
                                  {r.itemCode}
                                </span>
                                <span className="text-xs text-gray-600 flex-1 truncate">{r.itemName}</span>
                                {r.subCategory && (
                                  <span className="text-[10px] text-gray-400 shrink-0 bg-gray-100 px-1.5 py-0.5 rounded">
                                    {SUB_LABEL[r.subCategory] ?? r.subCategory}
                                  </span>
                                )}
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
            <Input type="number" min="0" step="any" value={addQty} onChange={e => setAddQty(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
              placeholder="수량" className="h-8 text-xs w-20 text-right shrink-0 rounded-lg" />
            <Input value={addUnit} onChange={e => setAddUnit(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
              placeholder="단위" className="h-8 text-xs w-20 shrink-0 rounded-lg" />
            <Input value={addMemo} onChange={e => setAddMemo(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
              placeholder="비고 (선택)" className="h-8 text-xs flex-1 min-w-0 rounded-lg" />
            <Button size="sm" className="h-8 text-xs px-5 shrink-0 rounded-lg"
              onClick={handleAdd} disabled={saving || !selectedChild}>
              {saving ? '추가 중…' : '추가'}
            </Button>
          </div>
          <p className="mt-2 text-[10px] text-gray-400">Enter 키로 빠르게 추가 가능합니다</p>
        </div>

        {/* 푸터 */}
        <div className="px-6 py-3 border-t bg-white shrink-0 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {lines.length === 0 ? '구성 품목 없음' : `총 ${lines.length}개 구성 품목`}
          </span>
          <Button size="sm" variant="outline" className="text-xs h-8 rounded-lg px-5" onClick={onClose}>닫기</Button>
        </div>
      </div>
    </div>
  )
}
