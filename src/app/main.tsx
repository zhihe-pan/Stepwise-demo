import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "@fontsource/geist-sans/latin.css"
import "@fontsource/geist-mono/latin.css"
import "../styles/globals.css"
import App from "./App"

export function renderApp() {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
