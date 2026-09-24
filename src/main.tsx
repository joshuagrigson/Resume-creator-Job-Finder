import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '@/App';
// Self-hosted type: Inter (interface) and Newsreader (display). Only the subsets a page uses download.
import '@fontsource-variable/inter/opsz.css';
import '@fontsource-variable/newsreader/opsz.css';
import '@/styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
