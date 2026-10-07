/** Keep audit artifacts separate from the screenshots of approved earlier stages. */
export function evidencePath(path: string): string {
  const prefix = process.env.ATLAS_EVIDENCE_PREFIX
  if (!prefix) return path
  if (!/^[a-z0-9-]+$/.test(prefix))
    throw new Error('Prefixo de evidência inválido')
  return path.replace(/\/([^/]+)$/, `/${prefix}-$1`)
}
