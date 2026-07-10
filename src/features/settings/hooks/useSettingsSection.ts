import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DEFAULT_SETTINGS_SECTION,
  getDefaultTabForSection,
  isLegacySettingsSection,
  LEGACY_SECTION_REDIRECTS,
  parseSettingsSection,
  parseSettingsTab,
  type AccountSettingsTab,
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
  const section = parseSettingsSection(rawSection);
  const tab = parseSettingsTab(section, rawSection, searchParams.get('tab'));

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

  const setAccountTab = useCallback(
    (nextTab: AccountSettingsTab) => {
      setTab(nextTab);
    },
    [setTab],
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
          applyCanonicalParams(updated, redirect.section, redirect.tab);
          return updated;
        },
        { replace: true },
      );
    }
  }, [rawSection, searchParams, setSearchParams, setSection]);

  return {
    section,
    tab,
    setSection,
    setTab,
    setAccountTab,
    setCompanyTab,
  };
}
