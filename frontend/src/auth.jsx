import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("clashtok_token")) {
      api.me().then(setUser).catch(() => localStorage.removeItem("clashtok_token")).finally(() => setReady(true));
    } else {
      setReady(true);
    }
  }, []);

  function persist(token, u) {
    localStorage.setItem("clashtok_token", token);
    setUser(u);
  }
  function logout() {
    localStorage.removeItem("clashtok_token");
    setUser(null);
  }

  return (
    <AuthCtx.Provider value={{ user, ready, persist, logout, setUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
