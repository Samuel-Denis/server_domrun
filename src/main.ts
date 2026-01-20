import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { AppModule } from './app.module';

/**
 * Parse e valida a variável de ambiente CORS_ORIGINS
 * Formato esperado: "https://app.com,https://admin.app.com" (separado por vírgula)
 * 
 * @param corsOriginsString - String com origins separados por vírgula
 * @returns Array de origins válidos (sem espaços, URLs válidas)
 */
function parseCorsOrigins(corsOriginsString: string | undefined): string[] {
  if (!corsOriginsString || corsOriginsString.trim() === '') {
    return [];
  }

  // Separar por vírgula, remover espaços e filtrar vazios
  const origins = corsOriginsString
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);

  // Validar que cada origin é uma URL válida (http:// ou https://)
  const validOrigins: string[] = [];
  for (const origin of origins) {
    try {
      const url = new URL(origin);
      // Aceitar apenas http:// ou https://
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        validOrigins.push(origin);
      } else {
        console.warn(`⚠️  CORS origin ignorado (protocolo inválido): ${origin}`);
      }
    } catch (error) {
      console.warn(`⚠️  CORS origin ignorado (URL inválida): ${origin}`);
    }
  }

  return validOrigins;
}

/**
 * Configura CORS baseado no ambiente
 * - DEV: permite qualquer origin (flexível para desenvolvimento)
 * - PROD: usa allowlist de CORS_ORIGINS (seguro para produção)
 */
function getCorsConfig(configService: ConfigService) {
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const corsOriginsEnv = configService.get<string>('CORS_ORIGINS');
  const isProduction = nodeEnv === 'production';

  if (isProduction) {
    // PRODUÇÃO: usar allowlist de origins
    const allowedOrigins = parseCorsOrigins(corsOriginsEnv);

    if (allowedOrigins.length === 0) {
      // Se não especificado em produção, permite todas (com aviso)
      // Isso mantém compatibilidade com frontend existente
      console.warn('⚠️  CORS_ORIGINS não definido em produção. Permitindo todas as origins (não recomendado para segurança).');
      return {
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      };
    }

    console.log(`🔒 CORS configurado para produção com ${allowedOrigins.length} origin(s) permitida(s):`);
    allowedOrigins.forEach(origin => console.log(`   - ${origin}`));

    return {
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        // Se não há origin (ex: requisições de mesma origem, Postman, etc), permitir
        if (!origin) {
          return callback(null, true);
        }

        // Verificar se a origin está na allowlist
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        // Origin não permitida
        console.warn(`🚫 CORS bloqueado: origin não permitida: ${origin}`);
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    };
  } else {
    // DESENVOLVIMENTO: permite qualquer origin (flexível)
    console.log('🔓 CORS configurado para desenvolvimento (permitindo todas as origins)');
    return {
      origin: true, // Permite todas as origens
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    };
  }
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Obter ConfigService para acessar variáveis de ambiente
  const configService = app.get(ConfigService);

  // Configurar arquivos estáticos para servir uploads
  // Usar process.cwd() para funcionar tanto em dev quanto em produção
  const uploadsPath = join(process.cwd(), 'uploads');
  app.useStaticAssets(uploadsPath, {
    prefix: '/uploads/',
  });

  // Configurar CORS baseado no ambiente
  const corsConfig = getCorsConfig(configService);
  app.enableCors(corsConfig);

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  const port = process.env.PORT ?? 3000;
  // Escutar em 0.0.0.0 para permitir conexões de qualquer interface de rede
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Servidor rodando em http://0.0.0.0:${port}`);
  console.log(`📱 Para conectar do celular, use o IP da sua máquina na mesma rede`);
}
bootstrap();
