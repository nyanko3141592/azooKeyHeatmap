export type CustardLanguage = 'ja_JP' | 'en_US' | 'el_GR' | 'none' | 'undefined';

export type CustardInputStyle = 'direct' | 'roman2kana';

export type CustardVersion = '1.0' | '1.1' | '1.2';

export interface CustardMetadata {
  custard_version: CustardVersion;
  display_name: string;
}

export interface Custard {
  identifier: string;
  language: CustardLanguage;
  input_style: CustardInputStyle;
  metadata: CustardMetadata;
  interface: CustardInterface;
}

export type CustardInterfaceStyle = 'tenkey_style' | 'pc_style';

export type CustardInterfaceLayout =
  | { type: 'grid_fit'; row_count: number; column_count: number }
  | { type: 'grid_scroll'; direction: 'vertical' | 'horizontal'; row_count: number; column_count: number };

export interface CustardInterface {
  key_style: CustardInterfaceStyle;
  key_layout: CustardInterfaceLayout;
  keys: CustardKeyEntry[];
}

export interface CustardKeyEntry {
  specifier_type: 'grid_fit' | 'grid_scroll';
  specifier: GridFitSpecifier | GridScrollSpecifier;
  key_type: 'system' | 'custom';
  key: CustardSystemKey | CustardCustomKey;
}

export interface GridFitSpecifier {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GridScrollSpecifier {
  index: number;
}

export type SystemKeyType =
  | 'change_keyboard'
  | 'enter'
  | 'upper_lower'
  | 'next_candidate'
  | 'flick_kogaki'
  | 'flick_kutoten'
  | 'flick_hira_tab'
  | 'flick_abc_tab'
  | 'flick_star123_tab';

export interface CustardSystemKey {
  type: SystemKeyType;
}

export type KeyColor = 'normal' | 'special' | 'selected' | 'unimportant';

export type CustardKeyLabelStyle =
  | { text: string }
  | { system_image: string }
  | { type: 'text'; text: string }
  | { type: 'system_image'; system_image: string }
  | { type: 'main_and_sub'; main: string; sub: string }
  | { type: 'main_and_directions'; main: string; directions: DirectionalLabel };

export interface DirectionalLabel {
  left?: string;
  top?: string;
  right?: string;
  bottom?: string;
}

export interface CustardKeyDesign {
  label: CustardKeyLabelStyle;
  color: KeyColor;
}

export type FlickDirection = 'left' | 'top' | 'right' | 'bottom';

export type CustardVariationType =
  | 'flick_variation'
  | 'longpress_variation';

export interface CustardVariationKey {
  design: { label: CustardKeyLabelStyle };
  press_actions: CodableActionData[];
  longpress_actions: CodableLongpressActionData;
}

export interface CustardVariation {
  type: CustardVariationType;
  direction?: FlickDirection;
  key: CustardVariationKey;
}

export interface CodableActionData {
  type: string;
  text?: string;
  count?: number;
  table?: Record<string, string>;
  tab_type?: string;
  identifier?: string;
  direction?: string;
  targets?: string[];
  scheme_type?: string;
  target?: string;
  forms?: string[];
}

export interface CodableLongpressActionData {
  duration?: 'normal' | 'light';
  start: CodableActionData[];
  repeat: CodableActionData[];
}

export interface CustardCustomKey {
  design: CustardKeyDesign;
  press_actions: CodableActionData[];
  longpress_actions: CodableLongpressActionData;
  variations: CustardVariation[];
}

export type EvaluationMode = 'hiragana' | 'romaji' | 'english';

export interface KeyHit {
  keyIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  flickDirection?: FlickDirection;
  character: string;
}

export interface SimulationResult {
  keyHits: KeyHit[];
  frequencyMap: Map<string, number>;
  unmappedChars: Set<string>;
  totalChars: number;
  mappedChars: number;
}

export interface ScoreResult {
  total: number;
  coverage: number;
  distance: number;
  evenness: number;
  sameKeyRate: number;
  details: {
    totalKeystrokes: number;
    uniqueKeysUsed: number;
    averageDistance: number;
    maxFrequencyKey: string;
    maxFrequency: number;
  };
}
