import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { GlassCard, GlassButton } from '../styles/glass';
import styled from '@emotion/styled';

interface GracefulErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface GracefulErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; resetError: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

const ErrorContainer = styled(GlassCard)`
  margin: 1rem;
  padding: 2rem;
  text-align: center;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  
  .error-icon {
    color: #ff6b6b;
    margin-bottom: 1rem;
  }
  
  .error-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: rgba(255, 255, 255, 0.9);
  }
  
  .error-message {
    color: rgba(255, 255, 255, 0.7);
    margin-bottom: 1.5rem;
    font-size: 0.9rem;
  }
  
  .error-details {
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.8rem;
    font-family: monospace;
    margin-bottom: 1.5rem;
    word-break: break-word;
    max-height: 100px;
    overflow-y: auto;
  }
`;

const DefaultErrorFallback: React.FC<{ error?: Error; resetError: () => void }> = ({ 
  error, 
  resetError 
}) => (
  <ErrorContainer>
    <AlertCircle size={48} className="error-icon" />
    <div className="error-title">Something went wrong in this section</div>
    <div className="error-message">
      Don't worry! This error won't affect the rest of the app. You can try refreshing this section.
    </div>
    {error && (
      <details>
        <summary style={{ cursor: 'pointer', marginBottom: '1rem', color: 'rgba(255, 255, 255, 0.7)' }}>
          Show technical details
        </summary>
        <div className="error-details">
          {error.name}: {error.message}
        </div>
      </details>
    )}
    <GlassButton onClick={resetError}>
      <RefreshCw size={16} />
      Try Again
    </GlassButton>
  </ErrorContainer>
);

export class GracefulErrorBoundary extends React.Component<
  GracefulErrorBoundaryProps,
  GracefulErrorBoundaryState
> {
  constructor(props: GracefulErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): GracefulErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn('🚨 Graceful Error Boundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
    }

    return this.props.children;
  }
}

// Simple wrapper for sections that might have recoverable errors
export const ErrorBoundarySection: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <GracefulErrorBoundary>
    {children}
  </GracefulErrorBoundary>
);

export default GracefulErrorBoundary;