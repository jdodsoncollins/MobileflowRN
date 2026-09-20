import { Stack } from 'expo-router';
import { tabStackScreenOptions } from '../../../src/shell/tabStackOptions';
import { SiteScopeTitle } from '../../../src/features/sites/SiteScopeTitle';

export default function ActivityStack() {
  return (
    <Stack
      screenOptions={{
        ...tabStackScreenOptions,
        headerTitle: () => <SiteScopeTitle />,
      }}
    />
  );
}
