'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { PALETTE, SelectOption } from '@/lib/select-options'

interface Props {
  value: string[]
  onChange: (value: string[]) => void
  options: SelectOption[]
  onAdd: (label: string) => void
  placeholder?: string
  portal?: boolean
  size?: 'sm' | 'md'
}

export function TagMultiSelect({
  value, onChange, options, onAdd,
  placeholder = '선택', portal, size = 'md',
}: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (!containerRef.current?.contains(t) && !dropdownRef.current?.contains(t)) {
        setOpen(false); setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  useEffect(() => {
    if (!portal || !open) return
    const close = (e: Event) => {
      if (dropdownRef.current?.contains(e.target as Node)) return
      setOpen(false); setSearch('')
    }
    document.addEventListener('scroll', close, true)
    return () => document.removeEventListener('scroll', close, true)
  }, [portal, open])

  const handleToggle = () => {
    if (portal && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 2, left: r.left, width: r.width })
    }
    setOpen(v => !v)
  }

  const toggle = (val: string) =>
    onChange(value.includes(val) ? value.filter(v => v !== val) : [...value, val])

  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
  const canCreate = search.trim() && !options.find(o => o.label.toLowerCase() === search.trim().toLowerCase())

  const btnCls = size === 'sm'
    ? 'w-full min-h-7 px-2 py-0.5 text-xs border rounded-md bg-white flex flex-wrap items-center gap-1 hover:bg-gray-50 transition-colors'
    : 'w-full min-h-9 px-3 py-1.5 text-sm border rounded-md bg-white flex flex-wrap items-center gap-1 hover:bg-gray-50 transition-colors'

  const dropdown = open ? (
    <div
      ref={dropdownRef}
      className="bg-white border rounded-lg shadow-xl"
      style={portal
        ? { position: 'fixed', top: pos.top, left: pos.left, width: Math.max(pos.width, 220), zIndex: 9999 }
        : { position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 100, width: '100%', minWidth: 220 }
      }
    >
      <div className="px-3 py-2 border-b">
        <input ref={inputRef} className="w-full text-sm outline-none placeholder:text-gray-400" placeholder="검색 또는 추가..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="max-h-56 overflow-y-auto py-1">
        {filtered.map(opt => {
          const c = PALETTE[opt.colorIndex % PALETTE.length]
          const checked = value.includes(opt.value)
          return (
            <button key={opt.value} type="button" onClick={() => toggle(opt.value)} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50">
              <span className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center ${checked ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                {checked && (
                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${c.bg} ${c.text}`}>
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
            onClick={() => { onAdd(search.trim()); toggle(search.trim()); setSearch('') }}
            className="w-full flex items-center gap-2 text-sm text-left hover:bg-gray-50 px-1 py-1 rounded"
          >
            <span className="text-gray-400 text-xs">만들기</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${PALETTE[options.length % PALETTE.length].bg} ${PALETTE[options.length % PALETTE.length].text}`}>
              {search.trim()}
            </span>
          </button>
        </div>
      )}
    </div>
  ) : null

  return (
    <div ref={containerRef} className="relative">
      <button ref={btnRef} type="button" onClick={handleToggle} className={btnCls}>
        {value.length === 0 ? (
          <span className={`text-gray-400 ${size === 'sm' ? 'text-xs' : ''}`}>{placeholder}</span>
        ) : (
          value.map(v => {
            const opt = options.find(o => o.value === v)
            if (!opt) return null
            const c = PALETTE[opt.colorIndex % PALETTE.length]
            return (
              <span key={v} className={`px-2 py-0.5 rounded text-xs font-medium ${c.bg} ${c.text}`}>
                {opt.code && opt.code !== opt.label ? `${opt.label}(${opt.code})` : opt.label}
              </span>
            )
          })
        )}
        <svg className="ml-auto w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {portal && typeof window !== 'undefined' ? createPortal(dropdown, document.body) : dropdown}
    </div>
  )
}
