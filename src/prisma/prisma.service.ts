import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

/**
 * PrismaService padronizado:
 * - Este service *é* o PrismaClient (não usa mais `this.client`)
 * - Mantém o adapter PG (Prisma 7) com Pool do `pg`
 *
 * Isso simplifica o uso do Prisma em todo o projeto:
 *   antes: this.prisma.client.user.findUnique(...)
 *   depois: this.prisma.user.findUnique(...)
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('❌ DATABASE_URL não está definida no .env');
    }

    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    // Evite logar segredos aqui.
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
