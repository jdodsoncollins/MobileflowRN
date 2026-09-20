// Expo modules expect RN globals when loaded under Node.
(globalThis as { __DEV__?: boolean }).__DEV__ = false;
