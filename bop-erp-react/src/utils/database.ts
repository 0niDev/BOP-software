// Database Connection Manager for SQLiteCloud
// DEBUG: Implements connection pooling and auto-reconnect logic

import { Database } from '@sqlitecloud/drivers';
import { DB_CONFIG, debugLog, errorLog } from '../config';

export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private db: Database | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = DB_CONFIG.retryAttempts;

  private constructor() {
    debugLog('DatabaseConnection', 'Initializing database connection manager');
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      debugLog('DatabaseConnection', 'Creating singleton instance');
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  /**
   * Get or create database connection
   * DEBUG: Implements lazy initialization with auto-reconnect
   */
  public async getConnection(): Promise<Database> {
    if (this.db && this.isConnected) {
      debugLog('DatabaseConnection', 'Returning existing connection');
      return this.db;
    }

    debugLog('DatabaseConnection', 'Establishing new connection to SQLiteCloud');
    await this.connect();
    return this.db!;
  }

  /**
   * Connect to SQLiteCloud database
   * DEBUG: Handles connection errors with retry logic
   */
  private async connect(): Promise<void> {
    try {
      debugLog('DatabaseConnection', `Connecting to: ${DB_CONFIG.connectionString.substring(0, 50)}...`);
      
      this.db = new Database(DB_CONFIG.connectionString);
      
      // Test connection with a simple query
      await this.db.sql`SELECT 1 as test;`;
      
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      debugLog('DatabaseConnection', 'Successfully connected to SQLiteCloud');
    } catch (error) {
      errorLog('DatabaseConnection', 'Failed to connect to SQLiteCloud', error);
      this.isConnected = false;
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = DB_CONFIG.retryDelay * Math.pow(2, this.reconnectAttempts - 1);
        warnLog('DatabaseConnection', `Retrying connection (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.connect();
      }
      
      throw new Error(`Failed to connect after ${this.maxReconnectAttempts} attempts: ${error}`);
    }
  }

  /**
   * Execute SQL query with automatic reconnection
   * DEBUG: Wraps all queries with error handling
   */
  public async query<T>(sql: TemplateStringsArray, ...values: any[]): Promise<T[]> {
    const db = await this.getConnection();
    
    try {
      debugLog('DatabaseConnection', `Executing query: ${sql[0].substring(0, 100)}...`);
      const result = await db.sql(sql, ...values);
      debugLog('DatabaseConnection', `Query executed successfully, rows returned: ${Array.isArray(result) ? result.length : 'N/A'}`);
      return result as T[];
    } catch (error) {
      errorLog('DatabaseConnection', 'Query execution failed', error);
      
      // Attempt to reconnect on failure
      this.isConnected = false;
      this.db = null;
      
      debugLog('DatabaseConnection', 'Attempting to reconnect after query failure');
      await this.connect();
      
      // Retry the query once after reconnection
      const dbRetry = await this.getConnection();
      const result = await dbRetry.sql(sql, ...values);
      debugLog('DatabaseConnection', 'Query retried successfully after reconnection');
      return result as T[];
    }
  }

  /**
   * Execute transaction with rollback on error
   * DEBUG: Ensures atomicity of related operations
   */
  public async transaction<T>(callback: () => Promise<T>): Promise<T> {
    const db = await this.getConnection();
    
    debugLog('DatabaseConnection', 'Starting transaction');
    
    try {
      // Begin transaction
      await db.sql`BEGIN TRANSACTION;`;
      debugLog('DatabaseConnection', 'Transaction started');
      
      // Execute callback
      const result = await callback();
      
      // Commit transaction
      await db.sql`COMMIT;`;
      debugLog('DatabaseConnection', 'Transaction committed successfully');
      
      return result;
    } catch (error) {
      // Rollback on error
      try {
        await db.sql`ROLLBACK;`;
        errorLog('DatabaseConnection', 'Transaction rolled back due to error', error);
      } catch (rollbackError) {
        errorLog('DatabaseConnection', 'Failed to rollback transaction', rollbackError);
      }
      
      throw error;
    }
  }

  /**
   * Check connection health
   * DEBUG: Used for periodic health checks
   */
  public async checkHealth(): Promise<boolean> {
    try {
      const db = await this.getConnection();
      await db.sql`SELECT 1 as health_check;`;
      debugLog('DatabaseConnection', 'Health check passed');
      return true;
    } catch (error) {
      errorLog('DatabaseConnection', 'Health check failed', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Close database connection
   * DEBUG: Cleanup on application shutdown
   */
  public async disconnect(): Promise<void> {
    if (this.db) {
      debugLog('DatabaseConnection', 'Closing database connection');
      // Note: @sqlitecloud/drivers doesn't have explicit close method
      this.db = null;
      this.isConnected = false;
    }
  }
}

// Export singleton instance
export const dbConnection = DatabaseConnection.getInstance();
console.log('[DatabaseConnection] Module initialized with singleton pattern');
