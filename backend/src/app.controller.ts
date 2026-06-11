import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly config: ConfigService) {}

  @Public()
  @Get('health')
  health() {
    return {
      status: 'ok',
      name: this.config.get<string>('app.name'),
      env: this.config.get<string>('app.env'),
      time: new Date().toISOString(),
    };
  }
}
