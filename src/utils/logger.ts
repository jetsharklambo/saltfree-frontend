/**
 * Production-safe logging service for PU2-rc1
 * Replaces console.log statements with structured logging
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  component?: string;
  gameCode?: string;
  userAddress?: string;
  transactionHash?: string;
  blockNumber?: number;
  [key: string]: any;
}

class Logger {
  private isDevelopment: boolean;
  private isProduction: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  /**
   * Debug level - only shows in development
   */
  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.log(`🐛 [DEBUG] ${message}`, context || '');
    }
  }

  /**
   * Info level - shows in development, structured in production
   */
  info(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.log(`ℹ️ [INFO] ${message}`, context || '');
    } else if (this.isProduction) {
      // In production, send to monitoring service (Sentry, LogRocket, etc.)
      this.sendToMonitoring('info', message, context);
    }
  }

  /**
   * Warning level - always logs
   */
  warn(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.warn(`⚠️ [WARN] ${message}`, context || '');
    } else {
      this.sendToMonitoring('warn', message, context);
    }
  }

  /**
   * Error level - always logs and sends to monitoring
   */
  error(message: string, error?: Error, context?: LogContext): void {
    const logData = {
      ...context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    };

    if (this.isDevelopment) {
      console.error(`🚨 [ERROR] ${message}`, error || '', logData);
    } else {
      this.sendToMonitoring('error', message, logData, error);
    }
  }

  /**
   * Special method for blockchain-related logs
   */
  blockchain(action: string, context: LogContext & { 
    success?: boolean; 
    gasUsed?: string; 
    error?: string 
  }): void {
    const message = `🔗 Blockchain: ${action}`;
    
    // Sanitize sensitive data
    const sanitizedContext = {
      ...context,
      userAddress: this.sanitizeAddress(context.userAddress),
      transactionHash: context.transactionHash ? 
        `${context.transactionHash.slice(0, 10)}...${context.transactionHash.slice(-8)}` : 
        undefined
    };

    if (context.success === false || context.error) {
      this.error(message, undefined, sanitizedContext);
    } else {
      this.info(message, sanitizedContext);
    }
  }

  /**
   * Special method for user actions
   */
  userAction(action: string, context: LogContext): void {
    const message = `👤 User Action: ${action}`;
    
    const sanitizedContext = {
      ...context,
      userAddress: this.sanitizeAddress(context.userAddress)
    };

    this.info(message, sanitizedContext);
  }

  /**
   * Performance timing logs
   */
  performance(operation: string, duration: number, context?: LogContext): void {
    const message = `⚡ Performance: ${operation} took ${duration}ms`;
    
    if (duration > 1000) {
      this.warn(`${message} (SLOW)`, context);
    } else {
      this.debug(message, context);
    }
  }

  /**
   * Sanitize wallet address for logging (keep first 6 and last 4 characters)
   */
  private sanitizeAddress(address?: string): string | undefined {
    if (!address) return undefined;
    if (address.length < 10) return address; // Not a valid address
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  /**
   * BigInt-safe JSON serializer
   */
  private safeStringify(obj: any): string {
    return JSON.stringify(obj, (key, value) => {
      // Convert BigInt to string for JSON serialization
      if (typeof value === 'bigint') {
        return value.toString() + 'n'; // Add 'n' suffix to indicate it was a BigInt
      }
      return value;
    });
  }

  /**
   * Send logs to monitoring service in production
   * This would integrate with Sentry, LogRocket, or similar service
   */
  private sendToMonitoring(
    level: LogLevel, 
    message: string, 
    context?: LogContext, 
    error?: Error
  ): void {
    // In a real implementation, this would send to your monitoring service
    // For now, we'll use a structured console log that can be parsed by log aggregators
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined
    };

    // Use console methods that can be captured by log aggregation services
    // Use BigInt-safe stringification
    switch (level) {
      case 'error':
        console.error(this.safeStringify(logEntry));
        break;
      case 'warn':
        console.warn(this.safeStringify(logEntry));
        break;
      default:
        console.info(this.safeStringify(logEntry));
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Convenience methods for common use cases
export const logGameAction = (action: string, gameCode: string, context?: Partial<LogContext>) => {
  logger.userAction(action, { ...context, gameCode, component: 'Game' });
};

export const logWalletAction = (action: string, address?: string, context?: Partial<LogContext>) => {
  logger.userAction(action, { ...context, userAddress: address, component: 'Wallet' });
};

export const logContractCall = (
  method: string, 
  success: boolean, 
  context: Partial<LogContext & { gasUsed?: string; error?: string }>
) => {
  logger.blockchain(`Contract call: ${method}`, { ...context, success });
};

export const logPerformance = (operation: string, startTime: number, context?: LogContext) => {
  const duration = Date.now() - startTime;
  logger.performance(operation, duration, context);
};

// Migration helpers - these can be used to easily replace console.log statements
export const developmentLog = (message: string, ...args: any[]) => {
  logger.debug(message, { data: args });
};

export const productionSafeLog = (message: string, context?: LogContext) => {
  logger.info(message, context);
};

export default logger;