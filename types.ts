
export interface ScrapeInput {
  type: 'url' | 'file';
  value: string | File;
}

export interface DetectionResult {
  source: string; // The URL or filename
  confidence: 'High' | 'Medium' | 'Low';
  summary: string; // e.g., "This appears to be a product catalog page for electronic components."
}

export interface ProductVariant {
  name: string;
  description: string;
  price: string;
  sku: string;
  brochureUrl?: string;
  source?: string;
}

export interface ProductLine {
  name: string;
  description: string;
  variants: ProductVariant[];
}

export interface ProductCategory {
  name: string;
  products: ProductLine[];
}

export interface ScrapedData {
  supplierName: string;
  categories: ProductCategory[];
}

export interface LoadingState {
  active: boolean;
  stage: string;
  progress?: {
    current: number;
    total: number;
  };
}

export type ViewMode = 'grid' | 'table';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export type ExportFormat = 'csv' | 'json' | 'txt';