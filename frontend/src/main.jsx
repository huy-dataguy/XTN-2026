import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx' // Đảm bảo import App
// import router from './routers/router.jsx'  <-- Bỏ dòng này hoặc comment lại
// import { RouterProvider } from 'react-router-dom' <-- Bỏ dòng này hoặc comment lại
import { Provider } from 'react-redux'
import { store } from './redux/store.js'

createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    {/* Thay RouterProvider bằng App */}
    <App /> 
  </Provider>
)