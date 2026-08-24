export function generateAPIKey() {
  const prefix = 'mdx_'
  const random = crypto.randomUUID().replace(/-/g, '')
  return prefix + random
}
