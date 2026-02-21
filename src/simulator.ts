import type {
  Custard,
  CustardKeyEntry,
  CustardCustomKey,
  CustardSystemKey,
  CodableActionData,
  GridFitSpecifier,
  FlickDirection,
  EvaluationMode,
  KeyHit,
  SimulationResult,
} from './types';
import { getInputText, getVariationInputs } from './parser';
import { hiraganaToRomaji, normalizeToHiragana } from './romaji';
import { JAPANESE_CORPUS, ENGLISH_CORPUS, ROMAJI_CORPUS } from './corpus';

interface KeyMapping {
  entryIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  flickDirection?: FlickDirection;
}

interface MultiKeyMapping {
  sequence: KeyMapping[];
  outputLength: number;
}

const DAKUTEN_MAP: Record<string, string> = {
  'か': 'が', 'き': 'ぎ', 'く': 'ぐ', 'け': 'げ', 'こ': 'ご',
  'さ': 'ざ', 'し': 'じ', 'す': 'ず', 'せ': 'ぜ', 'そ': 'ぞ',
  'た': 'だ', 'ち': 'ぢ', 'つ': 'づ', 'て': 'で', 'と': 'ど',
  'は': 'ば', 'ひ': 'び', 'ふ': 'ぶ', 'へ': 'べ', 'ほ': 'ぼ',
  'う': 'ゔ',
};

const HANDAKUTEN_MAP: Record<string, string> = {
  'は': 'ぱ', 'ひ': 'ぴ', 'ふ': 'ぷ', 'へ': 'ぺ', 'ほ': 'ぽ',
};

const KOGAKI_MAP: Record<string, string> = {
  'あ': 'ぁ', 'い': 'ぃ', 'う': 'ぅ', 'え': 'ぇ', 'お': 'ぉ',
  'や': 'ゃ', 'ゆ': 'ゅ', 'よ': 'ょ', 'つ': 'っ', 'わ': 'ゎ',
};

function buildReverseDakutenMap(): Map<string, { base: string; transform: string }> {
  const reverse = new Map<string, { base: string; transform: string }>();
  for (const [base, result] of Object.entries(DAKUTEN_MAP)) {
    reverse.set(result, { base, transform: 'dakuten' });
  }
  for (const [base, result] of Object.entries(HANDAKUTEN_MAP)) {
    reverse.set(result, { base, transform: 'handakuten' });
  }
  for (const [base, result] of Object.entries(KOGAKI_MAP)) {
    reverse.set(result, { base, transform: 'kogaki' });
  }
  return reverse;
}

const REVERSE_TRANSFORM_MAP = buildReverseDakutenMap();

function getKeyPosition(entry: CustardKeyEntry, rowCount: number) {
  if (entry.specifier_type === 'grid_fit') {
    const spec = entry.specifier as GridFitSpecifier;
    return { x: spec.x, y: spec.y, width: spec.width ?? 1, height: spec.height ?? 1 };
  }
  const spec = entry.specifier as { index: number };
  return { x: spec.index % rowCount, y: Math.floor(spec.index / rowCount), width: 1, height: 1 };
}

function getFirstInputText(actions: CodableActionData[]): string | null {
  for (const a of actions) {
    if (a.type === 'input' && a.text) return a.text;
  }
  return null;
}

interface CharacterMaps {
  direct: Map<string, KeyMapping>;
  multi: Map<string, MultiKeyMapping>;
  maxMultiLen: number;
}

export function buildCharacterMaps(custard: Custard): CharacterMaps {
  const direct = new Map<string, KeyMapping>();
  const multi = new Map<string, MultiKeyMapping>();
  const layout = custard.interface.key_layout;
  const rowCount = Math.floor(layout.row_count);
  let maxMultiLen = 1;

  const registerDirect = (text: string, mapping: KeyMapping) => {
    const existing = direct.get(text);
    if (!existing) {
      direct.set(text, mapping);
      return;
    }
    if (!mapping.flickDirection && existing.flickDirection) {
      direct.set(text, mapping);
    }
  };

  const updateMaxLen = (len: number) => { if (len > maxMultiLen) maxMultiLen = len; };

  // Pass 1: direct input mappings
  custard.interface.keys.forEach((entry, index) => {
    if (entry.key_type !== 'custom') return;
    const key = entry.key as CustardCustomKey;
    const pos = getKeyPosition(entry, rowCount);
    const makeMapping = (flickDir?: FlickDirection): KeyMapping => ({
      entryIndex: index, ...pos, flickDirection: flickDir,
    });

    const centerInput = getInputText(key);
    if (centerInput) {
      registerDirect(centerInput, makeMapping());
      updateMaxLen(centerInput.length);
    }

    const flickInputs = getVariationInputs(key);
    for (const [dir, text] of flickInputs) {
      registerDirect(text, makeMapping(dir as FlickDirection));
      updateMaxLen(text.length);
    }

    if (key.longpress_actions) {
      for (const action of key.longpress_actions.start || []) {
        if (action.type === 'input' && action.text) {
          registerDirect(action.text, makeMapping());
        }
      }
    }

    for (const variation of key.variations) {
      if (variation.type === 'longpress_variation') {
        for (const action of variation.key.press_actions) {
          if (action.type === 'input' && action.text) {
            registerDirect(action.text, makeMapping());
          }
        }
      }
    }
  });

  // Pass 2: replace_last_characters → multi-key mappings
  const processTable = (
    table: Record<string, string>,
    thisKeyInputText: string | null,
    ownerMapping: KeyMapping,
    flickDir?: FlickDirection
  ) => {
    const ownerWithFlick: KeyMapping = { ...ownerMapping, flickDirection: flickDir };

    for (const [inputSeq, output] of Object.entries(table)) {
      if (direct.has(output)) continue;

      let prefix = inputSeq;
      if (thisKeyInputText && inputSeq.endsWith(thisKeyInputText)) {
        prefix = inputSeq.slice(0, -thisKeyInputText.length);
      }

      if (prefix.length === 0) {
        registerDirect(output, ownerWithFlick);
        if (output.length > maxMultiLen) maxMultiLen = output.length;
        continue;
      }

      const sequence: KeyMapping[] = [];
      let resolved = true;
      for (const ch of prefix) {
        const prefixMapping = direct.get(ch);
        if (prefixMapping) {
          sequence.push(prefixMapping);
        } else {
          resolved = false;
          break;
        }
      }

      if (resolved) {
        sequence.push(ownerWithFlick);
        const existing = multi.get(output);
        if (!existing || sequence.length < existing.sequence.length) {
          multi.set(output, { sequence, outputLength: output.length });
        }
        if (output.length > maxMultiLen) maxMultiLen = output.length;
      }
    }
  };

  custard.interface.keys.forEach((entry, index) => {
    if (entry.key_type !== 'custom') return;
    const key = entry.key as CustardCustomKey;
    const pos = getKeyPosition(entry, rowCount);
    const ownerMapping: KeyMapping = { entryIndex: index, ...pos };
    const centerInput = getInputText(key);

    for (const action of key.press_actions) {
      if (action.type === 'replace_last_characters' && action.table) {
        processTable(action.table, centerInput, ownerMapping);
      }
    }

    for (const variation of key.variations) {
      const varInput = getFirstInputText(variation.key.press_actions);
      const flickDir = variation.type === 'flick_variation' ? variation.direction : undefined;
      for (const action of variation.key.press_actions) {
        if (action.type === 'replace_last_characters' && action.table) {
          processTable(action.table, varInput, ownerMapping, flickDir);
        }
      }
    }
  });

  // Pass 3: 中間状態の連鎖解決
  // 子音キーが "nt"→"んt", "kk"→"っk" 等の中間状態を生成し、
  // 母音キーがそれを "んた", "っか" 等に解決するパスを構築
  const INTERMEDIATE_RE = /^(.+?)([a-z]+)$/;
  const intermediates: Array<{
    confirmedKana: string;
    sequence: KeyMapping[];
    lastKey: KeyMapping;
  }> = [];

  for (const [output, mapping] of multi) {
    const match = output.match(INTERMEDIATE_RE);
    if (!match) continue;
    const confirmedKana = match[1];
    if (/[a-z]/.test(confirmedKana)) continue;
    intermediates.push({
      confirmedKana,
      sequence: mapping.sequence,
      lastKey: mapping.sequence[mapping.sequence.length - 1],
    });
  }

  const kanaEntries: Array<[string, MultiKeyMapping]> = [];
  for (const [output, mapping] of multi) {
    if (!/[a-z]/.test(output) && mapping.sequence.length > 0) {
      kanaEntries.push([output, mapping]);
    }
  }

  for (const inter of intermediates) {
    for (const [kanaOutput, kanaMapping] of kanaEntries) {
      const firstKey = kanaMapping.sequence[0];
      if (firstKey.entryIndex !== inter.lastKey.entryIndex) continue;
      if (firstKey.flickDirection !== inter.lastKey.flickDirection) continue;

      const chainOutput = inter.confirmedKana + kanaOutput;
      const chainSeq = [...inter.sequence, ...kanaMapping.sequence.slice(1)];

      if (direct.has(chainOutput)) continue;
      const existing = multi.get(chainOutput);
      if (!existing || chainSeq.length < existing.sequence.length) {
        multi.set(chainOutput, { sequence: chainSeq, outputLength: chainOutput.length });
        updateMaxLen(chainOutput.length);
      }
    }
  }

  return { direct, multi, maxMultiLen };
}

interface TransformKeyInfo {
  entryIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

function findTransformKey(custard: Custard): TransformKeyInfo | null {
  const layout = custard.interface.key_layout;
  const rowCount = Math.floor(layout.row_count);

  for (let i = 0; i < custard.interface.keys.length; i++) {
    const entry = custard.interface.keys[i];
    if (entry.key_type === 'system') {
      const sysKey = entry.key as CustardSystemKey;
      if (sysKey.type === 'flick_kogaki') {
        const pos = getKeyPosition(entry, rowCount);
        return { entryIndex: i, ...pos };
      }
    }
    if (entry.key_type === 'custom') {
      const customKey = entry.key as CustardCustomKey;
      if (customKey.press_actions.some(a => a.type === 'replace_default')) {
        const pos = getKeyPosition(entry, rowCount);
        return { entryIndex: i, ...pos };
      }
    }
  }
  return null;
}

function singleCharCost(
  ch: string,
  charMap: Map<string, KeyMapping>,
  multiMap: Map<string, MultiKeyMapping>,
  transformKey: TransformKeyInfo | null
): number {
  if (charMap.has(ch)) return 1;
  const mm = multiMap.get(ch);
  if (mm) return mm.sequence.length;
  const ti = REVERSE_TRANSFORM_MAP.get(ch);
  if (ti && transformKey) {
    if (charMap.has(ti.base)) return 2;
    const bm = multiMap.get(ti.base);
    if (bm) return bm.sequence.length + 1;
  }
  return Infinity;
}

function individualCost(
  substr: string,
  charMap: Map<string, KeyMapping>,
  multiMap: Map<string, MultiKeyMapping>,
  transformKey: TransformKeyInfo | null
): number {
  let cost = 0;
  for (const ch of substr) {
    const c = singleCharCost(ch, charMap, multiMap, transformKey);
    if (c === Infinity) return Infinity;
    cost += c;
  }
  return cost;
}

export function simulate(
  custard: Custard,
  mode: EvaluationMode,
  customText?: string
): SimulationResult {
  const { direct: charMap, multi: multiMap, maxMultiLen } = buildCharacterMaps(custard);
  const transformKey = findTransformKey(custard);
  let inputText: string;

  switch (mode) {
    case 'hiragana': {
      const raw = customText || JAPANESE_CORPUS;
      inputText = normalizeToHiragana(raw);
      break;
    }
    case 'romaji': {
      const hasAsciiVowels = 'aiueo'.split('').every(v => charMap.has(v) || multiMap.has(v));
      if (!hasAsciiVowels) {
        const raw = customText || JAPANESE_CORPUS;
        inputText = normalizeToHiragana(raw);
      } else if (customText) {
        const hiragana = normalizeToHiragana(customText);
        inputText = hiraganaToRomaji(hiragana).toLowerCase();
      } else {
        inputText = ROMAJI_CORPUS.toLowerCase();
      }
      break;
    }
    case 'english': {
      inputText = (customText || ENGLISH_CORPUS).toLowerCase();
      break;
    }
  }

  const keyHits: KeyHit[] = [];
  const frequencyMap = new Map<string, number>();
  const unmappedChars = new Set<string>();
  let mappedChars = 0;
  let totalChars = 0;

  const addHit = (mapping: KeyMapping | TransformKeyInfo, character: string, flickDir?: FlickDirection) => {
    keyHits.push({
      keyIndex: mapping.entryIndex,
      x: mapping.x,
      y: mapping.y,
      width: mapping.width,
      height: mapping.height,
      flickDirection: flickDir,
      character,
    });
    const freqKey = `${mapping.entryIndex}${flickDir ? `:${flickDir}` : ''}`;
    frequencyMap.set(freqKey, (frequencyMap.get(freqKey) || 0) + 1);
  };

  let i = 0;
  while (i < inputText.length) {
    const char = inputText[i];
    if (char === '\n' || char === '\r') { i++; continue; }

    let matched = false;
    if (maxMultiLen > 1) {
      for (let len = Math.min(maxMultiLen, inputText.length - i); len > 1; len--) {
        const substr = inputText.slice(i, i + len);

        const multiMapping = multiMap.get(substr);
        if (multiMapping) {
          const indivCost = individualCost(substr, charMap, multiMap, transformKey);
          if (multiMapping.sequence.length <= indivCost) {
            totalChars += len;
            mappedChars += len;
            for (const km of multiMapping.sequence) {
              addHit(km, substr, km.flickDirection);
            }
            i += len;
            matched = true;
            break;
          }
        }

        const directMulti = charMap.get(substr);
        if (directMulti) {
          const indivCost = individualCost(substr, charMap, multiMap, transformKey);
          if (1 <= indivCost) {
            totalChars += len;
            mappedChars += len;
            addHit(directMulti, substr, directMulti.flickDirection);
            i += len;
            matched = true;
            break;
          }
        }
      }
    }
    if (matched) continue;

    totalChars++;

    // 1. 直接マッピング (1打鍵)
    const directMapping = charMap.get(char);
    if (directMapping) {
      mappedChars++;
      addHit(directMapping, char, directMapping.flickDirection);
      i++;
      continue;
    }

    // 2. replace_last_characters による複数打鍵
    const multiMapping = multiMap.get(char);

    // 3. 濁音・半濁音・小書き → ベース文字 + 変換キー
    const transformInfo = REVERSE_TRANSFORM_MAP.get(char);
    let transformCost = Infinity;
    if (transformInfo && transformKey) {
      if (charMap.has(transformInfo.base)) {
        transformCost = 2;
      } else {
        const bm = multiMap.get(transformInfo.base);
        if (bm) transformCost = bm.sequence.length + 1;
      }
    }

    const multiCost = multiMapping ? multiMapping.sequence.length : Infinity;

    if (multiCost <= transformCost && multiMapping) {
      mappedChars++;
      for (const km of multiMapping.sequence) {
        addHit(km, char, km.flickDirection);
      }
      i++;
      continue;
    }

    if (transformCost < Infinity && transformInfo && transformKey) {
      mappedChars++;
      const baseMapping = charMap.get(transformInfo.base);
      if (baseMapping) {
        addHit(baseMapping, transformInfo.base, baseMapping.flickDirection);
      } else {
        const baseMulti = multiMap.get(transformInfo.base)!;
        for (const km of baseMulti.sequence) {
          addHit(km, transformInfo.base, km.flickDirection);
        }
      }
      addHit(transformKey, char);
      i++;
      continue;
    }

    unmappedChars.add(char);
    i++;
  }

  return { keyHits, frequencyMap, unmappedChars, totalChars, mappedChars };
}

export function getKeyFrequency(
  result: SimulationResult,
  entries: CustardKeyEntry[]
): Map<number, number> {
  const keyFreq = new Map<number, number>();
  for (const hit of result.keyHits) {
    keyFreq.set(hit.keyIndex, (keyFreq.get(hit.keyIndex) || 0) + 1);
  }
  return keyFreq;
}

export interface FlickFrequencyEntry {
  center: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
  total: number;
}

export function getFlickFrequency(
  result: SimulationResult
): Map<number, FlickFrequencyEntry> {
  const flickFreq = new Map<number, FlickFrequencyEntry>();

  for (const [freqKey, count] of result.frequencyMap) {
    const parts = freqKey.split(':');
    const keyIndex = parseInt(parts[0], 10);
    const direction = parts[1] as FlickDirection | undefined;

    let entry = flickFreq.get(keyIndex);
    if (!entry) {
      entry = { center: 0, left: 0, top: 0, right: 0, bottom: 0, total: 0 };
      flickFreq.set(keyIndex, entry);
    }

    if (direction) {
      entry[direction] += count;
    } else {
      entry.center += count;
    }
    entry.total += count;
  }

  return flickFreq;
}
