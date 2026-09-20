import { router } from 'expo-router';
import { SEODraftReviewSheet } from '../src/features/content/SEODraftReviewSheet';
import { openPublish } from '../src/shell/nav';

export default function SeoRoute() {
  return (
    <SEODraftReviewSheet
      visible
      onClose={() => router.back()}
      onOpenPublish={() => {
        router.back();
        openPublish();
      }}
    />
  );
}
