import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nService } from '../../i18n/i18n.service';
import { AppException } from '../exceptions/app.exception';

const STATUS_CODE_MAP: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'common.validationFailed',
  [HttpStatus.UNAUTHORIZED]: 'auth.unauthorized',
  [HttpStatus.FORBIDDEN]: 'auth.forbidden',
  [HttpStatus.NOT_FOUND]: 'common.notFound',
  [HttpStatus.TOO_MANY_REQUESTS]: 'common.rateLimited',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'common.serverError',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly i18n: I18nService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const locale = this.resolveLocale(request);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'common.serverError';
    let details: unknown;
    let customMessage: string | undefined;

    if (exception instanceof AppException) {
      status = exception.getStatus();
      code = exception.code;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      code = STATUS_CODE_MAP[status] ?? 'common.serverError';
      if (typeof res === 'string') {
        customMessage = res;
      } else if (typeof res === 'object' && res !== null && 'message' in res) {
        const message = (res as { message: unknown }).message;
        if (typeof message === 'string') customMessage = message;
        if (Array.isArray(message)) details = message;
      }
    } else {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    const body: Record<string, unknown> = {
      success: false,
      error: {
        code,
        message: customMessage ?? this.i18n.translate(code, locale),
      },
    };
    if (details) (body.error as Record<string, unknown>).details = details;

    response.status(status).json(body);
  }

  private resolveLocale(request: Request): string {
    const headerLocale =
      (request.headers['x-locale'] as string) ||
      (request.headers['accept-language'] as string)?.split(',')[0]?.split('-')[0];
    const userLocale = (request as any).user?.locale;
    return this.i18n.resolveLocale(userLocale || headerLocale);
  }
}
