import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// SMS로 동기화할 대상 분류 (WMS에서 관리)
const SMS_CATEGORIES = [
  { value: 'PRODUCT',  label: '완제품' },
  { value: 'ASSEMBLY', label: '반제품' },
  { value: 'COMPONENT', label: '자재'  },
]

const SMS_SUB_OPTIONS: Record<string, { value: string; label: string }[]> = {
  PRODUCT:   [{ value: 'BP', label: '배터리팩' }],
  ASSEMBLY:  [{ value: 'BM', label: 'BMS' }, { value: 'PC', label: 'PCM' }],
  COMPONENT: [{ value: 'CH', label: '충전기' }],
}

// 중분류별 추가 필터 필드 정의
const SMS_EXTRA_FILTERS: Record<string, string[]> = {
  BP: ['chemistryType', 'cellModel', 'circuit', 'packType', 'seriesCount', 'parallelCount', 'layerCount', 'certifications', 'specialOptions', 'vendors'],
  BM: ['manufacturer', 'maxSeriesCount', 'continuousDischargeCurrent', 'certifications', 'specialOptions'],
  PC: ['manufacturer', 'maxSeriesCount', 'continuousDischargeCurrent', 'certifications', 'specialOptions'],
  CH: ['length', 'width', 'height', 'diameter', 'weight', 'material'],
}

const DEFAULT_FIELD_OPTIONS: Record<string, { value: string; label: string }[]> = {
  chemistryType: [
    { value: 'NMC',   label: 'NMC'   },
    { value: 'LFP',   label: 'LFP'   },
    { value: 'NCA',   label: 'NCA'   },
    { value: 'LTO',   label: 'LTO'   },
    { value: 'LMFP',  label: 'LMFP'  },
    { value: 'LMO',   label: 'LMO'   },
    { value: 'LCO',   label: 'LCO'   },
    { value: 'LNMO',  label: 'LNMO'  },
    { value: 'LCP',   label: 'LCP'   },
    { value: 'LI-PO', label: 'LI-PO' },
  ],
  cellModel: [],
  circuit: [
    { value: 'BM', label: 'BMS' },
    { value: 'PC', label: 'PCM' },
  ],
  packType: [
    { value: '소프트팩', label: '소프트팩' },
    { value: '하드팩',   label: '하드팩'   },
  ],
  material: [
    { value: '알루미늄', label: '알루미늄' },
    { value: '플라스틱', label: '플라스틱' },
    { value: '스틸',     label: '스틸'     },
    { value: '고무',     label: '고무'     },
    { value: '실리콘',   label: '실리콘'   },
  ],
}

export async function GET() {
  try {
    // DB에 저장된 사용자 정의 옵션 읽기 (없으면 기본값 사용)
    const storeRow = await prisma.appOption.findUnique({ where: { key: '__store__' } })
    const groupsRow = await prisma.appOption.findUnique({ where: { key: '__groups__' } })
    const opts = (storeRow?.data ?? {}) as Record<string, { value: string; label: string }[]>

    // 셀모델: groups에서 flat 리스트 생성
    const groups = (groupsRow?.data ?? []) as { manufacturer: string; models: { value: string; label: string }[] }[]
    const cellModelOpts = groups.flatMap(g => g.models.map(m => ({ value: m.value, label: m.value })))

    const fieldOptions: Record<string, { value: string; label: string }[]> = {}
    for (const field of Object.keys(DEFAULT_FIELD_OPTIONS)) {
      if (field === 'cellModel') {
        fieldOptions.cellModel = cellModelOpts.length > 0
          ? cellModelOpts
          : (opts.cellModel ?? DEFAULT_FIELD_OPTIONS.cellModel).map(o => ({ value: o.value, label: o.label }))
      } else {
        fieldOptions[field] = (opts[field] ?? DEFAULT_FIELD_OPTIONS[field]).map(o => ({ value: o.value, label: o.label }))
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        categories:       SMS_CATEGORIES,
        subOptions:       SMS_SUB_OPTIONS,
        subExtraFilters:  SMS_EXTRA_FILTERS,
        fieldOptions,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
