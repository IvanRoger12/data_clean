export const sanitizeName = (s: string) =>
  s.replace(/[^\p{L}\p{N}\-_\.]+/gu, '_').slice(0, 64)

export const allowedFile = (name: string) =>
  /\.(csv|txt|xlsx|xls|json|yaml|yml)$/i.test(name)

export const clip = (s: string, n = 120) =>
  s.length > n ? s.slice(0, n) + '…' : s
