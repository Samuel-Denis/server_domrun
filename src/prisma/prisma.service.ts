import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
    // 1. Declaramos a propriedade 'client' para que ela exista na instância da classe
    public client: PrismaClient;

    constructor() {
        const connectionString = process.env.DATABASE_URL;

        console.log(connectionString)
        // 2. A lógica de validação deve estar dentro do construtor
        if (!connectionString) {
            throw new Error("❌ DATABASE_URL não está definida no .env");
        }

        // 3. Driver nativo do Postgres (Configuração do Pool)
        const pool = new Pool({
            connectionString,
        });

        // 4. Criação do Adapter para o Prisma 7
        const adapter = new PrismaPg(pool);

        // 5. Instanciamos o PrismaClient e atribuímos à propriedade da classe 'this.client'
        this.client = new PrismaClient({
            adapter,
        });
    }

    async onModuleInit() {
        // 6. Chamamos o connect através do this.client que foi instanciado no constructor
        await this.client.$connect();
        console.log('✅ Banco de dados conectado com sucesso via Adapter!');
    }

    async onModuleDestroy() {
        // 7. Garante o fechamento limpo da conexão ao desligar o servidor
        await this.client.$disconnect();
    }
}