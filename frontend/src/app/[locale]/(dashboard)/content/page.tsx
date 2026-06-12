import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { ContentStudioView } from '@/features/content-studio/content-studio-view';

export default function ContentPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <Suspense>
      <ContentStudioView />
    </Suspense>
  );
}
