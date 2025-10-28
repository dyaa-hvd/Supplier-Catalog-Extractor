
import React, { useState } from 'react';
import { ScrapedData, LoadingState, ViewMode, ExportFormat, ProductVariant, ProductLine } from '../types';

// --- ICONS ---
const GridIcon = (props: React.SVGProps<SVGSVGElement>) => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>);
const TableIcon = (props: React.SVGProps<SVGSVGElement>) => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12 3v18"></path><rect x="3" y="5" width="18" height="4"></rect><rect x="3" y="15" width="18" height="4"></rect></svg>);
const DownloadIcon = (props: React.SVGProps<SVGSVGElement>) => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>);
const LoadingSpinner = (props: React.SVGProps<SVGSVGElement>) => (<svg className="animate-spin h-8 w-8 text-sky-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" {...props}><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>);
const FileTextIcon = (props: React.SVGProps<SVGSVGElement>) => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>);


// --- HELPER FUNCTIONS ---
const flattenDataForCsv = (data: ScrapedData): Record<string, string>[] => {
    const rows: Record<string, string>[] = [];
    data.categories.forEach(category => {
        category.products.forEach(product => {
            product.variants.forEach(variant => {
                rows.push({
                    'Supplier': data.supplierName,
                    'Category': category.name,
                    'Product Line': product.name,
                    'Product Line Description': product.description,
                    'Variant Name': variant.name,
                    'Variant Description': variant.description,
                    'Variant Price': variant.price,
                    'Variant SKU': variant.sku,
                    'Brochure URL': variant.brochureUrl || 'N/A',
                    'Source': variant.source || 'N/A',
                });
            });
        });
    });
    return rows;
};

const convertToCSV = (data: Record<string, string>[]): string => {
    if (data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const csvRows = [
        headers.join(','),
        ...data.map(row =>
            headers.map(header => JSON.stringify(row[header] || '', (key, value) => value === null ? '' : value)).join(',')
        )
    ];
    return csvRows.join('\n');
};

const convertToTXT = (data: ScrapedData): string => {
    let txt = `Supplier: ${data.supplierName}\n\n`;
    data.categories.forEach(cat => {
        txt += `========================================\n`;
        txt += `CATEGORY: ${cat.name}\n`;
        txt += `========================================\n\n`;
        cat.products.forEach(prod => {
            txt += `Product Line: ${prod.name}\n`;
            txt += `Description: ${prod.description}\n\n`;
            prod.variants.forEach(v => {
                txt += `  - Variant: ${v.name}\n`;
                txt += `    Description: ${v.description}\n`;
                txt += `    Price: ${v.price}\n`;
                txt += `    SKU: ${v.sku}\n`;
                txt += `    Brochure: ${v.brochureUrl || 'N/A'}\n`;
                txt += `    Source: ${v.source || 'N/A'}\n\n`;
            });
        });
    });
    return txt;
};

const downloadFile = (content: string, filename: string, mimeType: string) => {
    // Prepending a BOM (Byte Order Mark) for CSV to ensure Excel correctly interprets UTF-8 characters.
    const fileContent = mimeType === 'text/csv;charset=utf-8;' ? '\uFEFF' + content : content;
    const blob = new Blob([fileContent], { type: mimeType });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

// --- RENDER COMPONENTS ---

const ProductDetailModal: React.FC<{ productLine: ProductLine; onClose: () => void }> = ({ productLine, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in-scale" onClick={onClose}>
            <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b border-slate-700 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-amber-300">{productLine.name}</h2>
                        <p className="text-sm text-slate-400">{productLine.description}</p>
                    </div>
                    <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">&times;</button>
                </header>
                <div className="p-6 overflow-y-auto space-y-4">
                    {productLine.variants.map((variant, index) => (
                        <div key={index} className="bg-slate-900/60 p-4 rounded-lg border border-slate-700">
                             <div className="flex justify-between items-start">
                                <h3 className="font-semibold text-slate-200 mb-2">{variant.name}</h3>
                                {variant.brochureUrl && variant.brochureUrl !== 'N/A' && (
                                    <a href={variant.brochureUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-sky-400 hover:text-sky-300 font-semibold px-3 py-1 bg-sky-900/50 border border-sky-800/70 rounded-full">
                                        <FileTextIcon className="h-4 w-4" /> View Brochure
                                    </a>
                                )}
                            </div>
                            <p className="text-sm text-slate-400 mb-3">{variant.description}</p>
                            <div className="grid grid-cols-2 gap-4 text-sm border-t border-slate-700 pt-3">
                                <div><span className="text-slate-500 block text-xs">Price</span><span className="font-mono text-green-400">{variant.price}</span></div>
                                <div><span className="text-slate-500 block text-xs">SKU</span><span className="font-mono">{variant.sku}</span></div>
                                <div><span className="text-slate-500 block text-xs">Source</span><span className="font-mono text-xs">{variant.source}</span></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const GridView: React.FC<{ data: ScrapedData, onVariantClick: (productLine: ProductLine) => void }> = ({ data, onVariantClick }) => (
    <div className="space-y-8">
        {data.categories.map((category, catIndex) => (
            <div key={catIndex} className="animate-slide-in-up-stagger" style={{ animationDelay: `${catIndex * 100}ms`}}>
                <h2 className="text-2xl font-bold text-sky-300 border-b-2 border-slate-700 pb-2 mb-4">{category.name}</h2>
                <div className="space-y-6">
                    {category.products.map((product, prodIndex) => (
                         <div key={prodIndex} className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 animate-slide-in-up-stagger" style={{ animationDelay: `${prodIndex * 50}ms`}}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-lg font-semibold text-amber-300">{product.name}</h3>
                                    <p className="text-sm text-slate-400 mt-1 mb-3">{product.description}</p>
                                </div>
                                <button onClick={() => onVariantClick(product)} className="text-sm text-sky-400 hover:text-sky-300 font-semibold">View Details</button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {product.variants.slice(0, 3).map((variant, varIndex) => (
                                    <div key={varIndex} className="bg-slate-900/60 p-3 rounded-md border border-slate-600/50">
                                        <p className="font-semibold text-slate-200 truncate">{variant.name}</p>
                                        <div className="flex justify-between items-center mt-2 text-sm">
                                            <span className="text-green-400 font-mono">{variant.price}</span>
                                            {variant.brochureUrl && variant.brochureUrl !== 'N/A' && <a href={variant.brochureUrl} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300"><FileTextIcon className="h-4 w-4" /></a>}
                                        </div>
                                    </div>
                                ))}
                                {product.variants.length > 3 && <div className="bg-slate-900/60 p-3 rounded-md border border-slate-600/50 flex items-center justify-center text-sm text-slate-400">+{product.variants.length - 3} more</div>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        ))}
    </div>
);


const TableView: React.FC<{ data: ScrapedData, onVariantClick: (productLine: ProductLine) => void }> = ({ data, onVariantClick }) => {
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left text-slate-300">
                <thead className="text-xs text-slate-400 uppercase bg-slate-800/60">
                    <tr>
                        <th scope="col" className="px-4 py-3">Category</th>
                        <th scope="col" className="px-4 py-3">Product Line</th>
                        <th scope="col" className="px-4 py-3">Variants</th>
                        <th scope="col" className="px-4 py-3">Source</th>
                        <th scope="col" className="px-4 py-3"></th>
                    </tr>
                </thead>
                <tbody>
                    {data.categories.flatMap(cat => cat.products.map((prod, index) => (
                        <tr key={`${cat.name}-${prod.name}-${index}`} className="border-b border-slate-700 hover:bg-slate-800/40">
                            <td className="px-4 py-3 font-medium text-sky-300">{cat.name}</td>
                            <td className="px-4 py-3 text-white font-semibold">{prod.name}</td>
                            <td className="px-4 py-3">{prod.variants.length}</td>
                            <td className="px-4 py-3 text-xs font-mono text-slate-500">{[...new Set(prod.variants.map(v => v.source))].join(', ')}</td>
                            <td className="px-4 py-3 text-right">
                                <button onClick={() => onVariantClick(prod)} className="font-medium text-sky-400 hover:underline">View</button>
                            </td>
                        </tr>
                    )))}
                </tbody>
            </table>
        </div>
    );
}

// --- MAIN COMPONENT ---

interface ResultsDisplayProps {
    displayData: ScrapedData | null;
    exportData: ScrapedData | null;
    loadingState: LoadingState;
    error: string | null;
    viewMode: ViewMode;
    setViewMode: (mode: ViewMode) => void;
}

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ displayData, exportData, loadingState, error, viewMode, setViewMode }) => {
    const [selectedProductLine, setSelectedProductLine] = useState<ProductLine | null>(null);
    
    const handleExport = (format: ExportFormat) => {
        if (!exportData) return;
        const baseFilename = `${exportData.supplierName.replace(/\s+/g, '_')}_catalog`;
        let content = '';
        let filename = '';
        let mimeType = '';

        switch(format) {
            case 'csv':
                content = convertToCSV(flattenDataForCsv(exportData));
                filename = `${baseFilename}.csv`;
                mimeType = 'text/csv;charset=utf-8;';
                break;
            case 'json':
                content = JSON.stringify(exportData, null, 2);
                filename = `${baseFilename}.json`;
                mimeType = 'application/json';
                break;
            case 'txt':
                content = convertToTXT(exportData);
                filename = `${baseFilename}.txt`;
                mimeType = 'text/plain';
                break;
        }
        downloadFile(content, filename, mimeType);
    };

    if (loadingState.active) {
        const progressPercent = loadingState.progress ? (loadingState.progress.current / loadingState.progress.total) * 100 : 0;
        return (
            <div className="flex flex-col items-center justify-center h-full text-center">
                <LoadingSpinner />
                <p className="mt-4 text-lg font-semibold text-slate-300 animate-pulse-text">{loadingState.stage}</p>
                {loadingState.progress && loadingState.progress.total > 1 && (
                    <div className="w-full max-w-md bg-slate-700 rounded-full h-2.5 mt-4">
                        <div className="bg-sky-500 h-2.5 rounded-full" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                )}
            </div>
        );
    }
    
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center bg-red-900/20 border border-red-500/30 p-6 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-400 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <h2 className="text-xl font-bold text-red-300">An Error Occurred</h2>
                <p className="mt-2 text-red-300/80 max-w-xl">{error}</p>
            </div>
        );
    }

    if (!displayData) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-4 text-slate-600"><path d="M4 18.214V5.786a2 2 0 0 1 1.6-1.96l12-3a2 2 0 0 1 2.4 1.96v12.428a2 2 0 0 1-1.6 1.96l-12 3a2 2 0 0 1-2.4-1.96z"/><path d="m4 6 16-4"/><path d="m8 5 11 3"/><path d="m9.5 13.5 4-1"/><circle cx="8" cy="18" r="2"/><circle cx="16" cy="14" r="2"/></svg>
                <h2 className="text-2xl font-semibold text-slate-300">Ready to Extract</h2>
                <p className="mt-2 max-w-md">Clean, Structured Data. Every Time. From Website to Spreadsheet, Instantly.</p>
            </div>
        );
    }
    
    const hasResults = displayData.categories.some(c => c.products.length > 0);

    return (
        <div>
            {selectedProductLine && <ProductDetailModal productLine={selectedProductLine} onClose={() => setSelectedProductLine(null)} />}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white">{displayData.supplierName}</h1>
                    <p className="text-slate-400 mt-1">Product Catalog Results</p>
                </div>
                <div className="flex items-center gap-2 mt-4 sm:mt-0">
                    <div className="flex bg-slate-800/60 rounded-lg p-1">
                        <button onClick={() => setViewMode('grid')} className={`px-3 py-1.5 text-sm rounded-md transition-colors ${viewMode === 'grid' ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}><GridIcon /></button>
                        <button onClick={() => setViewMode('table')} className={`px-3 py-1.5 text-sm rounded-md transition-colors ${viewMode === 'table' ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}><TableIcon /></button>
                    </div>
                     <div className="relative group">
                        <button className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg text-sm"><DownloadIcon /> Export</button>
                        <div className="absolute top-full right-0 mt-2 w-32 bg-slate-700 border border-slate-600 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto z-10">
                            <a onClick={() => handleExport('csv')} className="block px-4 py-2 text-sm text-slate-200 hover:bg-slate-600 cursor-pointer">as CSV</a>
                            <a onClick={() => handleExport('json')} className="block px-4 py-2 text-sm text-slate-200 hover:bg-slate-600 cursor-pointer">as JSON</a>
                            <a onClick={() => handleExport('txt')} className="block px-4 py-2 text-sm text-slate-200 hover:bg-slate-600 cursor-pointer">as TXT</a>
                        </div>
                    </div>
                </div>
            </header>
            {hasResults ? (
                viewMode === 'grid' ? <GridView data={displayData} onVariantClick={setSelectedProductLine} /> : <TableView data={displayData} onVariantClick={setSelectedProductLine} />
            ) : (
                <div className="text-center py-16 text-slate-400">
                    <p className="text-lg font-semibold">No products found matching your filters.</p>
                    <p className="mt-1">Try adjusting your search query or clearing the category filters.</p>
                </div>
            )}
        </div>
    );
};
