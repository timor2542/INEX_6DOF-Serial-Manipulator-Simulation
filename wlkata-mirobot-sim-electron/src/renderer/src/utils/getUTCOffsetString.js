export function getUTCOffsetString(d) {
  // getTimezoneOffset() คืน "นาทีที่ช้ากว่า UTC"
  // เช่น กรุงเทพฯ จะได้ -420 (เพราะเร็วกว่า UTC 7 ชม.)
  const offsetMinutes = -d.getTimezoneOffset(); // สลับเครื่องหมายให้เป็นตามสัญชาตญาณ
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
//   const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const hh = String(Math.floor(abs / 60));
  return `UTC${sign}${hh}`;
}