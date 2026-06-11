import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleName } from '../../database/entities';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ForbiddenAppException } from '../exceptions/app.exception';
import { AuthUser } from '../interfaces/auth-user.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RoleName[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const user: AuthUser = context.switchToHttp().getRequest().user;
    const hasRole = user?.roles?.some((role) => required.includes(role));

    if (!hasRole) {
      throw new ForbiddenAppException();
    }
    return true;
  }
}
