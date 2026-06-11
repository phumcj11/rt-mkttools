import { SetMetadata } from '@nestjs/common';

export const AUDIT_SKIP_KEY = 'audit_skip';

export const AuditSkip = () => SetMetadata(AUDIT_SKIP_KEY, true);
