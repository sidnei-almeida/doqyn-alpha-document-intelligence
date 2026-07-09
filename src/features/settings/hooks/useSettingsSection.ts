import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DEFAULT_SETTINGS_SECTION,
  parseSettingsSection,
  type SettingsSectionId,
} from '../settingsSections';

export function useSettingsSection() {
  const [searchParams, setSearchParams] = useSearchParams();

  const section = parseSettingsSection(searchParams.get('section'));

  const setSection = useCallback(
    (next: SettingsSectionId) => {
      setSearchParams(
        (params) => {
          const updated = new URLSearchParams(params);
          if (next === DEFAULT_SETTINGS_SECTION) {
            updated.delete('section');
          } else {
            updated.set('section', next);
          }
          return updated;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.replace('#', '');
    if (!hash) return;
    const legacyMap: Record<string, SettingsSectionId> = {
      upload: 'upload-ia',
    };
    const mapped = legacyMap[hash];
    if (mapped && !searchParams.get('section')) {
      setSection(mapped);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, [searchParams, setSection]);

  return { section, setSection };
}
