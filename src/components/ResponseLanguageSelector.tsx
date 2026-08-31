import {
  RESPONSE_LANGUAGE_CODES,
  RESPONSE_LANGUAGE_LABELS,
  normalizeLanguageInput,
  type ResponseLanguageCode,
} from '@/ai/response-languages';
import { useTranslation } from 'react-i18next';

interface ResponseLanguageSelectorProps {
  value: ResponseLanguageCode;
  onChange: (code: ResponseLanguageCode) => void;
  helperText?: string;
}

export default function ResponseLanguageSelector({
  value,
  onChange,
  helperText,
}: ResponseLanguageSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <label className="block text-[11px] font-display font-bold uppercase tracking-widest text-outline">
        {t('responseLanguageSelector.fields.language.label')}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(normalizeLanguageInput(e.target.value))}
        className="w-full px-4 py-2.5 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface text-sm"
      >
        {RESPONSE_LANGUAGE_CODES.map((code) => (
          <option key={code} value={code}>
            {RESPONSE_LANGUAGE_LABELS[code]}
          </option>
        ))}
      </select>
      {helperText ? (
        <p className="text-[11px] text-outline leading-relaxed">{helperText}</p>
      ) : null}
    </div>
  );
}
