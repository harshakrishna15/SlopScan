import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CameraPage from './pages/CameraPage';
import ResultsPage from './pages/ResultsPage';
import ProductDetailPage from './pages/ProductDetailPage';
import AlternativesPage from './pages/AlternativesPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CameraPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/product/:code" element={<ProductDetailPage />} />
        <Route path="/alternatives/:code" element={<AlternativesPage />} />
      </Routes>
    </BrowserRouter>
  );
}
