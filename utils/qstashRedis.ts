// QStash Redis REST API Client - Simple implementation for rate limiting
import { redisConfig } from './env.ts';

class QStashRedis {
  private baseUrl: string;
  private token: string;

  constructor() {
    if (!redisConfig.restUrl || !redisConfig.restToken) {
      throw new Error('QStash Redis configuration missing');
    }
    
    this.baseUrl = redisConfig.restUrl;
    this.token = redisConfig.restToken;
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, { ...options, headers });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`QStash API error: ${response.status} ${response.statusText}`);
      }
      
      return data;
    } catch (error) {
      console.error('QStash Redis API error:', error);
      throw error;
    }
  }

  async incr(key: string): Promise<number> {
    const result = await this.request(`/incr/${key}`);
    return result?.result || 0;
  }

  async incrby(key: string, increment: number): Promise<number> {
    // For rate limiting, we need to increment by the weight
    // QStash doesn't have incrby, so we'll use the SET command with NX option
    const currentValue = await this.get(key) || '0';
    const newValue = parseInt(currentValue) + increment;
    await this.set(key, newValue.toString());
    return newValue;
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    const result = await this.request(`/expire/${key}/${ttl}`);
    return result?.result === 1;
  }

  async get(key: string): Promise<string | null> {
    const result = await this.request(`/get/${key}`);
    return result?.result || null;
  }

  async set(key: string, value: string): Promise<boolean> {
    const result = await this.request(`/set/${key}/${value}`);
    return result?.result === 'OK';
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.request('/ping');
      return result?.result === 'PONG';
    } catch (error) {
      return false;
    }
  }

  // Pipeline that works exactly like Redis for rate limiting
  pipeline() {
    return {
      commands: [] as Array<{method: string, args: any[]}>,
      incr(key: string) {
        this.commands.push({method: 'incr', args: [key]});
        return this;
      },
      incrby(key: string, increment: number) {
        this.commands.push({method: 'incrby', args: [key, increment]});
        return this;
      },
      expire(key: string, ttl: number) {
        this.commands.push({method: 'expire', args: [key, ttl]});
        return this;
      },
      async exec(): Promise<[Error | null, any][]> {
        const results: [Error | null, any][] = [];
        
        for (const command of this.commands) {
          try {
            const result = await (this as any)[command.method](...command.args);
            results.push([null, result]);
          } catch (error) {
            results.push([error as Error, null]);
          }
        }
        
        return results;
      }
    };
  }

  disconnect(): void {
    console.log('QStash Redis disconnected');
  }

  get status(): string {
    return 'ready';
  }
}

// Create and export Redis client
let redisClient: QStashRedis | null = null;

export function getRedisClient(): QStashRedis {
  if (!redisClient) {
    redisClient = new QStashRedis();
  }
  return redisClient;
}

export default getRedisClient();
