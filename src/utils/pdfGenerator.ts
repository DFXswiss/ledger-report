import jsPDF from "jspdf";
import type { SupportedAsset } from "../types";
import { formatSwissNumber } from "./formatNumber";

const hashAddress = async (address: string): Promise<string> => {
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(address));
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
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

    // Try to load and add logo
    try {
      const logoResponse = await fetch("/ledger-logo.jpg");
      const logoBlob = await logoResponse.blob();
      const logoBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(logoBlob);
      });

      // Add logo centered at the top
      const logoWidth = 40;
      const logoHeight = 40;
      const logoX = (pageWidth - logoWidth) / 2; // Center horizontally
      doc.addImage(logoBase64, "JPEG", logoX, 30, logoWidth, logoHeight);

      // Add title left-aligned below the logo
      doc.setFontSize(20);
      doc.text("Wallet Balance Report for Tax Purposes", 20, 100);
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