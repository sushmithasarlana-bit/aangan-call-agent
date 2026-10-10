/** Front desk hours are 10am–7pm IST. Anything outside is an after-hours call. */
export function isAfterHours(at: Date): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(at),
  );
  return hour < 10 || hour >= 19;
}

export function fmtIST(at: Date | string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
    ...opts,
  }).format(new Date(at));
}
