import { Controller, Post, Get, Body, Param, Query, UseGuards, HttpCode, HttpStatus, Delete } from '@nestjs/common';
import { BattleService } from './services/battle.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JoinQueueDto } from './dto/join-queue.dto';
import { SubmitBattleResultDto } from './dto/submit-battle-result.dto';

@Controller('battles')
export class BattlesController {
  constructor(private readonly battleService: BattleService) {}

  /**
   * Entra na fila de matchmaking
   * POST /battles/queue
   */
  @UseGuards(JwtAuthGuard)
  @Post('queue')
  @HttpCode(HttpStatus.OK)
  async joinQueue(@CurrentUser() user: any, @Body() dto: JoinQueueDto) {
    return this.battleService.joinQueue(user.id, dto.mode);
  }

  /**
   * Submete o resultado de uma batalha
   * POST /battles/submit
   */
  @UseGuards(JwtAuthGuard)
  @Post('submit')
  @HttpCode(HttpStatus.OK)
  async submitBattleResult(@CurrentUser() user: any, @Body() dto: SubmitBattleResultDto) {
    return this.battleService.submitBattleResult(user.id, dto);
  }

  /**
   * Cancela uma batalha (sair da fila)
   * DELETE /battles/:battleId
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':battleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelBattle(@CurrentUser() user: any, @Param('battleId') battleId: string) {
    await this.battleService.cancelBattle(user.id, battleId);
  }

  /**
   * Lista batalhas do usuário
   * GET /battles/history
   */
  @UseGuards(JwtAuthGuard)
  @Get('history')
  async getUserBattles(
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.battleService.getUserBattles(
      user.id,
      limit ? parseInt(limit) : 20,
      offset ? parseInt(offset) : 0,
    );
  }
}
