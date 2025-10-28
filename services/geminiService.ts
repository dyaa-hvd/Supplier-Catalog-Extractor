import { GoogleGenAI, Type } from "https://aistudiocdn.com/@google/genai@^1.27.0";
import { ScrapedData, ScrapeInput, DetectionResult, ChatMessage } from '../types';
import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;

// Use the hardcoded API key for all requests.
const getAiClient = () => new GoogleGenAI({ apiKey: 'AIzaSyC3gpn8LKDgrBUpMP8mkNbY71A4x2qwgWQ' });

// --- Helper Functions ---

/**
 * Extracts text from a PDF file for quick analysis.
 */
const getTextFromPdf = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let textContent = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const text = await page.getTextContent();
        textContent += text.items.map(item => ('str' in item ? item.str : '')).join(' ');
    }
    return textContent;
};

/**
 * Converts a PDF file into an array of base64 image strings for vision model processing.
 */
const pdfToImagesBase64 = async (file: File): Promise<{ mimeType: string; data: string }[]> => {
    const imageParts: { mimeType: string; data: string }[] = [];
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        // Use a reasonable scale for good OCR quality
        const viewport = page.getViewport({ scale: 1.5 });
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        if (context) {
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            const dataUrl = canvas.toDataURL('image/jpeg');
            imageParts.push({
                mimeType: 'image/jpeg',
                data: dataUrl.split(',')[1]
            });
        }
    }
    canvas.remove();
    return imageParts;
};


// --- API Functions ---

export const detectProducts = async (inputs: ScrapeInput[]): Promise<DetectionResult[]> => {
    const ai = getAiClient(); // Initialize client just before use
    const results: DetectionResult[] = [];
    const model = 'gemini-2.5-flash';

    for (const input of inputs) {
        let content: string;
        let source: string;
        if (input.type === 'url') {
            source = input.value as string;
            // NOTE: In a real-world scenario, you'd fetch the URL content on a server-side proxy
            // to avoid CORS issues. For this example, we'll ask the model to analyze the URL's purpose.
            content = `Please analyze the likely content of the following URL: ${source}`;
        } else {
            const file = input.value as File;
            source = file.name;
            content = await getTextFromPdf(file);
        }

        const prompt = `
            Analyze the following content and determine if it is a product catalog or a page listing products for sale.
            Provide a confidence level (High, Medium, Low) and a brief one-sentence summary of your reasoning.
            Preserve any special characters or symbols (e.g., ©, Ä) accurately in your summary.
            Do not analyze the URL itself, but the content provided (or the likely content of the URL).

            Content to analyze:
            ---
            ${content.substring(0, 30000)}
            ---

            Respond in JSON format with "confidence" and "summary" keys. Example: {"confidence": "High", "summary": "The page lists multiple products with prices and descriptions."}
        `;

        try {
            const response = await ai.models.generateContent({
                model: model,
                // FIX: Use a structured request format instead of a raw string to prevent proxy errors.
                // This robust format is less prone to misinterpretation by intermediate services.
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: { responseMimeType: 'application/json' }
            });
            
            const jsonText = response.text.trim();
            const result = JSON.parse(jsonText);
            results.push({
                source,
                confidence: result.confidence || 'Low',
                summary: result.summary || 'Could not determine the content type.',
            });
        } catch (error) {
            console.error(`Error detecting products for ${source}:`, error);
            results.push({
                source,
                confidence: 'Low',
                summary: 'An error occurred during analysis.',
            });
        }
    }
    return results;
};

const dataSchema = {
    type: Type.OBJECT,
    properties: {
        supplierName: { type: Type.STRING, description: "The name of the supplier or company." },
        categories: {
            type: Type.ARRAY,
            description: "A list of product categories found on the page.",
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: "The name of the category (e.g., 'Laptops', 'T-Shirts')." },
                    products: {
                        type: Type.ARRAY,
                        description: "A list of product lines within this category.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING, description: "The name of the product line (e.g., 'MacBook Pro', 'Classic Crewneck')." },
                                description: { type: Type.STRING, description: "A brief description of the product line." },
                                variants: {
                                    type: Type.ARRAY,
                                    description: "A list of specific variants for this product (e.g., different sizes, colors, or model numbers).",
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            name: { type: Type.STRING, description: "The specific name of the variant (e.g., '16-inch, M2 Pro, Silver' or 'Medium, Blue')." },
                                            description: { type: Type.STRING, description: "A brief description specific to this variant, if any." },
                                            price: { type: Type.STRING, description: "The price of the variant. Include currency symbols. If not available, use 'N/A'." },
                                            sku: { type: Type.STRING, description: "The Stock Keeping Unit or product code. If not available, use 'N/A'." },
                                            brochureUrl: { type: Type.STRING, description: "A direct URL to a product brochure, datasheet, or specification sheet. If not available, use 'N/A'." },
                                        },
                                        required: ["name", "price", "sku"]
                                    }
                                }
                            },
                            required: ["name", "variants"]
                        }
                    }
                },
                required: ["name", "products"]
            }
        }
    },
    required: ["supplierName", "categories"]
};


export const scrapeSupplierData = async (
    inputs: ScrapeInput[],
    onProgress: (update: { stage: string; progress?: { current: number; total: number } }) => void,
    ocrQuality: 'standard' | 'high'
): Promise<ScrapedData> => {
    const ai = getAiClient(); // Initialize client just before use
    // Select model based on complexity and quality requirement. gemini-2.5-pro for high-quality multimodal tasks.
    const model = ocrQuality === 'high' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    let combinedData: ScrapedData = { supplierName: '', categories: [] };
    let supplierNameFound = false;
    
    onProgress({ stage: 'Preparing inputs...', progress: { current: 0, total: inputs.length } });

    for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        onProgress({ stage: `Processing ${input.type === 'url' ? 'URL' : 'file'} ${i + 1} of ${inputs.length}...`, progress: { current: i, total: inputs.length } });

        // FIX: Explicitly define parts as an array of Gemini 'Part' objects.
        // This ensures that strings are correctly formatted as { text: "..." } objects,
        // resolving the "required oneof field 'data' must have one initialized field" error.
        const parts: ({ text: string } | { inlineData: { mimeType: string; data: string; } })[] = [];
        const sourceName = input.type === 'url' ? new URL(input.value as string).hostname : (input.value as File).name;

        if (input.type === 'url') {
            // NOTE: In a real-world scenario, you'd fetch the URL content on a server-side proxy
            // to avoid CORS issues. For this example, we'll tell the model to imagine it has access.
            parts.push({ text: `Analyze the product catalog at this URL: ${input.value as string}` });
        } else { // file
            parts.push({ text: `Analyze the attached product catalog document named "${sourceName}".` });
            // Vision model requires images, so we convert PDF pages to images.
            const imageParts = await pdfToImagesBase64(input.value as File);
            parts.push(...imageParts.map(p => ({ inlineData: p })));
        }

        const systemInstruction = `
You are an expert data extractor specializing in supplier product catalogs.
Your task is to meticulously analyze the provided content (from a URL or a document) and extract all product information into a structured JSON format.
Adhere strictly to the provided JSON schema.
- Pay close attention to special characters, symbols (e.g., ©, ®, ™), and accented letters (e.g., Ä, é, ü). Preserve them exactly as they appear in the source content. Ensure all text is encoded correctly in UTF-8.
- If a value is not found for a field, use "N/A" or omit it if optional. Do not omit required fields.
- Group products into logical categories. If no clear categories exist, create a general one like "Products".
- A "product line" is a general product (e.g., "iPhone 15"), while "variants" are the specific versions (e.g., "128GB, Blue", "256GB, Black").
- Extract every single product variant you can find. Be thorough.
- Do not add any commentary or introductory text. Your output must be only the JSON object.
`;

        try {
            const response = await ai.models.generateContent({
                model: model,
                contents: [{ role: 'user', parts }],
                config: {
                    systemInstruction,
                    responseMimeType: 'application/json',
                    responseSchema: dataSchema,
                },
            });

            const jsonText = response.text.trim();
            const result = JSON.parse(jsonText) as ScrapedData;
            
             // Tag each variant with its source
            result.categories.forEach(category => {
                category.products.forEach(product => {
                    product.variants.forEach(variant => {
                        variant.source = sourceName;
                    });
                });
            });

            if (!supplierNameFound && result.supplierName && result.supplierName !== 'N/A') {
                combinedData.supplierName = result.supplierName;
                supplierNameFound = true;
            }

            // Merge categories and products
            result.categories.forEach(newCategory => {
                const existingCategory = combinedData.categories.find(c => c.name.toLowerCase() === newCategory.name.toLowerCase());
                if (existingCategory) {
                    existingCategory.products.push(...newCategory.products);
                } else {
                    combinedData.categories.push(newCategory);
                }
            });

        } catch (error) {
            console.error(`Error processing input ${i + 1}:`, error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            throw new Error(`Failed to process input ${i + 1} (${input.type === 'url' ? input.value : sourceName}): ${errorMessage}`);
        }
    }

    onProgress({ stage: 'Finalizing data...', progress: { current: inputs.length, total: inputs.length } });
    if (!combinedData.supplierName) {
        combinedData.supplierName = "Supplier Name Not Found";
    }

    return combinedData;
};


export const chatWithDataStream = async function* (
    scrapedData: ScrapedData,
    message: string,
    history: ChatMessage[]
) {
    const ai = getAiClient(); // Initialize client just before use
    // Use `ai.chats.create` for conversational chat and streaming.
    const chat = ai.chats.create({
        model: 'gemini-2.5-pro', // Use a powerful model for data analysis
        config: {
            systemInstruction: `You are an intelligent assistant for analyzing product catalog data.
The user has provided you with the following product data in JSON format.
Your answers must be based *only* on this data. Do not invent information.
When referencing data, ensure all special characters and symbols (e.g., ©, ®, ™, Ä) are reproduced accurately.
If the answer cannot be found in the data, say so clearly.
Be concise and helpful. You can use markdown for formatting like tables and lists.
Be aware of the 'source' field for each product variant to answer questions about data origins.

Here is the data:
\`\`\`json
${JSON.stringify(scrapedData, null, 2)}
\`\`\`
`,
        },
    });

    const previousMessages = history.slice(0, -1).map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
    }));

    // The stream is initiated by `sendMessageStream`.
    const stream = await chat.sendMessageStream({
        message,
        // The history can be passed along with the message in sendMessageStream
        history: previousMessages 
    });

    // Iterate over the stream and yield the text from each chunk.
    for await (const chunk of stream) {
        yield chunk.text;
    }
};