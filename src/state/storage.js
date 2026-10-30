import { seed, validateData } from './model.js'
export const WORKSPACE_KEY = 'onboardhq.workspace.v1'
export function loadWorkspace(storage) {
  const raw = storage.getItem(WORKSPACE_KEY)
  const data = raw === null ? seed() : validateData(JSON.parse(raw))
  const serialized = JSON.stringify(data)
  if (serialized !== raw) storage.setItem(WORKSPACE_KEY,serialized)
  return { data, serialized }
}
export function saveWorkspace(storage, expected, next) {
  if (storage.getItem(WORKSPACE_KEY) !== expected) throw Error('The workspace changed in another tab. Reload before saving to avoid overwriting those changes.')
  const serialized = JSON.stringify(validateData(next))
  storage.setItem(WORKSPACE_KEY,serialized)
  return serialized
}
