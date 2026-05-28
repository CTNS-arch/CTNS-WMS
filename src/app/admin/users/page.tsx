'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const ROLE_OPTIONS = [
  { value: 'MASTER_ADMIN', label: '마스터 관리자', desc: '모든 권한', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'ITEM_WRITE',   label: '품목 관리', desc: '품목 등록·수정·삭제', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'LAB_STOCK',    label: '연구소 재고', desc: '연구소 입출고', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'PROD_STOCK',   label: '생산구매 재고', desc: '생산팀 입출고', color: 'bg-purple-100 text-purple-700 border-purple-200' },
]

const LOCAL_ROLE_OPTIONS = [
  { value: 'MASTER_ADMIN', label: '마스터 관리자', desc: '모든 권한', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'ITEM_WRITE',   label: '품목 관리', desc: '품목 등록·수정·삭제', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'LAB_STOCK',    label: '연구소 재고', desc: '연구소 입출고', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'PROD_STOCK',   label: '생산구매 재고', desc: '생산팀 입출고', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'VENDOR',       label: '거래처', desc: '구매요청 제한 접근', color: 'bg-amber-100 text-amber-700 border-amber-200' },
]

const ALL_ROLE_MAP: Record<string, any> = {
  ...Object.fromEntries([...ROLE_OPTIONS, ...LOCAL_ROLE_OPTIONS].map(r => [r.value, r])),
  ITEM_DELETE: { label: '품목 관리', color: 'bg-blue-100 text-blue-700 border-blue-200' },
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-emerald-500',
  'bg-orange-500', 'bg-pink-500', 'bg-indigo-500',
]

type MsUser = {
  msId: string
  dbId: string | null
  email: string
  name: string | null
  image: string | null
  roles: string[]
  hasLoggedIn: boolean
  createdAt: string | null
}

type LocalUser = {
  id: string
  username: string
  name: string
  roles: string[]
  isActive: boolean
  createdAt: string
}

export default function UsersPage() {
  const [tab, setTab] = useState<'ms' | 'local'>('ms')

  // ── MS 계정 상태 ──────────────────────────────────────────
  const [users, setUsers] = useState<MsUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRoles, setEditRoles] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // ── 일반 계정 상태 ────────────────────────────────────────
  const [localUsers, setLocalUsers] = useState<LocalUser[]>([])
  const [localLoading, setLocalLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [localSearch, setLocalSearch] = useState('')

  const [localEditingId, setLocalEditingId] = useState<string | null>(null)
  const [localEditRoles, setLocalEditRoles] = useState<string[]>([])
  const [localSaving, setLocalSaving] = useState(false)

  const [showCreate, setShowCreate] = useState(false)
  const [createUsername, setCreateUsername] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createName, setCreateName] = useState('')
  const [createRoles, setCreateRoles] = useState<string[]>([])
  const [createLoading, setCreateLoading] = useState(false)

  const [resetId, setResetId] = useState<string | null>(null)
  const [resetPw, setResetPw] = useState('')
  const [resetSaving, setResetSaving] = useState(false)

  // ── MS 계정 함수 ──────────────────────────────────────────
  const fetchUsers = async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/admin/ms-users')
      const json = await res.json()
      if (json.success) setUsers(json.data)
      else { setError(json.error ?? '불러오지 못했습니다.'); toast.error(json.error ?? '불러오지 못했습니다.') }
    } catch { const m = '서버 오류'; setError(m); toast.error(m) }
    finally { setLoading(false) }
  }

  const startEdit = (user: MsUser) => { setEditingId(user.msId); setEditRoles(user.roles ?? []) }
  const cancelEdit = () => { setEditingId(null); setEditRoles([]) }
  const toggleRole = (role: string) => {
    if (role === 'ITEM_WRITE') {
      setEditRoles(prev => prev.includes('ITEM_WRITE')
        ? prev.filter(r => r !== 'ITEM_WRITE' && r !== 'ITEM_DELETE')
        : [...prev.filter(r => r !== 'ITEM_DELETE'), 'ITEM_WRITE', 'ITEM_DELETE'])
    } else {
      setEditRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role])
    }
  }

  const saveRoles = async (user: MsUser) => {
    if (!user.dbId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/users/${user.dbId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: editRoles }),
      })
      const json = await res.json()
      if (json.success) { toast.success('권한이 저장되었습니다.'); setUsers(prev => prev.map(u => u.msId === user.msId ? { ...u, roles: editRoles } : u)); cancelEdit() }
      else toast.error('저장에 실패했습니다.')
    } catch { toast.error('서버 오류가 발생했습니다.') }
    finally { setSaving(false) }
  }

  const toggleBlock = async (user: MsUser) => {
    if (!user.dbId) return
    const isBlocked = user.roles.includes('ACCESS_BLOCKED')
    if (!isBlocked && !window.confirm(`${user.name ?? user.email} 사용자의 로그인을 차단하시겠습니까?`)) return
    const newRoles = isBlocked
      ? user.roles.filter(r => r !== 'ACCESS_BLOCKED')
      : [...user.roles.filter(r => r !== 'ACCESS_BLOCKED'), 'ACCESS_BLOCKED']
    try {
      const res = await fetch(`/api/admin/users/${user.dbId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: newRoles }),
      })
      const json = await res.json()
      if (json.success) { setUsers(prev => prev.map(u => u.msId === user.msId ? { ...u, roles: newRoles } : u)); toast.success(isBlocked ? '차단이 해제되었습니다.' : '로그인이 차단되었습니다.') }
      else toast.error('저장에 실패했습니다.')
    } catch { toast.error('서버 오류가 발생했습니다.') }
  }

  // ── 일반 계정 함수 ────────────────────────────────────────
  const fetchLocalUsers = async () => {
    setLocalLoading(true); setLocalError(null)
    try {
      const res = await fetch('/api/admin/external-users')
      const json = await res.json()
      if (json.success) setLocalUsers(json.data)
      else { setLocalError(json.message ?? '불러오지 못했습니다.'); toast.error(json.message ?? '불러오지 못했습니다.') }
    } catch { const m = '서버 오류'; setLocalError(m); toast.error(m) }
    finally { setLocalLoading(false) }
  }

  const createLocalUser = async () => {
    if (!createUsername.trim() || !createPassword.trim() || !createName.trim()) {
      toast.error('아이디, 비밀번호, 이름은 필수입니다.'); return
    }
    setCreateLoading(true)
    try {
      const res = await fetch('/api/admin/external-users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: createUsername.trim(), password: createPassword.trim(), name: createName.trim(), roles: createRoles }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('계정이 생성되었습니다.')
        setLocalUsers(prev => [json.data, ...prev])
        setShowCreate(false); setCreateUsername(''); setCreatePassword(''); setCreateName(''); setCreateRoles([])
      } else toast.error(json.message ?? '생성에 실패했습니다.')
    } catch { toast.error('서버 오류가 발생했습니다.') }
    finally { setCreateLoading(false) }
  }

  const startLocalEdit = (user: LocalUser) => { setLocalEditingId(user.id); setLocalEditRoles(user.roles ?? []); setResetId(null) }
  const cancelLocalEdit = () => { setLocalEditingId(null); setLocalEditRoles([]) }
  const toggleLocalRole = (role: string) => {
    if (role === 'ITEM_WRITE') {
      setLocalEditRoles(prev => prev.includes('ITEM_WRITE')
        ? prev.filter(r => r !== 'ITEM_WRITE' && r !== 'ITEM_DELETE')
        : [...prev.filter(r => r !== 'ITEM_DELETE'), 'ITEM_WRITE', 'ITEM_DELETE'])
    } else {
      setLocalEditRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role])
    }
  }

  const saveLocalRoles = async (userId: string) => {
    setLocalSaving(true)
    try {
      const res = await fetch(`/api/admin/external-users/${userId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: localEditRoles }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('권한이 저장되었습니다.')
        setLocalUsers(prev => prev.map(u => u.id === userId ? { ...u, roles: localEditRoles } : u))
        cancelLocalEdit()
      } else toast.error('저장에 실패했습니다.')
    } catch { toast.error('서버 오류가 발생했습니다.') }
    finally { setLocalSaving(false) }
  }

  const toggleLocalActive = async (user: LocalUser) => {
    try {
      const res = await fetch(`/api/admin/external-users/${user.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      })
      const json = await res.json()
      if (json.success) {
        setLocalUsers(prev => prev.map(u => u.id === user.id ? { ...u, isActive: !user.isActive } : u))
        toast.success(user.isActive ? '계정이 비활성화되었습니다.' : '계정이 활성화되었습니다.')
      } else toast.error('저장에 실패했습니다.')
    } catch { toast.error('서버 오류가 발생했습니다.') }
  }

  const deleteLocalUser = async (user: LocalUser) => {
    if (!window.confirm(`"${user.name}" 계정을 삭제하시겠습니까?\n\n삭제 후 복구할 수 없습니다.`)) return
    try {
      const res = await fetch(`/api/admin/external-users/${user.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) { setLocalUsers(prev => prev.filter(u => u.id !== user.id)); toast.success('계정이 삭제되었습니다.') }
      else toast.error('삭제에 실패했습니다.')
    } catch { toast.error('서버 오류가 발생했습니다.') }
  }

  const saveResetPassword = async (userId: string) => {
    if (!resetPw.trim()) { toast.error('새 비밀번호를 입력하세요.'); return }
    setResetSaving(true)
    try {
      const res = await fetch(`/api/admin/external-users/${userId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: resetPw.trim() }),
      })
      const json = await res.json()
      if (json.success) { toast.success('비밀번호가 변경되었습니다.'); setResetId(null); setResetPw('') }
      else toast.error('변경에 실패했습니다.')
    } catch { toast.error('서버 오류가 발생했습니다.') }
    finally { setResetSaving(false) }
  }

  const avatarColor = (seed: string) => AVATAR_COLORS[seed.charCodeAt(0) % AVATAR_COLORS.length]

  useEffect(() => { fetchUsers() }, [])
  useEffect(() => { if (tab === 'local' && localUsers.length === 0 && !localLoading) fetchLocalUsers() }, [tab])

  const adminCount = users.filter(u => u.roles.includes('MASTER_ADMIN')).length
  const noRoleCount = users.filter(u => u.roles.length === 0).length
  const filtered = users.filter(u => u.hasLoggedIn && (!search.trim() || (u.name ?? '').toLowerCase().includes(search.toLowerCase()) || (u.email ?? '').toLowerCase().includes(search.toLowerCase())))
  const filteredLocal = localUsers.filter(u => !localSearch.trim() || u.name.toLowerCase().includes(localSearch.toLowerCase()) || u.username.toLowerCase().includes(localSearch.toLowerCase()))

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b bg-white shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold text-gray-900">사용자 관리</h1>
            <p className="text-xs text-gray-500 mt-0.5">조직 구성원 및 일반 계정을 관리합니다</p>
          </div>
          <button
            onClick={() => tab === 'ms' ? fetchUsers() : fetchLocalUsers()}
            disabled={tab === 'ms' ? loading : localLoading}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50 px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50 transition-colors"
          >
            <svg className={`w-3.5 h-3.5 ${(tab === 'ms' ? loading : localLoading) ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            새로고침
          </button>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 mt-3">
          <button
            onClick={() => setTab('ms')}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === 'ms' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
          >
            MS 계정
          </button>
          <button
            onClick={() => setTab('local')}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === 'local' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
          >
            일반 계정
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════ MS 계정 탭 ═══════════════════════════════ */}
      {tab === 'ms' && (
        <>
          {/* 통계 바 */}
          <div className="px-6 py-3 bg-white border-b shrink-0">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"/>
                <span className="text-xs text-gray-500">재직자</span>
                <span className="text-sm font-bold text-gray-900">{users.length}명</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500"/>
                <span className="text-xs text-gray-500">관리자</span>
                <span className="text-sm font-bold text-gray-900">{adminCount}명</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-gray-300"/>
                <span className="text-xs text-gray-500">권한 미설정</span>
                <span className="text-sm font-bold text-gray-900">{noRoleCount}명</span>
              </div>
            </div>
          </div>

          {/* 검색 */}
          <div className="px-6 py-3 bg-white border-b shrink-0">
            <div className="relative max-w-xs">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="이름 또는 이메일 검색" className="pl-9 h-8 text-xs"/>
            </div>
          </div>

          {/* 사용자 목록 */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <div className="flex items-center justify-center h-40 text-sm text-gray-400 gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                Microsoft 365에서 불러오는 중...
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
                <p className="text-sm text-red-400">{error}</p>
                <button onClick={fetchUsers} className="text-xs text-blue-500 hover:underline">다시 시도</button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
                <p className="text-sm">{search ? '검색 결과가 없습니다.' : '재직 중인 직원이 없습니다.'}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-w-3xl">
                {filtered.map(user => {
                  const isEditing = editingId === user.msId
                  const initials = (user.name?.[0] ?? user.email?.[0] ?? '?').toUpperCase()
                  const isMaster = user.roles.includes('MASTER_ADMIN')
                  const isBlocked = user.roles.includes('ACCESS_BLOCKED')
                  const displayRoles = user.roles
                    .filter(r => r !== 'ACCESS_BLOCKED')
                    .filter(r => !(r === 'ITEM_DELETE' && user.roles.includes('ITEM_WRITE')))
                  return (
                    <div key={user.msId} className={`rounded-xl border transition-all ${isBlocked ? 'bg-red-50/40 border-red-200' : isEditing ? 'bg-white ring-2 ring-blue-200 border-blue-300 shadow-sm' : 'bg-white hover:border-gray-300'}`}>
                      <div className="flex items-start gap-4 p-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${avatarColor(user.email ?? '')}`}>
                          {user.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={user.image} alt={initials} className="w-10 h-10 rounded-full object-cover"/>
                          ) : initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-gray-900">{user.name ?? '(이름 없음)'}</span>
                            {isMaster && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold border border-red-200">관리자</span>}
                            {isBlocked && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-600 text-white font-semibold border border-red-700">차단됨</span>}
                            {user.hasLoggedIn && user.createdAt && (
                              <span className="text-xs text-gray-400 ml-auto shrink-0">
                                {new Date(user.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })} 최초 로그인
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
                          {!isEditing && (
                            <div className="mt-2.5 flex flex-wrap gap-1">
                              {displayRoles.length > 0 ? (
                                displayRoles.map(role => (
                                  <span key={role} className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${ALL_ROLE_MAP[role]?.color ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                    {ALL_ROLE_MAP[role]?.label ?? role}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-gray-300 italic">권한 없음 — 접근 불가</span>
                              )}
                            </div>
                          )}
                          {isEditing && (
                            <div className="mt-3 space-y-3">
                              <p className="text-xs font-medium text-gray-500">권한 선택</p>
                              <div className="grid grid-cols-1 gap-2">
                                {ROLE_OPTIONS.map(opt => {
                                  const checked = editRoles.includes(opt.value)
                                  return (
                                    <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${checked ? `${opt.color} border-current` : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
                                      <input type="checkbox" checked={checked} onChange={() => toggleRole(opt.value)} className="w-4 h-4 accent-blue-600 shrink-0"/>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold">{opt.label}</p>
                                        <p className="text-[11px] opacity-70">{opt.desc}</p>
                                      </div>
                                    </label>
                                  )
                                })}
                              </div>
                              <div className="flex items-center gap-2 pt-1">
                                <Button size="sm" className="h-8 text-xs px-4" onClick={() => saveRoles(user)} disabled={saving}>{saving ? '저장 중...' : '저장'}</Button>
                                <Button size="sm" variant="outline" className="h-8 text-xs px-3" onClick={cancelEdit} disabled={saving}>취소</Button>
                              </div>
                            </div>
                          )}
                        </div>
                        {!isEditing && user.hasLoggedIn && (
                          <div className="flex gap-1.5 shrink-0 items-center">
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => startEdit(user)}>권한 수정</Button>
                            <Button size="sm" variant="outline"
                              className={`h-7 text-xs ${isBlocked ? 'border-red-300 text-red-600 hover:bg-red-50' : 'border-gray-300 text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-300'}`}
                              onClick={() => toggleBlock(user)}
                            >
                              {isBlocked ? '차단 해제' : '차단'}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 안내 배너 */}
          <div className="px-6 py-3 border-t bg-white shrink-0">
            <div className="flex items-start gap-2 text-[11px] text-gray-400">
              <svg className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
              </svg>
              <span>Microsoft 365에서 활성화된 계정만 표시됩니다. 퇴사 처리된 계정은 로그인이 차단되며 목록에서 자동으로 제거됩니다.</span>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════ 일반 계정 탭 ═══════════════════════════════ */}
      {tab === 'local' && (
        <>
          {/* 액션 바 */}
          <div className="px-6 py-3 bg-white border-b shrink-0 flex items-center justify-between gap-4">
            <div className="relative max-w-xs flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <Input value={localSearch} onChange={e => setLocalSearch(e.target.value)} placeholder="아이디 또는 이름 검색" className="pl-9 h-8 text-xs"/>
            </div>
            <Button size="sm" className="h-8 text-xs gap-1.5 shrink-0" onClick={() => { setShowCreate(v => !v); setLocalEditingId(null) }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
              </svg>
              {showCreate ? '닫기' : '계정 추가'}
            </Button>
          </div>

          {/* 계정 생성 폼 */}
          {showCreate && (
            <div className="px-6 py-4 bg-blue-50 border-b shrink-0">
              <p className="text-xs font-semibold text-blue-800 mb-3">새 일반 계정 생성</p>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">아이디 *</label>
                  <Input value={createUsername} onChange={e => setCreateUsername(e.target.value)} placeholder="username" className="h-8 text-xs"/>
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">비밀번호 *</label>
                  <Input type="password" value={createPassword} onChange={e => setCreatePassword(e.target.value)} placeholder="••••••••" className="h-8 text-xs"/>
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">이름 *</label>
                  <Input value={createName} onChange={e => setCreateName(e.target.value)} placeholder="홍길동" className="h-8 text-xs"/>
                </div>
              </div>
              <div className="mb-3">
                <label className="block text-[11px] text-gray-500 mb-2">권한</label>
                <div className="flex flex-wrap gap-2">
                  {LOCAL_ROLE_OPTIONS.map(opt => {
                    const checked = createRoles.includes(opt.value)
                    return (
                      <label key={opt.value} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-xs font-medium transition-all ${checked ? `${opt.color} border-current` : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                        <input type="checkbox" checked={checked} onChange={() => {
                          if (opt.value === 'ITEM_WRITE') {
                            setCreateRoles(prev => prev.includes('ITEM_WRITE')
                              ? prev.filter(r => r !== 'ITEM_WRITE' && r !== 'ITEM_DELETE')
                              : [...prev.filter(r => r !== 'ITEM_DELETE'), 'ITEM_WRITE', 'ITEM_DELETE'])
                          } else {
                            setCreateRoles(prev => prev.includes(opt.value) ? prev.filter(r => r !== opt.value) : [...prev, opt.value])
                          }
                        }} className="w-3.5 h-3.5 accent-blue-600"/>
                        {opt.label}
                      </label>
                    )
                  })}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="h-8 text-xs px-4" onClick={createLocalUser} disabled={createLoading}>{createLoading ? '생성 중...' : '생성'}</Button>
                <Button size="sm" variant="outline" className="h-8 text-xs px-3" onClick={() => { setShowCreate(false); setCreateUsername(''); setCreatePassword(''); setCreateName(''); setCreateRoles([]) }}>취소</Button>
              </div>
            </div>
          )}

          {/* 일반 계정 목록 */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {localLoading ? (
              <div className="flex items-center justify-center h-40 text-sm text-gray-400 gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                불러오는 중...
              </div>
            ) : localError ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
                <p className="text-sm text-red-400">{localError}</p>
                <button onClick={fetchLocalUsers} className="text-xs text-blue-500 hover:underline">다시 시도</button>
              </div>
            ) : filteredLocal.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
                <svg className="w-8 h-8 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                <p className="text-sm">{localSearch ? '검색 결과가 없습니다.' : '등록된 일반 계정이 없습니다.'}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-w-3xl">
                {filteredLocal.map(user => {
                  const isEditing = localEditingId === user.id
                  const isResetting = resetId === user.id
                  const displayRoles = user.roles
                    .filter(r => !(r === 'ITEM_DELETE' && user.roles.includes('ITEM_WRITE')))
                  return (
                    <div key={user.id} className={`rounded-xl border transition-all ${!user.isActive ? 'bg-gray-50 border-gray-200 opacity-60' : isEditing || isResetting ? 'bg-white ring-2 ring-blue-200 border-blue-300 shadow-sm' : 'bg-white hover:border-gray-300'}`}>
                      <div className="p-4">
                        {/* 상단: 아바타 + 정보 */}
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${avatarColor(user.username)}`}>
                            {user.name[0]?.toUpperCase() ?? '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-gray-900">{user.name}</span>
                              <span className="text-xs text-gray-400">@{user.username}</span>
                              {!user.isActive && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-500 font-semibold">비활성</span>}
                              <span className="text-xs text-gray-400 ml-auto shrink-0">
                                {new Date(user.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                            {/* 역할 뱃지 */}
                            {!isEditing && !isResetting && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {displayRoles.length > 0 ? (
                                  displayRoles.map(role => (
                                    <span key={role} className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${ALL_ROLE_MAP[role]?.color ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                      {ALL_ROLE_MAP[role]?.label ?? role}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-xs text-gray-300 italic">권한 없음</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 권한 편집 모드 */}
                        {isEditing && (
                          <div className="mt-3 space-y-3">
                            <p className="text-xs font-medium text-gray-500">권한 선택</p>
                            <div className="grid grid-cols-2 gap-2">
                              {LOCAL_ROLE_OPTIONS.map(opt => {
                                const checked = localEditRoles.includes(opt.value)
                                return (
                                  <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${checked ? `${opt.color} border-current` : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
                                    <input type="checkbox" checked={checked} onChange={() => toggleLocalRole(opt.value)} className="w-4 h-4 accent-blue-600 shrink-0"/>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-semibold">{opt.label}</p>
                                      <p className="text-[11px] opacity-70">{opt.desc}</p>
                                    </div>
                                  </label>
                                )
                              })}
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                              <Button size="sm" className="h-7 text-xs px-4" onClick={() => saveLocalRoles(user.id)} disabled={localSaving}>{localSaving ? '저장 중...' : '저장'}</Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs px-3" onClick={cancelLocalEdit} disabled={localSaving}>취소</Button>
                            </div>
                          </div>
                        )}

                        {/* 비밀번호 재설정 모드 */}
                        {isResetting && (
                          <div className="mt-3 flex items-center gap-2">
                            <Input type="password" value={resetPw} onChange={e => setResetPw(e.target.value)} placeholder="새 비밀번호" className="h-7 text-xs max-w-[180px]"/>
                            <Button size="sm" className="h-7 text-xs px-3 shrink-0" onClick={() => saveResetPassword(user.id)} disabled={resetSaving}>{resetSaving ? '변경 중...' : '변경'}</Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs px-3 shrink-0" onClick={() => { setResetId(null); setResetPw('') }}>취소</Button>
                          </div>
                        )}

                        {/* 하단 버튼 */}
                        {!isEditing && !isResetting && (
                          <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-gray-100">
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => startLocalEdit(user)}>권한 수정</Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setResetId(user.id); setResetPw(''); setLocalEditingId(null) }}>비밀번호</Button>
                            <Button size="sm" variant="outline" className={`h-7 text-xs ${user.isActive ? 'text-gray-500 hover:text-orange-600 hover:border-orange-300' : 'text-orange-600 border-orange-300 hover:bg-orange-50'}`} onClick={() => toggleLocalActive(user)}>
                              {user.isActive ? '비활성화' : '활성화'}
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs text-red-500 border-red-200 hover:bg-red-50 hover:border-red-300 ml-auto" onClick={() => deleteLocalUser(user)}>삭제</Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 안내 배너 */}
          <div className="px-6 py-3 border-t bg-white shrink-0">
            <div className="flex items-start gap-2 text-[11px] text-gray-400">
              <svg className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
              </svg>
              <span>일반 계정은 아이디/비밀번호로 로그인합니다. 거래처 권한이 있는 계정은 구매요청 페이지만 접근 가능합니다.</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
