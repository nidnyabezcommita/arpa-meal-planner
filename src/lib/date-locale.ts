import { enUS, ru } from 'date-fns/locale';

export function dateLocaleFor(language: string | undefined) {
  return language?.toLowerCase().startsWith('ru') ? ru : enUS;
}
