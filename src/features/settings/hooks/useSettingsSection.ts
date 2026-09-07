import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DEFAULT_SETTINGS_SECTION,
  isSettingsSection,
  parseSettingsSection,
  type SettingsSectionId,
} from '../settingsSections';

function applySection(params: URLSearchParams, section: SettingsSectionId) {
  if (section === DEFAULT_SETTINGS_SECTION) {
    params.delete('section');
  } else {
    params.set('section', section);
  }
  // Não existe mais sub-aba: cada seção é uma tela só.
  params.delete('tab');
}

export function useSettingsSection() {
  const [searchParams, setSearchParams] = useSearchParams();

  const rawSection = searchParams.get('section');
  const rawTab = searchParams.get('tab');
  const section = parseSettingsSection(rawSection);

  const setSection = useCallback(
    (next: SettingsSectionId) => {
      setSearchParams(
        (params) => {
          const updated = new URLSearchParams(params);
          applySection(updated, next);
          return updated;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Âncora antiga de "Upload e IA" (#upload) continua caindo na seção certa.
    const hash = window.location.hash.replace('#', '');
    if (hash === 'upload' && !rawSection) {
      setSection('organizacao');
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      return;
    }

    const needsRewrite = (rawSection !== null && !isSettingsSection(rawSection)) || rawTab !== null;
    if (needsRewrite) {
      setSection(section);
    }
  }, [rawSection, rawTab, section, setSection]);

  return { section, setSection };
}
