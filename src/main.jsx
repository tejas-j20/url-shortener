import React from 'react'
import ReactDOM from 'react-dom/client'
// Ensure this path exactly matches your file name
import UrlShortenerApp from './UrlShortenrApp.jsx' 
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <UrlShortenerApp />
  </React.StrictMode>,
)