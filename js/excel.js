// Excel読み込み（SheetJSをindex.htmlで読み込み済み）
// C列=氏名 / D〜R列=日程別回答15項目 / T列=理由 / U列=弁当サイズ / 3行目以降がデータ
import { parseFileName } from './util.js';

const COL = { name: 2, first: 3, last: 17, reason: 19, bento: 20 }; // 0始まり

const isOne = v => {
  if (v === 1 || v === true) return true;
  return String(v ?? '').normalize('NFKC').trim() === '1';
};

export async function parseWorkbook(file) {
  if (!window.XLSX) throw new Error('Excel読み込み用ライブラリを読み込めませんでした。通信状況を確認してください。');
  const buf = await file.arrayBuffer();
  let wb;
  try { wb = XLSX.read(buf, { type: 'array' }); } catch { throw new Error('Excelファイルを開けませんでした。.xlsx形式か確認してください。'); }
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws || !ws['!ref']) throw new Error('シートにデータがありません。');

  // シートの開始位置がA1でなくても、列・行の位置が変わらないようA1起点で読む
  const end = XLSX.utils.decode_range(ws['!ref']).e;
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: end.r, c: Math.max(end.c, COL.bento) } });
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

  const rows = [];
  for (let r = 2; r < aoa.length; r++) {            // 3行目以降
    const line = aoa[r];
    const name = String(line[COL.name] ?? '').trim();
    if (!name) continue;
    let initial = '';
    for (let c = COL.first; c <= COL.last; c++) initial += isOne(line[c]) ? '1' : '0';
    rows.push({
      order: rows.length + 1,
      name,
      bento: String(line[COL.bento] ?? '').trim(),
      reason: String(line[COL.reason] ?? '').trim(),
      initial,
    });
  }
  if (!rows.length) throw new Error('3行目以降のC列に氏名が見つかりませんでした。');

  const parsed = parseFileName(file.name);
  return {
    fileName: file.name,
    dates: parsed ? parsed.dates : [],
    namedDays: parsed ? parsed.namedDays : 0,
    rows,
  };
}
