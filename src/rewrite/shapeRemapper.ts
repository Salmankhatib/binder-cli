// src/rewrite/shapeRemapper.ts

export interface ShapeRemapResult {
    code: string;
    remapperName: string;
}

export function generateShapeRemapper(
  mockName: string,
  mockShape: Record<string, string>,
  apiShape: Record<string, string>
): ShapeRemapResult | null {
  const remappings: string[] = [];
  const remapperName = `remap${mockName.replace(/^(MOCK_|FAKE_)/i, '')}`;
  
  for (const [mockKey, _] of Object.entries(mockShape)) {
    const apiKey = findMatchingKey(mockKey, apiShape);
    if (apiKey && apiKey !== mockKey) {
      remappings.push(`${mockKey}: apiData.${apiKey}`);
    } else if (apiShape[mockKey]) {
        remappings.push(`${mockKey}: apiData.${mockKey}`);
    }
  }
  
  if (remappings.length === 0) return null;
  
  const code = `
const ${remapperName} = (apiData: any) => ({
  ${remappings.join(',\n  ')}
});`.trim();

  return { code, remapperName };
}

function findMatchingKey(mockKey: string, apiShape: Record<string, string>): string | null {
  if (apiShape[mockKey]) return mockKey;
  
  const snake = mockKey.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
  if (apiShape[snake]) return snake;
  
  const aliases: Record<string, string> = {
    'firstName': 'first_name',
    'lastName': 'last_name',
    'userName': 'username',
    'phoneNumber': 'phone'
  };
  
  if (aliases[mockKey] && apiShape[aliases[mockKey]]) return aliases[mockKey];
  
  return null;
}
