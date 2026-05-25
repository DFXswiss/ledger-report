import jsPDF from "jspdf";
import type { Blockchain, Currency, SupportedAsset } from "../types";
import { formatSwissNumber } from "./formatNumber";
import { blockchainLabel } from "./blockchainLabel";

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
    network: Blockchain;
    asset: SupportedAsset;
    address: string;
  };
  balance: string | null;
  prices?: {
    usd: number;
    eur: number;
    chf: number;
  } | null;
  selectedCurrency: Currency;
}

export const generateWalletBalancePDF = async ({
  formData,
  balance,
  prices,
  selectedCurrency,
}: PDFParams): Promise<void> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Render the new LedgerReport brand: logomark on the left, wordmark on the
  // right, centred together at the top of the page. SVG sources live in
  // /assets so we rasterise them to PNG (canvas-based) before handing to
  // jsPDF.
  //
  // No try/catch around the brand: a tax-grade artifact without
  // identification is exactly the kind of degraded result the
  // no-silent-degradation rule forbids. If rasterisation fails the throw
  // bubbles up to App.tsx's submit handler and surfaces in the error banner.

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
  const titleY = brandTopY + logomarkHeightMm + 16;
  doc.setFontSize(20);
  doc.text("Wallet Balance Report for Tax, Audit, and Accounting", 20, titleY);

  // Derive the data block's top edge from the title so the layout stays
  // compact instead of leaving a hardcoded ~5cm dead band between brand and
  // data. The 8mm offset puts the rule a comfortable distance below the
  // descender line of the title text.
  const startY = titleY + 8;

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

  // Render the snapshot date in Swiss DD.MM.YYYY so it matches the on-screen
  // input format (the date input renders in user locale, de-CH being the
  // primary audience). Parsed by hand from the ISO string to stay
  // locale-independent on the Node-built test path.
  const [isoY, isoM, isoD] = formData.date.split("-");
  const dateSwiss = `${isoD}.${isoM}.${isoY}`;

  // Print labels and values separately for perfect alignment. No silent
  // "Not specified" fallbacks: by the time canGeneratePdf gates this call,
  // every field below is populated. A future refactor that makes one
  // optional should surface a thrown error, not paper a placeholder into a
  // tax document.
  doc.text("Date:", labelX, y);
  doc.text(dateSwiss, valueX, y);
  y += rowGap;

  doc.text("Network:", labelX, y);
  doc.text(blockchainLabel(formData.network), valueX, y);
  y += rowGap;

  doc.text("Token:", labelX, y);
  doc.text(formData.asset.name, valueX, y);
  y += rowGap;

  // Hash the address for privacy
  const addressHash = (await hashAddress(formData.address)).substring(0, 16);
  doc.text("Address Hash:", labelX, y);
  doc.text(addressHash, valueX, y);
  y += rowGap * 2; // extra spacer before the balance block

  // Add balance if available
  if (balance) {
    doc.setFont("helvetica", "bold");
    doc.text("Balance:", labelX, y);
    doc.text(`${balance} ${formData.asset.name}`, valueX, y);
    doc.setFont("helvetica", "normal");
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
    doc.setFont("helvetica", "bold");
    doc.text("Balance:", labelX, y);
    doc.text("Not yet fetched", valueX, y);
    doc.setFont("helvetica", "normal");
    y += rowGap;
  }

  // Add horizontal line below data section
  doc.line(20, y, pageWidth - 20, y);

  // Add footer at the bottom of the page
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0); // Reset to black

  // Local-time YYYY-MM-DD HH:MM:SS — free of locale-specific separators.
  // Single-user PDF, so local time is the right reference frame for the
  // reader.
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const generatedOn =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  doc.text("Generated with LedgerReport.com — Wallet Balance Reports for Tax, Audit, and Accounting", 20, pageHeight - 20);
  doc.text(`Generated on: ${generatedOn}`, 20, pageHeight - 15);

  // Save the PDF. Filename keeps ISO YYYY-MM-DD because that's the right
  // call for sortable filenames; the on-page Date row above uses Swiss
  // formatting to match the form input.
  doc.save(`wallet-balance-${formData.date}.pdf`);
};