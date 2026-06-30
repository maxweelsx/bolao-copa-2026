import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const adapter = new PrismaPg({
  connectionString: 'postgresql://bolao:bolao123@localhost:5432/bolao_copa'
})

export const prisma = new PrismaClient({ adapter })