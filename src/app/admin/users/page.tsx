'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const ROLE_OPTIONS = [
  { value: 'MASTER_ADMIN', label: '마스터 관리자', desc: '모든 권한', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'ITEM_WRITE',   label: '품번 생성/편집', desc: '품목 등록·수정', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'ITEM_DELETE',  label: '품번 삭제', desc: '품목 삭제', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'LAB_STOCK',    label: '연구소 재고', desc: '연구소 입출고', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'PROD_STOCK',   label: '생산구매 재고', desc: '생산팀 입출고', color: 'bg-purple-100 text-purple-700 border-purple-200' },
]

const ROLE_MAP = Object.fromEntries(ROLE_OPTIONS.map(r => [r.value, r]))

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-emerald-500',
  'bg-orange-500', 'bg-pink-500', 'bg-indigo-500',
]

type User = {
  id: string
  email: string
  name: string | null
  image: string | null
  roles: string[]
  createdAt: string
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRoles, setEditRoles] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      const json = await res.json()
      if (json.success) setUsers(json.data)
      else toast.error('사용자 목록을 불러오지 못했습니다.')
    } catch {
      toast.error('서버 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  const filtered = users.filter(u =>
    !search.trim() ||
    (u.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const startEdit = (user: User) => {
    setEditingId(user.id)
    setEditRoles(user.roles ?? [])
  }

  const cancelEdit = () => { setEditingId(null); setEditRoles([]) }

  const toggleRole = (role: string) =>
    setEditRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role])

  const saveRoles = async (userId: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: editRoles }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('권한이 저장되었습니다.')
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, roles: editRoles } : u))
        cancelEdit()
      } else toast.error('저장에 실패했습니다.')
    } catch {
      toast.error('서버 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const avatarColor = (email: string) =>
    AVATAR_COLORS[email.charCodeAt(0) % AVATAR_COLORS.length]

  const adminCount = users.filter(u => u.roles.includes('MASTER_ADMIN')).length

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b bg-white shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold text-gray-900">사용자 관리</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Microsoft 계정으로 최초 로그인 시 자동 등록됩니다
            </p>
          </div>
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50 px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50 transition-colors"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            새로고침
          </button>
        </div>
      </div>

      {/* 통계 바 */}
      <div className="px-6 py-3 bg-white border-b shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500"/>
            <span className="text-xs text-gray-500">전체</span>
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
            <span className="text-sm font-bold text-gray-900">{users.filter(u => u.roles.length === 0).length}명</span>
          </div>
        </div>
      </div>

      {/* 검색 */}
      <div className="px-6 py-3 bg-white border-b shrink-0">
        <div className="relative max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름 또는 이메일 검색"
            className="pl-9 h-8 text-xs"
          />
        </div>
      </div>

      {/* 사용자 목록 */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400 gap-2">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            불러오는 중...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
            <svg className="w-8 h-8 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            <p className="text-sm">{search ? '검색 결과가 없습니다.' : '등록된 사용자가 없습니다.'}</p>
            {!search && <p className="text-xs">사용자가 Microsoft 계정으로 로그인하면 자동 등록됩니다.</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-w-3xl">
            {filtered.map(user => {
              const isEditing = editingId === user.id
              const initials = (user.name?.[0] ?? user.email?.[0] ?? '?').toUpperCase()
              const isMaster = user.roles.includes('MASTER_ADMIN')

              return (
                <div key={user.id} className={`bg-white rounded-xl border transition-all ${isEditing ? 'ring-2 ring-blue-200 border-blue-300 shadow-sm' : 'hover:border-gray-300'}`}>
                  <div className="flex items-start gap-4 p-4">
                    {/* 아바타 */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${avatarColor(user.email ?? '')}`}>
                      {user.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={user.image} alt={initials} className="w-10 h-10 rounded-full object-cover"/>
                      ) : initials}
                    </div>

                    {/* 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">
                          {user.name ?? '(이름 없음)'}
                        </span>
                        {isMaster && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold border border-red-200">
                            관리자
                          </span>
                        )}
                        <span className="text-xs text-gray-400 ml-auto shrink-0">
                          {new Date(user.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })} 가입
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>

                      {/* 역할 뱃지 (보기 모드) */}
                      {!isEditing && (
                        <div className="mt-2.5 flex flex-wrap gap-1">
                          {user.roles.length > 0 ? (
                            user.roles.map(role => (
                              <span key={role} className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${ROLE_MAP[role]?.color ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                {ROLE_MAP[role]?.label ?? role}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-300 italic">권한 없음 — 접근 불가</span>
                          )}
                        </div>
                      )}

                      {/* 편집 모드 */}
                      {isEditing && (
                        <div className="mt-3 space-y-3">
                          <p className="text-xs font-medium text-gray-500">권한 선택</p>
                          <div className="grid grid-cols-1 gap-2">
                            {ROLE_OPTIONS.map(opt => {
                              const checked = editRoles.includes(opt.value)
                              return (
                                <label
                                  key={opt.value}
                                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                    checked ? `${opt.color} border-current` : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleRole(opt.value)}
                                    className="w-4 h-4 accent-blue-600 shrink-0"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold">{opt.label}</p>
                                    <p className="text-[11px] opacity-70">{opt.desc}</p>
                                  </div>
                                </label>
                              )
                            })}
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <Button size="sm" className="h-8 text-xs px-4" onClick={() => saveRoles(user.id)} disabled={saving}>
                              {saving ? '저장 중...' : '저장'}
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 text-xs px-3" onClick={cancelEdit} disabled={saving}>
                              취소
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 수정 버튼 */}
                    {!isEditing && (
                      <Button size="sm" variant="outline" className="shrink-0 h-8 text-xs" onClick={() => startEdit(user)}>
                        권한 수정
                      </Button>
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
          <span>사용자가 처음 Microsoft 로그인 시 이 목록에 자동 추가됩니다. 권한을 설정하지 않으면 시스템 접근이 제한됩니다.</span>
        </div>
      </div>
    </div>
  )
}
