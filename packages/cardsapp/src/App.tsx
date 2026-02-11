import { CardsPage, TablesPage } from "./routes";
import { BrowserRouter, Route, Routes, Navigate } from "react-router";

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route index element={<Navigate to="/cards/" />} />
        <Route path="/cards" element={<CardsPage />} />
        <Route path="/table" element={<TablesPage />} />
      </Routes>
    </BrowserRouter>
  );
}
