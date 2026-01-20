import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Configurar arquivos estáticos para servir uploads
  // Usar process.cwd() para funcionar tanto em dev quanto em produção
  const uploadsPath = join(process.cwd(), 'uploads');
  app.useStaticAssets(uploadsPath, {
    prefix: '/uploads/',
  });

  // Habilitar CORS para permitir conexões do celular
  app.enableCors({
    origin: true, // Permite todas as origens (para desenvolvimento)
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

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
