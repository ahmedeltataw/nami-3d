// Compare structural keys and stable record identities, not translated values or list lengths.
export function parityErrors(ar, en, path = '') {
  const errors = [];
  const missing = value => value && typeof value === 'object' && !Array.isArray(value) && value.status === 'missing' && Object.keys(value).length === 1;
  if (missing(ar) || missing(en)) return errors;
  if (Array.isArray(ar) && Array.isArray(en)) {
    if (ar.every(v => v && typeof v === 'object' && 'sourceUrl' in v) && en.every(v => v && typeof v === 'object' && 'sourceUrl' in v)) {
      const key = v => new URL(v.sourceUrl).pathname.replace(/^\/(ar|en)(?=\/|$)/, '');
      const left = new Map(ar.map(v => [key(v), v]));
      const right = new Map(en.map(v => [key(v), v]));
      for (const id of new Set([...left.keys(), ...right.keys()])) {
        if (!left.has(id) || !right.has(id)) errors.push(`${path}[${id}] missing in ${left.has(id) ? 'en' : 'ar'}`);
        else errors.push(...parityErrors(left.get(id), right.get(id), `${path}[${id}]`));
      }
    } else if (ar.length && en.length && ar.every(v => v && typeof v === 'object') && en.every(v => v && typeof v === 'object')) {
      // Lists can legitimately differ in length; every object must still have the same keys.
      for (let i = 0; i < ar.length; i++) errors.push(...parityErrors(ar[i], en[0], `${path}[ar:${i}]`));
      for (let i = 0; i < en.length; i++) errors.push(...parityErrors(ar[0], en[i], `${path}[en:${i}]`));
    }
    return errors;
  }
  if (ar && en && typeof ar === 'object' && typeof en === 'object' && !Array.isArray(ar) && !Array.isArray(en)) {
    for (const key of new Set([...Object.keys(ar), ...Object.keys(en)])) {
      const child = path ? `${path}.${key}` : key;
      if (!(key in ar) || !(key in en)) errors.push(`${child} missing in ${key in ar ? 'en' : 'ar'}`);
      else errors.push(...parityErrors(ar[key], en[key], child));
    }
  } else if ((typeof ar === 'object') !== (typeof en === 'object') || Array.isArray(ar) !== Array.isArray(en)) errors.push(`${path} has incompatible shapes`);
  return errors;
}
