type LogLevel = 'info' | 'warn' | 'error'

export function logEvent(
  level: LogLevel,
  event: string,
  meta?: Record<string, unknown>,
): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...meta,
  })
  if (level === 'error') {
    console.error(line)
    return
  }
  if (level === 'warn') {
    console.warn(line)
    return
  }
  console.log(line)
}
