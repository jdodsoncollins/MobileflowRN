import type { AppTab } from './AppContext';

type RouterLike = {
  navigate: (href: string) => void;
  push: (href: string) => void;
  back: () => void;
  canGoBack: () => boolean;
};

function getRouter(): RouterLike | null {
  try {
    return require('expo-router').router as RouterLike;
  } catch {
    return null;
  }
}

export function navigateTab(tab: AppTab): void {
  const router = getRouter();
  if (!router) return;
  if (tab === 'home') router.navigate('/home');
  else if (tab === 'content') router.navigate('/content');
  else if (tab === 'advanced') router.navigate('/advanced');
  else router.navigate('/activity');
}

export function openSettings(): void {
  getRouter()?.push('/settings');
}

export function openSites(): void {
  getRouter()?.push('/sites');
}

export function openCommand(): void {
  getRouter()?.push('/command');
}

export function openPublish(): void {
  getRouter()?.push('/publish');
}

export function openHealth(): void {
  getRouter()?.push('/health');
}

export function openSeo(): void {
  getRouter()?.push('/seo');
}

export function closeModal(): void {
  const router = getRouter();
  if (router?.canGoBack()) router.back();
}
