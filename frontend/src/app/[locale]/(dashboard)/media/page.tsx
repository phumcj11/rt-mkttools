import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { MediaView } from '@/features/media/media-view';

export default function MediaPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <Suspense>
      <MediaView />
    </Suspense>
  );
}
