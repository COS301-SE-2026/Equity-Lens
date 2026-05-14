import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "../pages/Auth/Login";
import Register from "../pages/Auth/Register";
import Dashboard from "../pages/Dashboard/Dashboard";
import AIChat from "../pages/AIChat/AIChat";
import Analytics from "../pages/Analytics/Analytics";
import News from "../pages/News/News";
import Portfolio from "../pages/Portfolio/Portfolio";
import NotFound from "../pages/NotFound/NotFound";

export default function AppRouter() {
  return (
    <BrowserRouter>
       <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/ai-chat" element={<AIChat />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/news" element={<News />} />
        <Route path="/portfolio" element={<Portfolio />} />
       <Route path="/register" element={<Register />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
