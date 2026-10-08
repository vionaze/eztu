import "server-only";

import * as XLSX from "xlsx";

export type DeliveryExportLine = {
  productName: string;
  quantity: number;
  supplierTid: string | null;
  codes: string[];
};

export const DELIVERY_SHEET_COLUMNS = [
  "Product Name",
  "Reference Number",
  "Transaction ID",
  "Delivery Name",
  "Delivery To",
  "Voucher",
  "Voucher Pin",
  "Account Data",
  "Note",
  "Status",
  "Reason (If Failed)",
] as const;

/**
 * Mirrors the supplier order-details export: one row per delivered voucher,
 * so resellers can forward the file straight to their own customers.
 */
export function buildOrderDetailsWorkbook(params: {
  reference: string;
  orderNumber: string;
  lines: DeliveryExportLine[];
}) {
  const rows: (string | null)[][] = [];
  for (const [index, line] of params.lines.entries()) {
    const transactionId = line.supplierTid ?? `${params.orderNumber}-${index + 1}`;
    const codes = line.codes.length ? line.codes : [""];
    for (const code of codes) {
      rows.push([
        line.productName,
        params.reference,
        transactionId,
        null,
        "*",
        code || "-",
        "-",
        "-",
        "-",
        "Success",
        null,
      ]);
    }
  }

  const sheet = XLSX.utils.aoa_to_sheet([[...DELIVERY_SHEET_COLUMNS], ...rows]);
  sheet["!cols"] = [
    { wch: 42 }, { wch: 18 }, { wch: 34 }, { wch: 14 }, { wch: 12 }, { wch: 24 },
    { wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 10 }, { wch: 18 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "data");
  return XLSX.write(workbook, { type: "base64", bookType: "xlsx" }) as string;
}

export function orderDetailsFilename(orderNumber: string) {
  return `order_details_${orderNumber.replace(/[^A-Za-z0-9_-]/g, "")}.xlsx`;
}
