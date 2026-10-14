type ExcelColumn<T> = {
  header: string;
  value: keyof T | ((row: T) => unknown);
};

type ExportExcelOptions<T> = {
  filename: string;
  sheetName?: string;
  columns: ExcelColumn<T>[];
  rows: T[];
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const sanitizeFilename = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

const protectFromFormulaInjection = (value: string) =>
  /^[=+\-@]/.test(value.trim()) ? `'${value}` : value;

const getCellValue = <T,>(row: T, column: ExcelColumn<T>) => {
  const rawValue = typeof column.value === "function" ? column.value(row) : row[column.value];

  if (rawValue === null || rawValue === undefined) return "";
  if (typeof rawValue === "number" || typeof rawValue === "bigint") return String(rawValue);
  if (typeof rawValue === "boolean") return rawValue ? "Sim" : "Não";

  return protectFromFormulaInjection(String(rawValue));
};

export function exportRowsToExcel<T>({ filename, sheetName, columns, rows }: ExportExcelOptions<T>) {
  const safeFilename = sanitizeFilename(filename) || "exportacao";
  const safeSheetName = escapeHtml(sheetName || "Planilha");

  const headers = columns
    .map((column) => `<th>${escapeHtml(column.header)}</th>`)
    .join("");

  const body = rows
    .map((row) => {
      const cells = columns
        .map((column) => `<td>${escapeHtml(getCellValue(row, column))}</td>`)
        .join("");

      return `<tr>${cells}</tr>`;
    })
    .join("");

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <meta name="ProgId" content="Excel.Sheet" />
        <meta name="Generator" content="Codex" />
        <title>${safeSheetName}</title>
        <style>
          body { font-family: Calibri, Arial, sans-serif; padding: 16px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #d6d9e0; padding: 8px 10px; font-size: 12px; text-align: left; vertical-align: top; }
          th { background: #f3f4f6; font-weight: 700; }
          tr:nth-child(even) td { background: #fafafa; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>${headers}</tr>
          </thead>
          <tbody>
            ${body}
          </tbody>
        </table>
      </body>
    </html>
  `.trim();

  const blob = new Blob(["\ufeff", html], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeFilename}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
