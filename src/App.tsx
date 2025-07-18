import React from 'react';
import { BrowserRouter as Router, Routes, Route, useSearchParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { Layout } from './components/layout/Layout';
import { HomePage } from './pages/HomePage';
import { ModelsPage } from './pages/ModelsPage';
import { ApiPage } from './pages/ApiPage';
import { useAppStore } from './store/useAppStore';

// Create a query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Component to handle URL parameters
const HomePageWithParams: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { setModel } = useAppStore();

  React.useEffect(() => {
    const modelParam = searchParams.get('model');
    if (modelParam) {
      setModel(modelParam as any);
    }
  }, [searchParams, setModel]);

  return <HomePage />;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePageWithParams />} />
            <Route path="/models" element={<ModelsPage />} />
            <Route path="/api" element={<ApiPage />} />
          </Routes>
        </Layout>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </Router>
    </QueryClientProvider>
  );
}

export default App;