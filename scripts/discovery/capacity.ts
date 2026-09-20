export function subscriptionExhausted(limits: any): boolean {
  return Object.values(
    limits?.rateLimitsByLimitId || { default: limits?.rateLimits },
  )
    .flatMap((bucket: any) => [bucket?.primary, bucket?.secondary])
    .filter(Boolean)
    .some((window: any) => window.usedPercent >= 100);
}
