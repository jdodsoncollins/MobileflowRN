export async function isAvailable(): Promise<boolean> {
  return false;
}

export async function prepareBuiltInModel(): Promise<void> {}

export async function generateObject(): Promise<{ object: { lines: string } }> {
  return { object: { lines: '' } };
}

export default {};
