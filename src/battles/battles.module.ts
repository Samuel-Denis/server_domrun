import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BattlesController } from './battles.controller';
import { BattleService } from './services/battle.service';
import { BattleScoreService } from './services/battle-score.service';
import { TrophyService } from './services/trophy.service';
import { LeagueService } from './services/league.service';
import { AntiCheatService } from './services/anti-cheat.service';
import { BattleGateway } from './gateway/battle.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => UsersModule), // Para usar XpService
    // JwtModule configurado via ConfigService (sem fallbacks hardcoded)
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        // JWT_SECRET é obrigatório e já validado na etapa anterior (env.validation.ts)
        const jwtSecret = configService.get<string>('JWT_SECRET');
        if (!jwtSecret) {
          throw new Error('JWT_SECRET não encontrado. Verifique a configuração do ConfigModule.');
        }
        return {
          secret: jwtSecret,
          signOptions: { expiresIn: '7d' },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [BattlesController],
  providers: [
    BattleService,
    BattleScoreService,
    TrophyService,
    LeagueService,
    AntiCheatService,
    BattleGateway,
  ],
  exports: [BattleService, LeagueService, TrophyService, BattleGateway],
})
export class BattlesModule {}
