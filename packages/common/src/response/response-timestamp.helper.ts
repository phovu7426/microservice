const APP_TZ = process.env.APP_TIMEZONE || 'Asia/Ho_Chi_Minh';

export function formatResponseTimestamp(): string {
  const date = new Date();
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  if (APP_TZ === 'Asia/Ho_Chi_Minh') {
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+07:00`;
  }

  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const offH = pad(Math.floor(abs / 60));
  const offM = pad(abs % 60);

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offH}:${offM}`;
}
