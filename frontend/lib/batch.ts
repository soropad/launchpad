/**
 * Utility for parsing and validating batch mint data.
 */

export interface BatchMintEntry {
  address: string;
  amount: string;
}

export interface ParseResult {
  entries: BatchMintEntry[];
  errors: string[];
}

/**
 * Parses a numeric value or comma-separated string into an array of entries.
 * Format expected: address, amount (one per line)
 */
export function parseBatchMintData(data: string): ParseResult {
  const lines = data.split(/\r?\n/);
  const entries: BatchMintEntry[] = [];
  const errors: string[] = [];

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return; // Skip empty lines

    const parts = trimmedLine.split(/[,\s]+/).map(p => p.trim());
    
    if (parts.length < 2) {
      errors.push(`Line ${index + 1}: Invalid format. Expected 'address, amount'.`);
      return;
    }

    const [address, amount] = parts;

    // Basic address validation (Stellar G... address)
    if (!/^G[A-Z2-7]{55}$/.test(address)) {
      errors.push(`Line ${index + 1}: Invalid Stellar address '${address}'.`);
      return;
    }

    // Basic amount validation
    if (isNaN(Number(amount)) || Number(amount) <= 0) {
      errors.push(`Line ${index + 1}: Invalid amount '${amount}'. Must be a positive number.`);
      return;
    }

    entries.push({ address, amount });
  });

  return { entries, errors };
}

/**
 * Reads a File object (CSV) and parses it.
 */
export async function parseBatchMintFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        resolve(parseBatchMintData(content));
      } else {
        resolve({ entries: [], errors: ["File is empty or could not be read."] });
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsText(file);
  });
}
