import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  BadRequestException,
  ForbiddenException,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { AchievementsService } from './achievements.service';
import { StatsService } from './stats.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SyncAchievementProgressDto } from './dto/sync-achievement-progress.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly achievementsService: AchievementsService,
    private readonly statsService: StatsService,
  ) { }

  @UseGuards(JwtAuthGuard)
  @Get('profile/stats')
  async getUserStats(@CurrentUser() user: any) {
    return this.statsService.calculateUserStats(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile/complete')
  async getCompleteProfile(@CurrentUser() user: any) {
    return this.usersService.getUserByIdComplete(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile/runs')
  async getUserRuns(
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // TODO: Implementar filtros por data se necessário
    return this.usersService.getUserRuns(
      user.id,
      limit ? parseInt(limit) : 20,
      offset ? parseInt(offset) : 0,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/achievements')
  async getMyAchievements(@CurrentUser() user: any) {
    // Endpoint leve: retorna apenas IDs e progresso (conquistas vêm do cq.json do frontend)
    const achievements = await this.achievementsService.getUserAchievementsLight(user.id);
    return { achievements };
  }

  @UseGuards(JwtAuthGuard)
  @Post('achievements/progress/sync')
  async syncAchievementProgress(
    @CurrentUser() user: any,
    @Body() syncDto: SyncAchievementProgressDto,
  ) {
    return this.achievementsService.syncAchievementProgress(
      syncDto.userId,
      user.id,
      syncDto.progress,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':userId/achievements/progress')
  async getUserAchievementProgress(
    @Param('userId') userId: string,
    @CurrentUser() user: any,
  ) {
    // Verificar se pode acessar (próprio usuário)
    if (userId !== user.id) {
      throw new ForbiddenException('Você não tem permissão para ver esse progresso');
    }
    return this.achievementsService.getUserAchievementProgress(userId);
  }



  @UseGuards(JwtAuthGuard)
  @Put('profile')
  @UseInterceptors(FileInterceptor('photo'))
  async updateProfile(
    @CurrentUser() user: any,
    @Body() body: any,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: false,
        //validators: [
        // new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
        // new FileTypeValidator({ fileType: /(jpg|jpeg|png|gif|webp)$/ }),
        // ],
      }),
    )
    file?: Express.Multer.File,
  ) {
    // Converter e validar o body (quando vem como FormData, pode precisar de parse)
    const updateProfileDto = plainToInstance(UpdateProfileDto, body);

    // Se biography vier como string "null" ou vazio, tratar como null
    if (updateProfileDto.biography === 'null' || updateProfileDto.biography === '') {
      updateProfileDto.biography = null;
    }

    const errors = await validate(updateProfileDto);
    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }

    return this.usersService.updateProfile(user.id, updateProfileDto, file);
  }

  @Get('ranking/trophies')
  async getTrophyRanking(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    if (limitNum < 1 || limitNum > 100) {
      throw new BadRequestException('Limit deve estar entre 1 e 100');
    }
    return this.usersService.getTrophyRanking(limitNum);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.usersService.getPublicUserById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(+id, updateUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(+id);
  }
}
