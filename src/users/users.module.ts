import { Module, forwardRef } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UploadService } from './upload.service';
import { StatsService } from './stats.service';
import { AchievementsService } from './achievements.service';
import { XpService } from './xp.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UploadService, StatsService, AchievementsService, XpService],
  exports: [UsersService, StatsService, AchievementsService, XpService, UploadService],
})
export class UsersModule { }
