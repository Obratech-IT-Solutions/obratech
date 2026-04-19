import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AdminLogin from "./AdminLogin.tsx";
import App from "./App.tsx";
import "./firebase";
import "./index.css";

function isAdminGate() {
  return new URLSearchParams(window.location.search).get("admin") === "1";
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>{isAdminGate() ? <AdminLogin /> : <App />}</StrictMode>,
);
