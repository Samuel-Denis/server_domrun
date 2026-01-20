import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WeeklyRoomService } from './services/weekly-room.service';
import { WeeklyRunService } from './services/weekly-run.service';
import { LeagueService } from './services/league.service';
import { ChampionRunService } from './services/champion-run.service';
import { WeeklyEnrollmentService } from './services/weekly-enrollment.service';
import { SubmitWeeklyRunDto } from './dto/submit-weekly-run.dto';

/**
 * Controller para batalhas semanais e ligas
 */
@Controller('weekly-battles')
export class WeeklyBattlesController {
  constructor(
    private readonly weeklyRoomService: WeeklyRoomService,
    private readonly weeklyRunService: WeeklyRunService,
    private readonly leagueService: LeagueService,
    private readonly championRunService: ChampionRunService,
    private readonly enrollmentService: WeeklyEnrollmentService,
  ) {}

  /**
   * GET /weekly-battles/current-room
   * Retorna a sala semanal atual do usuário
   */
  @UseGuards(JwtAuthGuard)
  @Get('current-room')
  async getCurrentRoom(@CurrentUser() user: any) {
    const room = await this.weeklyRoomService.getCurrentRoom(user.id);
    
    if (!room) {
      return {
        message: 'Você não está em uma sala semanal ativa',
        room: null,
      };
    }

    return room;
  }

  /**
   * GET /weekly-battles/rooms/:roomId/ranking
   * Retorna o ranking da sala
   */
  @UseGuards(JwtAuthGuard)
  @Get('rooms/:roomId/ranking')
  async getRoomRanking(@Param('roomId') roomId: string) {
    return this.weeklyRoomService.getRoomRanking(roomId);
  }

  /**
   * POST /weekly-battles/runs
   * Submete uma corrida para a sala semanal
   */
  @UseGuards(JwtAuthGuard)
  @Post('runs')
  @HttpCode(HttpStatus.CREATED)
  async submitRun(@CurrentUser() user: any, @Body() dto: SubmitWeeklyRunDto) {
    return this.weeklyRunService.submitRun(user.id, dto.runId);
  }

  /**
   * GET /weekly-battles/runs
   * Lista corridas submetidas pelo usuário na sala atual
   */
  @UseGuards(JwtAuthGuard)
  @Get('runs')
  async getUserRuns(@CurrentUser() user: any) {
    return this.weeklyRunService.getUserRuns(user.id);
  }

  /**
   * POST /weekly-battles/champion/runs
   * Submete uma corrida para a Liga Imortal
   */
  @UseGuards(JwtAuthGuard)
  @Post('champion/runs')
  @HttpCode(HttpStatus.CREATED)
  async submitChampionRun(@CurrentUser() user: any, @Body() dto: SubmitWeeklyRunDto) {
    return this.championRunService.submitChampionRun(user.id, dto.runId);
  }

  /**
   * POST /weekly-battles/enroll
   * Inscreve o usuário para a próxima semana
   * Disponível apenas durante segunda-feira (00:00 - 23:59)
   */
  @UseGuards(JwtAuthGuard)
  @Post('enroll')
  @HttpCode(HttpStatus.CREATED)
  async enroll(@CurrentUser() user: any) {
    return this.enrollmentService.enrollUser(user.id);
  }

  /**
   * DELETE /weekly-battles/enroll
   * Cancela inscrição do usuário para a próxima semana
   */
  @UseGuards(JwtAuthGuard)
  @Delete('enroll')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unenroll(@CurrentUser() user: any) {
    await this.enrollmentService.unenrollUser(user.id);
  }

  /**
   * GET /weekly-battles/enrollments
   * Lista inscrições do usuário
   */
  @UseGuards(JwtAuthGuard)
  @Get('enrollments')
  async getEnrollments(@CurrentUser() user: any) {
    return this.enrollmentService.getUserEnrollments(user.id);
  }
}

/**
 * Controller para gerenciamento de ligas
 */
@Controller('leagues')
export class LeaguesController {
  constructor(private readonly leagueService: LeagueService) {}

  /**
   * GET /leagues
   * Retorna todas as ligas ordenadas
   */
  @Get()
  async getAllLeagues() {
    return this.leagueService.findAll();
  }

  /**
   * GET /leagues/:code
   * Retorna uma liga específica por código
   */
  @Get(':code')
  async getLeagueByCode(@Param('code') code: string) {
    return this.leagueService.findByCode(code);
  }
}
