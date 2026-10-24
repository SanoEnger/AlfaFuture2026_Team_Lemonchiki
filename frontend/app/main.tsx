import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MantineProvider, createTheme } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@mantine/core/styles.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import { SessionProvider } from "./session";
import { Routes } from "./routes";
import "../shared/theme/styles.css";
import "../src/styles/finance-themes.css";
import "../shared/theme/sidebar.css";
import "../src/styles/ai-assistant.css";
import "../src/styles/workflow.css";
const theme = createTheme({
  fontFamily: "IBM Plex Sans, Arial, sans-serif",
  headings: {
    fontFamily: "IBM Plex Sans, Arial, sans-serif",
    fontWeight: "600",
  },
  primaryColor: "red",
  primaryShade: { light: 6, dark: 6 },
  colors: {
    red: [
      "#fff0f1",
      "#ffdadc",
      "#ffb5b9",
      "#ff8e95",
      "#fa6870",
      "#f34b54",
      "#ed3b44",
      "#d12a33",
      "#b92129",
      "#a01720",
    ],
  },
  defaultRadius: 8,
  components: { Button: { defaultProps: { variant: "filled" } } },
});
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 15000 } },
});
document.documentElement.dataset.density =
  localStorage.getItem("smart-density") || "comfortable";
document.documentElement.dataset.motion =
  localStorage.getItem("smart-motion") || "normal";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <BrowserRouter>
            <Routes />
          </BrowserRouter>
        </SessionProvider>
      </QueryClientProvider>
    </MantineProvider>
  </React.StrictMode>,
);
