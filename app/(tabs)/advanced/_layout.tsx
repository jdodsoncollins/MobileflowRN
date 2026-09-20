import { Stack } from 'expo-router';
import { tabStackScreenOptions } from '../../../src/shell/tabStackOptions';
import { SiteScopeTitle } from '../../../src/features/sites/SiteScopeTitle';

export default function AdvancedStack() {
  return (
    <Stack
      screenOptions={{
        ...tabStackScreenOptions,
        headerTitle: () => <SiteScopeTitle />,
      }}
    />
  );
}
