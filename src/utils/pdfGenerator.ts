import jsPDF from "jspdf";
import type { SupportedAsset } from "../types";
import { formatSwissNumber } from "./formatNumber";

const hashAddress = async (address: string): Promise<string> => {
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(address));
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

// Rasterise an SVG into a base64 PNG at the requested pixel dimensions.
// We use this instead of jsPDF's addSvgAsImage / svg2pdf.js to avoid a new
// dependency — the canvas/Image round-trip works in every modern browser and
// gives a crisp result because we size the canvas to the final PDF size.
const svgToPngDataUrl = async (
  svgUrl: string,
  pixelWidth: number,
  pixelHeight: number,
): Promise<string> => {
  const response = await fetch(svgUrl);
  if (!response.ok) {
    throw new Error(`Failed to load SVG ${svgUrl}: ${response.status}`);
  }
  const svgText = await response.text();
  const svgBlobUrl = URL.createObjectURL(
    new Blob([svgText], { type: "image/svg+xml;charset=utf-8" }),
  );

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Image decode failed for ${svgUrl}`));
      image.src = svgBlobUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(img, 0, 0, pixelWidth, pixelHeight);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(svgBlobUrl);
  }
};

interface PDFParams {
  formData: {
    date: string;
    network: string;
    asset: SupportedAsset;
    address: string;
  };
  balance: string | null;
  prices?: {
    usd: number;
    eur: number;
    chf: number;
  } | null;
  selectedCurrency: string;
}

export const generateWalletBalancePDF = async ({
  formData,
  balance,
  prices,
  selectedCurrency,
}: PDFParams): Promise<void> => {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Render the new LedgerReport brand: logomark on the left, wordmark on the
    // right, centred together at the top of the page. SVG sources live in
    // /assets so we rasterise them to PNG (canvas-based) before handing to
    // jsPDF.
    try {
      // Native aspect ratios pulled from the source SVG viewBoxes.
      const logomarkAspect = 45.9736 / 41.7461;
      const wordmarkAspect = 242.688 / 38.1413;

      // Target PDF dimensions (mm). The wordmark drives the visual height;
      // the logomark matches its height and computes its width from aspect.
      const wordmarkHeightMm = 10;
      const wordmarkWidthMm = wordmarkHeightMm * wordmarkAspect;
      const logomarkHeightMm = 12;
      const logomarkWidthMm = logomarkHeightMm * logomarkAspect;
      const gapMm = 4;

      const totalWidthMm = logomarkWidthMm + gapMm + wordmarkWidthMm;
      const startX = (pageWidth - totalWidthMm) / 2;
      const brandTopY = 28;
      // The wordmark sits at the same optical centre as the logomark.
      const wordmarkY = brandTopY + (logomarkHeightMm - wordmarkHeightMm) / 2;

      // Rasterise at ~3x for crisp output on print zoom. mm × 2.83465 = points,
      // and we want roughly 3x device pixels.
      const px = (mm: number) => Math.round(mm * 11.81); // ≈ 300 DPI

      const [logomarkPng, wordmarkPng] = await Promise.all([
        svgToPngDataUrl("/assets/logo-logomark.svg", px(logomarkWidthMm), px(logomarkHeightMm)),
        svgToPngDataUrl("/assets/logo-wordmark.svg", px(wordmarkWidthMm), px(wordmarkHeightMm)),
      ]);

      doc.addImage(logomarkPng, "PNG", startX, brandTopY, logomarkWidthMm, logomarkHeightMm);
      doc.addImage(
        wordmarkPng,
        "PNG",
        startX + logomarkWidthMm + gapMm,
        wordmarkY,
        wordmarkWidthMm,
        wordmarkHeightMm,
      );

      // Add title left-aligned below the brand strip.
      doc.setFontSize(20);
      doc.text("Wallet Balance Report for Tax Purposes", 20, brandTopY + logomarkHeightMm + 16);
    } catch (logoError) {
      console.warn("Logo failed, continuing without:", logoError);
      doc.setFontSize(20);
      doc.text("Wallet Balance Report for Tax Purposes", 20, 30);
    }

    // Determine starting Y position based on whether logo loaded
    const startY = 110;

    // Add horizontal line above data section
    doc.setLineWidth(0.5);
    doc.line(20, startY, pageWidth - 20, startY);

    // Layout: a running Y cursor that advances per row. Adding or removing
    // rows here is a single insertion — no need to recompute every following
    // offset.
    const labelX = 20;      // X position for labels
    const valueX = 60;      // X position for values (aligned column)
    const rowGap = 10;      // vertical distance between successive rows
    let y = startY + 12.5;

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");

    // Print labels and values separately for perfect alignment
    doc.text("Date:", labelX, y);
    doc.text(formData.date || "Not specified", valueX, y);
    y += rowGap;

    doc.text("Network:", labelX, y);
    doc.text(formData.network || "Not specified", valueX, y);
    y += rowGap;

    doc.text("Token:", labelX, y);
    doc.text(formData.asset.name || "Not specified", valueX, y);
    y += rowGap;

    // Hash the address for privacy
    const addressHash = (await hashAddress(formData.address)).substring(0, 16);
    doc.text("Address Hash:", labelX, y);
    doc.text(addressHash, valueX, y);
    y += rowGap * 2; // extra spacer before the balance block

    // Add balance if available
    if (balance) {
      doc.setFont(undefined, "bold");
      doc.text("Balance:", labelX, y);
      doc.text(`${balance} ${formData.asset.name || "tokens"}`, valueX, y);
      doc.setFont(undefined, "normal");
      y += rowGap;

      // Add currency value if prices are available
      if (prices) {
        const currency = selectedCurrency.toLowerCase() as keyof typeof prices;
        const rate = prices[currency];
        const currencyValue = formatSwissNumber(parseFloat(balance) * rate);

        doc.text(`In ${selectedCurrency}:`, labelX, y);
        doc.text(currencyValue, valueX, y);
        y += rowGap;
      }
    } else {
      doc.setFont(undefined, "bold");
      doc.text("Balance:", labelX, y);
      doc.text("Not yet fetched", valueX, y);
      doc.setFont(undefined, "normal");
      y += rowGap;
    }

    // Add horizontal line below data section
    doc.line(20, y, pageWidth - 20, y);

    // Add footer at the bottom of the page
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0); // Reset to black

    const currentDate = new Date();
    const formattedDate = `${currentDate.getDate()}.${(currentDate.getMonth() + 1)}.${currentDate.getFullYear()}`;
    const formattedTime = `${currentDate.getHours().toString().padStart(2, '0')}:${currentDate.getMinutes().toString().padStart(2, '0')}:${currentDate.getSeconds().toString().padStart(2, '0')}`;

    doc.text("Data generated with LedgerReport.com - Historical Wallet Balance Checker", 20, pageHeight - 20);
    doc.text(`Generated on: ${formattedDate}, ${formattedTime}`, 20, pageHeight - 15);

    // Save the PDF
    doc.save(`wallet-balance-${formData.date || "report"}.pdf`);
  } catch (error) {
    console.error("PDF generation failed:", error);
    throw new Error(`Failed to generate PDF: ${error}`);
  }
};