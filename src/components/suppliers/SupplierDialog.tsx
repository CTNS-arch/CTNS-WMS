'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { SUB_OPTIONS, THIRD_OPTIONS } from '@/lib/classification'

type SupplierStatus = 'ACTIVE' | 'INACTIVE'
type SupplierRegion = 'DOMESTIC' | 'OVERSEAS'

interface ContactRow {
  _key: string; id?: string
  name: string; title: string; phone: string; email: string
}
interface FileRow {
  _key: string; id?: string
  fileName: string; fileUrl: string; fileSize?: number; mimeType?: string
}
interface SelectedItem {
  id: string; itemCode: string; itemName: string
  category: string; subCategory: string | null; status: string
}
interface SupplierFormState {
  supplierCode: string; companyName: string
  status: SupplierStatus; region: SupplierRegion
  businessRegNo: string; url: string
  bankName: string; accountNumber: string; accountHolder: string
  subCategory: string; note: string
}
interface SupplierDialogProps {
  open: boolean; onClose: () => void
  supplier?: any | null; onSaved: (saved?: any) => void
}

const EMPTY_FORM: SupplierFormState = {
  supplierCode: '', companyName: '', status: 'ACTIVE', region: 'DOMESTIC',
  businessRegNo: '', url: '',
  bankName: '', accountNumber: '', accountHolder: '', subCategory: '', note: '',
}

function newKey() { return Math.random().toString(36).slice(2) }

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="-mx-6 px-6 py-2.5 bg-gray-100 border-t border-b border-gray-200 flex items-center gap-2">
      <div className="w-0.5 h-3.5 bg-blue-500 rounded-full shrink-0" />
      <span className="text-xs font-bold text-gray-600 tracking-wide">{title}</span>
      {action && <div className="ml-auto">{action}</div>}
    </div>
  )
}

function Field({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm text-gray-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  )
}

const SUB_CATEGORY_GROUPS = [
  { label: '반제품', options: SUB_OPTIONS.ASSEMBLY?.filter(o => ['BM', 'PC'].includes(o.value)) ?? [] },
  { label: '자재 (중분류)', options: SUB_OPTIONS.COMPONENT?.filter(o => ['CL', 'EL', 'ME'].includes(o.value)) ?? [] },
  { label: '도전재 (CD)', options: THIRD_OPTIONS.CD ?? [] },
  { label: '포장자재 (PK)', options: THIRD_OPTIONS.PK ?? [] },
  { label: '체결부품 (FS)', options: THIRD_OPTIONS.FS ?? [] },
  { label: '부자재/소모품 (SM)', options: THIRD_OPTIONS.SM ?? [] },
  { label: '기타 (OT)', options: THIRD_OPTIONS.OT ?? [] },
]

export default function SupplierDialog({ open, onClose, supplier, onSaved }: SupplierDialogProps) {
  const isEdit = !!supplier
  const [form, setForm] = useState<SupplierFormState>(EMPTY_FORM)
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
  const [files, setFiles] = useState<FileRow[]>([])
  const [bizLicenseFile, setBizLicenseFile] = useState<FileRow | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [codeLoading, setCodeLoading] = useState(false)
  const [userEditedCode, setUserEditedCode] = useState(false)

  const [itemSearch, setItemSearch] = useState('')
  const [allItems, setAllItems] = useState<SelectedItem[]>([])
  const [itemSearching, setItemSearching] = useState(false)
  const [showItemDropdown, setShowItemDropdown] = useState(false)
  const itemSearchRef = useRef<HTMLDivElement>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const bizLicenseRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const [uploading, setUploading] = useState(false)
  const [bizUploading, setBizUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setItemSearch(''); setAllItems([]); setShowItemDropdown(false)
    setUserEditedCode(false); setPreviewUrl(null)
    if (supplier) {
      setForm({
        supplierCode: supplier.supplierCode ?? '',
        companyName: supplier.companyName ?? '',
        status: supplier.status ?? 'ACTIVE',
        region: supplier.region ?? 'DOMESTIC',
        businessRegNo: supplier.businessRegNo ?? '',
        url: supplier.url ?? '',
        bankName: supplier.bankName ?? '',
        accountNumber: supplier.accountNumber ?? '',
        accountHolder: supplier.accountHolder ?? '',
        subCategory: supplier.subCategory ?? '',
        note: supplier.note ?? '',
      })
      setContacts((supplier.contacts ?? []).map((c: any) => ({ _key: newKey(), ...c })))
      setSelectedItems((supplier.items ?? []).map((si: any) => ({ ...si.item })))
      const allFiles: any[] = (supplier.files ?? []).map((f: any) => ({ _key: newKey(), ...f }))
      const biz = allFiles.find((f: any) => f.fileName?.startsWith('[사업자등록증]'))
      setBizLicenseFile(biz ?? null)
      setFiles(allFiles.filter((f: any) => !f.fileName?.startsWith('[사업자등록증]')))
    } else {
      setForm(EMPTY_FORM); setContacts([]); setSelectedItems([]); setFiles([]); setBizLicenseFile(null)
    }
  }, [open, supplier])

  useEffect(() => {
    if (isEdit || !form.subCategory || userEditedCode) return
    setCodeLoading(true)
    fetch(`/api/suppliers/next-code?subCategory=${form.subCategory}`)
      .then(r => r.json())
      .then(json => { if (json.success) setForm(f => ({ ...f, supplierCode: json.data.nextCode })) })
      .catch(() => {})
      .finally(() => setCodeLoading(false))
  }, [form.subCategory, isEdit, userEditedCode])

  const loadAllItems = async () => {
    setShowItemDropdown(true)
    if (allItems.length > 0) return
    setItemSearching(true)
    try {
      const base = 'limit=1000&sortBy=itemCode&sortOrder=asc'
      const [asmRes, compRes] = await Promise.all([
        fetch(`/api/items?category=ASSEMBLY&subCategory=BM,PC&${base}`),
        fetch(`/api/items?category=COMPONENT&${base}`),
      ])
      const [asmJson, compJson] = await Promise.all([asmRes.json(), compRes.json()])
      const toRow = (item: any): SelectedItem => ({
        id: item.id, itemCode: item.itemCode, itemName: item.itemName,
        category: item.category, subCategory: item.subCategory, status: item.status,
      })
      const combined = [
        ...(asmJson.success ? asmJson.data.items.map(toRow) : []),
        ...(compJson.success ? compJson.data.items.map(toRow) : []),
      ]
      combined.sort((a, b) => a.itemCode.localeCompare(b.itemCode))
      setAllItems(combined)
    } catch {}
    setItemSearching(false)
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (itemSearchRef.current && !itemSearchRef.current.contains(e.target as Node))
        setShowItemDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filteredItems = itemSearch.trim()
    ? allItems.filter(item =>
        item.itemCode.toLowerCase().includes(itemSearch.toLowerCase()) ||
        item.itemName.toLowerCase().includes(itemSearch.toLowerCase())
      )
    : allItems

  const uploadFiles = async (fileList: FileList) => {
    setUploading(true)
    try {
      const formData = new FormData()
      Array.from(fileList).forEach(f => formData.append('files', f))
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const json = await res.json()
      if (json.success) {
        const newFiles: FileRow[] = Array.from(fileList).map((f, i) => ({
          _key: newKey(), fileName: f.name, fileUrl: json.data.urls[i], fileSize: f.size, mimeType: f.type,
        }))
        setFiles(prev => [...prev, ...newFiles])
      } else toast.error(json.message ?? '파일 업로드 실패')
    } catch { toast.error('파일 업로드 중 오류가 발생했습니다.') }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = '' }
  }

  const handleBizLicenseChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return
    const f = fileList[0]
    setBizUploading(true)
    try {
      const formData = new FormData()
      formData.append('files', f)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const json = await res.json()
      if (json.success)
        setBizLicenseFile({ _key: newKey(), fileName: f.name, fileUrl: json.data.urls[0], fileSize: f.size, mimeType: f.type })
      else toast.error(json.message ?? '파일 업로드 실패')
    } catch { toast.error('파일 업로드 중 오류가 발생했습니다.') }
    finally { setBizUploading(false); if (bizLicenseRef.current) bizLicenseRef.current.value = '' }
  }

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = (e: React.DragEvent) => {
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) setIsDragging(false)
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files)
  }

  const handleSubmit = async () => {
    if (!form.companyName.trim()) { toast.error('회사명을 입력해주세요.'); return }
    if (!form.supplierCode.trim()) { toast.error('회사코드를 확인해주세요.'); return }
    setSubmitting(true)
    try {
      const bizFiles = bizLicenseFile
        ? [{ fileName: `[사업자등록증] ${bizLicenseFile.fileName}`, fileUrl: bizLicenseFile.fileUrl, fileSize: bizLicenseFile.fileSize, mimeType: bizLicenseFile.mimeType }]
        : []
      const payload = {
        ...form,
        contacts: contacts.filter(c => c.name.trim()).map(c => ({
          id: c.id, name: c.name.trim(), title: c.title || null, phone: c.phone || null, email: c.email || null,
        })),
        itemIds: selectedItems.map(i => i.id),
        files: [
          ...bizFiles,
          ...files.map(f => ({ fileName: f.fileName, fileUrl: f.fileUrl, fileSize: f.fileSize, mimeType: f.mimeType })),
        ],
      }
      const url = isEdit ? `/api/suppliers/${supplier.id}` : '/api/suppliers'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const json = await res.json()
      if (json.success) {
        toast.success(isEdit ? '공급처가 수정되었습니다.' : '공급처가 등록되었습니다.')
        onSaved(json.data); onClose()
      } else toast.error(json.message ?? '저장 실패')
    } catch { toast.error('서버 오류가 발생했습니다.') }
    finally { setSubmitting(false) }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
        <SheetContent side="right" className="w-[600px] max-w-[600px] h-screen flex flex-col p-0 gap-0">

          {/* 헤더 */}
          <SheetHeader className="px-6 py-4 border-b shrink-0">
            <SheetTitle className="text-sm font-semibold">
              {isEdit ? `공급처 수정 — ${supplier?.companyName}` : '공급처 등록'}
            </SheetTitle>
          </SheetHeader>

          {/* 회사코드 미리보기 */}
          <div className="bg-gray-900 text-white px-6 py-4 shrink-0 border-b border-gray-700">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">회사코드</p>
            <span className={`font-mono text-base font-bold ${
              !form.supplierCode || codeLoading ? 'text-red-400' : 'text-green-300'
            }`}>
              {codeLoading ? '생성 중...' : (form.supplierCode || '소분류를 선택하세요')}
            </span>
          </div>

          {/* 스크롤 콘텐츠 */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* ── 분류 체계 ── */}
            <div className="space-y-4">
              <SectionHeader title="분류 체계" />
              <Field label="소분류" required>
                <select
                  value={form.subCategory}
                  onChange={e => { setForm(f => ({ ...f, subCategory: e.target.value })); setUserEditedCode(false) }}
                  disabled={isEdit}
                  className="w-full h-9 text-sm border border-gray-200 rounded-md px-3 bg-white disabled:bg-gray-50 disabled:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
                >
                  <option value="">소분류 선택</option>
                  {SUB_CATEGORY_GROUPS.map(group => (
                    <optgroup key={group.label} label={group.label}>
                      {group.options.map(o => (
                        <option key={o.value} value={o.value}>{o.label} ({o.value})</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Field>
            </div>

            {/* ── 기본 정보 ── */}
            <div className="space-y-4">
              <SectionHeader title="기본 정보" />

              <div className="grid grid-cols-2 gap-4">
                <Field label="상태">
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as SupplierStatus }))}
                    className="w-full h-9 text-sm border border-gray-200 rounded-md px-3 bg-white focus:outline-none focus:ring-1 focus:ring-gray-400">
                    <option value="ACTIVE">사용</option>
                    <option value="INACTIVE">미사용</option>
                  </select>
                </Field>
                <Field label="구분">
                  <select value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value as SupplierRegion }))}
                    className="w-full h-9 text-sm border border-gray-200 rounded-md px-3 bg-white focus:outline-none focus:ring-1 focus:ring-gray-400">
                    <option value="DOMESTIC">국내</option>
                    <option value="OVERSEAS">해외</option>
                  </select>
                </Field>
              </div>

              <Field label="사업자등록번호">
                <Input value={form.businessRegNo} onChange={e => setForm(f => ({ ...f, businessRegNo: e.target.value }))}
                  placeholder="000-00-00000" className="h-9 text-sm" />
              </Field>

              <Field label="회사명" required>
                <Input value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                  placeholder="회사명" className="h-9 text-sm" />
              </Field>

              <Field label="URL">
                <Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="https://example.com" className="h-9 text-sm" />
              </Field>

              {/* 사업자등록증 (기본정보로 이동) */}
              <Field label="사업자등록증">
                <input ref={bizLicenseRef} type="file" accept=".pdf,image/*" className="hidden" onChange={handleBizLicenseChange} />
                {bizLicenseFile ? (
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                    <span className="text-sm shrink-0">{getFileIcon(bizLicenseFile.mimeType)}</span>
                    <a href={bizLicenseFile.fileUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex-1 truncate">{bizLicenseFile.fileName}</a>
                    {bizLicenseFile.fileSize && <span className="text-[10px] text-gray-400 shrink-0">{formatBytes(bizLicenseFile.fileSize)}</span>}
                    <button onClick={() => setBizLicenseFile(null)} className="text-gray-400 hover:text-red-500 shrink-0 text-lg leading-none">×</button>
                  </div>
                ) : (
                  <button type="button" disabled={bizUploading} onClick={() => bizLicenseRef.current?.click()}
                    className="flex items-center gap-2 h-9 px-3 w-full text-sm border border-dashed border-gray-300 rounded-md text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50">
                    {bizUploading ? '업로드 중...' : '+ 파일 선택 (PDF / 이미지)'}
                  </button>
                )}
              </Field>
            </div>

            {/* ── 금융 정보 ── */}
            <div className="space-y-4">
              <SectionHeader title="금융 정보" />
              <div className="grid grid-cols-3 gap-4">
                <Field label="은행">
                  <Input value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))}
                    placeholder="신한은행" className="h-9 text-sm" />
                </Field>
                <Field label="계좌번호">
                  <Input value={form.accountNumber} onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value }))}
                    placeholder="000-000-000000" className="h-9 text-sm" />
                </Field>
                <Field label="예금주">
                  <Input value={form.accountHolder} onChange={e => setForm(f => ({ ...f, accountHolder: e.target.value }))}
                    placeholder="홍길동" className="h-9 text-sm" />
                </Field>
              </div>
            </div>

            {/* ── 담당자 ── */}
            <div className="space-y-4">
              <SectionHeader title={`담당자${contacts.length > 0 ? ` (${contacts.length}명)` : ''}`}
                action={
                  <Button size="sm" variant="outline" className="h-7 text-xs"
                    onClick={() => setContacts(prev => [...prev, { _key: newKey(), name: '', title: '', phone: '', email: '' }])}>
                    + 추가
                  </Button>
                }
              />
              {contacts.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-3">담당자를 추가하세요.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {contacts.map((c, idx) => (
                    <div key={c._key} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-center bg-gray-50 rounded-lg px-3 py-2">
                      <Input value={c.name} onChange={e => setContacts(prev => prev.map((r, i) => i === idx ? { ...r, name: e.target.value } : r))}
                        placeholder="이름 *" className="h-7 text-xs" />
                      <Input value={c.title} onChange={e => setContacts(prev => prev.map((r, i) => i === idx ? { ...r, title: e.target.value } : r))}
                        placeholder="직책" className="h-7 text-xs" />
                      <Input value={c.phone} onChange={e => setContacts(prev => prev.map((r, i) => i === idx ? { ...r, phone: e.target.value } : r))}
                        placeholder="연락처" className="h-7 text-xs" />
                      <Input value={c.email} onChange={e => setContacts(prev => prev.map((r, i) => i === idx ? { ...r, email: e.target.value } : r))}
                        placeholder="이메일" className="h-7 text-xs" />
                      <button onClick={() => setContacts(prev => prev.filter((_, i) => i !== idx))}
                        className="text-gray-400 hover:text-red-500 text-lg leading-none">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── 구매품목 ── */}
            <div className="space-y-4">
              <SectionHeader title={`구매품목${selectedItems.length > 0 ? ` (${selectedItems.length}개)` : ''}`} />
              <div ref={itemSearchRef} className="relative">
                <Input value={itemSearch} onChange={e => setItemSearch(e.target.value)}
                  onFocus={loadAllItems}
                  placeholder="클릭하여 전체 품목 표시 · 입력하여 검색"
                  className="h-9 text-sm" />
                {showItemDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border rounded-md shadow-lg z-20 max-h-52 overflow-y-auto">
                    {itemSearching ? (
                      <p className="text-xs text-gray-400 px-3 py-2">불러오는 중...</p>
                    ) : filteredItems.length === 0 ? (
                      <p className="text-xs text-gray-400 px-3 py-2">결과 없음</p>
                    ) : filteredItems.map(item => {
                      const already = selectedItems.some(s => s.id === item.id)
                      return (
                        <button key={item.id}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 ${already ? 'opacity-40' : ''}`}
                          onClick={() => {
                            if (already) return
                            setSelectedItems(prev => [...prev, item])
                            setItemSearch(''); setShowItemDropdown(false)
                          }}>
                          <span className="font-mono text-gray-500 shrink-0">{item.itemCode}</span>
                          <span className="text-gray-800 truncate">{item.itemName}</span>
                          {already && <span className="ml-auto text-gray-300 text-[10px] shrink-0">선택됨</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
              {selectedItems.length > 0 && (
                <div className="flex flex-col gap-1">
                  {selectedItems.map(item => (
                    <div key={item.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                      <span className="font-mono text-xs text-gray-500 shrink-0">{item.itemCode}</span>
                      <span className="text-xs text-gray-800 flex-1 truncate">{item.itemName}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${
                        item.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>{item.status === 'ACTIVE' ? '사용' : item.status}</span>
                      <button onClick={() => setSelectedItems(prev => prev.filter(i => i.id !== item.id))}
                        className="text-gray-400 hover:text-red-500 shrink-0 text-lg leading-none">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── 파일첨부 ── */}
            <div className="space-y-4">
              <SectionHeader title={`파일첨부${files.length > 0 ? ` (${files.length}개)` : ''}`} />
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => { if (e.target.files?.length) uploadFiles(e.target.files) }} />
              <div ref={dropZoneRef} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg px-4 py-6 text-center transition-colors ${
                  isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                }`}>
                <div className="flex flex-col items-center gap-2">
                  <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm text-gray-400">
                    파일을 드래그하거나{' '}
                    <button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()}
                      className="text-blue-500 hover:underline disabled:opacity-50">클릭하여 선택</button>
                  </p>
                  {uploading && <p className="text-xs text-blue-500">업로드 중...</p>}
                </div>
              </div>
              {files.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {files.map(f => (
                    <div key={f._key} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                      {f.mimeType?.startsWith('image/') ? (
                        <button type="button" onClick={() => setPreviewUrl(f.fileUrl)}
                          className="shrink-0 w-8 h-8 rounded overflow-hidden border border-gray-200 hover:opacity-80">
                          <img src={f.fileUrl} alt="" className="w-full h-full object-cover" />
                        </button>
                      ) : (
                        <span className="text-sm shrink-0">{getFileIcon(f.mimeType)}</span>
                      )}
                      <a href={f.fileUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline flex-1 truncate">{f.fileName}</a>
                      {f.fileSize && <span className="text-[10px] text-gray-400 shrink-0">{formatBytes(f.fileSize)}</span>}
                      <button onClick={() => setFiles(prev => prev.filter(x => x._key !== f._key))}
                        className="text-gray-400 hover:text-red-500 shrink-0 text-lg leading-none">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── 비고 ── */}
            <div className="space-y-4">
              <SectionHeader title="비고" />
              <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                placeholder="비고" rows={3}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-gray-400" />
            </div>

            <div className="h-2" />
          </div>

          {/* 하단 버튼 */}
          <SheetFooter className="px-6 py-4 border-t shrink-0 flex gap-2 justify-end">
            <Button variant="outline" disabled={submitting} onClick={onClose}>취소</Button>
            <Button disabled={submitting} onClick={handleSubmit}>
              {submitting ? '저장 중...' : isEdit ? '수정' : '등록'}
            </Button>
          </SheetFooter>

        </SheetContent>
      </Sheet>

      {previewUrl && (
        <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center" onClick={() => setPreviewUrl(null)}>
          <img src={previewUrl} alt="" className="max-w-[90vw] max-h-[90vh] object-contain rounded shadow-2xl" onClick={e => e.stopPropagation()} />
          <button className="absolute top-4 right-4 w-9 h-9 bg-white text-gray-800 rounded-full flex items-center justify-center shadow-lg hover:bg-gray-100 text-lg font-bold"
            onClick={() => setPreviewUrl(null)}>×</button>
        </div>
      )}
    </>
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
