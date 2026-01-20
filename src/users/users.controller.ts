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

  /**
   * Busca runs do usuário autenticado
   * 
   * Suporta dois modos de paginação:
   * - Cursor-based (recomendado): use ?take=20&cursor=<id>
   * - Offset-based (legacy): use ?limit=20&offset=0
   * 
   * @param user - Usuário autenticado
   * @param take - Número de itens por página (cursor-based)
   * @param cursor - ID da última run da página anterior (cursor-based)
   * @param limit - Número de itens por página (offset-based, legacy)
   * @param offset - Número de itens a pular (offset-based, legacy)
   */
  @UseGuards(JwtAuthGuard)
  @Get('profile/runs')
  async getUserRuns(
    @CurrentUser() user: any,
    @Query('take') take?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    // Se cursor ou take estão presentes, usar cursor-based
    if (cursor !== undefined || take !== undefined) {
      const takeNum = take ? parseInt(take, 10) : 20;
      if (takeNum < 1 || takeNum > 100) {
        throw new BadRequestException('take deve estar entre 1 e 100');
      }
      return this.usersService.getUserRunsCursorBased(user.id, takeNum, cursor);
    }

    // Caso contrário, usar offset-based (legacy para compatibilidade)
    return this.usersService.getUserRuns(
      user.id,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  /**
   * Busca territórios do usuário autenticado com paginação cursor-based
   * 
   * @param user - Usuário autenticado
   * @param take - Número de itens por página (padrão: 20, máximo: 100)
   * @param cursor - ID do último território da página anterior
   * @param simplify - Tolerância de simplificação em metros (opcional). Reduz pontos da geometria mantendo forma.
   *                   Recomendado: 5-20 metros. Quanto maior, menos pontos (menor payload).
   */
  @UseGuards(JwtAuthGuard)
  @Get('profile/territories')
  async getUserTerritories(
    @CurrentUser() user: any,
    @Query('take') take?: string,
    @Query('cursor') cursor?: string,
    @Query('simplify') simplify?: string,
  ) {
    const takeNum = take ? parseInt(take, 10) : 20;
    if (takeNum < 1 || takeNum > 100) {
      throw new BadRequestException('take deve estar entre 1 e 100');
    }
    const simplifyTolerance = simplify ? parseFloat(simplify) : undefined;
    if (simplifyTolerance !== undefined && (isNaN(simplifyTolerance) || simplifyTolerance < 0)) {
      throw new BadRequestException('simplify deve ser um número positivo (tolerância em metros)');
    }
    return this.usersService.getUserTerritoriesCursorBased(user.id, takeNum, cursor, simplifyTolerance);
  }

  /**
   * Busca conquistas do usuário autenticado
   * 
   * Suporta dois modos:
   * - Cursor-based (recomendado): use ?take=20&cursor=<id>
   * - Completo (legacy): sem parâmetros, retorna todas as conquistas
   * 
   * @param user - Usuário autenticado
   * @param take - Número de itens por página (cursor-based)
   * @param cursor - ID da última conquista da página anterior (cursor-based)
   */
  @UseGuards(JwtAuthGuard)
  @Get('me/achievements')
  async getMyAchievements(
    @CurrentUser() user: any,
    @Query('take') take?: string,
    @Query('cursor') cursor?: string,
  ) {
    // Se cursor ou take estão presentes, usar cursor-based
    if (cursor !== undefined || take !== undefined) {
      const takeNum = take ? parseInt(take, 10) : 20;
      if (takeNum < 1 || takeNum > 100) {
        throw new BadRequestException('take deve estar entre 1 e 100');
      }
      return this.achievementsService.getUserAchievementsCursorBased(user.id, takeNum, cursor);
    }

    // Caso contrário, retornar todas as conquistas (legacy para compatibilidade)
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

  /**
   * Busca perfil público de um usuário
   * 
   * Por padrão retorna apenas dados básicos (otimizado):
   * - Informações do usuário (nome, foto, nível, etc)
   * - Contagens (territoriesCount, runsCount, achievementsCount)
   * - Estatísticas básicas (trophies, xp, totalTerritoryAreaM2)
   * 
   * Use ?full=true para obter dados completos:
   * - territories: array completo com geometryGeoJson (GeoJSON Polygon)
   * - runs: últimas 10 corridas
   * - achievements: array completo de conquistas
   * 
   * Use ?simplify=<metros> para simplificar geometria dos territórios (reduz payload).
   * Recomendado: 5-20 metros. Exemplo: ?full=true&simplify=10
   * 
   * @param id - ID do usuário
   * @param full - Se true, retorna dados completos (runs, territories, achievements)
   * @param simplify - Tolerância de simplificação em metros (opcional, apenas quando full=true)
   */
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Query('full') full?: string,
    @Query('simplify') simplify?: string,
  ) {
    const includeFull = full === 'true' || full === '1';
    const simplifyTolerance = simplify ? parseFloat(simplify) : undefined;
    if (simplifyTolerance !== undefined && (isNaN(simplifyTolerance) || simplifyTolerance < 0)) {
      throw new BadRequestException('simplify deve ser um número positivo (tolerância em metros)');
    }
    return this.usersService.getPublicUserById(id, includeFull, simplifyTolerance);
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
