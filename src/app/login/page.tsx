'use client'

import { signIn } from 'next-auth/react'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import iconPng from '../icon.png'

const ERROR_MESSAGES: Record<string, string> = {
  Configuration:    '서버 설정 오류입니다. 관리자에게 문의하세요.',
  AccessDenied:     '접근이 거부되었습니다. 조직 계정으로 시도해 주세요.',
  OAuthCallback:    'Microsoft 인증 중 오류가 발생했습니다. 다시 시도해 주세요.',
  OAuthCreateAccount: '계정 생성에 실패했습니다. 관리자에게 문의하세요.',
  Default:          '로그인 중 오류가 발생했습니다. 다시 시도해 주세요.',
}

function LoginPage() {
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()
  const errorCode = searchParams.get('error')
  const errorMsg = errorCode ? (ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.Default) : null

  // Configuration 오류 시 자동 1회 재시도 (Vercel/Neon 콜드 스타트 대응)
  useEffect(() => {
    if (errorCode !== 'Configuration') return
    const retried = sessionStorage.getItem('ctns_auth_retried')
    if (retried) {
      sessionStorage.removeItem('ctns_auth_retried')
      return
    }
    sessionStorage.setItem('ctns_auth_retried', '1')
    setLoading(true)
    const t = setTimeout(() => signIn('microsoft-entra-id', { callbackUrl: '/items' }), 1200)
    return () => clearTimeout(t)
  }, [errorCode])

  const handleLogin = async () => {
    sessionStorage.removeItem('ctns_auth_retried')
    setLoading(true)
    await signIn('microsoft-entra-id', { callbackUrl: '/items' })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-blue-50">
      <div className="w-full max-w-[360px] px-4 flex flex-col items-center gap-8">

        {/* 로고 */}
        <div className="flex flex-col items-center gap-3">
          <Image src={iconPng} alt="CTNS 로고" width={56} height={56} className="rounded-xl" />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">CTNS WMS</h1>
            <p className="text-sm text-gray-500 mt-0.5">(주)씨티엔에스 물류 관리 시스템</p>
          </div>
        </div>

        {/* 카드 */}
        <div className="w-full bg-white rounded-2xl shadow-md border border-gray-100 p-8 flex flex-col gap-6">
          {errorMsg && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
              </svg>
              <p className="text-xs text-red-600">{errorMsg}</p>
            </div>
          )}
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">조직 계정으로 로그인</p>
            <p className="text-xs text-gray-400 mt-1">myctns.com 구성원만 접속 가능합니다</p>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-xl transition-colors text-sm"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                로그인 중...
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                  <rect x="0" y="0" width="10" height="10" fill="#F25022"/>
                  <rect x="12" y="0" width="10" height="10" fill="#7FBA00"/>
                  <rect x="0" y="12" width="10" height="10" fill="#00A4EF"/>
                  <rect x="12" y="12" width="10" height="10" fill="#FFB900"/>
                </svg>
                Microsoft 계정으로 로그인
              </>
            )}
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-100"/>
            <span className="text-[11px] text-gray-400">Microsoft Entra ID</span>
            <div className="flex-1 h-px bg-gray-100"/>
          </div>

          <div className="flex flex-col gap-1.5 text-[11px] text-gray-400">
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
              조직 계정 SSO 로그인
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
              최초 로그인 시 자동 계정 생성
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
              별도 비밀번호 불필요
            </div>
          </div>
        </div>

        <p className="text-[11px] text-gray-400 text-center">
          문의: IT 담당자 또는 시스템 관리자
        </p>
      </div>
    </div>
  )
}

export default function LoginPageWrapper() {
  return (
    <Suspense>
      <LoginPage />
    </Suspense>
  )
}
