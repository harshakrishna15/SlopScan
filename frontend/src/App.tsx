import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import StartPage from './pages/StartPage';
import CameraPage from './pages/CameraPage';
import ResultsPage from './pages/ResultsPage';
import ProductDetailPage from './pages/ProductDetailPage';
import AlternativesPage from './pages/AlternativesPage';
import HistoryPage from './pages/HistoryPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<StartPage />} />
          <Route path="/scan" element={<CameraPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/product/:code" element={<ProductDetailPage />} />
          <Route path="/alternatives/:code" element={<AlternativesPage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
