'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import SupplierDialog from '@/components/suppliers/SupplierDialog'
import { SUB_OPTIONS, THIRD_OPTIONS } from '@/lib/classification'

const ALL_SUB_OPTIONS = [
  ...Object.values(SUB_OPTIONS).flat(),
  ...Object.values(THIRD_OPTIONS).flat(),
]

const LIMIT = 20

interface SupplierRow {
  id: string
  supplierCode: string
  companyName: string
  status: 'ACTIVE' | 'INACTIVE'
  region: 'DOMESTIC' | 'OVERSEAS'
  businessRegNo: string | null
  url: string | null
  bankName: string | null
  accountNumber: string | null
  accountHolder: string | null
  subCategory: string | null
  note: string | null
  contacts: { id: string; name: string; title?: string | null; phone?: string | null; email?: string | null }[]
  items: { item: { id: string; itemCode: string; itemName: string; category: string; subCategory: string | null; status: string } }[]
  files: { id: string; fileName: string; fileUrl: string; fileSize?: number; mimeType?: string }[]
}

export default function SuppliersPage() {
  const [rows, setRows] = useState<SupplierRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const [filterStatus, setFilterStatus] = useState('')
  const [filterRegion, setFilterRegion] = useState('')
  const [filterSubCat, setFilterSubCat] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editSupplier, setEditSupplier] = useState<SupplierRow | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; ids: string[] }>({ open: false, ids: [] })

  const [itemsPopup, setItemsPopup] = useState<{ open: boolean; supplier: SupplierRow | null }>({ open: false, supplier: null })
  const [filesPopup, setFilesPopup] = useState<{ open: boolean; supplier: SupplierRow | null }>({ open: false, supplier: null })
  const [contactsPopup, setContactsPopup] = useState<{ open: boolean; supplier: SupplierRow | null }>({ open: false, supplier: null })

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  const fetchRows = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) })
      if (filterStatus) params.set('status', filterStatus)
      if (filterRegion) params.set('region', filterRegion)
      if (filterSubCat) params.set('subCategory', filterSubCat)
      if (search) params.set('search', search)
      const res = await fetch(`/api/suppliers?${params}`)
      const json = await res.json()
      if (json.success) {
        setRows(json.data.suppliers)
        setTotal(json.data.total)
        setPage(json.data.page)
      } else {
        toast.error(json.message ?? '조회 실패')
      }
    } catch {
      toast.error('서버 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterRegion, filterSubCat, search])

  useEffect(() => { fetchRows(page) }, [fetchRows, page])

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault(); setSearch(searchInput); setPage(1); setSelected(new Set())
  }
  const handleFilterChange = () => { setPage(1); setSelected(new Set()) }

  const openCreate = () => { setEditSupplier(null); setDialogOpen(true) }
  const openEdit = (row: SupplierRow) => { setEditSupplier(row); setDialogOpen(true) }
  const confirmDelete = (ids: string[]) => setDeleteConfirm({ open: true, ids })

  const handleDelete = async () => {
    const { ids } = deleteConfirm
    setDeleteConfirm({ open: false, ids: [] })
    let failed = 0
    for (const id of ids) {
      try {
        const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' })
        const json = await res.json()
        if (!json.success) failed++
      } catch { failed++ }
    }
    if (failed > 0) toast.error(`${failed}개 삭제 실패`)
    else toast.success(`${ids.length}개 삭제되었습니다.`)
    setSelected(new Set()); fetchRows(1)
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }
  const toggleAll = () => {
    if (selected.size === rows.length) setSelected(new Set())
    else setSelected(new Set(rows.map(r => r.id)))
  }

  const subLabel = (val: string | null) => {
    if (!val) return '-'
    return ALL_SUB_OPTIONS.find(o => o.value === val)?.label ?? val
  }

  // 소분류 필터 옵션 (SUB_CATEGORY_GROUPS와 동일 구조)
  const filterSubGroups = [
    { label: '반제품', options: SUB_OPTIONS.ASSEMBLY?.filter(o => ['BM', 'PC'].includes(o.value)) ?? [] },
    { label: '자재 (중분류)', options: SUB_OPTIONS.COMPONENT?.filter(o => ['CL', 'EL', 'ME'].includes(o.value)) ?? [] },
    { label: '도전재 (CD)', options: THIRD_OPTIONS.CD ?? [] },
    { label: '포장자재 (PK)', options: THIRD_OPTIONS.PK ?? [] },
    { label: '체결부품 (FS)', options: THIRD_OPTIONS.FS ?? [] },
    { label: '부자재/소모품 (SM)', options: THIRD_OPTIONS.SM ?? [] },
    { label: '기타 (OT)', options: THIRD_OPTIONS.OT ?? [] },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-3 border-b bg-white shrink-0">
        <h1 className="text-sm font-semibold text-gray-800">공급처 관리</h1>
      </div>

      <div className="px-4 py-2.5 border-b bg-white flex items-center gap-2 flex-wrap min-h-[52px] shrink-0">
        <form onSubmit={handleFilter} className="flex items-center gap-1">
          <Input value={searchInput} onChange={e => setSearchInput(e.target.value)}
            placeholder="코드 또는 회사명 검색" className="h-8 text-xs w-44" />
          <Button type="submit" variant="outline" size="sm" className="h-8 text-xs px-3">검색</Button>
        </form>

        <select value={filterRegion} className="h-8 text-xs border border-gray-200 rounded-md px-2 bg-white"
          onChange={e => { setFilterRegion(e.target.value); handleFilterChange() }}>
          <option value="">구분 전체</option>
          <option value="DOMESTIC">국내</option>
          <option value="OVERSEAS">해외</option>
        </select>

        <select value={filterStatus} className="h-8 text-xs border border-gray-200 rounded-md px-2 bg-white"
          onChange={e => { setFilterStatus(e.target.value); handleFilterChange() }}>
          <option value="">상태 전체</option>
          <option value="ACTIVE">사용</option>
          <option value="INACTIVE">미사용</option>
        </select>

        <select value={filterSubCat} className="h-8 text-xs border border-gray-200 rounded-md px-2 bg-white"
          onChange={e => { setFilterSubCat(e.target.value); handleFilterChange() }}>
          <option value="">소분류 전체</option>
          {filterSubGroups.map(g => (
            <optgroup key={g.label} label={g.label}>
              {g.options.map(o => (
                <option key={o.value} value={o.value}>{o.label} ({o.value})</option>
              ))}
            </optgroup>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-400">총 {total.toLocaleString()}개</span>
          {selected.size > 0 && (
            <Button variant="outline" size="sm" className="h-8 text-xs border-red-300 text-red-500 hover:bg-red-50"
              onClick={() => confirmDelete([...selected])}>
              삭제 ({selected.size})
            </Button>
          )}
          <Button size="sm" className="h-8 text-xs" onClick={openCreate}>+ 공급처 등록</Button>
        </div>
      </div>

      {/* 테이블 */}
      <div className="flex-1 overflow-auto min-h-0">
        <table className="text-xs" style={{ tableLayout: 'fixed', width: '1600px', minWidth: '1600px' }}>
          <colgroup>
            <col style={{ width: 36 }} />
            <col style={{ width: 100 }} />  {/* 회사코드 */}
            <col style={{ width: 180 }} />  {/* 회사명 */}
            <col style={{ width: 60 }} />   {/* 상태 */}
            <col style={{ width: 60 }} />   {/* 구분 */}
            <col style={{ width: 120 }} />  {/* 소분류 */}
            <col style={{ width: 130 }} />  {/* 사업자등록번호 */}
            <col style={{ width: 90 }} />   {/* 구매품목 */}
            <col style={{ width: 90 }} />   {/* 담당자 */}
            <col style={{ width: 70 }} />   {/* 파일 */}
            <col style={{ width: 160 }} />  {/* 은행/계좌 */}
            <col style={{ width: 170 }} />  {/* URL */}
            <col style={{ width: 100 }} />  {/* 비고 */}
            <col style={{ width: 110 }} />  {/* 관리 */}
          </colgroup>
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-2 py-2 border-b">
                <input type="checkbox" className="w-3 h-3"
                  checked={rows.length > 0 && selected.size === rows.length} onChange={toggleAll} />
              </th>
              {['회사코드', '회사명', '상태', '구분', '소분류', '사업자등록번호', '구매품목', '담당자', '파일', '은행/계좌', 'URL', '비고', '관리'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 border-b whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={14} className="px-3 py-10 text-center text-gray-400">불러오는 중...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={14} className="px-3 py-10 text-center text-gray-400">공급처가 없습니다.</td></tr>
            ) : rows.map(row => (
              <tr key={row.id} className={`border-b hover:bg-gray-50 ${selected.has(row.id) ? 'bg-blue-50' : ''}`}>
                <td className="px-2 py-2">
                  <input type="checkbox" className="w-3 h-3"
                    checked={selected.has(row.id)} onChange={() => toggleSelect(row.id)} />
                </td>
                <td className="px-3 py-2 font-mono text-gray-700 truncate">{row.supplierCode}</td>
                <td className="px-3 py-2 font-medium text-gray-800 truncate">{row.companyName}</td>
                <td className="px-3 py-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${
                    row.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                  }`}>{row.status === 'ACTIVE' ? '사용' : '미사용'}</span>
                </td>
                <td className="px-3 py-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${
                    row.region === 'DOMESTIC' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                  }`}>{row.region === 'DOMESTIC' ? '국내' : '해외'}</span>
                </td>
                <td className="px-3 py-2">
                  {row.subCategory ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 whitespace-nowrap">
                      {subLabel(row.subCategory)}
                    </span>
                  ) : <span className="text-gray-300">-</span>}
                </td>
                <td className="px-3 py-2 text-gray-600 font-mono text-xs truncate">
                  {row.businessRegNo ?? <span className="text-gray-300">-</span>}
                </td>
                <td className="px-3 py-2">
                  {row.items.length > 0 ? (
                    <button onClick={() => setItemsPopup({ open: true, supplier: row })}
                      className="text-blue-600 hover:underline text-xs font-medium">
                      {row.items.length}개
                    </button>
                  ) : <span className="text-gray-300">-</span>}
                </td>
                <td className="px-3 py-2">
                  {row.contacts.length > 0 ? (
                    <button onClick={() => setContactsPopup({ open: true, supplier: row })}
                      className="text-blue-600 hover:underline text-xs font-medium">
                      {row.contacts.length}명
                    </button>
                  ) : <span className="text-gray-300">-</span>}
                </td>
                <td className="px-3 py-2">
                  {row.files.length > 0 ? (
                    <button onClick={() => setFilesPopup({ open: true, supplier: row })}
                      className="text-blue-600 hover:underline text-xs font-medium">
                      {row.files.length}개
                    </button>
                  ) : <span className="text-gray-300">-</span>}
                </td>
                <td className="px-3 py-2 text-gray-500 text-xs truncate">
                  {row.bankName ? `${row.bankName} ${row.accountNumber ?? ''}` : <span className="text-gray-300">-</span>}
                </td>
                <td className="px-3 py-2 truncate">
                  {row.url ? (
                    <a href={row.url} target="_blank" rel="noopener noreferrer"
                      className="text-blue-500 hover:underline text-xs truncate">{row.url}</a>
                  ) : <span className="text-gray-300">-</span>}
                </td>
                <td className="px-3 py-2 text-gray-500 truncate">{row.note ?? <span className="text-gray-300">-</span>}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" className="h-6 text-xs px-2" onClick={() => openEdit(row)}>수정</Button>
                    <Button variant="outline" size="sm" className="h-6 text-xs px-2 border-red-300 text-red-500 hover:bg-red-50"
                      onClick={() => confirmDelete([row.id])}>삭제</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      <div className="px-4 py-2.5 border-t bg-white shrink-0 flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {total.toLocaleString()}개 중 {Math.min((page - 1) * LIMIT + 1, total)}–{Math.min(page * LIMIT, total)}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>이전</Button>
          <span className="text-xs text-gray-600 px-2">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>다음</Button>
        </div>
      </div>

      <SupplierDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        supplier={editSupplier}
        onSaved={() => { setPage(1); fetchRows(1) }}
      />

      {/* 삭제 확인 */}
      <Dialog open={deleteConfirm.open} onOpenChange={v => setDeleteConfirm(prev => ({ ...prev, open: v }))}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader><DialogTitle className="text-sm">삭제 확인</DialogTitle></DialogHeader>
          <p className="text-xs text-gray-600">
            선택한 {deleteConfirm.ids.length}개 공급처를 삭제하시겠습니까?<br />이 작업은 되돌릴 수 없습니다.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" className="text-xs"
              onClick={() => setDeleteConfirm({ open: false, ids: [] })}>취소</Button>
            <Button size="sm" className="text-xs bg-red-500 hover:bg-red-600 text-white" onClick={handleDelete}>삭제</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 담당자 팝업 */}
      <Dialog open={contactsPopup.open} onOpenChange={v => setContactsPopup(prev => ({ ...prev, open: v }))}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">
              담당자 — {contactsPopup.supplier?.companyName} ({contactsPopup.supplier?.contacts.length}명)
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto">
            <table className="text-xs w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">이름</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">직책</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">연락처</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">이메일</th>
                </tr>
              </thead>
              <tbody>
                {contactsPopup.supplier?.contacts.map(c => (
                  <tr key={c.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-800">{c.name}</td>
                    <td className="px-3 py-2 text-gray-600">{c.title ?? '-'}</td>
                    <td className="px-3 py-2 text-gray-600">{c.phone ?? '-'}</td>
                    <td className="px-3 py-2 text-gray-600">{c.email ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="text-xs"
              onClick={() => setContactsPopup({ open: false, supplier: null })}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 구매품목 팝업 */}
      <Dialog open={itemsPopup.open} onOpenChange={v => setItemsPopup(prev => ({ ...prev, open: v }))}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">
              구매품목 — {itemsPopup.supplier?.companyName} ({itemsPopup.supplier?.items.length}개)
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto">
            <table className="text-xs w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">품번</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">품명</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">소분류</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">상태</th>
                </tr>
              </thead>
              <tbody>
                {itemsPopup.supplier?.items.map(si => (
                  <tr key={si.item.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-gray-600">{si.item.itemCode}</td>
                    <td className="px-3 py-2 text-gray-800">{si.item.itemName}</td>
                    <td className="px-3 py-2 text-gray-500">{si.item.subCategory ?? '-'}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        si.item.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>{si.item.status === 'ACTIVE' ? '사용' : si.item.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="text-xs"
              onClick={() => setItemsPopup({ open: false, supplier: null })}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 파일 팝업 */}
      <Dialog open={filesPopup.open} onOpenChange={v => setFilesPopup(prev => ({ ...prev, open: v }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">
              첨부파일 — {filesPopup.supplier?.companyName} ({filesPopup.supplier?.files.length}개)
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto flex flex-col gap-2">
            {filesPopup.supplier?.files.map(f => (
              <div key={f.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-sm">{getFileIcon(f.mimeType)}</span>
                <a href={f.fileUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex-1 truncate">{f.fileName}</a>
                {f.fileSize && <span className="text-[10px] text-gray-400 shrink-0">{formatBytes(f.fileSize)}</span>}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="text-xs"
              onClick={() => setFilesPopup({ open: false, supplier: null })}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function getFileIcon(mimeType?: string) {
  if (!mimeType) return '📄'
  if (mimeType.startsWith('image/')) return '🖼'
  if (mimeType === 'application/pdf') return '📕'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return '📊'
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝'
  return '📄'
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
