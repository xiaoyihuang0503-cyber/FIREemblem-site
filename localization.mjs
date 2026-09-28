/** Translate display text without changing stored facts, identifiers or numbers. */
export function createTranslator(terms = {}) {
  const normalize = text => text.replaceAll('’', "'");
  const map = new Map(Object.entries(terms).map(([en, zh]) => [normalize(en).toLowerCase(), zh]));
  const keys = [...new Set(Object.keys(terms).map(normalize))].sort((a,b) => b.length-a.length);
  const pattern = keys.length ? new RegExp('(?<![A-Za-z])(' + keys.map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|') + ')(?![A-Za-z])', 'gi') : null;
  return value => {
    const input = normalize(String(value ?? ''));
    if (map.has(input.toLowerCase())) return map.get(input.toLowerCase());
    let text = pattern ? input.replace(pattern, match => map.get(match.toLowerCase())) : input;
    text = text.replace(/\bLv\.?\s*(\d+)/gi,'等级 $1').replace(/\bPart\s+([123])\b/g, (_, n) => ['','第一部','第二部','第三部'][n]);
    text = text.replace(/Chapter\s*(\d+)/gi,'第 $1 章').replace(/\bSkill\b/gi,'熟练度').replace(/Perform Quest/gi,'演出委托');
    return text;
  };
}
