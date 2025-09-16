import jsPDF from "jspdf";
import type { EvmAsset } from "../types";
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
    asset: EvmAsset;
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
      console.log("Logo failed, continuing without:", logoError);
      doc.setFontSize(20);
      doc.text("Wallet Balance Report for Tax Purposes", 20, 30);
    }

    // Determine starting Y position based on whether logo loaded
    const startY = 110;

    // Add horizontal line above data section
    doc.setLineWidth(0.5);
    doc.line(20, startY, pageWidth - 20, startY);

    // Add report details with proper tabbed formatting
    const dataStartY = startY + 12.5;
    const labelX = 20;      // X position for labels
    const valueX = 60;      // X position for values (aligned column)

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");

    // Print labels and values separately for perfect alignment
    doc.text("Date:", labelX, dataStartY);
    doc.text(formData.date || "Not specified", valueX, dataStartY);

    doc.text("Network:", labelX, dataStartY + 10);
    doc.text(formData.network || "Not specified", valueX, dataStartY + 10);

    doc.text("Token:", labelX, dataStartY + 20);
    doc.text(formData.asset.name || "Not specified", valueX, dataStartY + 20);

    // Hash the address for privacy
    const addressHash = (await hashAddress(formData.address)).substring(0, 16);
    doc.text("Address Hash:", labelX, dataStartY + 30);
    doc.text(addressHash, valueX, dataStartY + 30);

    // Add balance if available
    if (balance) {
      doc.setFont(undefined, "bold");
      doc.text("Balance:", labelX, dataStartY + 50);
      doc.text(`${balance} ${formData.asset.name || "tokens"}`, valueX, dataStartY + 50);
      doc.setFont(undefined, "normal");

      // Add currency value if prices are available
      if (prices) {
        const currencyValue =
          selectedCurrency === "USD"
            ? formatSwissNumber(parseFloat(balance) * prices.usd)
            : selectedCurrency === "EUR"
            ? formatSwissNumber(parseFloat(balance) * prices.eur)
            : formatSwissNumber(parseFloat(balance) * prices.chf);

        doc.text("In CHF:", labelX, dataStartY + 60);
        doc.text(currencyValue, valueX, dataStartY + 60);
      }
    } else {
      doc.setFont(undefined, "bold");
      doc.text("Balance:", labelX, dataStartY + 50);
      doc.text("Not yet fetched", valueX, dataStartY + 50);
      doc.setFont(undefined, "normal");
    }

    // Add horizontal line below data section
    const dataEndY = prices && balance ? dataStartY + 70 : dataStartY + 60;
    doc.line(20, dataEndY, pageWidth - 20, dataEndY);

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