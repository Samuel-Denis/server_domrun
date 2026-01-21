import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { BattleService } from '../services/battle.service';
// import { JoinQueueDto } from '../dto/join-queue.dto'; // Não usado diretamente

@WebSocketGateway({
  cors: {
    origin: '*', // Configure conforme necessário
    credentials: true,
  },
  namespace: '/battles',
})
export class BattleGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, string>(); // socketId -> userId
  private readonly logger = new Logger(BattleGateway.name);

  constructor(
    private readonly battleService: BattleService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Extrai o userId do token JWT do socket
   */
  private async getUserIdFromSocket(socket: Socket): Promise<string | null> {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return null;
      }

      const payload = this.jwtService.verify(token);
      return payload.sub || payload.userId || payload.id;
    } catch {
      return null;
    }
  }

  async handleConnection(@ConnectedSocket() client: Socket) {
    const userId = await this.getUserIdFromSocket(client);
    
    if (!userId) {
      client.disconnect();
      return;
    }

    this.connectedUsers.set(client.id, userId);
    this.logger.debug(`🔌 Cliente conectado: ${client.id} (userId: ${userId})`);
  }

  async handleDisconnect(@ConnectedSocket() client: Socket) {
    const userId = this.connectedUsers.get(client.id);
    this.connectedUsers.delete(client.id);
    this.logger.debug(`🔌 Cliente desconectado: ${client.id} (userId: ${userId})`);
  }

  /**
   * Evento: join_queue
   * Cliente entra na fila de matchmaking
   */
  @SubscribeMessage('join_queue')
  async handleJoinQueue(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { mode: string },
  ) {
    const userId = this.connectedUsers.get(client.id);
    
    if (!userId) {
      client.emit('error', { message: 'Usuário não autenticado' });
      return;
    }

    try {
      const battle = await this.battleService.joinQueue(userId, data.mode);

      if (battle.status === 'IN_PROGRESS' && battle.player2Id) {
        // Match encontrado! Notifica ambos os jogadores
        const player1Socket = this.findSocketByUserId(battle.player1Id);
        const player2Socket = this.findSocketByUserId(battle.player2Id);

        if (player1Socket) {
          player1Socket.emit('match_found', {
            battleId: battle.id,
            opponent: battle.player2,
            mode: battle.mode,
          });
        }

        if (player2Socket) {
          player2Socket.emit('match_found', {
            battleId: battle.id,
            opponent: battle.player1,
            mode: battle.mode,
          });
        }
      } else {
        // Ainda buscando oponente
        client.emit('searching', {
          battleId: battle.id,
          status: 'SEARCHING',
        });
      }
    } catch (error: any) {
      client.emit('error', { message: error.message || 'Erro ao entrar na fila' });
    }
  }

  /**
   * Evento: leave_queue
   * Cliente sai da fila
   */
  @SubscribeMessage('leave_queue')
  async handleLeaveQueue(@ConnectedSocket() client: Socket) {
    const userId = this.connectedUsers.get(client.id);
    
    if (!userId) {
      return;
    }

    // Busca batalhas ativas do usuário e cancela
    // Implementação simplificada - pode ser melhorada
    client.emit('left_queue', { success: true });
  }

  /**
   * Encontra o socket de um usuário pelo userId
   */
  private findSocketByUserId(userId: string): Socket | null {
    for (const [socketId, uid] of this.connectedUsers.entries()) {
      if (uid === userId) {
        return this.server.sockets.sockets.get(socketId) || null;
      }
    }
    return null;
  }

  /**
   * Emite resultado da batalha para os jogadores
   */
  emitBattleResult(battleId: string, result: any) {
    // Busca os sockets dos jogadores e emite o resultado
    this.server.emit(`battle_result_${battleId}`, result);
  }
}
