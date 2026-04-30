// Shared collaborator matching used by sync, import, and reports filters.
// Match rule: collab name must appear as a whole word in the memo
// (Unicode-aware non-letter boundary). Map is sorted longest-name-first so
// "Juan Perez" wins over "Juan" when both could match.

export function buildCollaboratorMap(collaborators) {
  const map = new Map();
  const sorted = [...collaborators].sort((a, b) => b.name.length - a.name.length);
  for (const c of sorted) {
    map.set(c.name.toLowerCase().trim(), c._id);
  }
  return map;
}

export function matchCollaborator(raw = '', collabMap) {
  if (!raw) return null;
  const text = String(raw).trim();
  if (!text) return null;
  for (const [name, id] of collabMap.entries()) {
    if (!name) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[^\\p{L}])${escaped}($|[^\\p{L}])`, 'iu');
    if (re.test(text)) return id;
  }
  return null;
}
