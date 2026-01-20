import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class RefreshTokenService {
  constructor(private prisma: PrismaService) {}

  async generateRefreshToken(userId: string): Promise<string> {
    // Gerar um token aleatório seguro
    const token = crypto.randomBytes(32).toString('hex');
    
    // Definir expiração para 30 dias
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.prisma.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    });

    return token;
  }

  async validateRefreshToken(token: string): Promise<any> {
    const refreshToken = await this.prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!refreshToken) {
      return null;
    }

    // Verificar se o token expirou
    if (new Date() > refreshToken.expiresAt) {
      await this.deleteRefreshToken(token);
      return null;
    }

    return refreshToken;
  }

  async deleteRefreshToken(token: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { token },
    });
  }

  async deleteAllUserRefreshTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  async deleteExpiredTokens(): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
  }
}
