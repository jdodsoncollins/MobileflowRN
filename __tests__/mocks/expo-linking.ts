export function addEventListener(
  _event: string,
  _handler: (event: { url: string }) => void,
) {
  return { remove: () => undefined };
}

export async function getInitialURL(): Promise<string | null> {
  return null;
}
