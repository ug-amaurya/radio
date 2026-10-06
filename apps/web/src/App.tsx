import { Navigate, Route, Routes } from "react-router-dom";
import { AuthedLayout } from "./components/layout/AuthedLayout";
import { ToastHost } from "./components/layout/ToastHost";
import Callback from "./pages/Callback";
import Home from "./pages/Home";
import Join from "./pages/Join";
import Profile from "./pages/Profile";
import Stations from "./pages/Stations";
import Trending from "./pages/Trending";

export default function App() {
  return (
    <>
      <Routes>
        <Route element={<AuthedLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/stations" element={<Stations />} />
          <Route path="/trending" element={<Trending />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
        <Route path="/join/:code" element={<Join />} />
        <Route path="/callback" element={<Callback />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastHost />
    </>
  );
}
