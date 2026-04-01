const storageKey = 'mongo-insights:last-database'

export function getLastDatabase(): string | null {
  return localStorage.getItem(storageKey)
}

export function setLastDatabase(name: string): void {
  localStorage.setItem(storageKey, name)
}
