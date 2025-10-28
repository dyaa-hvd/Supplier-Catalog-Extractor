
import React, { useState, useRef, useEffect } from 'react';
// FIX: Import centralized LoadingState type and remove local definition for consistency.
import { ScrapeInput, DetectionResult, LoadingState } from '../types';
import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs';

// Set the workerSrc for pdf.js to load its worker script from a CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;

interface InputFormProps {
  onDetect: (inputs: ScrapeInput[]) => void;
  onSubmit: (inputs: ScrapeInput[]) => void;
  loadingState: LoadingState;
  isDetecting: boolean;
  detectionResults: DetectionResult[] | null;
  ocrQuality: 'standard' | 'high';
  onOcrQualityChange: (quality: 'standard' | 'high') => void;
}

type InputMode = 'url' | 'file';

// --- ICONS ---
const ScrapeIcon = (props: React.SVGProps<SVGSVGElement>) => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path></svg>);
const DetectIcon = (props: React.SVGProps<SVGSVGElement>) => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>);
const UploadIcon = (props: React.SVGProps<SVGSVGElement>) => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>);
const PlusIcon = (props: React.SVGProps<SVGSVGElement>) => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>);
const TrashIcon = (props: React.SVGProps<SVGSVGElement>) => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>);
const CheckCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>);
const AlertTriangleIcon = (props: React.SVGProps<SVGSVGElement>) => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>);
const XCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>);
const LoadingSpinner = (props: React.SVGProps<SVGSVGElement>) => (<svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" {...props}><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>);

// --- RENDERERS & MODALS ---
const DetectionResultDisplay: React.FC<{ result: DetectionResult }> = ({ result }) => (
    <div className="p-3 rounded-lg border bg-slate-800/50 border-slate-700 animate-slide-in-up">
        <p className="text-xs font-bold text-slate-400 truncate mb-2">{result.source}</p>
        <div className={`flex items-start text-sm`}>
            <div className={`mr-2 flex-shrink-0 mt-0.5 text-${result.confidence === 'High' ? 'green' : result.confidence === 'Medium' ? 'yellow' : 'red'}-400`}>
                {result.confidence === 'High' ? <CheckCircleIcon className="h-4 w-4" /> : result.confidence === 'Medium' ? <AlertTriangleIcon className="h-4 w-4" /> : <XCircleIcon className="h-4 w-4" />}
            </div>
            <p className="text-slate-300">{result.summary}</p>
        </div>
    </div>
);
const DetectionResultsList: React.FC<{ results: DetectionResult[] }> = ({ results }) => (
    <div className="mt-4 space-y-3">
        {results.map((result, index) => (
            <DetectionResultDisplay key={index} result={result} />
        ))}
    </div>
);

const PdfPreview: React.FC<{ file: File }> = ({ file }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const reader = new FileReader();
        reader.readAsArrayBuffer(file);
        reader.onload = async (e) => {
            if (e.target?.result && canvasRef.current) {
                const pdf = await pdfjsLib.getDocument({ data: e.target.result as ArrayBuffer }).promise;
                const page = await pdf.getPage(1);
                const viewport = page.getViewport({ scale: 1 });
                const canvas = canvasRef.current;
                const context = canvas.getContext('2d');
                const scale = 80 / viewport.width; // Desired width 80px
                const scaledViewport = page.getViewport({ scale });
                canvas.height = scaledViewport.height;
                canvas.width = scaledViewport.width;
                if (context) {
                    await page.render({ canvasContext: context, viewport: scaledViewport }).promise;
                }
            }
        };
    }, [file]);
    return <canvas ref={canvasRef} className="rounded border border-slate-600 shadow-md" />;
};

const BulkUrlModal: React.FC<{ onClose: () => void; onAdd: (urls: string) => void; }> = ({ onClose, onAdd }) => {
    const [text, setText] = useState('');
    const handleAdd = () => {
        if (text.trim()) {
            onAdd(text);
        }
        onClose();
    };
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in-scale">
            <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl w-full max-w-lg">
                <div className="p-4 border-b border-slate-700">
                    <h3 className="text-lg font-semibold text-white">Bulk Add URLs</h3>
                </div>
                <div className="p-4">
                    <p className="text-sm text-slate-400 mb-2">Paste URLs, one per line.</p>
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        rows={8}
                        className="w-full p-2 bg-slate-900 border border-slate-600 rounded-md text-slate-200"
                        placeholder="https://example.com/products&#10;https://anothersite.com/catalog"
                    />
                </div>
                <div className="flex justify-end p-4 border-t border-slate-700 space-x-2">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md">Cancel</button>
                    <button onClick={handleAdd} className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-md">Add URLs</button>
                </div>
            </div>
        </div>
    );
};


// --- MAIN FORM ---
export const InputForm: React.FC<InputFormProps> = ({ onDetect, onSubmit, loadingState, isDetecting, detectionResults, ocrQuality, onOcrQualityChange }) => {
  const [inputMode, setInputMode] = useState<InputMode>('url');
  const [urls, setUrls] = useState<string[]>(['']);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUrlChange = (index: number, value: string) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
  };
  const addUrlInput = () => setUrls([...urls, '']);
  const removeUrlInput = (index: number) => setUrls(urls.filter((_, i) => i !== index));
  
  const handleBulkAddUrls = (urlsString: string) => {
    const newUrls = urlsString.split('\n').map(u => u.trim()).filter(Boolean);
    if (newUrls.length > 0) {
        const combined = [...urls.filter(Boolean), ...newUrls];
        const unique = [...new Set(combined)];
        setUrls(unique);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).filter(f => f.type === 'application/pdf');
      if (newFiles.length !== e.target.files.length) {
        setError('Some selected files were not PDFs and have been ignored.');
      } else {
        setError('');
      }
      setFiles(prevFiles => [...prevFiles, ...newFiles]);
    }
  };
  const removeFile = (index: number) => setFiles(files.filter((_, i) => i !== index));

  const validateAndGetInputs = (): ScrapeInput[] | null => {
    setError('');
    let inputs: ScrapeInput[] = [];
    if (inputMode === 'url') {
        const validUrls = urls.map(u => u.trim()).filter(Boolean);
        if (validUrls.length === 0) {
            setError('Please enter at least one URL.');
            return null;
        }
        for (const url of validUrls) {
            try {
                new URL(url);
                inputs.push({ type: 'url', value: url });
            // FIX: The unbound catch statement was causing a type error in some environments. Changed to a standard catch.
            } catch (e) {
                setError(`Invalid URL format: ${url}`);
                return null;
            }
        }
    } else {
        if (files.length === 0) {
            setError('Please select at least one PDF file.');
            return null;
        }
        inputs = files.map(f => ({ type: 'file', value: f }));
    }
    return inputs;
  };
  
  const handleAction = (action: (inputs: ScrapeInput[]) => void) => (e: React.FormEvent) => {
      e.preventDefault();
      const inputs = validateAndGetInputs();
      if (inputs) {
          action(inputs);
      }
  };

  const anyLoading = loadingState.active || isDetecting;

  return (
    <>
    <form className="space-y-4">
      <div className="flex bg-slate-800/50 rounded-lg p-1 space-x-1">
        <button type="button" onClick={() => setInputMode('url')} disabled={anyLoading} className={`w-full text-sm font-semibold py-2 rounded-md transition-all ${inputMode === 'url' ? 'bg-sky-600 text-white' : 'hover:bg-slate-700/60 text-slate-300'}`}>
          From URLs
        </button>
        <button type="button" onClick={() => setInputMode('file')} disabled={anyLoading} className={`w-full text-sm font-semibold py-2 rounded-md transition-all ${inputMode === 'file' ? 'bg-sky-600 text-white' : 'hover:bg-slate-700/60 text-slate-300'}`}>
          From PDFs
        </button>
      </div>
      
      <div className="space-y-3">
        {inputMode === 'url' ? (
            <>
                {urls.map((url, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <input
                            type="text" value={url} onChange={(e) => handleUrlChange(index, e.target.value)}
                            placeholder="https://www.supplier.com/products"
                            className="flex-grow px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                            disabled={anyLoading}
                        />
                        {urls.length > 1 && <button type="button" onClick={() => removeUrlInput(index)} className="p-2 text-slate-400 hover:text-red-400"><TrashIcon /></button>}
                    </div>
                ))}
                <div className="flex items-center gap-4">
                  <button type="button" onClick={addUrlInput} disabled={anyLoading} className="text-xs flex items-center gap-1 text-sky-400 hover:text-sky-300 font-semibold"><PlusIcon /> Add another URL</button>
                  <button type="button" onClick={() => setIsBulkModalOpen(true)} disabled={anyLoading} className="text-xs font-semibold text-sky-400 hover:text-sky-300">Bulk Add</button>
                </div>
            </>
        ) : (
           <>
                <div className="border-2 border-dashed border-slate-700 rounded-lg p-4 text-center cursor-pointer hover:border-sky-500" onClick={() => fileInputRef.current?.click()}>
                    <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} accept="application/pdf" disabled={anyLoading} />
                    <div className="flex flex-col items-center text-slate-400"><UploadIcon className="h-8 w-8 mb-2 text-sky-500"/><span className="font-semibold text-slate-200">Click to upload PDFs</span><span className="text-xs">or drag and drop</span></div>
                </div>
                <div className="flex items-center justify-between bg-slate-800/50 px-3 py-2 rounded-lg mt-2">
                  <label htmlFor="ocr-toggle" className="text-sm font-medium text-slate-300 cursor-pointer">
                      High Quality OCR <span className="text-xs text-slate-400">(Slower)</span>
                  </label>
                  <button
                    type="button"
                    role="switch"
                    id="ocr-toggle"
                    aria-checked={ocrQuality === 'high'}
                    onClick={() => onOcrQualityChange(ocrQuality === 'high' ? 'standard' : 'high')}
                    disabled={anyLoading}
                    className={`${
                        ocrQuality === 'high' ? 'bg-sky-600' : 'bg-slate-600'
                    } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-800`}
                  >
                    <span
                        className={`${
                            ocrQuality === 'high' ? 'translate-x-6' : 'translate-x-1'
                        } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                    />
                  </button>
                </div>
                {files.length > 0 && (
                    <div className="mt-4 space-y-2">
                        {files.map((file, index) => (
                            <div key={index} className="flex items-center justify-between bg-slate-800/50 p-2 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <PdfPreview file={file} />
                                    <div className="text-sm">
                                        <p className="font-medium text-slate-200 truncate max-w-[150px]">{file.name}</p>
                                        <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                </div>
                                <button type="button" onClick={() => removeFile(index)} disabled={anyLoading} className="p-2 text-slate-400 hover:text-red-400 disabled:opacity-50"><TrashIcon /></button>
                            </div>
                        ))}
                    </div>
                )}
           </>
        )}
      </div>

      {detectionResults && <DetectionResultsList results={detectionResults} />}

      {error && <p className="text-sm text-red-400 mt-3 animate-slide-in-up">{error}</p>}
      
      <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <button type="submit" onClick={handleAction(onDetect)} disabled={anyLoading} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors disabled:bg-slate-800 disabled:text-slate-500">
              {isDetecting ? <LoadingSpinner /> : <DetectIcon />}
              Detect Products
          </button>
          <button type="submit" onClick={handleAction(onSubmit)} disabled={anyLoading} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-lg transition-colors disabled:bg-amber-800/50 disabled:text-slate-400">
              {loadingState.active ? <LoadingSpinner /> : <ScrapeIcon />}
              Scrape Data
          </button>
      </div>
    </form>
    {isBulkModalOpen && <BulkUrlModal onClose={() => setIsBulkModalOpen(false)} onAdd={handleBulkAddUrls} />}
    </>
  );
};