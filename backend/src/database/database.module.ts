import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseConfig } from '../config/configuration';
import { PasswordReset, RefreshToken, Role, Tenant, User } from './entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const db = config.getOrThrow<DatabaseConfig>('database');
        return {
          type: 'mysql',
          host: db.host,
          port: db.port,
          username: db.username,
          password: db.password,
          database: db.database,
          charset: 'utf8mb4_unicode_ci',
          timezone: 'Z',
          entities: [Tenant, User, Role, RefreshToken, PasswordReset],
          synchronize: db.synchronize,
          logging: db.logging,
          extra: { connectionLimit: db.connectionLimit },
        };
      },
    }),
  ],
})
export class DatabaseModule {}
