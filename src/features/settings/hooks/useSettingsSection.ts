import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DEFAULT_SETTINGS_SECTION,
  getDefaultTabForSection,
  isLegacyAccountTabParam,
  isLegacySettingsSection,
  LEGACY_SECTION_REDIRECTS,
  parseSettingsSection,
  parseSettingsTab,
  type CompanySettingsTab,
  type SettingsSectionId,
  type SettingsTabId,
} from '../settingsSections';

function applyCanonicalParams(
  params: URLSearchParams,
  section: SettingsSectionId,
  tab: SettingsTabId | null,
) {
  const defaultTab = getDefaultTabForSection(section);

  if (section === DEFAULT_SETTINGS_SECTION) {
    params.delete('section');
  } else {
    params.set('section', section);
  }

  if (tab && tab !== defaultTab) {
    params.set('tab', tab);
  } else {
    params.delete('tab');
  }
}

export function useSettingsSection() {
  const [searchParams, setSearchParams] = useSearchParams();

  const rawSection = searchParams.get('section');
  const rawTab = searchParams.get('tab');
  const section = parseSettingsSection(rawSection);
  const tab = parseSettingsTab(section, rawSection, rawTab);

  const setSection = useCallback(
    (next: SettingsSectionId) => {
      setSearchParams(
        (params) => {
          const updated = new URLSearchParams(params);
          applyCanonicalParams(updated, next, getDefaultTabForSection(next));
          return updated;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setTab = useCallback(
    (nextTab: SettingsTabId) => {
      setSearchParams(
        (params) => {
          const updated = new URLSearchParams(params);
          applyCanonicalParams(updated, section, nextTab);
          return updated;
        },
        { replace: true },
      );
    },
    [section, setSearchParams],
  );

  const setCompanyTab = useCallback(
    (nextTab: CompanySettingsTab) => {
      setTab(nextTab);
    },
    [setTab],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hash = window.location.hash.replace('#', '');
    if (hash === 'upload' && !searchParams.get('section')) {
      setSection('upload-ia');
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      return;
    }

    if (rawSection && isLegacySettingsSection(rawSection)) {
      const redirect = LEGACY_SECTION_REDIRECTS[rawSection];
      setSearchParams(
        (params) => {
          const updated = new URLSearchParams(params);
          applyCanonicalParams(updated, redirect.section, redirect.tab ?? null);
          return updated;
        },
        { replace: true },
      );
      return;
    }

    // Limpa ?tab=identidade|preferencias|acesso no Perfil (tabs removidas).
    if (section === 'perfil' && isLegacyAccountTabParam(rawTab)) {
      setSearchParams(
        (params) => {
          const updated = new URLSearchParams(params);
          applyCanonicalParams(updated, 'perfil', null);
          return updated;
        },
        { replace: true },
      );
    }
  }, [rawSection, rawTab, searchParams, section, setSearchParams, setSection]);

  return {
    section,
    tab,
    setSection,
    setTab,
    setCompanyTab,
  };
}
