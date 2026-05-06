'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

const ROLE_OPTIONS = [
  { value: 'ITEM_WRITE',   label: '품번 생성/편집' },
  { value: 'ITEM_DELETE',  label: '품번 삭제' },
  { value: 'LAB_STOCK',    label: '연구소 재고 관리' },
  { value: 'PROD_STOCK',   label: '생산구매팀 재고 관리' },
  { value: 'MASTER_ADMIN', label: '마스터 관리자' },
]

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRoles, setEditRoles] = useState<string[]>([])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      const json = await res.json()
      if (json.success) {
        setUsers(json.data)
      } else {
        toast.error('사용자 목록을 불러오지 못했습니다.')
      }
    } catch {
      toast.error('사용자 목록 조회 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const startEdit = (user: any) => {
    setEditingId(user.id)
    setEditRoles(user.roles ?? [])
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditRoles([])
  }

  const toggleRole = (role: string) => {
    setEditRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    )
  }

  const saveRoles = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: editRoles }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('역할이 저장되었습니다.')
        setUsers(prev =>
          prev.map(u => (u.id === userId ? { ...u, roles: editRoles } : u))
        )
        cancelEdit()
      } else {
        toast.error('역할 저장에 실패했습니다.')
      }
    } catch {
      toast.error('역할 저장 중 오류가 발생했습니다.')
    }
  }

  const getRoleLabel = (value: string) => {
    return ROLE_OPTIONS.find(r => r.value === value)?.label ?? value
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-3 border-b bg-white shrink-0">
        <h1 className="text-sm font-semibold text-gray-800">사용자 관리</h1>
      </div>

      <div className="flex-1 overflow-auto min-h-0 px-6 py-4">
        {loading ? (
          <p className="text-sm text-gray-500">불러오는 중...</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-gray-500">등록된 사용자가 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {users.map(user => (
              <div
                key={user.id}
                className="flex items-start gap-4 p-4 border rounded-lg bg-white"
              >
                {/* 아바타 */}
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600 uppercase">
                  {(user.name?.[0] ?? user.email?.[0] ?? '?')}
                </div>

                {/* 이름 + 이메일 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {user.name ?? '(이름 없음)'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>

                  {/* 역할 배지 (보기 모드) */}
                  {editingId !== user.id && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {user.roles?.length > 0 ? (
                        user.roles.map((role: string) => (
                          <span
                            key={role}
                            className="inline-block px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700"
                          >
                            {getRoleLabel(role)}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400">역할 없음</span>
                      )}
                    </div>
                  )}

                  {/* 편집 모드 */}
                  {editingId === user.id && (
                    <div className="mt-3 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        {ROLE_OPTIONS.map(option => (
                          <label
                            key={option.value}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={editRoles.includes(option.value)}
                              onChange={() => toggleRole(option.value)}
                              className="w-4 h-4 accent-gray-700"
                            />
                            <span className="text-xs text-gray-700">
                              {option.label}
                            </span>
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => saveRoles(user.id)}
                        >
                          저장
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={cancelEdit}
                        >
                          취소
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 역할 수정 버튼 (보기 모드에서만) */}
                {editingId !== user.id && (
                  <div className="flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit(user)}
                    >
                      역할 수정
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
