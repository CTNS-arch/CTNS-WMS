'use client'

import { useState, useRef, useEffect } from 'react'
import { PALETTE, SelectOption } from '@/lib/select-options'

interface Props {
  value: string[]
  onChange: (value: string[]) => void
  options: SelectOption[]
  onAdd: (label: string) => void
  placeholder?: string
}

export function TagMultiSelect({ value, onChange, options, onAdd, placeholder = '선택' }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const toggle = (val: string) => {
    onChange(value.includes(val) ? value.filter(v => v !== val) : [...value, val])
  }

  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
  const canCreate = search.trim() && !options.find(o => o.label.toLowerCase() === search.trim().toLowerCase())

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full min-h-9 px-3 py-1.5 text-sm border rounded-md bg-white flex flex-wrap items-center gap-1 hover:bg-gray-50 transition-colors"
      >
        {value.length === 0 ? (
          <span className="text-gray-400">{placeholder}</span>
        ) : (
          value.map(v => {
            const opt = options.find(o => o.value === v)
            if (!opt) return null
            const c = PALETTE[opt.colorIndex % PALETTE.length]
            return (
              <span key={v} className={`px-2 py-0.5 rounded text-xs font-medium ${c.bg} ${c.text}`}>
                {opt.label}
              </span>
            )
          })
        )}
        <svg className="ml-auto w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-[100] w-full min-w-[220px] bg-white border rounded-lg shadow-xl">
          <div className="px-3 py-2 border-b">
            <input
              ref={inputRef}
              className="w-full text-sm outline-none placeholder:text-gray-400"
              placeholder="검색 또는 추가..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.map(opt => {
              const c = PALETTE[opt.colorIndex % PALETTE.length]
              const checked = value.includes(opt.value)
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggle(opt.value)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50"
                >
                  <span className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center ${checked ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                    {checked && (
                      <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.bg} ${c.text}`}>{opt.label}</span>
                </button>
              )
            })}
            {filtered.length === 0 && !canCreate && (
              <p className="px-3 py-2 text-xs text-gray-400">결과 없음</p>
            )}
          </div>
          {canCreate && (
            <div className="border-t px-3 py-2">
              <button
                type="button"
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
      )}
    </div>
  )
}
