// FNV-1a, 32-bit hex: identifies a text without storing it. Shared by the
// server's reply records (api/_aiRecords.js) and the prompt registry, so a
// record's template_version and the registry's version agree.
export function textHash(text) {
  let h = 0x811c9dc5
  const s = String(text ?? '')
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(16).padStart(8, '0')
}
