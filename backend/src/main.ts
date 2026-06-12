import * as path from 'path';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  const appConfig = config.getOrThrow<AppConfig>('app');

  // Poster uploads send base64 PNG in JSON — default 100kb limit is too small
  app.useBodyParser('json', { limit: '15mb' });
  app.useBodyParser('urlencoded', { limit: '15mb', extended: true });

  // Serve uploaded media files
  app.useStaticAssets(path.join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  app.use(helmet());
  app.setGlobalPrefix(appConfig.apiPrefix);
  app.enableCors({
    origin: appConfig.corsOrigins,
    credentials: true,
  });
  app.enableShutdownHooks();

  await app.listen(appConfig.port);

  const logger = new Logger('Bootstrap');
  logger.log(`🚀 ${appConfig.name} พร้อมใช้งานที่ http://localhost:${appConfig.port}/${appConfig.apiPrefix}`);
}

bootstrap();
