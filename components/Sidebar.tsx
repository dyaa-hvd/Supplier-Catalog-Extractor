import React, { useState, useRef, useEffect } from 'react';
import { InputForm } from './UrlInputForm';
// FIX: Import the centralized LoadingState type to resolve the 'Cannot find name' error.
import { ScrapeInput, DetectionResult, ChatMessage, LoadingState } from '../types';
import { marked } from 'marked';

// Configure marked for markdown rendering
marked.setOptions({
    gfm: true, // Use GitHub Flavored Markdown
    breaks: true, // Convert single line breaks to <br>
    async: false, // Ensure synchronous parsing
});


// --- ICONS ---
const ChevronDownIcon: React.FC<{ open: boolean }> = ({ open }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>
        <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
);
const SearchIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);
const SortIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M3 6h18" />
        <path d="M7 12h10" />
        <path d="M10 18h4" />
    </svg>
);
const UserIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
    </svg>
);
const SparkleIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M12 3L9.5 8.5L4 11L9.5 13.5L12 19L14.5 13.5L20 11L14.5 8.5L12 3Z"/>
        <path d="M5 21L6 17"/><path d="M19 21L18 17"/><path d="M21 5L17 6"/><path d="M3 5L7 6"/>
    </svg>
);

// --- CHAT COMPONENTS ---
const SendIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="22" y1="2" x2="11" y2="13"></line>
    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
  </svg>
);
const ChatLoadingDots: React.FC = () => (
    <div className="flex items-center space-x-1 p-1">
        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
    </div>
);

const ChatPanel: React.FC<{history: ChatMessage[], isChatting: boolean, onSendMessage: (message: string) => void}> = ({ history, isChatting, onSendMessage }) => {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history, isChatting]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim()) {
            onSendMessage(input);
            setInput('');
        }
    };

    return (
        <div className="flex flex-col h-96 bg-slate-800/50 rounded-lg border border-slate-700">
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {history.length === 0 && !isChatting && (
                     <div className="text-center text-sm text-slate-400 h-full flex flex-col justify-center items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        Ask a question about the scraped data.
                    </div>
                )}
                {history.map((msg, index) => (
                    <div key={index} className={`flex items-start gap-3 animate-slide-in-up-stagger ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`} style={{ animationDelay: `${index * 50}ms` }}>
                        {msg.role === 'model' && (
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-amber-300">
                                <SparkleIcon className="w-5 h-5" />
                            </div>
                        )}
                        <div className={`max-w-xs md:max-w-sm lg:max-w-md rounded-xl px-4 py-2 text-sm chat-bubble ${
                            msg.role === 'user' 
                            ? 'bg-sky-600 text-white rounded-br-xl' 
                            : 'bg-slate-700 text-slate-200 rounded-bl-xl'
                        }`}>
                             {msg.role === 'model' && msg.text === '' && isChatting && index === history.length - 1 ? (
                                <ChatLoadingDots />
                            ) : msg.role === 'model' ? (
                                <div dangerouslySetInnerHTML={{ __html: marked.parse(msg.text) as string }} />
                            ) : (
                                msg.text
                            )}
                        </div>
                        {msg.role === 'user' && (
                             <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-white">
                                <UserIcon className="w-5 h-5" />
                            </div>
                        )}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSubmit} className="p-2 border-t border-slate-700 flex items-center gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about the data..."
                    className="flex-1 w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    disabled={isChatting}
                />
                <button type="submit" disabled={isChatting || !input.trim()} className="p-2 bg-amber-500 text-slate-900 rounded-lg hover:bg-amber-400 disabled:bg-slate-600 disabled:text-slate-400 transition-colors">
                    <SendIcon />
                </button>
            </form>
        </div>
    );
};


// --- SIDEBAR COMPONENTS ---
const CollapsibleSection: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;}> = ({ title, icon, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  
  return (
    <div className="border-b border-slate-700/80">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center py-4 text-left text-slate-200 hover:text-white transition-colors"
      >
        <div className="flex items-center">
            <div className="mr-3 text-sky-400">{icon}</div>
            <span className="font-semibold">{title}</span>
        </div>
        <ChevronDownIcon open={isOpen} />
      </button>
      <div
        ref={contentRef}
        style={{ maxHeight: isOpen ? `${contentRef.current?.scrollHeight}px` : '0px' }}
        className="overflow-hidden transition-all duration-500 ease-in-out"
      >
        <div className="pb-6 px-1">{children}</div>
      </div>
    </div>
  );
};

const SummaryItem: React.FC<{ value: number, label: string }> = ({ value, label }) => (
    <div className="text-center bg-slate-800/50 p-3 rounded-lg border border-slate-700/80">
        <p className="text-2xl font-bold text-amber-300">{value}</p>
        <p className="text-xs text-slate-400">{label}</p>
    </div>
);

const ControlsPanel: React.FC<any> = ({ allCategories, selectedCategories, onCategoryToggle, onClearFilters, searchQuery, onSearchChange, sortOption, onSortChange, onResetView, hasActiveFilters }) => {
    return (
        <div className="space-y-6">
             <div className="grid grid-cols-1 gap-4">
                <div>
                    <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon className="h-5 w-5 text-slate-400" /></div>
                        <input type="text" value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search..." className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg" />
                    </div>
                </div>
                <div>
                    <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SortIcon className="h-5 w-5 text-slate-400" /></div>
                        <select value={sortOption} onChange={(e) => onSortChange(e.target.value)} className="w-full appearance-none pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg">
                            <option value="default">Default Order</option><option value="name-asc">Name (A-Z)</option><option value="name-desc">Name (Z-A)</option><option value="price-asc">Price (Low to High)</option><option value="price-desc">Price (High to Low)</option>
                        </select>
                    </div>
                </div>
            </div>
            {allCategories.length > 1 && (
                <div className="pt-4 border-t border-slate-700/80">
                    <div className="flex justify-between items-center mb-3"><h3 className="text-sm font-semibold text-slate-300">Filter by Category</h3>{selectedCategories.size > 0 && (<button onClick={onClearFilters} className="text-xs text-sky-400 hover:text-sky-300">Clear</button>)}</div>
                    <div className="flex flex-wrap gap-2">{allCategories.map((category:string) => (<button key={category} onClick={() => onCategoryToggle(category)} className={`px-3 py-1.5 text-xs rounded-full transition-all ${selectedCategories.has(category) ? 'bg-sky-600 text-white' : 'bg-slate-700 hover:bg-slate-600'}`}>{category}</button>))}</div>
                </div>
            )}
            {hasActiveFilters && <div className="pt-6 border-t border-slate-700/80"><button onClick={onResetView} className="w-full text-center text-sm py-2 bg-slate-700 hover:bg-slate-600 rounded-lg">Reset View</button></div>}
        </div>
    );
};

// --- MAIN SIDEBAR ---
interface SidebarProps {
    onDetect: (inputs: ScrapeInput[]) => void;
    onSubmit: (inputs: ScrapeInput[]) => void;
    loadingState: LoadingState;
    isDetecting: boolean;
    detectionResults: DetectionResult[] | null;
    summary: { categories: number, productLines: number, variants: number };
    allCategories: string[];
    selectedCategories: Set<string>;
    onCategoryToggle: (categoryName: string) => void;
    onClearFilters: () => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    sortOption: string;
    onSortChange: (option: string) => void;
    onResetView: () => void;
    hasActiveFilters: boolean;
    hasData: boolean;
    chatHistory: ChatMessage[];
    isChatting: boolean;
    onSendMessage: (message: string) => void;
    ocrQuality: 'standard' | 'high';
    onOcrQualityChange: (quality: 'standard' | 'high') => void;
}

export const Sidebar: React.FC<SidebarProps> = (props) => {
    return (
        <aside className="lg:col-span-1 xl:col-span-1 lg:sticky top-8 self-start bg-slate-900/70 border border-slate-700/50 p-6 rounded-xl shadow-2xl shadow-black/30 backdrop-blur-md lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto">
            <div className="mb-6 pb-6 border-b border-slate-700/80">
                <h1 className="text-2xl font-bold text-white">Supplier Catalog <span className="text-amber-400">Extractor</span></h1>
                <p className="text-slate-300 mt-2">
                    <span className="font-medium text-sm block">Clean, Structured Data. Every Time.</span>
                    <span className="text-xs text-slate-400">From Website to Spreadsheet, Instantly.</span>
                </p>
            </div>

            <CollapsibleSection title="Input Sources" defaultOpen={true} icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>}>
                 <p className="text-slate-400 text-sm mb-4">Enter URLs or upload PDF files to extract product information.</p>
                 <InputForm
                    onDetect={props.onDetect}
                    onSubmit={props.onSubmit}
                    loadingState={props.loadingState}
                    isDetecting={props.isDetecting}
                    detectionResults={props.detectionResults}
                    ocrQuality={props.ocrQuality}
                    onOcrQualityChange={props.onOcrQualityChange}
                 />
            </CollapsibleSection>
            
            {props.hasData && (
                <>
                <CollapsibleSection title="Chat with Data" defaultOpen={true} icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>}>
                    <ChatPanel history={props.chatHistory} isChatting={props.isChatting} onSendMessage={props.onSendMessage} />
                </CollapsibleSection>
                <CollapsibleSection title="Live Summary" defaultOpen={false} icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20v-6M6 20v-4M18 20v-8"/></svg>}>
                    <div className="grid grid-cols-3 gap-2"><SummaryItem value={props.summary.categories} label="Categories" /><SummaryItem value={props.summary.productLines} label="Product Lines" /><SummaryItem value={props.summary.variants} label="Variants" /></div>
                </CollapsibleSection>
                <CollapsibleSection title="Analysis & Controls" defaultOpen={false} icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20l-7 -7a4 4 0 0 1 6 -6l1 1l1 -1a4 4 0 0 1 6 6l-7 7"/></svg>}>
                    <ControlsPanel {...props} />
                </CollapsibleSection>
                </>
            )}
        </aside>
    );
};