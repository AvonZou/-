import ExcelJS from "exceljs";
import { guessHeader } from "./job-import";
export type Sheet = { name: string; rows: string[][] };
const MAX_ROWS = 2020;
function csvRows(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (quoted || cell === "") quoted = !quoted;
      else cell += c;
    } else if (c === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
    if (rows.length > MAX_ROWS)
      throw Error("每个工作表最多支持 2000 条数据；请拆分文件");
  }
  if (quoted) throw Error("CSV 引号没有闭合");
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  if (rows.some((r) => r.length > 100)) throw Error("最多支持 100 列");
  return rows;
}
export async function readSpreadsheet(
  buffer: Buffer,
  name: string,
): Promise<Sheet[]> {
  if (buffer.length > 10 * 1024 * 1024) throw Error("文件超过 10 MB");
  if (/\.(csv|tsv)$/i.test(name)) {
    let text: string;
    if (buffer[0] === 0xff && buffer[1] === 0xfe)
      text = new TextDecoder("utf-16le").decode(buffer);
    else if (buffer[0] === 0xfe && buffer[1] === 0xff)
      text = new TextDecoder("utf-16be").decode(buffer);
    else
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      } catch {
        text = new TextDecoder("gb18030").decode(buffer);
      }
    text = text.replace(/^\uFEFF/, "");
    const options = (/\.tsv$/i.test(name) ? ["\t"] : [",", "\t", ";"]).map(
      (d) => csvRows(text, d),
    );
    options.sort((a, b) => (b[0]?.length ?? 0) - (a[0]?.length ?? 0));
    if (!options[0].length) throw Error("表格中没有可读取的数据");
    return [{ name: "CSV", rows: options[0] }];
  }
  if (!/\.xlsx$/i.test(name))
    throw Error("仅支持 .xlsx、.csv 或 .tsv；旧 .xls 请另存为 .xlsx");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  const sheets: Sheet[] = [];
  workbook.eachSheet((sheet) => {
    const rows: string[][] = [];
    sheet.eachRow((row) => {
      if (rows.length >= MAX_ROWS)
        throw Error("每个工作表最多支持 2000 条数据；请拆分文件");
      if (row.cellCount > 100) throw Error("最多支持 100 列");
      const values: string[] = [];
      for (let i = 1; i <= row.cellCount; i++) {
        const cell = row.getCell(i);
        if (cell.value instanceof Date)
          values.push(cell.value.toISOString().slice(0, 10));
        else if (
          cell.type === ExcelJS.ValueType.Hyperlink &&
          /链接|网址|url|link/i.test(rows[guessHeader(rows)]?.[i - 1] ?? "")
        )
          values.push((cell.value as ExcelJS.CellHyperlinkValue).hyperlink);
        else if (cell.type === ExcelJS.ValueType.Formula)
          values.push(cell.result == null ? "" : String(cell.result));
        else values.push(cell.text);
      }
      if (values.some((v) => v.trim())) rows.push(values);
    });
    if (rows.length) sheets.push({ name: sheet.name, rows });
  });
  if (!sheets.length) throw Error("没有可读取的数据");
  return sheets;
}
