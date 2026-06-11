import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * ข้อยกเว้นของระบบที่พก i18n key (code) เพื่อให้ filter แปลข้อความตาม locale
 */
export class AppException extends HttpException {
  constructor(
    public readonly code: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super(code, status);
  }
}

export class UnauthorizedAppException extends AppException {
  constructor(code = 'auth.unauthorized') {
    super(code, HttpStatus.UNAUTHORIZED);
  }
}

export class ForbiddenAppException extends AppException {
  constructor(code = 'auth.forbidden') {
    super(code, HttpStatus.FORBIDDEN);
  }
}

export class NotFoundAppException extends AppException {
  constructor(code = 'common.notFound') {
    super(code, HttpStatus.NOT_FOUND);
  }
}

export class ConflictAppException extends AppException {
  constructor(code: string) {
    super(code, HttpStatus.CONFLICT);
  }
}
