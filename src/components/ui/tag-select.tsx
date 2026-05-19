'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { PALETTE, SelectOption } from '@/lib/select-options'

interface Props {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  onAdd: (label: string, code?: string) => void
  placeholder?: string
  disabled?: boolean
  portal?: boolean
  size?: 'sm' | 'md'
  minDropdownWidth?: number
  requireCode?: boolean
}

export function TagSelect({
  value, onChange, options, onAdd,
  placeholder = '선택', disabled, portal, size = 'md', minDropdownWidth = 180,
  requireCode = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [codeStep, setCodeStep] = useState(false)
  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState('')
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const codeInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (!containerRef.current?.contains(t) && !dropdownRef.current?.contains(t)) {
        setOpen(false); setSearch(''); setCodeStep(false); setCodeInput(''); setCodeError('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open && !codeStep) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open, codeStep])

  useEffect(() => {
    if (codeStep) setTimeout(() => codeInputRef.current?.focus(), 50)
  }, [codeStep])

  useEffect(() => {
    if (!portal || !open) return
    const close = (e: Event) => {
      if (dropdownRef.current?.contains(e.target as Node)) return
      setOpen(false); setSearch(''); setCodeStep(false); setCodeInput(''); setCodeError('')
    }
    document.addEventListener('scroll', close, true)
    return () => document.removeEventListener('scroll', close, true)
  }, [portal, open])

  const handleToggle = () => {
    if (disabled) return
    if (portal && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 2, left: r.left, width: r.width })
    }
    setOpen(v => !v)
  }

  const handleCreate = () => {
    const label = search.trim()
    const code  = codeInput.trim().toUpperCase()
    if (!label || !code) return
    if (options.some(o => o.code?.toUpperCase() === code)) {
      setCodeError('이미 사용 중인 코드입니다.')
      return
    }
    onAdd(label, code)
    onChange(code)
    setOpen(false); setSearch(''); setCodeStep(false); setCodeInput(''); setCodeError('')
  }

  const handleCreateSimple = () => {
    const label = search.trim()
    onAdd(label, label)
    onChange(label)
    setOpen(false); setSearch('')
  }

  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
  const selected = options.find(o => o.value === value)
  const canCreate = search.trim() && !options.find(o => o.label.toLowerCase() === search.trim().toLowerCase())
  const color = selected ? PALETTE[selected.colorIndex % PALETTE.length] : null

  const btnCls = size === 'sm'
    ? 'w-full min-h-7 px-2 py-0.5 text-xs border rounded-md bg-white flex items-center gap-1.5 overflow-hidden hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
    : 'w-full min-h-9 px-3 py-1.5 text-sm border rounded-md bg-white flex items-center gap-2 overflow-hidden hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

  const dropdown = open ? (
    <div
      ref={dropdownRef}
      className="bg-white border rounded-lg shadow-xl"
      style={portal
        ? { position: 'fixed', top: pos.top, left: pos.left, width: Math.max(pos.width, minDropdownWidth), zIndex: 9999 }
        : { position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 100, width: '100%', minWidth: minDropdownWidth }
      }
    >
      {!codeStep && (
        <>
          <div className="px-3 py-2 border-b">
            <input ref={inputRef} className="w-full text-sm outline-none placeholder:text-gray-400" placeholder="검색 또는 추가..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.map(opt => {
              const c = PALETTE[opt.colorIndex % PALETTE.length]
              return (
                <button key={opt.value} type="button"
                  onClick={() => { onChange(opt.value === value ? '' : opt.value); setOpen(false); setSearch('') }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50"
                >
                  <span className="w-4 shrink-0">
                    {opt.value === value && (
                      <svg className="w-3.5 h-3.5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.bg} ${c.text}`}>
                    {opt.code && opt.code !== opt.label ? `${opt.label}(${opt.code})` : opt.label}
                  </span>
                </button>
              )
            })}
            {filtered.length === 0 && !canCreate && <p className="px-3 py-2 text-xs text-gray-400">결과 없음</p>}
          </div>
          {canCreate && (
            <div className="border-t px-3 py-2">
              <button type="button"
                onClick={() => requireCode ? setCodeStep(true) : handleCreateSimple()}
                className="w-full flex items-center gap-2 text-sm text-left hover:bg-gray-50 px-1 py-1 rounded"
              >
                <span className="text-gray-400 text-xs">만들기</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${PALETTE[options.length % PALETTE.length].bg} ${PALETTE[options.length % PALETTE.length].text}`}>
                  {search.trim()}
                </span>
              </button>
            </div>
          )}
        </>
      )}

      {codeStep && (
        <div className="px-3 py-3 space-y-2.5">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">새 옵션 등록</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-12 shrink-0">표시명</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${PALETTE[options.length % PALETTE.length].bg} ${PALETTE[options.length % PALETTE.length].text}`}>
              {search.trim()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-12 shrink-0">코드</span>
            <input
              ref={codeInputRef}
              value={codeInput}
              onChange={e => { setCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)); setCodeError('') }}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setCodeStep(false); setCodeInput(''); setCodeError('') } }}
              placeholder="2~4자 영문"
              maxLength={4}
              className={`w-20 border rounded px-2 py-1 text-xs font-mono uppercase outline-none focus:ring-1 ${codeError ? 'border-red-400 focus:ring-red-300' : 'focus:ring-blue-400'}`}
            />
            <span className="text-[10px] text-gray-300">영문+숫자</span>
          </div>
          {codeError && (
            <p className="text-[10px] text-red-500 pl-14">{codeError}</p>
          )}
          <div className="flex gap-1.5 justify-end pt-0.5">
            <button type="button"
              onClick={() => { setCodeStep(false); setCodeInput(''); setCodeError('') }}
              className="text-xs px-2.5 py-1 rounded border text-gray-500 hover:bg-gray-50"
            >취소</button>
            <button type="button"
              onClick={handleCreate}
              disabled={codeInput.trim().length < 2}
              className="text-xs px-2.5 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >등록</button>
          </div>
        </div>
      )}
    </div>
  ) : null

  return (
    <div ref={containerRef} className="relative">
      <button ref={btnRef} type="button" disabled={disabled} onClick={handleToggle} className={btnCls}>
        {selected && color ? (
          <span className={`px-2 py-0.5 rounded text-xs font-medium min-w-0 truncate ${color.bg} ${color.text}`}>
            {selected.code && selected.code !== selected.label ? `${selected.label}(${selected.code})` : selected.label}
          </span>
        ) : (
          <span className={`text-gray-400 truncate min-w-0 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>{placeholder}</span>
        )}
        <svg className="ml-auto w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {portal && typeof window !== 'undefined' ? createPortal(dropdown, document.body) : dropdown}
    </div>
  )
}
