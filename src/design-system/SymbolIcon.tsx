import { Text } from 'react-native';
import { SymbolView, type SFSymbol, type SymbolWeight } from 'expo-symbols';

const fallbackGlyph: Partial<Record<string, string>> = {
  house: '⌂',
  'house.fill': '⌂',
  'square.grid.2x2': '▦',
  'square.grid.2x2.fill': '▦',
  clock: '◷',
  'clock.fill': '◷',
  'slider.horizontal.3': '⚒',
  gearshape: '⚙',
  sparkles: '✦',
  'text.badge.plus': '⌘',
  'chevron.down': '▾',
  'arrow.clockwise': '↻',
};

export function SymbolIcon({
  name,
  size = 24,
  color,
  weight = 'regular',
}: {
  name: SFSymbol;
  size?: number;
  color: string;
  weight?: SymbolWeight;
}) {
  return (
    <SymbolView
      name={name}
      tintColor={color}
      type="monochrome"
      weight={weight}
      size={size}
      accessible={false}
      importantForAccessibility="no"
      fallback={
        <Text
          style={{ fontSize: size * 0.82, color, lineHeight: size }}
          accessible={false}
        >
          {fallbackGlyph[name] ?? '•'}
        </Text>
      }
    />
  );
}
