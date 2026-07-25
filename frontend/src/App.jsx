import { Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Category from "./pages/Category";
import Profile from "./pages/Profile";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import "./App.css";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/c/:slug" element={<Category />} />
      <Route path="/u/:id" element={<Profile />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="*" element={<Landing />} />
    </Routes>
  );
}
