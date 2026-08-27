import { jsPDF } from "jspdf";
import { formatIDR, formatDate } from "@/lib/format";

// Brand Color Palette Constants (RGB)
const BRAND_PRIMARY = [20, 90, 36] as const; // #145A24
const BRAND_EMERALD = [30, 125, 50] as const; // #1E7D32
const BRAND_MINT_BG = [240, 253, 244] as const; // #F0FDF4
const BRAND_MINT_BORDER = [187, 247, 208] as const; // #BBF7D0
const COLOR_TEXT_DARK = [15, 23, 42] as const; // #0F172A
const COLOR_TEXT_MUTED = [100, 116, 139] as const; // #64748B
const COLOR_BORDER = [226, 232, 240] as const; // #E2E8F0
const COLOR_BG_ALT = [248, 250, 252] as const; // #F8FAFC
const COLOR_ROSE = [225, 29, 72] as const; // #E11D48

/**
 * Draws the professional AA Jersey official document header.
 * Returns the Y coordinate where the body content should start.
 */
function drawBrandedHeader(
  doc: jsPDF,
  title: string,
  category: string,
  pageWidth: number,
  metaInfo?: { docNumber?: string; period?: string },
): number {
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;

  // 1. Top Brand Banner Bar
  doc.setFillColor(BRAND_PRIMARY[0], BRAND_PRIMARY[1], BRAND_PRIMARY[2]);
  doc.rect(0, 0, pageWidth, 5, "F");

  // 2. Header Box Background
  doc.setFillColor(255, 255, 255);
  doc.rect(marginX, 8, contentWidth, 32, "F");

  // 3. Brand Logo & Name
  doc.setFillColor(BRAND_EMERALD[0], BRAND_EMERALD[1], BRAND_EMERALD[2]);
  doc.roundedRect(marginX, 9, 8, 8, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("AA", marginX + 4, 14.5, { align: "center" });

  doc.setTextColor(BRAND_PRIMARY[0], BRAND_PRIMARY[1], BRAND_PRIMARY[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("AA JERSEY", marginX + 11, 15);

  doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Authentic Football Apparel & Official Merchandise Store", marginX + 11, 19.5);
  doc.text("support@aajersey.com | +62 812-3456-7890 | www.aajersey.com", marginX + 11, 23.5);

  // 4. Document Badge on Right Side
  const rightX = pageWidth - marginX;
  doc.setFillColor(BRAND_MINT_BG[0], BRAND_MINT_BG[1], BRAND_MINT_BG[2]);
  doc.setDrawColor(BRAND_MINT_BORDER[0], BRAND_MINT_BORDER[1], BRAND_MINT_BORDER[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(rightX - 70, 9, 70, 16, 2, 2, "FD");

  doc.setTextColor(BRAND_EMERALD[0], BRAND_EMERALD[1], BRAND_EMERALD[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(category.toUpperCase(), rightX - 35, 14, { align: "center" });

  doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  const docNum = metaInfo?.docNumber || `AAJ/RPT/${Date.now().toString().slice(-6)}`;
  doc.text(`No. Dok: ${docNum}`, rightX - 35, 18.5, { align: "center" });
  doc.text(`Cetak: ${formatDate(new Date())}`, rightX - 35, 22.5, { align: "center" });

  // 5. Divider Line
  doc.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]);
  doc.setLineWidth(0.5);
  doc.line(marginX, 29, rightX, 29);

  // 6. Report Title Bar
  doc.setTextColor(COLOR_TEXT_DARK[0], COLOR_TEXT_DARK[1], COLOR_TEXT_DARK[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, marginX, 36);

  if (metaInfo?.period) {
    doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Periode: ${metaInfo.period}`, rightX, 36, { align: "right" });
  }

  return 42; // Next content Y position
}

/**
 * Draws page footer with page number and confidentiality note
 */
function drawFooter(doc: jsPDF, pageWidth: number, pageHeight: number, totalPages: number) {
  const marginX = 14;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]);
    doc.setLineWidth(0.3);
    doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);

    doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(
      "Dokumen Resmi AA Jersey Store — Informasi Rahasia & Hak Cipta Dilindungi Undang-Undang",
      marginX,
      pageHeight - 7,
    );
    doc.text(`Halaman ${i} dari ${totalPages}`, pageWidth - marginX, pageHeight - 7, {
      align: "right",
    });
  }
}

/**
 * Draw 4 summary KPI cards in a row
 */
function drawKpiRow(
  doc: jsPDF,
  startY: number,
  pageWidth: number,
  cards: { label: string; value: string; sub: string; highlight?: boolean }[],
): number {
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;
  const gap = 3;
  const cardWidth = (contentWidth - gap * (cards.length - 1)) / cards.length;
  const cardHeight = 16;

  cards.forEach((card, idx) => {
    const cardX = marginX + idx * (cardWidth + gap);

    if (card.highlight) {
      doc.setFillColor(BRAND_MINT_BG[0], BRAND_MINT_BG[1], BRAND_MINT_BG[2]);
      doc.setDrawColor(BRAND_MINT_BORDER[0], BRAND_MINT_BORDER[1], BRAND_MINT_BORDER[2]);
    } else {
      doc.setFillColor(COLOR_BG_ALT[0], COLOR_BG_ALT[1], COLOR_BG_ALT[2]);
      doc.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]);
    }

    doc.setLineWidth(0.3);
    doc.roundedRect(cardX, startY, cardWidth, cardHeight, 1.5, 1.5, "FD");

    // Label
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    if (card.highlight) {
      doc.setTextColor(BRAND_EMERALD[0], BRAND_EMERALD[1], BRAND_EMERALD[2]);
    } else {
      doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
    }
    doc.text(card.label.toUpperCase(), cardX + 3, startY + 4.5);

    // Value
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    if (card.highlight) {
      doc.setTextColor(BRAND_EMERALD[0], BRAND_EMERALD[1], BRAND_EMERALD[2]);
    } else {
      doc.setTextColor(COLOR_TEXT_DARK[0], COLOR_TEXT_DARK[1], COLOR_TEXT_DARK[2]);
    }
    doc.text(card.value, cardX + 3, startY + 10.5);

    // Sub
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
    doc.text(card.sub, cardX + 3, startY + 14);
  });

  return startY + cardHeight + 6;
}

// -------------------------------------------------------------
// 1. PDF Laporan Analisis Keuntungan & Profitabilitas per Produk
// -------------------------------------------------------------
export interface ProductProfitItem {
  name: string;
  team: string;
  sold_count: number;
  stock: number;
  cost_price: number;
  price: number;
  total_omset: number;
  total_modal: number;
  total_laba: number;
  profit_margin: number;
}

export function generateProductProfitPDF(data: {
  products: ProductProfitItem[];
  totalOmset: number;
  totalModal: number;
  totalLaba: number;
  avgMargin: number;
  totalPcs: number;
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = 297;
  const pageHeight = 210;
  const marginX = 14;

  let currentY = drawBrandedHeader(
    doc,
    "LAPORAN ANALISIS PROFITABILITAS PER PRODUK",
    "Laporan Keuangan & HPP",
    pageWidth,
    { period: "Seluruh Periode Berjalan" },
  );

  // KPI Summary
  currentY = drawKpiRow(doc, currentY, pageWidth, [
    {
      label: "Total Omset Penjualan",
      value: formatIDR(data.totalOmset),
      sub: `Dari ${data.totalPcs} pcs jersey terjual`,
    },
    {
      label: "Total Beban Pokok (COGS)",
      value: formatIDR(data.totalModal),
      sub: "Beban modal stok produk terjual",
    },
    {
      label: "Total Keuntungan Bersih",
      value: formatIDR(data.totalLaba),
      sub: `Rata-rata Margin ${data.avgMargin.toFixed(1)}%`,
      highlight: true,
    },
    {
      label: "Katalog Terpantau",
      value: `${data.products.length} Produk`,
      sub: "Daftar inventaris jersey",
    },
  ]);

  // Table Columns Definition (Landscape A4: 269mm usable width)
  const columns = [
    { header: "NO", width: 10, align: "center" as const },
    { header: "NAMA PRODUK & TIM", width: 68, align: "left" as const },
    { header: "TERJUAL", width: 18, align: "center" as const },
    { header: "SISA", width: 15, align: "center" as const },
    { header: "MODAL/PCS", width: 25, align: "right" as const },
    { header: "HARGA JUAL", width: 25, align: "right" as const },
    { header: "TOTAL OMSET", width: 30, align: "right" as const },
    { header: "TOTAL MODAL", width: 30, align: "right" as const },
    { header: "LABA BERSIH", width: 30, align: "right" as const },
    { header: "MARGIN", width: 18, align: "center" as const },
  ];

  // Draw Table Header
  function drawTableHeader(y: number) {
    doc.setFillColor(BRAND_PRIMARY[0], BRAND_PRIMARY[1], BRAND_PRIMARY[2]);
    doc.rect(marginX, y, pageWidth - marginX * 2, 7, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);

    let curX = marginX;
    columns.forEach((col) => {
      let textX = curX + 2;
      if (col.align === "center") textX = curX + col.width / 2;
      else if (col.align === "right") textX = curX + col.width - 2;

      doc.text(col.header, textX, y + 4.8, { align: col.align });
      curX += col.width;
    });

    return y + 7;
  }

  currentY = drawTableHeader(currentY);

  const rowHeight = 6.5;
  data.products.forEach((p, idx) => {
    // Check page overflow
    if (currentY + rowHeight > pageHeight - 20) {
      doc.addPage();
      currentY = drawBrandedHeader(
        doc,
        "LAPORAN ANALISIS PROFITABILITAS PER PRODUK (LANJUTAN)",
        "Laporan Keuangan & HPP",
        pageWidth,
      );
      currentY = drawTableHeader(currentY + 2);
    }

    // Row Background (Zebra Striping)
    if (idx % 2 === 1) {
      doc.setFillColor(COLOR_BG_ALT[0], COLOR_BG_ALT[1], COLOR_BG_ALT[2]);
      doc.rect(marginX, currentY, pageWidth - marginX * 2, rowHeight, "F");
    }

    // Border line bottom
    doc.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]);
    doc.setLineWidth(0.2);
    doc.line(marginX, currentY + rowHeight, pageWidth - marginX, currentY + rowHeight);

    let curX = marginX;

    // No
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
    doc.text(String(idx + 1), curX + columns[0].width / 2, currentY + 4.5, { align: "center" });
    curX += columns[0].width;

    // Name & Team
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLOR_TEXT_DARK[0], COLOR_TEXT_DARK[1], COLOR_TEXT_DARK[2]);
    const cleanName = p.name.length > 34 ? p.name.slice(0, 32) + "..." : p.name;
    doc.text(cleanName, curX + 2, currentY + 3.2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
    doc.text(p.team || "—", curX + 2, currentY + 5.8);
    curX += columns[1].width;

    // Sold
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(COLOR_TEXT_DARK[0], COLOR_TEXT_DARK[1], COLOR_TEXT_DARK[2]);
    doc.text(String(p.sold_count), curX + columns[2].width / 2, currentY + 4.5, { align: "center" });
    curX += columns[2].width;

    // Stock
    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
    doc.text(String(p.stock), curX + columns[3].width / 2, currentY + 4.5, { align: "center" });
    curX += columns[3].width;

    // Cost Price
    doc.text(formatIDR(p.cost_price), curX + columns[4].width - 2, currentY + 4.5, {
      align: "right",
    });
    curX += columns[4].width;

    // Selling Price
    doc.setTextColor(COLOR_TEXT_DARK[0], COLOR_TEXT_DARK[1], COLOR_TEXT_DARK[2]);
    doc.text(formatIDR(p.price), curX + columns[5].width - 2, currentY + 4.5, { align: "right" });
    curX += columns[5].width;

    // Total Omset
    doc.setFont("helvetica", "bold");
    doc.text(formatIDR(p.total_omset), curX + columns[6].width - 2, currentY + 4.5, {
      align: "right",
    });
    curX += columns[6].width;

    // Total Modal
    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
    doc.text(formatIDR(p.total_modal), curX + columns[7].width - 2, currentY + 4.5, {
      align: "right",
    });
    curX += columns[7].width;

    // Total Laba
    doc.setFont("helvetica", "bold");
    if (p.total_laba > 0) {
      doc.setTextColor(BRAND_EMERALD[0], BRAND_EMERALD[1], BRAND_EMERALD[2]);
    } else if (p.total_laba < 0) {
      doc.setTextColor(COLOR_ROSE[0], COLOR_ROSE[1], COLOR_ROSE[2]);
    } else {
      doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
    }
    doc.text(formatIDR(p.total_laba), curX + columns[8].width - 2, currentY + 4.5, {
      align: "right",
    });
    curX += columns[8].width;

    // Margin
    if (p.sold_count > 0) {
      doc.text(`${p.profit_margin.toFixed(0)}%`, curX + columns[9].width / 2, currentY + 4.5, {
        align: "center",
      });
    } else {
      doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
      doc.text("—", curX + columns[9].width / 2, currentY + 4.5, { align: "center" });
    }

    currentY += rowHeight;
  });

  // Grand Total Summary Row
  if (currentY + 10 > pageHeight - 20) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFillColor(BRAND_MINT_BG[0], BRAND_MINT_BG[1], BRAND_MINT_BG[2]);
  doc.setDrawColor(BRAND_MINT_BORDER[0], BRAND_MINT_BORDER[1], BRAND_MINT_BORDER[2]);
  doc.setLineWidth(0.4);
  doc.rect(marginX, currentY, pageWidth - marginX * 2, 8, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(BRAND_PRIMARY[0], BRAND_PRIMARY[1], BRAND_PRIMARY[2]);
  doc.text("TOTAL KESELURUHAN:", marginX + 4, currentY + 5.2);

  // Total Omset, Modal, Laba in footer
  const totalOmsetX = marginX + 10 + 68 + 18 + 15 + 25 + 25 + 30;
  doc.text(formatIDR(data.totalOmset), totalOmsetX - 2, currentY + 5.2, { align: "right" });

  const totalModalX = totalOmsetX + 30;
  doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
  doc.text(formatIDR(data.totalModal), totalModalX - 2, currentY + 5.2, { align: "right" });

  const totalLabaX = totalModalX + 30;
  doc.setTextColor(BRAND_EMERALD[0], BRAND_EMERALD[1], BRAND_EMERALD[2]);
  doc.text(formatIDR(data.totalLaba), totalLabaX - 2, currentY + 5.2, { align: "right" });

  const totalMarginX = totalLabaX + 18;
  doc.text(`${data.avgMargin.toFixed(0)}%`, totalMarginX - 9, currentY + 5.2, { align: "center" });

  // Signature Block
  currentY += 14;
  if (currentY + 25 < pageHeight - 15) {
    const signX = pageWidth - marginX - 60;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
    doc.text("Diverifikasi & Disahkan,", signX, currentY);
    doc.text("Manajemen Keuangan AA Jersey", signX, currentY + 4);

    doc.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]);
    doc.line(signX, currentY + 18, signX + 50, currentY + 18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLOR_TEXT_DARK[0], COLOR_TEXT_DARK[1], COLOR_TEXT_DARK[2]);
    doc.text("( Authorized Signatory )", signX, currentY + 22);
  }

  // Draw Page Number Footers
  drawFooter(doc, pageWidth, pageHeight, doc.getNumberOfPages());

  doc.save(`Laporan-Profit-Produk-AAJersey-${Date.now().toString().slice(-6)}.pdf`);
}

// -------------------------------------------------------------
// 2. PDF Laporan Rekapitulasi Omset & Profit Bulanan
// -------------------------------------------------------------
export interface MonthlyProfitItem {
  month: string;
  revenue: number;
  cost: number;
  profit: number;
}

export function generateMonthlyProfitPDF(data: {
  monthlyList: MonthlyProfitItem[];
  totalOmset: number;
  totalModal: number;
  totalLaba: number;
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 14;

  let currentY = drawBrandedHeader(
    doc,
    "LAPORAN REKAPITULASI OMSET & PROFIT BULANAN",
    "Laporan Arus Kas & Periode",
    pageWidth,
    { period: "Rekapitulasi Tahun Berjalan" },
  );

  const avgMargin = data.totalOmset > 0 ? (data.totalLaba / data.totalOmset) * 100 : 0;

  // KPI Row
  currentY = drawKpiRow(doc, currentY, pageWidth, [
    {
      label: "Total Omset",
      value: formatIDR(data.totalOmset),
      sub: "Pendapatan kotor",
    },
    {
      label: "Total Modal",
      value: formatIDR(data.totalModal),
      sub: "Beban pokok (COGS)",
    },
    {
      label: "Keuntungan Bersih",
      value: formatIDR(data.totalLaba),
      sub: `Margin ${avgMargin.toFixed(1)}%`,
      highlight: true,
    },
  ]);

  // Table Columns (Portrait A4: 182mm usable width)
  const columns = [
    { header: "NO", width: 12, align: "center" as const },
    { header: "BULAN / PERIODE", width: 45, align: "left" as const },
    { header: "TOTAL OMSET", width: 35, align: "right" as const },
    { header: "TOTAL MODAL (HPP)", width: 35, align: "right" as const },
    { header: "LABA BERSIH", width: 35, align: "right" as const },
    { header: "MARGIN", width: 20, align: "center" as const },
  ];

  // Draw Table Header
  doc.setFillColor(BRAND_PRIMARY[0], BRAND_PRIMARY[1], BRAND_PRIMARY[2]);
  doc.rect(marginX, currentY, pageWidth - marginX * 2, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);

  let curX = marginX;
  columns.forEach((col) => {
    let textX = curX + 2;
    if (col.align === "center") textX = curX + col.width / 2;
    else if (col.align === "right") textX = curX + col.width - 2;
    doc.text(col.header, textX, currentY + 4.8, { align: col.align });
    curX += col.width;
  });

  currentY += 7;

  const rowHeight = 7.5;
  data.monthlyList.forEach((m, idx) => {
    const margin = m.revenue > 0 ? (m.profit / m.revenue) * 100 : 0;

    if (idx % 2 === 1) {
      doc.setFillColor(COLOR_BG_ALT[0], COLOR_BG_ALT[1], COLOR_BG_ALT[2]);
      doc.rect(marginX, currentY, pageWidth - marginX * 2, rowHeight, "F");
    }

    doc.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]);
    doc.setLineWidth(0.2);
    doc.line(marginX, currentY + rowHeight, pageWidth - marginX, currentY + rowHeight);

    let cellX = marginX;

    // No
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
    doc.text(String(idx + 1), cellX + columns[0].width / 2, currentY + 5, { align: "center" });
    cellX += columns[0].width;

    // Month
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLOR_TEXT_DARK[0], COLOR_TEXT_DARK[1], COLOR_TEXT_DARK[2]);
    doc.text(m.month, cellX + 3, currentY + 5);
    cellX += columns[1].width;

    // Omset
    doc.text(formatIDR(m.revenue), cellX + columns[2].width - 2, currentY + 5, { align: "right" });
    cellX += columns[2].width;

    // Modal
    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
    doc.text(formatIDR(m.cost), cellX + columns[3].width - 2, currentY + 5, { align: "right" });
    cellX += columns[3].width;

    // Laba
    doc.setFont("helvetica", "bold");
    doc.setTextColor(BRAND_EMERALD[0], BRAND_EMERALD[1], BRAND_EMERALD[2]);
    doc.text(formatIDR(m.profit), cellX + columns[4].width - 2, currentY + 5, { align: "right" });
    cellX += columns[4].width;

    // Margin
    doc.text(`${margin.toFixed(0)}%`, cellX + columns[5].width / 2, currentY + 5, {
      align: "center",
    });

    currentY += rowHeight;
  });

  // Grand Total Row
  doc.setFillColor(BRAND_MINT_BG[0], BRAND_MINT_BG[1], BRAND_MINT_BG[2]);
  doc.setDrawColor(BRAND_MINT_BORDER[0], BRAND_MINT_BORDER[1], BRAND_MINT_BORDER[2]);
  doc.setLineWidth(0.4);
  doc.rect(marginX, currentY, pageWidth - marginX * 2, 8.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(BRAND_PRIMARY[0], BRAND_PRIMARY[1], BRAND_PRIMARY[2]);
  doc.text("TOTAL KESELURUHAN:", marginX + 4, currentY + 5.5);

  const totalOmsetX = marginX + 12 + 45 + 35;
  doc.text(formatIDR(data.totalOmset), totalOmsetX - 2, currentY + 5.5, { align: "right" });

  const totalModalX = totalOmsetX + 35;
  doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
  doc.text(formatIDR(data.totalModal), totalModalX - 2, currentY + 5.5, { align: "right" });

  const totalLabaX = totalModalX + 35;
  doc.setTextColor(BRAND_EMERALD[0], BRAND_EMERALD[1], BRAND_EMERALD[2]);
  doc.text(formatIDR(data.totalLaba), totalLabaX - 2, currentY + 5.5, { align: "right" });

  const totalMarginX = totalLabaX + 20;
  doc.text(`${avgMargin.toFixed(0)}%`, totalMarginX - 10, currentY + 5.5, { align: "center" });

  // Signature Block
  currentY += 16;
  const signX = pageWidth - marginX - 60;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
  doc.text("Diverifikasi & Disahkan,", signX, currentY);
  doc.text("Manajemen Keuangan AA Jersey", signX, currentY + 4);

  doc.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]);
  doc.line(signX, currentY + 18, signX + 50, currentY + 18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(COLOR_TEXT_DARK[0], COLOR_TEXT_DARK[1], COLOR_TEXT_DARK[2]);
  doc.text("( Authorized Signatory )", signX, currentY + 22);

  drawFooter(doc, pageWidth, pageHeight, doc.getNumberOfPages());
  doc.save(`Laporan-Bulanan-AAJersey-${Date.now().toString().slice(-6)}.pdf`);
}

// -------------------------------------------------------------
// 3. PDF Laporan Transaksi Pesanan Lengkap
// -------------------------------------------------------------
export function generateOrdersReportPDF(orders: any[]) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = 297;
  const pageHeight = 210;
  const marginX = 14;

  let currentY = drawBrandedHeader(
    doc,
    "LAPORAN TRANSAKSI PESANAN LENGKAP",
    "Laporan Transaksi & Logistik",
    pageWidth,
    { period: `Total ${orders.length} Transaksi Terdata` },
  );

  const totalAmount = orders.reduce(
    (s, o) =>
      s +
      Number(
        o.grand_total ||
          Number(o.subtotal || 0) + Number(o.shipping_cost || 0) - Number(o.discount_amount || 0),
      ),
    0,
  );
  const paidOrders = orders.filter((o) => {
    const rawStatus = (o.status || "").toLowerCase();
    const payment = Array.isArray(o.payments) ? o.payments[0] : o.payments;
    const paymentRaw = (payment?.status || "").toLowerCase();
    return (
      ["paid", "settlement", "success", "capture"].includes(paymentRaw) ||
      ["paid", "processing", "shipped", "delivered"].includes(rawStatus)
    );
  });

  // KPI Row
  currentY = drawKpiRow(doc, currentY, pageWidth, [
    {
      label: "Total Nilai Transaksi",
      value: formatIDR(totalAmount),
      sub: `Dari ${orders.length} transaksi`,
      highlight: true,
    },
    {
      label: "Pesanan Berhasil / Lunas",
      value: `${paidOrders.length} Pesanan`,
      sub: "Lunas / Terkirim",
    },
    {
      label: "Pesanan Pending / Batal",
      value: `${orders.length - paidOrders.length} Pesanan`,
      sub: "Menunggu / Dibatalkan",
    },
  ]);

  const columns = [
    { header: "NO", width: 10, align: "center" as const },
    { header: "NO. PESANAN", width: 35, align: "left" as const },
    { header: "TANGGAL", width: 28, align: "center" as const },
    { header: "NAMA PELANGGAN", width: 45, align: "left" as const },
    { header: "STATUS ORDER", width: 28, align: "center" as const },
    { header: "PEMBAYARAN", width: 28, align: "center" as const },
    { header: "METODE / KURIR", width: 45, align: "left" as const },
    { header: "TOTAL BAYAR", width: 50, align: "right" as const },
  ];

  function drawTableHeader(y: number) {
    doc.setFillColor(BRAND_PRIMARY[0], BRAND_PRIMARY[1], BRAND_PRIMARY[2]);
    doc.rect(marginX, y, pageWidth - marginX * 2, 7, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);

    let curX = marginX;
    columns.forEach((col) => {
      let textX = curX + 2;
      if (col.align === "center") textX = curX + col.width / 2;
      else if (col.align === "right") textX = curX + col.width - 2;

      doc.text(col.header, textX, y + 4.8, { align: col.align });
      curX += col.width;
    });

    return y + 7;
  }

  currentY = drawTableHeader(currentY);
  const rowHeight = 6.5;

  orders.forEach((o, idx) => {
    if (currentY + rowHeight > pageHeight - 20) {
      doc.addPage();
      currentY = drawBrandedHeader(
        doc,
        "LAPORAN TRANSAKSI PESANAN LENGKAP (LANJUTAN)",
        "Laporan Transaksi & Logistik",
        pageWidth,
      );
      currentY = drawTableHeader(currentY + 2);
    }

    if (idx % 2 === 1) {
      doc.setFillColor(COLOR_BG_ALT[0], COLOR_BG_ALT[1], COLOR_BG_ALT[2]);
      doc.rect(marginX, currentY, pageWidth - marginX * 2, rowHeight, "F");
    }

    doc.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]);
    doc.setLineWidth(0.2);
    doc.line(marginX, currentY + rowHeight, pageWidth - marginX, currentY + rowHeight);

    let cellX = marginX;

    // No
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
    doc.text(String(idx + 1), cellX + columns[0].width / 2, currentY + 4.5, { align: "center" });
    cellX += columns[0].width;

    // Order Number
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLOR_TEXT_DARK[0], COLOR_TEXT_DARK[1], COLOR_TEXT_DARK[2]);
    doc.text(o.order_number || o.id?.slice(0, 8) || "—", cellX + 2, currentY + 4.5);
    cellX += columns[1].width;

    // Date
    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
    doc.text(formatDate(o.created_at || new Date()), cellX + columns[2].width / 2, currentY + 4.5, {
      align: "center",
    });
    cellX += columns[2].width;

    // Customer Name (Extract real recipient_name, customer_name, profiles, or fallback)
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLOR_TEXT_DARK[0], COLOR_TEXT_DARK[1], COLOR_TEXT_DARK[2]);
    const rawCustName =
      o.recipient_name ||
      o.customer_name ||
      o.profiles?.nama_lengkap ||
      o.shipping_address?.nama_penerima ||
      (o.order_number?.startsWith("POS-") ? "Pelanggan Offline" : "Pelanggan Online");
    const custName = String(rawCustName).trim();
    doc.text(custName.slice(0, 24), cellX + 2, currentY + 4.5);
    cellX += columns[3].width;

    // Order Status
    doc.setFont("helvetica", "bold");
    const rawStatus = (o.status || "pending").toLowerCase();
    const statusMap: Record<string, string> = {
      delivered: "DELIVERED",
      shipped: "SHIPPED",
      processing: "PROCESSING",
      paid: "PAID",
      pending: "PENDING",
      cancelled: "CANCELLED",
    };
    const statusText = statusMap[rawStatus] || rawStatus.toUpperCase();
    if (["PAID", "DELIVERED", "SHIPPED"].includes(statusText)) {
      doc.setTextColor(BRAND_EMERALD[0], BRAND_EMERALD[1], BRAND_EMERALD[2]);
    } else if (["CANCELLED"].includes(statusText)) {
      doc.setTextColor(COLOR_ROSE[0], COLOR_ROSE[1], COLOR_ROSE[2]);
    } else {
      doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
    }
    doc.text(statusText, cellX + columns[4].width / 2, currentY + 4.5, { align: "center" });
    cellX += columns[4].width;

    // Payment Status
    doc.setFont("helvetica", "normal");
    const payment = Array.isArray(o.payments) ? o.payments[0] : o.payments;
    const paymentRaw = (payment?.status || "").toLowerCase();
    const isLunas =
      ["paid", "settlement", "success", "capture"].includes(paymentRaw) ||
      ["paid", "processing", "shipped", "delivered"].includes(rawStatus);
    const paymentStatus = isLunas ? "LUNAS" : rawStatus === "cancelled" ? "BATAL" : "PENDING";
    if (paymentStatus === "LUNAS") {
      doc.setTextColor(BRAND_EMERALD[0], BRAND_EMERALD[1], BRAND_EMERALD[2]);
      doc.setFont("helvetica", "bold");
    } else {
      doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
      doc.setFont("helvetica", "normal");
    }
    doc.text(paymentStatus, cellX + columns[5].width / 2, currentY + 4.5, { align: "center" });
    cellX += columns[5].width;

    // Courier / Method (Real extraction)
    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
    let courierName = o.courier || (o.order_number?.startsWith("POS-") ? "Outlet Kasir" : "Kurir Standar");
    if (courierName.includes(" - ")) {
      courierName = courierName.split(" - ")[0];
    }
    if (courierName.length > 12) {
      courierName = courierName.slice(0, 12);
    }

    let payMethodName = "Transfer";
    if (payment?.bank) {
      payMethodName = payment.bank.toUpperCase();
    } else if (payment?.method) {
      payMethodName =
        payment.method === "manual_transfer"
          ? "Manual TF"
          : payment.method.toUpperCase().slice(0, 10);
    } else if (o.order_number?.startsWith("POS-")) {
      payMethodName = (o.note || "").toLowerCase().includes("tunai") ? "Tunai" : "POS Kasir";
    }

    const courierText = `${courierName} · ${payMethodName}`;
    doc.text(courierText.slice(0, 24), cellX + 2, currentY + 4.5);
    cellX += columns[6].width;

    // Total Grand Total (Real calculation)
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLOR_TEXT_DARK[0], COLOR_TEXT_DARK[1], COLOR_TEXT_DARK[2]);
    const orderTotal = Number(
      o.grand_total ||
        Number(o.subtotal || 0) + Number(o.shipping_cost || 0) - Number(o.discount_amount || 0),
    );
    doc.text(formatIDR(orderTotal), cellX + columns[7].width - 2, currentY + 4.5, {
      align: "right",
    });

    currentY += rowHeight;
  });

  // Grand Total Row
  if (currentY + 10 > pageHeight - 20) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFillColor(BRAND_MINT_BG[0], BRAND_MINT_BG[1], BRAND_MINT_BG[2]);
  doc.setDrawColor(BRAND_MINT_BORDER[0], BRAND_MINT_BORDER[1], BRAND_MINT_BORDER[2]);
  doc.setLineWidth(0.4);
  doc.rect(marginX, currentY, pageWidth - marginX * 2, 8, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(BRAND_PRIMARY[0], BRAND_PRIMARY[1], BRAND_PRIMARY[2]);
  doc.text("TOTAL TRANSAKSI KESELURUHAN:", marginX + 4, currentY + 5.2);

  doc.text(formatIDR(totalAmount), pageWidth - marginX - 2, currentY + 5.2, { align: "right" });

  drawFooter(doc, pageWidth, pageHeight, doc.getNumberOfPages());
  doc.save(`Laporan-Pesanan-AAJersey-${Date.now().toString().slice(-6)}.pdf`);
}

// -------------------------------------------------------------
// 4. PDF Laporan Analisis Strategi Penjualan AI
// -------------------------------------------------------------
export function generateAIReportPDF(analysisText: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;

  let currentY = drawBrandedHeader(
    doc,
    "LAPORAN STRATEGIS ANALISIS PENJUALAN AI",
    "Laporan Intelijen Bisnis",
    pageWidth,
    { period: "Analisis Intelijen & Rekomendasi Bisnis" },
  );

  // Intro Callout Box
  doc.setFillColor(BRAND_MINT_BG[0], BRAND_MINT_BG[1], BRAND_MINT_BG[2]);
  doc.setDrawColor(BRAND_MINT_BORDER[0], BRAND_MINT_BORDER[1], BRAND_MINT_BORDER[2]);
  doc.setLineWidth(0.4);
  doc.roundedRect(marginX, currentY, contentWidth, 12, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(BRAND_PRIMARY[0], BRAND_PRIMARY[1], BRAND_PRIMARY[2]);
  doc.text("RINGKASAN EKSEKUTIF PENJUALAN & STRATEGI BISNIS", marginX + 4, currentY + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
  doc.text(
    "Dihasilkan otomatis menggunakan model kecerdasan buatan berbasis data transaksi aktual toko AA Jersey.",
    marginX + 4,
    currentY + 9,
  );

  currentY += 16;

  // Function to ensure page break if needed
  function checkPageBreak(neededHeight: number) {
    if (currentY + neededHeight > pageHeight - 22) {
      doc.addPage();
      currentY = drawBrandedHeader(
        doc,
        "LAPORAN STRATEGIS ANALISIS PENJUALAN AI (LANJUTAN)",
        "Laporan Intelijen Bisnis",
        pageWidth,
      );
      currentY += 4;
    }
  }

  // Parse lines of markdown text
  const rawLines = analysisText.split("\n");

  rawLines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      currentY += 2;
      return;
    }

    // 1. Heading 2 (## ...)
    if (line.startsWith("## ")) {
      checkPageBreak(14);
      currentY += 3;
      const headingText = line.replace(/^##\s+/, "").replace(/\*\*/g, "");

      // Draw emerald accent pill/bar on left of heading
      doc.setFillColor(BRAND_PRIMARY[0], BRAND_PRIMARY[1], BRAND_PRIMARY[2]);
      doc.rect(marginX, currentY, 2.5, 5.5, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(BRAND_PRIMARY[0], BRAND_PRIMARY[1], BRAND_PRIMARY[2]);
      doc.text(headingText, marginX + 5, currentY + 4.2);

      currentY += 7.5;
      return;
    }

    // 2. Heading 3 (### ...)
    if (line.startsWith("### ")) {
      checkPageBreak(10);
      currentY += 2;
      const headingText = line.replace(/^###\s+/, "").replace(/\*\*/g, "");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(COLOR_TEXT_DARK[0], COLOR_TEXT_DARK[1], COLOR_TEXT_DARK[2]);
      doc.text(headingText, marginX, currentY + 3.5);

      currentY += 6;
      return;
    }

    // 3. Bullet Point (- ... or * ... or 1. ...)
    if (line.startsWith("- ") || line.startsWith("* ") || line.match(/^\d+\.\s/)) {
      const cleanItem = line.replace(/^([-*]|\d+\.)\s+/, "").replace(/\*\*/g, "");
      const wrappedLines = doc.splitTextToSize(cleanItem, contentWidth - 8);
      const itemHeight = wrappedLines.length * 4.2;

      checkPageBreak(itemHeight + 2);

      // Draw emerald bullet dot
      doc.setFillColor(BRAND_EMERALD[0], BRAND_EMERALD[1], BRAND_EMERALD[2]);
      doc.circle(marginX + 2.5, currentY + 2.2, 0.8, "F");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(COLOR_TEXT_DARK[0], COLOR_TEXT_DARK[1], COLOR_TEXT_DARK[2]);

      wrappedLines.forEach((wl: string) => {
        doc.text(wl, marginX + 6, currentY + 3);
        currentY += 4.2;
      });

      currentY += 1;
      return;
    }

    // 4. Regular Paragraph Text
    const cleanText = line.replace(/\*\*/g, "");
    const wrappedLines = doc.splitTextToSize(cleanText, contentWidth);
    const paraHeight = wrappedLines.length * 4.2;

    checkPageBreak(paraHeight + 2);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(COLOR_TEXT_DARK[0], COLOR_TEXT_DARK[1], COLOR_TEXT_DARK[2]);

    wrappedLines.forEach((wl: string) => {
      doc.text(wl, marginX, currentY + 3);
      currentY += 4.2;
    });

    currentY += 2;
  });

  // Signature Block
  checkPageBreak(25);
  currentY += 8;
  const signX = pageWidth - marginX - 60;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
  doc.text("Diverifikasi & Diterbitkan,", signX, currentY);
  doc.text("Divisi Analitik AA Jersey Store", signX, currentY + 4);

  doc.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]);
  doc.line(signX, currentY + 18, signX + 50, currentY + 18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(COLOR_TEXT_DARK[0], COLOR_TEXT_DARK[1], COLOR_TEXT_DARK[2]);
  doc.text("( Automated AI Officer )", signX, currentY + 22);

  drawFooter(doc, pageWidth, pageHeight, doc.getNumberOfPages());
  doc.save(`Laporan-Analisis-AI-AAJersey-${Date.now().toString().slice(-6)}.pdf`);
}
