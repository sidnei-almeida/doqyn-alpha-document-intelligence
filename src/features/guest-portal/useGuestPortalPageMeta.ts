import { useEffect } from 'react';

type GuestPortalPageMetaInput = {
  title: string;
  description: string;
  imagePath?: string;
};

function upsertMetaTag(attribute: 'name' | 'property', key: string, content: string) {
  if (typeof document === 'undefined') return;
  const selector = `meta[${attribute}="${key}"]`;
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

/** Atualiza title e meta básicas no cliente (não substitui OG server-side para crawlers). */
export function useGuestPortalPageMeta({ title, description, imagePath }: GuestPortalPageMetaInput) {
  useEffect(() => {
    document.title = title;
    upsertMetaTag('name', 'description', description);
    upsertMetaTag('property', 'og:title', title);
    upsertMetaTag('property', 'og:description', description);
    upsertMetaTag('property', 'og:type', 'website');
    upsertMetaTag('name', 'twitter:card', 'summary_large_image');
    upsertMetaTag('name', 'twitter:title', title);
    upsertMetaTag('name', 'twitter:description', description);

    if (imagePath) {
      const absolute =
        imagePath.startsWith('http://') || imagePath.startsWith('https://')
          ? imagePath
          : `${window.location.origin}${imagePath.startsWith('/') ? imagePath : `/${imagePath}`}`;
      upsertMetaTag('property', 'og:image', absolute);
      upsertMetaTag('name', 'twitter:image', absolute);
    }
  }, [title, description, imagePath]);
}
