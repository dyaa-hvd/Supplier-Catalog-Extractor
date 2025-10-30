import React, { useState, useMemo, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ResultsDisplay } from './components/ResultsDisplay';
import { ScrapedData, ScrapeInput, DetectionResult, ViewMode, ChatMessage, LoadingState } from './types';
import { scrapeSupplierData, detectProducts, chatWithDataStream } from './services/geminiService';
import { ApiKeyManager } from './components/ApiKeyManager';

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

  return (
    <ApiKeyManager>
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
    </ApiKeyManager>
  );
};

export default App;