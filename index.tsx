
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AdminPage from './AdminPage';
import CalibrationPage from './CalibrationPage';

// Suppress specific MediaPipe/TFLite info logs that look like errors
const originalConsoleInfo = console.info;
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;

function shouldSuppress(args: any[]) {
    // Check first argument for the specific TFLite message
    if (args.length > 0 && typeof args[0] === 'string' && args[0].includes('Created TensorFlow Lite XNNPACK delegate for CPU')) {
        return true;
    }
    return false;
}

console.info = (...args: any[]) => {
  if (shouldSuppress(args)) return;
  originalConsoleInfo(...args);
};

console.log = (...args: any[]) => {
  if (shouldSuppress(args)) return;
  originalConsoleLog(...args);
};

console.warn = (...args: any[]) => {
  if (shouldSuppress(args)) return;
  originalConsoleWarn(...args);
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const path = window.location.pathname;

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {path === '/admin'     ? <AdminPage />       :
     path === '/calibrate' ? <CalibrationPage /> :
     <App />}
  </React.StrictMode>
);
