import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
// Latin only. The full stylesheet also ships latin-ext and vietnamese, which
// is 55kB of glyphs no letter here uses.
import '@fontsource/allura/latin-400.css';
import './styles.css';

createRoot(document.getElementById('root')).render(<App />);
