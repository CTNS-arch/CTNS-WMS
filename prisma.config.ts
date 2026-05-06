import { defineConfig } from 'prisma/config'
import { readFileSync } from 'fs'
import { join } from 'path'

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    try {
      const content = readFileSync(join(process.cwd(), file), 'utf-8')
      for (const line of content.split('\n')) {
        const match = line.match(/^([^#=]+)=(.*)$/)
        if (match) {
          const key = match[1].trim()
          const val = match[2].trim().replace(/^["']|["']$/g, '')
          if (!process.env[key]) process.env[key] = val
        }
      }
    } catch {}
  }
}

loadEnv()

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
})
