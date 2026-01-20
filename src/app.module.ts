import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { RunsModule } from './runs/runs.module';
import { AuthModule } from './auth/auth.module';
import { BattlesModule } from './battles/battles.module';
import { WeeklyBattlesModule } from './weekly-battles/weekly-battles.module';

@Module({
  imports: [PrismaModule, UsersModule, RunsModule, AuthModule, BattlesModule, WeeklyBattlesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
