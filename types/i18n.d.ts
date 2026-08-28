import 'i18next';
import { defaultNS, resources } from '@/i18n/i18n';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    returnNull: false;
    resources: (typeof resources)['en'];
  }
}
