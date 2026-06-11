import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import en from './en.json';
import th from './th.json';

type Catalog = Record<string, unknown>;

const CATALOGS: Record<string, Catalog> = { th, en };

@Injectable()
export class I18nService {
  private readonly defaultLocale: string;
  private readonly supported: string[];

  constructor(private readonly config: ConfigService) {
    this.defaultLocale = this.config.get<string>('app.defaultLocale') ?? 'th';
    this.supported = this.config.get<string[]>('app.supportedLocales') ?? ['th', 'en'];
  }

  resolveLocale(locale?: string): string {
    if (locale && this.supported.includes(locale)) return locale;
    return this.defaultLocale;
  }

  /**
   * แปลข้อความจาก key แบบ namespaced เช่น "auth.invalidCredentials"
   * ถ้าไม่พบจะคืน key เดิม
   */
  translate(key: string, locale?: string): string {
    const lang = this.resolveLocale(locale);
    const fromLang = this.lookup(CATALOGS[lang], key);
    if (fromLang !== undefined) return fromLang;

    const fromDefault = this.lookup(CATALOGS[this.defaultLocale], key);
    return fromDefault ?? key;
  }

  private lookup(catalog: Catalog | undefined, key: string): string | undefined {
    if (!catalog) return undefined;
    const value = key.split('.').reduce<unknown>((acc, part) => {
      if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[part];
      }
      return undefined;
    }, catalog);
    return typeof value === 'string' ? value : undefined;
  }
}
