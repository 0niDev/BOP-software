// Base Repository with caching layer
// DEBUG: Implements 30-second TTL cache and common CRUD operations

import { dbConnection } from '../utils/database';
import { CACHE_CONFIG, debugLog, warnLog, errorLog } from '../config';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Base Repository with built-in caching
 * DEBUG: All specific repositories extend this class
 */
export abstract class BaseRepository<T extends { id: number }> {
  protected tableName: string;
  private cache: Map<string, CacheEntry<T>> = new Map();
  private readonly ttlMs: number = CACHE_CONFIG.TTL_SECONDS * 1000;

  constructor(tableName: string) {
    this.tableName = tableName;
    debugLog('BaseRepository', `Initializing repository for table: ${tableName}`);
  }

  /**
   * Generate cache key from query parameters
   */
  private getCacheKey(method: string, params: any[]): string {
    return `${this.tableName}:${method}:${JSON.stringify(params)}`;
  }

  /**
   * Check if cache entry is valid
   */
  private isCacheValid(entry: CacheEntry<T>): boolean {
    const now = Date.now();
    return (now - entry.timestamp) < this.ttlMs;
  }

  /**
   * Get from cache if valid
   */
  protected getFromCache(method: string, params: any[]): T | null {
    const key = this.getCacheKey(method, params);
    const entry = this.cache.get(key);
    
    if (entry && this.isCacheValid(entry)) {
      debugLog('BaseRepository', `Cache HIT for ${key}`);
      return entry.data;
    }
    
    if (entry) {
      debugLog('BaseRepository', `Cache EXPIRED for ${key}, removing`);
      this.cache.delete(key);
    } else {
      debugLog('BaseRepository', `Cache MISS for ${key}`);
    }
    
    return null;
  }

  /**
   * Set cache entry
   */
  protected setCache(method: string, params: any[], data: T): void {
    const key = this.getCacheKey(method, params);
    
    // Limit cache size
    if (this.cache.size >= CACHE_CONFIG.MAX_SIZE) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      warnLog('BaseRepository', `Cache full, removed oldest entry: ${firstKey}`);
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
    
    debugLog('BaseRepository', `Cache SET for ${key}`);
  }

  /**
   * Invalidate all cache entries for this repository
   * DEBUG: Called after write operations
   */
  protected invalidateCache(): void {
    const keys = Array.from(this.cache.keys()).filter(k => k.startsWith(`${this.tableName}:`));
    keys.forEach(key => this.cache.delete(key));
    debugLog('BaseRepository', `Invalidated ${keys.length} cache entries for ${this.tableName}`);
  }

  /**
   * Find by ID
   */
  async findById(id: number): Promise<T | null> {
    const cached = this.getFromCache('findById', [id]);
    if (cached) return cached;

    try {
      const results = await dbConnection.query<T>`SELECT * FROM ${this.tableName} WHERE id = ${id}`;
      
      if (results.length === 0) {
        debugLog('BaseRepository', `No record found in ${this.tableName} with id ${id}`);
        return null;
      }

      const result = results[0];
      this.setCache('findById', [id], result);
      return result;
    } catch (error) {
      errorLog('BaseRepository', `Error finding ${this.tableName} by id ${id}`, error);
      throw error;
    }
  }

  /**
   * Find all records
   */
  async findAll(): Promise<T[]> {
    const cached = this.getFromCache('findAll', []);
    if (cached) return [cached];

    try {
      const results = await dbConnection.query<T>`SELECT * FROM ${this.tableName}`;
      debugLog('BaseRepository', `Found ${results.length} records in ${this.tableName}`);
      return results;
    } catch (error) {
      errorLog('BaseRepository', `Error fetching all from ${this.tableName}`, error);
      throw error;
    }
  }

  /**
   * Find by company ID (for multi-company support)
   */
  async findByCompanyId(companyId: number): Promise<T[]> {
    const cached = this.getFromCache('findByCompanyId', [companyId]);
    if (cached) return [cached];

    try {
      const results = await dbConnection.query<T>`
        SELECT * FROM ${this.tableName} 
        WHERE company_id = ${companyId}
      `;
      debugLog('BaseRepository', `Found ${results.length} records in ${this.tableName} for company ${companyId}`);
      return results;
    } catch (error) {
      errorLog('BaseRepository', `Error fetching ${this.tableName} by company ${companyId}`, error);
      throw error;
    }
  }

  /**
   * Insert new record
   * DEBUG: Invalidates cache after write
   */
  async insert(data: Partial<T>): Promise<number> {
    try {
      const columns = Object.keys(data);
      const values = Object.values(data);
      
      if (columns.length === 0) {
        throw new Error('Cannot insert empty record');
      }

      const columnNames = columns.join(', ');
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      
      // Build INSERT query manually since template literals don't support dynamic column names
      const sql = `INSERT INTO ${this.tableName} (${columnNames}) VALUES (${placeholders})`;
      
      debugLog('BaseRepository', `Inserting into ${this.tableName}: ${sql}`);
      
      const result = await dbConnection.query<any>([sql], ...values);
      
      // Get last inserted ID
      const idResult = await dbConnection.query<{ last_insert_rowid: number }>`SELECT last_insert_rowid() as last_insert_rowid`;
      const newId = idResult[0]?.last_insert_rowid || 0;
      
      this.invalidateCache();
      debugLog('BaseRepository', `Inserted record into ${this.tableName} with id ${newId}`);
      
      return newId;
    } catch (error) {
      errorLog('BaseRepository', `Error inserting into ${this.tableName}`, error);
      throw error;
    }
  }

  /**
   * Update existing record
   * DEBUG: Invalidates cache after write
   */
  async update(id: number, data: Partial<T>): Promise<boolean> {
    try {
      const columns = Object.keys(data);
      const values = Object.values(data);
      
      if (columns.length === 0) {
        warnLog('BaseRepository', 'Update called with no data');
        return false;
      }

      const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
      const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE id = $${columns.length + 1}`;
      
      debugLog('BaseRepository', `Updating ${this.tableName}: ${sql}`);
      
      await dbConnection.query<any>([sql], ...values, id);
      
      this.invalidateCache();
      debugLog('BaseRepository', `Updated record in ${this.tableName} with id ${id}`);
      
      return true;
    } catch (error) {
      errorLog('BaseRepository', `Error updating ${this.tableName} id ${id}`, error);
      throw error;
    }
  }

  /**
   * Delete record (soft delete if is_active column exists)
   */
  async delete(id: number): Promise<boolean> {
    try {
      // Check if table has is_active column for soft delete
      const record = await this.findById(id);
      if (!record) {
        warnLog('BaseRepository', `Cannot delete non-existent record ${id} in ${this.tableName}`);
        return false;
      }

      // Try soft delete first
      if ('is_active' in record) {
        await this.update(id, { is_active: false } as Partial<T>);
        debugLog('BaseRepository', `Soft deleted record ${id} in ${this.tableName}`);
        return true;
      }

      // Hard delete if no is_active column
      await dbConnection.query`DELETE FROM ${this.tableName} WHERE id = ${id}`;
      this.invalidateCache();
      debugLog('BaseRepository', `Hard deleted record ${id} in ${this.tableName}`);
      return true;
    } catch (error) {
      errorLog('BaseRepository', `Error deleting ${this.tableName} id ${id}`, error);
      throw error;
    }
  }

  /**
   * Execute raw SQL query
   * DEBUG: For complex queries not covered by CRUD methods
   */
  protected async executeQuery<R>(sql: string, params: any[] = []): Promise<R[]> {
    debugLog('BaseRepository', `Executing raw query: ${sql.substring(0, 100)}...`);
    return await dbConnection.query<R>([sql], ...params);
  }
}

console.log('[BaseRepository] Base repository class with caching initialized');
console.log('[BaseRepository] Cache TTL:', CACHE_CONFIG.TTL_SECONDS, 'seconds');
console.log('[BaseRepository] Max cache size:', CACHE_CONFIG.MAX_SIZE, 'entries');
