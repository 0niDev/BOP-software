import { useState, useEffect } from 'react'
import './App.css'
import { AuthProvider, useAuth } from './context/AuthContext'
import { LoginView, MainWindow } from './views'
import { debugLog } from './config'

// Debug logging
console.log('[App] Application component loading...');

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setIsLoaded(true);
      debugLog('App', `Authentication state loaded: ${isAuthenticated ? 'authenticated' : 'not authenticated'}`);
    }
  }, [isLoading, isAuthenticated]);

  if (!isLoaded) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner">
          <h1>BOP Nutraceuticals ERP</h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <MainWindow /> : <LoginView />;
}

function App() {
  debugLog('App', 'Rendering application with AuthProvider');
  
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App
