import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RefreshTokenService } from './refresh-token.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private refreshTokenService: RefreshTokenService,
  ) { }

  async validateUser(username: string, password: string): Promise<any> {
    const user = await this.usersService.findByUsername(username);
    if (user && (await bcrypt.compare(password, user.password))) {
      const { password: _, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { username: user.username, sub: user.id };

    // Atualizar último login
    await this.usersService.updateLastLogin(user.id);

    // Buscar todos os dados do usuário do banco
    const fullUser = await this.usersService.getUserByIdComplete(user.id);

    // Gerar access token (expira em 7 dias)
    const access_token = this.jwtService.sign(payload);

    // Gerar refresh token (armazenado no banco, expira em 30 dias)
    const refresh_token = await this.refreshTokenService.generateRefreshToken(user.id);
    this.logger.debug(`Login concluido para userId=${user.id}`);

    return {
      access_token,
      refresh_token,
      user: fullUser,
    };
  }

  async refresh(refreshToken: string) {
    const tokenData = await this.refreshTokenService.validateRefreshToken(refreshToken);

    if (!tokenData) {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    const user = tokenData.user;
    const payload = { username: user.username, sub: user.id };

    // Gerar novo access token
    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
    };
  }

  async logout(refreshToken: string) {
    await this.refreshTokenService.deleteRefreshToken(refreshToken);
    return { message: 'Logout realizado com sucesso' };
  }

  async register(registerDto: any) {
    // Verificar se o usuário já existe
    const existingUser = await this.usersService.findByUsername(registerDto.username);
    if (existingUser) {
      throw new ConflictException('Nome de usuário já está em uso');
    }

    const existingEmail = await this.usersService.findByEmail(registerDto.email);
    if (existingEmail) {
      throw new ConflictException('Email já está em uso');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const user = await this.usersService.create({
      ...registerDto,
      password: hashedPassword,
    });
    // const { password: _, ...result } = user;
    const fullUser = await this.login(user);
    return fullUser;
  }
}
