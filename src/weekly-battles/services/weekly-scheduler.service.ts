import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WeeklyRoomService } from './weekly-room.service';
import { WeeklyClosureService } from './weekly-closure.service';
import { ChampionRunService } from './champion-run.service';

/**
 * Serviço de agendamento (Cron) para tarefas semanais
 * 
 * Executa automaticamente:
 * - Segunda-feira 00:00: Fecha semana anterior e cria novas salas
 */
@Injectable()
export class WeeklySchedulerService {
  private readonly logger = new Logger(WeeklySchedulerService.name);

  constructor(
    private readonly weeklyRoomService: WeeklyRoomService,
    private readonly weeklyClosureService: WeeklyClosureService,
    private readonly championRunService: ChampionRunService,
  ) {}

  /**
   * Executa toda segunda-feira às 00:00
   * 
   * Tarefas:
   * 1. Fechar semana anterior das salas semanais
   * 2. Processar fechamento semanal da Liga Imortal
   * 
   * NOTA: Período de inscrição fica aberto durante toda segunda-feira (00:00 - 23:59)
   * Salas são criadas na terça-feira (job separado)
   */
  @Cron('0 0 * * 1', {
    timeZone: 'America/Sao_Paulo',
    name: 'weekly-closure',
  })
  async handleWeeklyClosure() {
    this.logger.log('🔄 Iniciando fechamento semanal automático...');

    try {
      // 1. Fechar salas semanais da semana anterior
      this.logger.log('📋 Fechando salas semanais...');
      await this.weeklyClosureService.closePreviousWeek();

      // 2. Processar Liga Imortal
      this.logger.log('🏆 Processando Liga Imortal...');
      await this.championRunService.processWeeklyClosure();

      this.logger.log('✅ Fechamento semanal concluído. Período de inscrição aberto até 23:59');
    } catch (error: any) {
      this.logger.error('❌ Erro no fechamento semanal:', error.message, error.stack);
    }
  }

  /**
   * Executa toda terça-feira às 00:00
   * 
   * Tarefas:
   * 1. Criar novas salas semanais apenas com usuários inscritos
   * 2. Iniciar período competitivo
   */
  @Cron('0 0 * * 2', {
    timeZone: 'America/Sao_Paulo',
    name: 'create-weekly-rooms',
  })
  async handleCreateWeeklyRooms() {
    this.logger.log('🏠 Iniciando criação de salas semanais...');

    try {
      await this.weeklyRoomService.createWeeklyRooms();
      this.logger.log('✅ Salas semanais criadas. Período competitivo iniciado!');
    } catch (error: any) {
      this.logger.error('❌ Erro ao criar salas semanais:', error.message, error.stack);
    }
  }

  /**
   * Método manual para executar fechamento (útil para testes)
   */
  async triggerManualClosure() {
    this.logger.log('🔧 Executando fechamento manual...');
    await this.handleWeeklyClosure();
  }
}
