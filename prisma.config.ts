import path from 'path'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  earlyAccess: true,
  schema: path.join('prisma', 'schema.prisma'),
  migrate: {
    adapter: async () => {
      const { PrismaPg } = await import('@prisma/adapter-pg')
      return new PrismaPg({
        connectionString: 'postgresql://bolao:bolao123@localhost:5432/bolao_copa'
      })
    }
  },
  datasource: {
    url: 'postgresql://bolao:bolao123@localhost:5432/bolao_copa'
  }
})