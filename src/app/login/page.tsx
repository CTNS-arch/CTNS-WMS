'use client'

import { signIn } from "next-auth/react"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">CTNS ERP</h1>
          <p className="mt-1 text-sm text-gray-500">배터리팩 제조 ERP 시스템</p>
        </div>

        <button
          onClick={() => signIn("microsoft-entra-id", { callbackUrl: "/items" })}
          className="w-full flex items-center justify-center gap-3 bg-gray-900 hover:bg-gray-800 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 22 22"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <rect x="0" y="0" width="10" height="10" fill="#F25022" />
            <rect x="12" y="0" width="10" height="10" fill="#7FBA00" />
            <rect x="0" y="12" width="10" height="10" fill="#00A4EF" />
            <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
          </svg>
          Microsoft 계정으로 로그인
        </button>
      </div>
    </div>
  )
}
