// FIX: Use standard import for @google/genai package.
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { ScrapedData, ScrapeInput, DetectionResult, ChatMessage } from '../types';
import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;

// FIX: The API key must be sourced from the environment variable `process.env.API_KEY` for security.
const getAiClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });


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
    const ai = getAiClient();
    const results: DetectionResult[] = [];
    const model = 'gemini-2.5-flash';

    for (const input of inputs) {
        const source = input.type === 'url' ? (input.value as string) : (input.value as File).name;

        try {
            let response: GenerateContentResponse;
            if (input.type === 'url') {
                const prompt = `
                    Access the content of this URL: ${input.value as string}.
                    Based on its content, determine if it is a product catalog or a page listing products for sale.
                    Provide a confidence level (High, Medium, Low) and a brief one-sentence summary of your reasoning.
                    Preserve any special characters or symbols (e.g., ©, Ä) accurately in your summary.
                    Your entire response must be ONLY a single, clean JSON object with "confidence" and "summary" keys. Example: {"confidence": "High", "summary": "The page lists multiple products with prices and descriptions."}
                `;
                response = await ai.models.generateContent({
                    model: model,
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    config: { tools: [{ googleSearch: {} }] }
                });
            } else { // file
                const content = await getTextFromPdf(input.value as File);
                const prompt = `
                    Analyze the following content from a file named "${source}" and determine if it is a product catalog or a page listing products for sale.
                    Provide a confidence level (High, Medium, Low) and a brief one-sentence summary of your reasoning.
                    Preserve any special characters or symbols (e.g., ©, Ä) accurately in your summary.

                    Content to analyze:
                    ---
                    ${content.substring(0, 30000)}
                    ---

                    Respond in JSON format with "confidence" and "summary" keys. Example: {"confidence": "High", "summary": "The content lists multiple products with prices and descriptions."}
                `;
                response = await ai.models.generateContent({
                    model: model,
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    config: { responseMimeType: 'application/json' }
                });
            }
            
            const jsonText = response.text.trim();
            // A simple regex to extract JSON object from potential markdown code blocks, which can happen with non-JSON response types
            const jsonMatch = jsonText.match(/```(json)?\s*([\s\S]*?)\s*```|({[\s\S]*})/);
            const parsableText = jsonMatch ? (jsonMatch[2] || jsonMatch[3]) : jsonText;
            
            const result = JSON.parse(parsableText);
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
    const model = ocrQuality === 'high' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    let combinedData: ScrapedData = { supplierName: '', categories: [] };
    let supplierNameFound = false;
    const errors: string[] = [];
    
    onProgress({ stage: 'Preparing inputs...', progress: { current: 0, total: inputs.length } });

    for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        const sourceName = input.type === 'url' ? (input.value as string) : (input.value as File).name;
        onProgress({ stage: `Processing ${input.type === 'url' ? 'URL' : 'file'} ${i + 1} of ${inputs.length}...`, progress: { current: i, total: inputs.length } });

        let response: GenerateContentResponse;
        try {
            const parts: ({ text: string } | { inlineData: { mimeType: string; data: string; } })[] = [];
            const config: any = {};

            if (input.type === 'url') {
                parts.push({ text: `Extract all product data from the website starting at this URL: ${input.value as string}` });
                config.systemInstruction = `You are an expert data extractor and web crawler specializing in supplier product catalogs. Your task is to meticulously analyze the website starting from the provided URL and extract all product information into a structured JSON format.

**Instructions:**
1.  **Explore the Website**: Starting from the given URL, act as if you are browsing the site to find the main "Products," "Shop," or "Catalog" section. Follow links to categories and sub-categories to find all available products.
2.  **Extract Every Product**: For each category you discover, you must find and extract detailed information for every single product line and all of its variants. Be extremely thorough and aim for 100% completeness.
3.  **Find Brochures**: For each product variant, search for and extract a direct URL link to a product brochure, datasheet, or specification sheet. If no specific link is found, use "N/A".
4.  **Preserve Data Integrity**: Pay close attention to special characters, symbols (e.g., ©, ®, ™), and accented letters (e.g., Ä, é, ü). Preserve them exactly as they appear in the source content.
5.  **Handle Missing Data**: If a value for a required field (like price or SKU) cannot be found, you must use the string "N/A".
6.  **Strict JSON Output**: Your entire output must be a single, valid JSON object and nothing else. Do not wrap it in markdown backticks. Do not add any introductory text, comments, or explanations before or after the JSON.
7.  **Error Handling**: If you are unable to access the URL or find any product data, you MUST return a valid JSON object with the supplierName set to the URL and an empty 'categories' array. Example: {"supplierName": "https://example.com", "categories": []}. Do not explain the failure in plain text or markdown.`;
                config.tools = [{googleSearch: {}}];
            } else { // file
                config.responseMimeType = 'application/json';
                config.responseSchema = dataSchema;

                parts.push({ text: `Analyze the attached product catalog document named "${sourceName}".` });
                const imageParts = await pdfToImagesBase64(input.value as File);
                parts.push(...imageParts.map(p => ({ inlineData: p })));
                
                config.systemInstruction = `You are an expert data extractor specializing in supplier product catalogs. Your task is to meticulously analyze the provided document pages and extract all product information into a structured JSON format.

**Instructions:**
1.  **Analyze All Pages**: Thoroughly scan every page of the provided document to find all products.
2.  **Adhere to Schema**: Structure all extracted information strictly according to the provided JSON schema.
3.  **Find Brochures**: For each product variant, check if there is a URL or link to a brochure, datasheet, or specification sheet. If found, populate the 'brochureUrl' field. If not, use "N/A".
4.  **Preserve Data Integrity**: Pay close attention to special characters, symbols (e.g., ©, ®, ™), and accented letters (e.g., Ä, é, ü). Preserve them exactly as they appear in the source content.
5.  **Handle Missing Data**: If a value for a required field (like price or SKU) cannot be found, you must use the string "N/A".
6.  **Strict JSON Output**: Your entire output must be only the JSON object, with no commentary, apologies, or introductory text.`;
            }

            response = await ai.models.generateContent({
                model: model,
                contents: [{ role: 'user', parts }],
                config: config,
            });

        } catch (requestError) {
            console.error(`Error during API request for ${sourceName}:`, requestError);
            const errorMessage = requestError instanceof Error ? requestError.message : "An unknown error occurred.";
            errors.push(`- ${sourceName}: The request to the AI model failed. ${errorMessage.substring(0, 100)}...`);
            continue; // Skip to the next input
        }

        try {
            const jsonText = response.text.trim();
            const jsonMatch = jsonText.match(/```(json)?\s*([\s\S]*?)\s*```|({[\s\S]*})/);
            const parsableText = jsonMatch ? (jsonMatch[2] || jsonMatch[3]) : null;

            if (!parsableText) {
                throw new Error(`No valid JSON object found in the model's response.`);
            }
            
            const result: ScrapedData = JSON.parse(parsableText) as ScrapedData;
            
            if (!result || !Array.isArray(result.categories)) {
                errors.push(`- ${sourceName}: The model returned data in an unexpected format.`);
                continue; // Skip to the next input
            }

            if (result.categories.length === 0 && (result.supplierName === sourceName || result.supplierName === 'N/A')) {
                errors.push(`- ${sourceName}: The model did not find any product data at this source.`);
                continue; // Skip to the next input in the loop
            }
            
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

        } catch (parsingError) {
            console.error(`Error parsing response for ${sourceName}:`, parsingError);
            errors.push(`- ${sourceName}: The model's response was in an unexpected format and could not be read.`);
            continue; // Skip to the next input
        }
    }

    onProgress({ stage: 'Finalizing data...', progress: { current: inputs.length, total: inputs.length } });
    
    if (errors.length > 0) {
        throw new Error(`Scraping completed with ${errors.length} error(s):\n\n${errors.join('\n')}`);
    }

    if (!combinedData.supplierName) {
        combinedData.supplierName = "Supplier Name Not Found";
    }

    return combinedData;
};

export const chatWithDataStream = async function* (
    scrapedData: ScrapedData,
    message: string,
    history: ChatMessage[]
): AsyncGenerator<string> {
    const ai = getAiClient();

    // The history from the client includes the latest user message. For the API call,
    // we need the history *before* the current user message.
    const historyForApi = history.slice(0, -1).map(msg => ({
        role: msg.role as ('user' | 'model'),
        parts: [{ text: msg.text }]
    }));

    const chat = ai.chats.create({
        model: 'gemini-2.5-pro',
        history: historyForApi,
        config: {
            systemInstruction: `You are an intelligent assistant for analyzing product catalog data.
The user has provided you with the following product data, which was extracted from supplier websites or documents.
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

    try {
        const stream = await chat.sendMessageStream({ message });
        for await (const chunk of stream) {
            yield chunk.text;
        }
    } catch (error) {
        console.error("Error during chat stream:", error);
        yield "An error occurred while communicating with the AI. Please check the console for details.";
    }
};