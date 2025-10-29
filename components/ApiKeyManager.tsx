import React from 'react';

// --- ICONS ---
const AlertTriangleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
    <line x1="12" y1="9" x2="12" y2="13"></line>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
);

const MissingApiKeyMessage: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center text-white font-sans p-4">
    <div className="max-w-2xl w-full bg-slate-800/50 border border-amber-500/30 p-8 rounded-xl shadow-2xl shadow-black/30 backdrop-blur-md">
      <div className="flex items-center mb-4">
        <AlertTriangleIcon className="h-8 w-8 text-amber-400 mr-4" />
        <h1 className="text-2xl font-bold text-amber-300">API Key Configuration Required</h1>
      </div>
      <div className="space-y-4 text-slate-300">
        <p>
          Welcome to the Supplier Catalog Extractor. To connect to the Gemini API, you need to provide an API key.
        </p>
        <p>
          For security reasons, the API key must be set as an environment variable named{' '}
          <code className="bg-slate-900 text-amber-300 px-2 py-1 rounded-md text-sm font-mono">API_KEY</code>.
          We do not allow keys to be entered directly in the browser to protect your credentials.
        </p>
        <div>
          <h2 className="font-semibold text-slate-100 mb-2">How to set your API Key:</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm bg-slate-900/70 p-4 rounded-lg border border-slate-700">
            <li>
              Obtain your API key from{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-400 hover:text-sky-300 underline"
              >
                Google AI Studio
              </a>.
            </li>
            <li>
              Set the <code className="font-mono text-amber-300">API_KEY</code> environment variable in your deployment
              platform or local development environment.
            </li>
            <li>
              Reload the application. The app will automatically detect the key.
            </li>
          </ol>
        </div>
        <p className="text-xs text-slate-500 pt-4 border-t border-slate-700">
          This secure method ensures your key is never exposed in the client-side code, protecting you from
          unauthorized use.
        </p>
      </div>
    </div>
  </div>
);

interface ApiKeyManagerProps {
  children: React.ReactNode;
}

export const ApiKeyManager: React.FC<ApiKeyManagerProps> = ({ children }) => {
  const hasApiKey = process.env.API_KEY && process.env.API_KEY.length > 0;

  if (!hasApiKey) {
    return <MissingApiKeyMessage />;
  }

  return <>{children}</>;
};
