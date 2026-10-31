import { createRoot } from "react-dom/client";
import "./index.css";

// Validates that all required Firebase environment variables are present.
// Previously in src/lib/env.ts — inlined here to reduce file count.
const getEnvErrors = (): string[] => {
  const required = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
  ];
  const errors: string[] = [];
  for (const key of required) {
    if (!import.meta.env[key]) errors.push(key);
  }
  return errors;
};

const envErrors = getEnvErrors();

if (envErrors.length > 0) {
  createRoot(document.getElementById("root")!).render(
    <div style={{ padding: "40px", fontFamily: "system-ui, sans-serif", maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ color: "#e11d48", marginBottom: "8px" }}>Configuration Error</h1>
      <p style={{ fontSize: "18px", color: "#333", marginBottom: "24px" }}>
        The application could not start because the following environment variables are missing:
      </p>
      <ul style={{ background: "#f871711a", padding: "20px 40px", borderRadius: "8px", border: "1px solid #f87171" }}>
        {envErrors.map(err => (
          <li key={err} style={{ color: "#991b1b", marginBottom: "8px", fontFamily: "monospace", fontSize: "16px" }}>{err}</li>
        ))}
      </ul>
      <div style={{ marginTop: "24px", padding: "20px", background: "#f3f4f6", borderRadius: "8px" }}>
        <h3 style={{ marginTop: 0 }}>How to fix this:</h3>
        <ol style={{ marginBottom: 0 }}>
          <li>Copy the <code>.env.example</code> file to create a new <code>.env</code> file in the root of the project.</li>
          <li>Fill in the required values for your Firebase / other specific resources.</li>
          <li>Restart the development server.</li>
        </ol>
      </div>
    </div>
  );
} else {
  import("react").then((React) => {
    class ErrorBoundary extends React.Component<{children: any}, {hasError: boolean, error: any, errorInfo: any}> {
      constructor(props: any) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
      }
      static getDerivedStateFromError(error: any) {
        return { hasError: true, error };
      }
      componentDidCatch(error: any, errorInfo: any) {
        this.setState({ errorInfo });
      }
      render() {
        if (this.state.hasError) {
          return (
            <div style={{ padding: "40px", fontFamily: "monospace", color: "red", background: "#fee" }}>
              <h2>Application Crashed</h2>
              <p>{this.state.error && this.state.error.toString()}</p>
              <pre>{this.state.errorInfo && this.state.errorInfo.componentStack}</pre>
            </div>
          );
        }
        return this.props.children;
      }
    }

    import("./App.tsx").then(({ default: App }) => {
      createRoot(document.getElementById("root")!).render(
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      );
    });
  });
}
