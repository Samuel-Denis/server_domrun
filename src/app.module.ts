import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { RunsModule } from './runs/runs.module';
import { AuthModule } from './auth/auth.module';
import { BattlesModule } from './battles/battles.module';
import { WeeklyBattlesModule } from './weekly-battles/weekly-battles.module';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    // ConfigModule global com validação de variáveis de ambiente
    ConfigModule.forRoot({
      isGlobal: true, // Torna o ConfigModule disponível em todos os módulos
      validate: validateEnv, // Validação automática ao iniciar
      envFilePath: ['.env'], // Arquivo .env na raiz do projeto
      cache: true, // Cache das variáveis para melhor performance
    }),
    PrismaModule,
    UsersModule,
    RunsModule,
    AuthModule,
    BattlesModule,
    WeeklyBattlesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
