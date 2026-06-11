import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // จับทุก path ยกเว้น api, ไฟล์ static และ internal ของ Next
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
