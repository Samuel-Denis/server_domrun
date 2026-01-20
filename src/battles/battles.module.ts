import { Module, forwardRef } from '@nestjs/common';
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
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'seu-secret-key-aqui-mude-em-producao',
      signOptions: { expiresIn: '7d' },
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
