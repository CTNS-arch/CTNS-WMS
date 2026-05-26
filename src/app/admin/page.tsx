'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

function MigrationSection() {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [results, setResults] = useState<string[]>([])
  const [error, setError] = useState('')

  const runMigration = async () => {
    if (!confirm('데이터 마이그레이션을 실행하시겠습니까?\n이 작업은 DB 품번을 직접 변경합니다.')) return
    setLoading(true); setError(''); setResults([])
    try {
      const res = await fetch('/api/admin/migrate', { method: 'POST' })
      const json = await res.json()
      if (json.success) { setResults(json.results); setDone(true) }
      else setError(json.message ?? '오류가 발생했습니다.')
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div>
      <h2 className="text-base font-semibold text-gray-800 mb-2">데이터 마이그레이션</h2>
      <p className="text-sm text-gray-500 mb-6">
        아래 항목을 DB에 반영합니다.
        <br />· BP 품번 회로 코드 수정 (BM→B, BM-001~004 → B-003~006)
        <br />· 대분류 재배치 (PRODUCT의 BM/PC → ASSEMBLY, CL → COMPONENT)
      </p>
      {!done ? (
        <Button onClick={runMigration} disabled={loading} className="w-full h-10">
          {loading ? '실행 중...' : '마이그레이션 실행'}
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
            ✓ 마이그레이션 완료 ({results.length}개 항목)
          </div>
          <div className="bg-gray-50 border rounded-md p-3 space-y-1 max-h-64 overflow-y-auto">
            {results.length === 0
              ? <p className="text-xs text-gray-400">변경된 항목이 없습니다. (이미 완료된 상태)</p>
              : results.map((r, i) => <p key={i} className="text-xs font-mono text-gray-700">{r}</p>)
            }
          </div>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => { setDone(false); setResults([]) }}>
            다시 실행
          </Button>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
    </div>
  )
}

export default function AdminPage() {
  return (
    <div className="max-w-3xl mx-auto mt-10 px-6 pb-16">
      <h1 className="text-lg font-bold text-gray-900 mb-6">관리자 설정</h1>
      <MigrationSection />
    </div>
  )
}
