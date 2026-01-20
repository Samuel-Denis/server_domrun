import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { WeeklyRoomService } from './weekly-room.service';
import { WeeklyClosureService } from './weekly-closure.service';
import { ChampionRunService } from './champion-run.service';

/**
 * Serviço de agendamento (Cron) para tarefas semanais
 * 
 * Executa automaticamente:
 * - Segunda-feira 00:00: Fecha semana anterior e cria novas salas
 * 
 * PROTEÇÃO CONTRA EXECUÇÃO DUPLICADA:
 * Usa PostgreSQL Advisory Locks para garantir que apenas uma instância execute cada job,
 * mesmo em ambientes com múltiplas instâncias do servidor (load balancer, replicação, etc).
 */
@Injectable()
export class WeeklySchedulerService {
  private readonly logger = new Logger(WeeklySchedulerService.name);

  // IDs únicos para advisory locks (evitar conflitos com outros locks)
  private readonly LOCK_ID_WEEKLY_CLOSURE = 1001;
  private readonly LOCK_ID_CREATE_ROOMS = 1002;

  constructor(
    private readonly prisma: PrismaService,
    private readonly weeklyRoomService: WeeklyRoomService,
    private readonly weeklyClosureService: WeeklyClosureService,
    private readonly championRunService: ChampionRunService,
  ) {}

  /**
   * Adquire um advisory lock do PostgreSQL
   * 
   * Advisory locks são locks de aplicação que garantem exclusividade entre instâncias.
   * Se outra instância já possui o lock, retorna false (não bloqueia).
   * 
   * @param lockId - ID único do lock (deve ser diferente para cada job)
   * @returns true se conseguiu adquirir o lock, false se outra instância já possui
   */
  private async acquireAdvisoryLock(lockId: number): Promise<boolean> {
    try {
      // pg_try_advisory_lock retorna true se conseguiu adquirir, false se já está lockeado
      const result = await this.prisma.$queryRaw<Array<{ pg_try_advisory_lock: boolean }>>(
        Prisma.sql`SELECT pg_try_advisory_lock(${lockId}) as pg_try_advisory_lock`
      );
      
      return result[0]?.pg_try_advisory_lock ?? false;
    } catch (error: any) {
      this.logger.error(`Erro ao adquirir advisory lock ${lockId}:`, error.message);
      return false;
    }
  }

  /**
   * Libera um advisory lock do PostgreSQL
   * 
   * IMPORTANTE: Sempre deve ser chamado no finally para garantir liberação mesmo em caso de erro.
   * 
   * @param lockId - ID único do lock
   */
  private async releaseAdvisoryLock(lockId: number): Promise<void> {
    try {
      await this.prisma.$executeRaw(
        Prisma.sql`SELECT pg_advisory_unlock(${lockId})`
      );
    } catch (error: any) {
      this.logger.error(`Erro ao liberar advisory lock ${lockId}:`, error.message);
      // Não lançar erro - lock será liberado automaticamente quando conexão fechar
    }
  }

  /**
   * Executa um job protegido por advisory lock
   * 
   * Garante que apenas uma instância execute o job, mesmo em múltiplas instâncias do servidor.
   * 
   * @param lockId - ID único do lock
   * @param jobName - Nome do job (para logs)
   * @param jobFunction - Função a ser executada
   */
  private async executeWithLock(
    lockId: number,
    jobName: string,
    jobFunction: () => Promise<void>,
  ): Promise<void> {
    // Tentar adquirir lock
    const lockAcquired = await this.acquireAdvisoryLock(lockId);

    if (!lockAcquired) {
      this.logger.warn(
        `⏭️  Job "${jobName}" já está sendo executado por outra instância. Pulando execução.`
      );
      return;
    }

    this.logger.log(`🔒 Lock adquirido para job "${jobName}". Executando...`);

    try {
      await jobFunction();
      this.logger.log(`✅ Job "${jobName}" concluído com sucesso.`);
    } catch (error: any) {
      this.logger.error(`❌ Erro ao executar job "${jobName}":`, error.message, error.stack);
      throw error; // Re-lançar para que caller possa tratar
    } finally {
      // SEMPRE liberar lock, mesmo em caso de erro
      await this.releaseAdvisoryLock(lockId);
      this.logger.log(`🔓 Lock liberado para job "${jobName}".`);
    }
  }

  /**
   * Executa toda segunda-feira às 00:00
   * 
   * Tarefas:
   * 1. Fechar semana anterior das salas semanais
   * 2. Processar fechamento semanal da Liga Imortal
   * 
   * NOTA: Período de inscrição fica aberto durante toda segunda-feira (00:00 - 23:59)
   * Salas são criadas na terça-feira (job separado)
   * 
   * PROTEÇÃO: Usa advisory lock para evitar execução duplicada em múltiplas instâncias
   */
  @Cron('0 0 * * 1', {
    timeZone: 'America/Sao_Paulo',
    name: 'weekly-closure',
  })
  async handleWeeklyClosure() {
    await this.executeWithLock(
      this.LOCK_ID_WEEKLY_CLOSURE,
      'weekly-closure',
      async () => {
        this.logger.log('🔄 Iniciando fechamento semanal automático...');

        // 1. Fechar salas semanais da semana anterior
        this.logger.log('📋 Fechando salas semanais...');
        await this.weeklyClosureService.closePreviousWeek();

        // 2. Processar Liga Imortal
        this.logger.log('🏆 Processando Liga Imortal...');
        await this.championRunService.processWeeklyClosure();

        this.logger.log('✅ Fechamento semanal concluído. Período de inscrição aberto até 23:59');
      },
    );
  }

  /**
   * Executa toda terça-feira às 00:00
   * 
   * Tarefas:
   * 1. Criar novas salas semanais apenas com usuários inscritos
   * 2. Iniciar período competitivo
   * 
   * PROTEÇÃO: Usa advisory lock para evitar execução duplicada em múltiplas instâncias
   */
  @Cron('0 0 * * 2', {
    timeZone: 'America/Sao_Paulo',
    name: 'create-weekly-rooms',
  })
  async handleCreateWeeklyRooms() {
    await this.executeWithLock(
      this.LOCK_ID_CREATE_ROOMS,
      'create-weekly-rooms',
      async () => {
        this.logger.log('🏠 Iniciando criação de salas semanais...');

        await this.weeklyRoomService.createWeeklyRooms();
        this.logger.log('✅ Salas semanais criadas. Período competitivo iniciado!');
      },
    );
  }

  /**
   * Método manual para executar fechamento (útil para testes)
   */
  async triggerManualClosure() {
    this.logger.log('🔧 Executando fechamento manual...');
    await this.handleWeeklyClosure();
  }
}
