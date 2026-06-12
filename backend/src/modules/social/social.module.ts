import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ListeningKeyword, SocialMention } from '../../database/entities';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';

@Module({
  imports: [TypeOrmModule.forFeature([SocialMention, ListeningKeyword])],
  controllers: [SocialController],
  providers: [SocialService],
})
export class SocialModule {}
