export interface EmailTypoWarning {
  suggestion: string | null;
  message: string;
}

const COM_PROVIDERS = new Set([
  'gmail',
  'googlemail',
  'hotmail',
  'outlook',
  'yahoo',
  'icloud',
  'live',
  'protonmail',
  'msn',
]);

/** These providers do not hand out @provider.com.ar addresses. */
const NO_DOT_AR = new Set([
  'gmail',
  'googlemail',
  'outlook',
  'icloud',
  'protonmail',
  'me',
  'mac',
  'msn',
]);

/**
 * .co, .cm and .om are real TLDs. Only treat them as a cut-off .com when the
 * name is a well-known mailbox provider.
 */
const SHORT_COM_TYPOS = new Set(['co', 'cm', 'om']);

const FAKE_TLDS: Record<string, string> = {
  con: 'com',
  cmo: 'com',
  ocm: 'com',
  comm: 'com',
  coom: 'com',
  comn: 'com',
  clm: 'com',
  cim: 'com',
  vom: 'com',
  xom: 'com',
  cpm: 'com',
  cok: 'com',
  coml: 'com',
  ney: 'net',
  nett: 'net',
  nte: 'net',
  ten: 'net',
  ogr: 'org',
  orgg: 'org',
  oeg: 'org',
};

const LABEL_TYPOS: Record<string, string> = {
  gmial: 'gmail',
  gmal: 'gmail',
  gmai: 'gmail',
  gamil: 'gmail',
  gmali: 'gmail',
  gmaill: 'gmail',
  gnail: 'gmail',
  gmil: 'gmail',
  gemail: 'gmail',
  gmaul: 'gmail',
  gimail: 'gmail',
  gmeil: 'gmail',
  hotmial: 'hotmail',
  hotmal: 'hotmail',
  hotmai: 'hotmail',
  hotamil: 'hotmail',
  hotnail: 'hotmail',
  homail: 'hotmail',
  hormail: 'hotmail',
  hotmaill: 'hotmail',
  hotmeil: 'hotmail',
  htomail: 'hotmail',
  outlok: 'outlook',
  outloo: 'outlook',
  outllook: 'outlook',
  outloook: 'outlook',
  outllok: 'outlook',
  outluk: 'outlook',
  yaho: 'yahoo',
  yahooo: 'yahoo',
  yhaoo: 'yahoo',
  yhoo: 'yahoo',
  yahho: 'yahoo',
};

const MISSING_DOT: Record<string, string> = {
  gmailcom: 'gmail.com',
  hotmailcom: 'hotmail.com',
  outlookcom: 'outlook.com',
  yahoocom: 'yahoo.com',
  icloudcom: 'icloud.com',
  livecom: 'live.com',
  googlemailcom: 'googlemail.com',
  protonmailcom: 'protonmail.com',
  gmailcomar: 'gmail.com',
  hotmailcomar: 'hotmail.com.ar',
  yahoocomar: 'yahoo.com.ar',
  livecomar: 'live.com.ar',
  outlookcomar: 'outlook.com',
  icloudcomar: 'icloud.com',
  googlemailcomar: 'googlemail.com',
};

const EXACT_DOMAIN_TYPOS: Record<string, string> = {
  'proton.con': 'proton.me',
  'proton.co': 'proton.me',
  'proton.cm': 'proton.me',
  'proton.om': 'proton.me',
  'fibertel.com': 'fibertel.com.ar',
  'ciudad.com': 'ciudad.com.ar',
  'speedy.com': 'speedy.com.ar',
  'arnet.com': 'arnet.com.ar',
};

const KNOWN_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'hotmail.com.ar',
  'outlook.com',
  'outlook.es',
  'live.com',
  'live.com.ar',
  'yahoo.com',
  'yahoo.com.ar',
  'yahoo.es',
  'icloud.com',
  'me.com',
  'mac.com',
  'proton.me',
  'protonmail.com',
  'msn.com',
]);

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/\p{Mark}/gu, '');
}

function applyDomainFixes(domain: string): string {
  const withoutDot = MISSING_DOT[domain];
  if (withoutDot) return withoutDot;

  const exact = EXACT_DOMAIN_TYPOS[domain];
  if (exact) return exact;

  let labels = domain.split('.').filter((label) => label.length > 0);
  if (labels.length === 0) return domain;

  labels = labels.map((label) => LABEL_TYPOS[label] ?? label);

  if (labels.at(-1) === 'comar') {
    labels.splice(labels.length - 1, 1, 'com', 'ar');
  }

  if (labels.length >= 2 && labels.at(-2) === 'com' && labels.at(-1) === 'ra') {
    labels[labels.length - 1] = 'ar';
  }

  if (labels.length >= 2 && labels.at(-1) === 'ar') {
    const fixedCom = FAKE_TLDS[labels.at(-2) ?? ''];
    if (fixedCom === 'com') labels[labels.length - 2] = 'com';
  }

  const fakeTld = FAKE_TLDS[labels.at(-1) ?? ''];
  if (fakeTld) labels[labels.length - 1] = fakeTld;

  if (
    labels.length === 2 &&
    COM_PROVIDERS.has(labels[0] ?? '') &&
    SHORT_COM_TYPOS.has(labels[1] ?? '')
  ) {
    labels[1] = 'com';
  }

  if (
    labels.length === 3 &&
    labels[1] === 'com' &&
    labels[2] === 'ar' &&
    NO_DOT_AR.has(labels[0] ?? '')
  ) {
    labels = [labels[0] ?? '', 'com'];
  }

  if (
    labels.length === 3 &&
    labels[1] === 'com' &&
    labels[2] === 'com' &&
    COM_PROVIDERS.has(labels[0] ?? '')
  ) {
    labels = [labels[0] ?? '', 'com'];
  }

  return labels.join('.');
}

function correctDomain(domain: string): string {
  let current = domain;
  for (let pass = 0; pass < 4; pass += 1) {
    const next = applyDomainFixes(current);
    if (next === current) return current;
    current = next;
  }
  return current;
}

function suggestMissingAt(value: string): string | null {
  const labels = value.split('.').filter((label) => label.length > 0);
  if (labels.length < 2) return null;

  const maxSize = Math.min(3, labels.length - 1);
  for (let size = maxSize; size >= 2; size -= 1) {
    const corrected = correctDomain(labels.slice(-size).join('.'));
    if (!KNOWN_DOMAINS.has(corrected)) continue;
    const local = labels.slice(0, -size).join('.');
    if (!local) continue;
    return `${local}@${corrected}`;
  }

  return null;
}

function buildSuggestion(value: string): string | null {
  const compact = stripDiacritics(value.replace(/\s+/g, ''));
  if (!compact.includes('@')) return suggestMissingAt(compact);

  const at = compact.indexOf('@');
  const local = compact.slice(0, at).replace(/^\.+|\.+$/g, '');
  const domain = correctDomain(compact.slice(at + 1).replace(/,/g, '.'));
  if (!local || !domain) return null;

  const suggestion = `${local}@${domain}`;
  if (!EMAIL_SHAPE.test(suggestion)) return null;
  return suggestion;
}

function withSuggestion(suggestion: string): EmailTypoWarning {
  return {
    suggestion,
    message: `¿Quisiste decir ${suggestion}? Revisá que el mail esté bien escrito.`,
  };
}

export function getEmailTypoWarning(raw: string): EmailTypoWarning | null {
  const original = raw.trim().toLowerCase();
  if (!original) return null;

  if (original.split('@').length - 1 > 1) {
    const collapsed = original.replace(/@{2,}/g, '@');
    if (collapsed.split('@').length - 1 > 1) {
      return {
        suggestion: null,
        message: 'Este mail tiene más de un @. Revisalo antes de seguir.',
      };
    }

    const suggestion = buildSuggestion(collapsed);
    if (suggestion && suggestion !== original)
      return withSuggestion(suggestion);
    return {
      suggestion: null,
      message: 'Este mail tiene más de un @. Revisalo antes de seguir.',
    };
  }

  const suggestion = buildSuggestion(original);
  if (!suggestion || suggestion === original) return null;
  return withSuggestion(suggestion);
}

/**
 * Hides a suggestion while the buyer is still typing toward it
 * (`gmail.co` on the way to `gmail.com`). Clear typos show immediately.
 */
export function shouldWarnEmailTypo(
  value: string,
  settled: boolean,
): string | null {
  const warning = getEmailTypoWarning(value);
  if (!warning) return null;
  if (!settled && warning.suggestion) {
    const typed = value.trim().toLowerCase();
    if (warning.suggestion.startsWith(typed) && warning.suggestion !== typed) {
      return null;
    }
  }
  return warning.message;
}
