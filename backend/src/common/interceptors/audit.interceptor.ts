import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { AUDIT_SKIP_KEY } from '../decorators/audit-skip.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthUser } from '../interfaces/auth-user.interface';
import { AuditService } from '../../modules/audit/audit.service';

const MUTATION_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const method = req.method?.toUpperCase() ?? 'GET';

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const skip = this.reflector.getAllAndOverride<boolean>(AUDIT_SKIP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!MUTATION_METHODS.has(method) || isPublic || skip) {
      return next.handle();
    }

    const user = req.user as AuthUser | undefined;
    if (!user?.tenantId) {
      return next.handle();
    }

    const controller = context.getClass().name.replace('Controller', '').toLowerCase();
    const handler = context.getHandler().name;
    const entityId = this.extractEntityId(req);
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      ?? req.ip
      ?? null;

    return next.handle().pipe(
      tap(() => {
        void this.audit.log({
          tenantId: user.tenantId,
          userId: user.id,
          action: `${controller}.${handler}`,
          entity: controller || null,
          entityId,
          metadata: {
            method,
            path: req.path,
            params: req.params,
          },
          ipAddress,
        });
      }),
    );
  }

  private extractEntityId(req: Request): number | null {
    const raw = req.params?.id ?? req.params?.invoiceId;
    if (raw === undefined) return null;
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
  }
}
