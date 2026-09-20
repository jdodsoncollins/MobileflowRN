import { router } from 'expo-router';
import { PublishSheet } from '../src/features/publish/PublishSheet';

export default function PublishRoute() {
  return <PublishSheet visible onClose={() => router.back()} />;
}
