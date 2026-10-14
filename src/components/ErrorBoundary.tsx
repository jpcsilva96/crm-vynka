import React from "react";

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallbackLabel?: string },
  State
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary] Component crashed:", error);
    console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-destructive">
          <p className="text-lg font-semibold">
            Erro no {this.props.fallbackLabel || "componente"}
          </p>
          <pre className="max-w-lg whitespace-pre-wrap rounded-lg bg-destructive/10 p-4 text-xs">
            {this.state.error?.message}
            {"\n\n"}
            {this.state.error?.stack}
          </pre>
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
