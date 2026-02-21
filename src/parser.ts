import type {
  Custard,
  CustardKeyEntry,
  GridFitSpecifier,
  CustardCustomKey,
  CustardSystemKey,
  CustardKeyLabelStyle,
} from './types';

export function parseCustard(json: string): Custard | Custard[] {
  const data = JSON.parse(json);
  if (Array.isArray(data)) {
    return data.map(validateCustard);
  }
  return validateCustard(data);
}

function validateCustard(data: unknown): Custard {
  const obj = data as Record<string, unknown>;
  if (!obj.identifier || !obj.interface) {
    throw new Error('無効なCustard JSON: identifier または interface が見つかりません');
  }

  const iface = obj.interface as Record<string, unknown>;
  if (!iface.key_layout || !iface.keys) {
    throw new Error('無効なCustard JSON: key_layout または keys が見つかりません');
  }

  const keys = iface.keys as CustardKeyEntry[];
  for (const entry of keys) {
    if (entry.specifier_type === 'grid_fit') {
      const spec = entry.specifier as GridFitSpecifier;
      if (spec.width === undefined) spec.width = 1;
      if (spec.height === undefined) spec.height = 1;
    }
  }

  return data as Custard;
}

export function getLabelText(label: CustardKeyLabelStyle): string {
  if ('text' in label && typeof label.text === 'string') {
    return label.text;
  }
  if ('system_image' in label && typeof label.system_image === 'string') {
    return mapSystemImage(label.system_image);
  }
  if ('type' in label) {
    switch (label.type) {
      case 'text':
        return (label as { type: 'text'; text: string }).text;
      case 'system_image':
        return mapSystemImage((label as { type: 'system_image'; system_image: string }).system_image);
      case 'main_and_sub':
        return (label as { type: 'main_and_sub'; main: string }).main;
      case 'main_and_directions':
        return (label as { type: 'main_and_directions'; main: string }).main;
    }
  }
  return '?';
}

function mapSystemImage(name: string): string {
  const mapping: Record<string, string> = {
    'delete.left': '⌫',
    'xmark': '✕',
    'list.bullet': '☰',
    'globe': '🌐',
    'arrow.left': '←',
    'arrow.right': '→',
    'arrow.up': '↑',
    'arrow.down': '↓',
  };
  return mapping[name] ?? name;
}

export function getSystemKeyLabel(key: CustardSystemKey): string {
  const labels: Record<string, string> = {
    change_keyboard: '🌐',
    enter: '確定',
    upper_lower: 'a/A',
    next_candidate: '空白',
    flick_kogaki: '小ﾞﾟ',
    flick_kutoten: '。',
    flick_hira_tab: 'あいう',
    flick_abc_tab: 'abc',
    flick_star123_tab: '☆123',
  };
  return labels[key.type] ?? key.type;
}

export function getInputText(key: CustardCustomKey): string | null {
  for (const action of key.press_actions) {
    if (action.type === 'input' && action.text) {
      return action.text;
    }
  }
  return null;
}

export function getVariationInputs(key: CustardCustomKey): Map<string, string> {
  const result = new Map<string, string>();
  for (const variation of key.variations) {
    if (variation.type === 'flick_variation' && variation.direction) {
      for (const action of variation.key.press_actions) {
        if (action.type === 'input' && action.text) {
          result.set(variation.direction, action.text);
          break;
        }
      }
    }
  }
  return result;
}
