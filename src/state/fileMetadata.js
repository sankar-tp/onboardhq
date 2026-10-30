// File objects stay in the browser input. Only this explicit metadata allowlist is returned.
export const MAX_FILE_BYTES = 10 * 1024 * 1024
const mimeTypes = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' }
export function fileMetadata(file) {
  const name = typeof file?.name === 'string' ? file.name : ''
  const extension = name.split('.').at(-1)?.toLowerCase()
  if (!name.trim() || name.length > 180 || (/[\\/]/.test(name) || Array.from(name).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) || name.startsWith('.') || !Object.hasOwn(mimeTypes,extension)) throw Error('Choose a PDF, JPG or PNG file with a valid filename (up to 180 characters, without paths or control characters).')
  if (!Number.isInteger(file.size) || file.size <= 0 || file.size > MAX_FILE_BYTES) throw Error('File size must be greater than 0 bytes and at most 10 MB.')
  if (file.type && file.type !== mimeTypes[extension]) throw Error('The selected file type does not match its filename extension.')
  return { name, format: extension === 'jpeg' ? 'jpg' : extension, sizeBytes:file.size, mimeType:mimeTypes[extension], source:'file-picker', mock:true }
}
export function validPickedMetadata(file) {
  try {
    const normalized = fileMetadata({ name:file.name, size:file.sizeBytes, type:file.mimeType })
    return file.source === 'file-picker' && file.mock === true && normalized.format === file.format
  } catch { return false }
}
