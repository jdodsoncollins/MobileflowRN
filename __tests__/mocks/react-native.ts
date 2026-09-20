/** Minimal react-native stub for Vitest (node) runs. */
export const Linking = {
  addEventListener: () => ({ remove: () => undefined }),
  getInitialURL: async () => null,
};

export const Platform = {
  OS: 'ios' as const,
  select: <T,>(spec: { ios?: T; android?: T; default?: T }) =>
    spec.ios ?? spec.default,
};

export default {};
