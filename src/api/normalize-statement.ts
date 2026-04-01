type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

const operationKeys = [
  'aggregate',
  'count',
  'delete',
  'distinct',
  'find',
  'findAndModify',
  'getMore',
  'insert',
  'update'
] as const

export function normalizeStatement(commandJson: string): string {
  let command: Record<string, JsonValue>

  try {
    command = JSON.parse(commandJson)
  } catch {
    return commandJson
  }

  for (const key of operationKeys) {
    if (key in command) {
      const value = command[key]
      const collection =
        key === 'getMore'
          ? String(command['collection'] ?? '')
          : String(value ?? '')

      const filter = command['filter'] ?? command['query'] ?? null

      const parts = [key, collection]

      if (filter && typeof filter === 'object' && !Array.isArray(filter)) {
        parts.push(normalizeFilter(filter as Record<string, JsonValue>))
      }

      return parts.join(' ')
    }
  }

  const firstKey = Object.keys(command)[0]

  return firstKey ?? 'unknown'
}

function normalizeFilter(filter: Record<string, JsonValue>): string {
  const keys = Object.keys(filter).sort()

  const parts = keys.map((key) => {
    const value = filter[key]

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return `${key}: ${normalizeFilter(value as Record<string, JsonValue>)}`
    }

    return `${key}: ?`
  })

  return `{${parts.join(', ')}}`
}
