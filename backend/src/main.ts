import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  const appConfig = config.getOrThrow<AppConfig>('app');

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
