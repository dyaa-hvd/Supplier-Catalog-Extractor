import React, { useState, useMemo, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ResultsDisplay } from './components/ResultsDisplay';
import { ScrapedData, ScrapeInput, DetectionResult, ViewMode, ChatMessage, LoadingState } from './types';
import { scrapeSupplierData, detectProducts, chatWithDataStream } from './services/geminiService';

/**
 * Normalizes text for searching by making it lowercase and removing diacritics (accents).
 * e.g., "ÄKTA" becomes "akta".
 */
const normalizeText = (text: string): string => {
  if (!text) return '';
  return text
    .normalize('NFD') // Decompose combined characters into base characters and diacritics
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .toLowerCase();
};


const App: React.FC = () => {
  const [scrapedData, setScrapedData] = useState<ScrapedData | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>({ active: false, stage: '' });
  const [error, setError] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOption, setSortOption] = useState<string>('default');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [detectionResults, setDetectionResults] = useState<DetectionResult[] | null>(null);

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isChatting, setIsChatting] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const [ocrQuality, setOcrQuality] = useState<'standard' | 'high'>(() => {
    const saved = localStorage.getItem('ocrQuality');
    return (saved === 'standard' || saved === 'high') ? saved : 'high';
  });

  // State to track if the API key is ready.
  const [isApiKeyReady, setIsApiKeyReady] = useState(false);

  // Effect to check for the API key availability.
  useEffect(() => {
    const checkKey = () => {
      // Use an interval to handle potential race conditions where the aistudio object isn't ready.
      const intervalId = setInterval(async () => {
        if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
          const hasKey = await window.aistudio.hasSelectedApiKey();
          if (hasKey) {
            setIsApiKeyReady(true);
            clearInterval(intervalId);
          }
        }
      }, 500); // Check every 500ms
      
      // Cleanup on unmount
      return () => clearInterval(intervalId);
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      await window.aistudio.openSelectKey();
      // Optimistically set to true, as the user has now gone through the flow.
      // The interval checker will confirm it shortly after.
      setIsApiKeyReady(true);
    }
  };


  const handleOcrQualityChange = (quality: 'standard' | 'high') => {
      setOcrQuality(quality);
      localStorage.setItem('ocrQuality', quality);
  };


  const handleDetect = async (inputs: ScrapeInput[]) => {
    setIsDetecting(true);
    setDetectionResults(null);
    setError(null);
    try {
      const results = await detectProducts(inputs);
      setDetectionResults(results);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred during detection.');
      }
    } finally {
      setIsDetecting(false);
    }
  };

  const handleScrape = async (inputs: ScrapeInput[]) => {
    setLoadingState({ active: true, stage: 'Initiating...' });
    setError(null);
    setScrapedData(null);
    setDetectionResults(null);
    setChatHistory([]); // Reset chat on new scrape
    resetView();
    try {
      const onProgress = (update: { stage: string; progress?: { current: number; total: number } }) => {
        setLoadingState(prevState => ({ 
          ...prevState, 
          stage: update.stage,
          progress: update.progress ?? prevState.progress
        }));
      };
      const data = await scrapeSupplierData(inputs, onProgress, ocrQuality);
      setScrapedData(data);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setLoadingState({ active: false, stage: '' });
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || !scrapedData) return;

    const userMessage: ChatMessage = { role: 'user', text: message };
    const newHistoryWithUser = [...chatHistory, userMessage];
    setChatHistory(newHistoryWithUser);
    setIsChatting(true);
    setChatError(null);

    try {
      // Add a placeholder for the model's response
      setChatHistory(prev => [...prev, { role: 'model', text: '' }]);

      const stream = chatWithDataStream(scrapedData, message, newHistoryWithUser);
      for await (const chunk of stream) {
        setChatHistory(prev => {
          const updatedHistory = [...prev];
          const lastMessage = updatedHistory[updatedHistory.length - 1];
          if (lastMessage && lastMessage.role === 'model') {
            lastMessage.text += chunk;
          }
          return updatedHistory;
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown chat error occurred.";
      setChatError(errorMessage);
      setChatHistory(prev => [...prev, { role: 'model', text: `Sorry, I ran into an error: ${errorMessage}` }]);
    } finally {
      setIsChatting(false);
    }
  };


  const handleCategoryToggle = (categoryName: string) => {
    setSelectedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryName)) {
        newSet.delete(categoryName);
      } else {
        newSet.add(categoryName);
      }
      return newSet;
    });
  };

  const clearFilters = () => {
    setSelectedCategories(new Set());
  };
  
  const resetView = () => {
    clearFilters();
    setSearchQuery('');
    setSortOption('default');
  }

  const allCategories = useMemo(() =>
    scrapedData?.categories.map(c => c.name) ?? [],
    [scrapedData]
  );

  const filteredAndSortedData = useMemo(() => {
    if (!scrapedData) return null;

    let processedData = JSON.parse(JSON.stringify(scrapedData)) as ScrapedData;

    // 1. Category Filtering
    if (selectedCategories.size > 0) {
      processedData.categories = processedData.categories.filter(category => selectedCategories.has(category.name));
    }

    // 2. Search Filtering (accent and case insensitive)
    if (searchQuery.trim() !== '') {
      const normalizedQuery = normalizeText(searchQuery);
      processedData.categories = processedData.categories.map(category => {
          const matchingProducts = category.products.map(product => {
              const matchesProductLine = normalizeText(product.name).includes(normalizedQuery) || normalizeText(product.description).includes(normalizedQuery);
              const matchingVariants = product.variants.filter(variant =>
                  normalizeText(variant.name).includes(normalizedQuery) ||
                  normalizeText(variant.description).includes(normalizedQuery)
              );

              if (matchesProductLine) {
                  return product;
              }
              if (matchingVariants.length > 0) {
                  return { ...product, variants: matchingVariants };
              }
              return null;
          }).filter((p): p is NonNullable<typeof p> => p !== null);
          
          return { ...category, products: matchingProducts };
      }).filter(category => category.products.length > 0);
    }

    // 3. Sorting (applied to variants within each product line)
    if (sortOption !== 'default') {
      const parsePrice = (priceStr: string): number => {
        if (!priceStr || priceStr.toLowerCase() === 'n/a') return sortOption.includes('asc') ? Infinity : -Infinity;
        const num = parseFloat(priceStr.replace(/[^0-9.-]+/g, ""));
        return isNaN(num) ? (sortOption.includes('asc') ? Infinity : -Infinity) : num;
      };

      processedData.categories.forEach(category => {
        category.products.forEach(product => {
            product.variants.sort((a, b) => {
              switch (sortOption) {
                case 'name-asc':
                  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
                case 'name-desc':
                  return b.name.localeCompare(a.name, undefined, { sensitivity: 'base' });
                case 'price-asc':
                  return parsePrice(a.price) - parsePrice(b.price);
                case 'price-desc':
                  return parsePrice(b.price) - parsePrice(a.price);
                default:
                  return 0;
              }
            });
        });
      });
    }

    return processedData;
  }, [scrapedData, selectedCategories, searchQuery, sortOption]);


  const dataSummary = useMemo(() => {
    const data = filteredAndSortedData || { categories: [] };
    const categories = data.categories.length;
    let productLines = 0;
    let variants = 0;
    data.categories.forEach(cat => {
        productLines += cat.products.length;
        cat.products.forEach(prod => {
            variants += prod.variants.length;
        });
    });
    return { categories, productLines, variants };
  }, [filteredAndSortedData]);
  
  const hasActiveFilters = selectedCategories.size > 0 || searchQuery.trim() !== '' || sortOption !== 'default';

  // Render a loading/prompt screen until the API key is ready.
  if (!isApiKeyReady) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white text-center p-4">
        <div className="bg-slate-800/50 border border-slate-700 p-8 rounded-xl max-w-md animate-fade-in-scale">
          <h1 className="text-2xl font-bold text-amber-400 mb-4">API Key Required</h1>
          <p className="text-slate-300 mb-6">
            To use this application, please select a Gemini API key. This is required to make requests to the AI model.
          </p>
          <button
            onClick={handleSelectKey}
            className="w-full px-4 py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg transition-colors"
          >
            Select API Key
          </button>
          <p className="text-xs text-slate-400 mt-4">
            Note: Using the Gemini API may incur costs. For details, see the 
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline ml-1">
              billing documentation
            </a>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white font-sans">
      <main className="container mx-auto p-4 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          
          <Sidebar
            onDetect={handleDetect}
            onSubmit={handleScrape} 
            loadingState={loadingState}
            isDetecting={isDetecting}
            detectionResults={detectionResults}
            summary={dataSummary}
            allCategories={allCategories}
            selectedCategories={selectedCategories}
            onCategoryToggle={handleCategoryToggle}
            onClearFilters={clearFilters}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortOption={sortOption}
            onSortChange={setSortOption}
            onResetView={resetView}
            hasActiveFilters={hasActiveFilters}
            hasData={!!scrapedData}
            chatHistory={chatHistory}
            isChatting={isChatting}
            onSendMessage={handleSendMessage}
            ocrQuality={ocrQuality}
            onOcrQualityChange={handleOcrQualityChange}
          />

          <div className="lg:col-span-2 xl:col-span-3 min-h-[80vh] bg-slate-800/20 border border-slate-700/50 p-6 rounded-xl">
             <ResultsDisplay 
                displayData={filteredAndSortedData}
                exportData={scrapedData}
                loadingState={loadingState} 
                error={error} 
                viewMode={viewMode}
                setViewMode={setViewMode}
             />
          </div>
        </div>
      </main>
      <footer className="text-center py-4 mt-8 text-xs text-slate-500 space-y-2">
        <p>
          Supplier Catalog Extractor | Powered by Gemini API
        </p>
        <div className="border-t border-slate-700/50 w-1/4 mx-auto pt-3">
          <p className="font-semibold text-slate-400">Built by: Dyaa Bassiony</p>
          <p>Market Research Specialist at HVD Egypt</p>
          <p>
            Contact: <a href="mailto:dyaa.bassiony@hvdegypt.com" className="text-sky-400 hover:text-sky-300">dyaa.bassiony@hvdegypt.com</a>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;