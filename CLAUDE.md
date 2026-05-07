# CLAUDE.md — CTNS ERP

## 언어규칙
모든 응답, 결과값, 설명은 반드시 한국어로 작성한다.

## 프로젝트 개요
CTNS 배터리팩 제조사 내부 ERP 시스템.
기능: 품목관리(BOM 포함), 재고관리(연구소/생산구매팀), 구매요청.

## 기술스택
- **Next.js 16.2.4** (App Router, Turbopack) — middleware.ts → proxy.ts로 대체됨
- **Prisma 7.8.0** + Neon PostgreSQL (serverless HTTP)
- **NextAuth v5 beta** — Microsoft Entra ID (AZURE_AD_CLIENT_ID 없으면 자동 우회)
- **@base-ui/react** — Select onValueChange 타입: (val: string | null) => void
- **Vercel** 배포 (GitHub: CTNS-arch/CT-WMS, main 브랜치 push → 자동 재배포)

## Prisma 7 핵심 규칙
- schema.prisma datasource에 url 없음 → prisma.config.ts에서 관리
- prisma.config.ts: defineConfig({ datasource: { url: process.env.DATABASE_URL } })
- Prisma CLI는 .env.local 자동로드 안 함 → prisma.config.ts에 loadEnv() 직접 구현
- PrismaNeonHttp 생성자: new PrismaNeonHttp(url, {}) (인자 2개 필수, 1개만 넣으면 빌드 오류)
- transaction 타입: type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
- import { Prisma } from @prisma/client 불가 — Prisma 7에서 namespace export 제거됨

## DB 변경 절차
  npx prisma db push [--accept-data-loss]
  npx prisma generate
  (개발 서버 재시작: 포트 3000 프로세스 종료 후 npm run dev)
새 필수 컬럼 추가 시: @default("") 임시 추가 → push → default 제거 → push 재실행

## 주요 경로
- src/app/api/          — API 라우트
- src/app/(pages)/      — 페이지
- src/lib/prisma.ts     — Prisma 클라이언트 (PrismaNeonHttp 어댑터)
- prisma/schema.prisma  — DB 스키마
- prisma.config.ts      — Prisma CLI 환경변수 설정
