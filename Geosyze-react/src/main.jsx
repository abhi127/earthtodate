import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import * as ol from 'ol';
import * as proj from 'ol/proj';
import * as source from 'ol/source';
import * as layer from 'ol/layer';
import * as control from 'ol/control';
import * as interaction from 'ol/interaction';
import * as format from 'ol/format';
import * as style from 'ol/style';
import * as geom from 'ol/geom';
import * as sphere from 'ol/sphere';
import * as extent from 'ol/extent';
import 'ol/ol.css';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import './App.css';

// ponytail: shim composing the namespaced global the components read via `window.ol`
// (v10 npm package doesn't export namespaces from the root `ol` entry like the old CDN full build did)
window.ol = { ...ol, proj, source, layer, control, interaction, format, style, geom, sphere, extent };

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
