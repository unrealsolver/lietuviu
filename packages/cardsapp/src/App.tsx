import { AppLayout } from "./Layout";
import { CardsPage, TablesPage, TutorialCardsPage } from "./routes";
import { HashRouter, Route, Routes, Navigate } from "react-router";

export default function App() {
  return (
    <HashRouter /* For browser router: basename={import.meta.env.BASE_URL} */>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/cards/" />} />
          <Route path="/cards" element={<CardsPage />} />
          <Route path="/cards/tutorial" element={<TutorialCardsPage />} />
          <Route path="/table" element={<TablesPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
