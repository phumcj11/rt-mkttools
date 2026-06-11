import { setRequestLocale } from 'next-intl/server';
import { ReviewsView } from '@/features/reviews/reviews-view';

export default function ReviewsPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <ReviewsView />;
}
