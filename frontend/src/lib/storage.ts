const K = {
  RULES: 'dc_rules',
  LAST_BASE: 'dc_api_base'
}

export type Rule = {
  column: string
  required?: boolean
  regex?: string
  minLen?: number
  maxLen?: number
}

export const saveRules = (rules: Rule[]) =>
  localStorage.setItem(K.RULES, JSON.stringify(rules))

export const loadRules = (): Rule[] => {
  try { return JSON.parse(localStorage.getItem(K.RULES) || '[]') } catch { return [] }
}

export const saveApiBase = (base: string) => localStorage.setItem(K.LAST_BASE, base)
export const loadApiBase = () => localStorage.getItem(K.LAST_BASE) || ''
