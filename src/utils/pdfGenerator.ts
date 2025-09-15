import jsPDF from "jspdf";
import type { EvmAsset } from "../types";

interface PDFParams {
  formData: {
    date?: string;
    network?: string;
    asset: EvmAsset;
    address?: string;
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

      // Add logo at the top right corner - keeping aspect ratio 1:1 for square logo
      const logoWidth = 40;
      const logoHeight = 40;
      const logoX = pageWidth - logoWidth - 10; // 10mm margin from right edge
      doc.addImage(logoBase64, "JPEG", logoX, 10, logoWidth, logoHeight);

      // Add title at the top left
      doc.setFontSize(20);
      doc.text("Wallet Balance Report", 20, 25);
    } catch (logoError) {
      console.log("Logo failed, continuing without:", logoError);
      // If logo fails, just add title
      doc.setFontSize(20);
      doc.text("Wallet Balance Report", 20, 20);
    }

    // Add report details
    doc.setFontSize(12);
    doc.text(`Date: ${formData.date || "Not specified"}`, 20, 45);
    doc.text(`Network: ${formData.network || "Not specified"}`, 20, 55);
    doc.text(`Token: ${formData.asset.name || "Not specified"}`, 20, 65);
    doc.text(`Address: ${formData.address || "Not specified"}`, 20, 75);

    // Add balance if available
    if (balance) {
      doc.setFontSize(14);
      doc.setFont(undefined, "bold");
      doc.text(`Balance: ${balance} ${formData.asset.name || "tokens"}`, 20, 95);
      doc.setFont(undefined, "normal");

      // Add currency value if prices are available
      if (prices) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        const currencyValue =
          selectedCurrency === "USD"
            ? `~ ${(parseFloat(balance) * prices.usd).toFixed(2)} USD`
            : selectedCurrency === "EUR"
            ? `~ ${(parseFloat(balance) * prices.eur).toFixed(2)} EUR`
            : `~ ${(parseFloat(balance) * prices.chf).toFixed(2)} CHF`;
        doc.text(currencyValue, 20, 105);
      }
    } else {
      doc.setFontSize(12);
      doc.text(`Balance: Not yet fetched`, 20, 95);
    }

    // Add timestamp
    doc.setFontSize(10);
    doc.setTextColor(128, 128, 128);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, prices && balance ? 120 : 115);

    // Add footer
    doc.setFontSize(8);
    doc.text("LedgerReport.com - Historical Wallet Balance Checker", pageWidth / 2, 280, { align: "center" });

    // Save the PDF
    doc.save(`wallet-balance-${formData.date || "report"}.pdf`);
  } catch (error) {
    console.error("PDF generation failed:", error);
    throw new Error(`Failed to generate PDF: ${error}`);
  }
};