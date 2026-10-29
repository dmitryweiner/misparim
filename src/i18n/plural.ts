export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

/** Picks the plural form of a word for n by the locale's rules (1 сотня, 3 сотни, 5 сотен). */
export function plural(locale: string, n: number, forms: PluralForms): string {
  return forms[new Intl.PluralRules(locale).select(n)] ?? forms.other;
}
