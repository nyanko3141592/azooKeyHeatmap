const HIRAGANA_TO_ROMAJI: Record<string, string> = {
  'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
  'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
  'さ': 'sa', 'し': 'si', 'す': 'su', 'せ': 'se', 'そ': 'so',
  'た': 'ta', 'ち': 'ti', 'つ': 'tu', 'て': 'te', 'と': 'to',
  'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
  'は': 'ha', 'ひ': 'hi', 'ふ': 'hu', 'へ': 'he', 'ほ': 'ho',
  'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
  'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
  'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
  'わ': 'wa', 'ゐ': 'wi', 'ゑ': 'we', 'を': 'wo',
  'ん': 'nn',

  'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
  'ざ': 'za', 'じ': 'zi', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
  'だ': 'da', 'ぢ': 'di', 'づ': 'du', 'で': 'de', 'ど': 'do',
  'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
  'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',

  'ぁ': 'xa', 'ぃ': 'xi', 'ぅ': 'xu', 'ぇ': 'xe', 'ぉ': 'xo',
  'ゃ': 'xya', 'ゅ': 'xyu', 'ょ': 'xyo',
  'っ': 'xtu',
  'ゎ': 'xwa',

  'きゃ': 'kya', 'きゅ': 'kyu', 'きょ': 'kyo',
  'しゃ': 'sya', 'しゅ': 'syu', 'しょ': 'syo',
  'ちゃ': 'tya', 'ちゅ': 'tyu', 'ちょ': 'tyo',
  'にゃ': 'nya', 'にゅ': 'nyu', 'にょ': 'nyo',
  'ひゃ': 'hya', 'ひゅ': 'hyu', 'ひょ': 'hyo',
  'みゃ': 'mya', 'みゅ': 'myu', 'みょ': 'myo',
  'りゃ': 'rya', 'りゅ': 'ryu', 'りょ': 'ryo',
  'ぎゃ': 'gya', 'ぎゅ': 'gyu', 'ぎょ': 'gyo',
  'じゃ': 'zya', 'じゅ': 'zyu', 'じょ': 'zyo',
  'びゃ': 'bya', 'びゅ': 'byu', 'びょ': 'byo',
  'ぴゃ': 'pya', 'ぴゅ': 'pyu', 'ぴょ': 'pyo',
  'でゃ': 'dha', 'でゅ': 'dhu', 'でょ': 'dho',
  'てゃ': 'tha', 'てゅ': 'thu', 'てょ': 'tho',

};

export function hiraganaToRomaji(text: string): string {
  let result = '';
  let i = 0;

  while (i < text.length) {
    // 促音（っ）の処理: 次の子音を重ねる
    if (text[i] === 'っ' && i + 1 < text.length) {
      const nextChar = text[i + 1];
      const nextRomaji = HIRAGANA_TO_ROMAJI[nextChar];
      if (nextRomaji && nextRomaji.length > 0 && /^[bcdfghjklmnpqrstvwxyz]/.test(nextRomaji)) {
        result += nextRomaji[0];
        i++;
        continue;
      }
    }

    // 2文字の拗音を先にチェック
    if (i + 1 < text.length) {
      const twoChar = text[i] + text[i + 1];
      if (HIRAGANA_TO_ROMAJI[twoChar]) {
        result += HIRAGANA_TO_ROMAJI[twoChar];
        i += 2;
        continue;
      }
    }

    // 1文字変換
    if (HIRAGANA_TO_ROMAJI[text[i]]) {
      result += HIRAGANA_TO_ROMAJI[text[i]];
    } else {
      result += text[i];
    }
    i++;
  }

  return result;
}

const KATAKANA_TO_HIRAGANA_OFFSET = 0x30A1 - 0x3041;

export function katakanaToHiragana(text: string): string {
  let result = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= 0x30A1 && code <= 0x30F6) {
      result += String.fromCharCode(code - KATAKANA_TO_HIRAGANA_OFFSET);
    } else if (code === 0x30FC) {
      result += 'ー';
    } else {
      result += ch;
    }
  }
  return result;
}

export function normalizeToHiragana(text: string): string {
  return katakanaToHiragana(text);
}
