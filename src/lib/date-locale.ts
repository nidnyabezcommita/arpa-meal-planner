import { enUS, tr } from 'date-fns/locale';

export function dateLocaleFor(language: string | undefined) {
  return language?.toLowerCase().startsWith('tr') ? tr : enUS;
}
