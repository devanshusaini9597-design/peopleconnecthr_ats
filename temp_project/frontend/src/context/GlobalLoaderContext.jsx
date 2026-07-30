import React, { createContext, useContext, useState, useCallback } from 'react';

const GlobalLoaderContext = createContext(null);

export function GlobalLoaderProvider({ children }) {
  const [state, setState] = useState({ show: false, message: 'Loading...' });

  const setGlobalLoading = useCallback((show, message = 'Loading...') => {
    setState({ show: Boolean(show), message: message || 'Loading...' });
  }, []);

  return (
    <GlobalLoaderContext.Provider value={{ ...state, setGlobalLoading }}>
      {children}
    </GlobalLoaderContext.Provider>
  );
}

export function useGlobalLoader() {
  const ctx = useContext(GlobalLoaderContext);
  if (!ctx) return { show: false, message: 'Loading...', setGlobalLoading: () => {} };
  return ctx;
}
