export interface SheddingData {
  id: string;
  Office: string;
  "Upokendro name": string;
  "elakar nam": string;
  "shedding hours": string[];
  mw: string;
  feeder_no?: string;
  original_pdf?: string;
}

export const loadSheddingData: SheddingData[] = [];
