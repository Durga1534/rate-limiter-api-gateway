// QStash Redis REST API Client - Simple and memory efficient
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

  private async request(endpoint: string): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };

    try {
      const response = await fetch(url, { headers });
      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  }

  async incr(key: string): Promise<number> {
    const result = await this.request(`/incr/${key}`);
    return result?.result || 0;
  }

  async incrby(key: string, increment: number): Promise<number> {
    // Simple implementation for rate limiting
    const current = await this.incr(key);
    for (let i = 1; i < increment; i++) {
      await this.incr(key);
    }
    return current + increment;
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    const result = await this.request(`/expire/${key}/${ttl}`);
    return result?.result === 1;
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.request('/ping');
      return result?.result === 'PONG';
    } catch (error) {
      return false;
    }
  }

  // Simple pipeline for rate limiting
  pipeline() {
    const commands: Array<{method: string, args: any[]}> = [];
    
    return {
      incr(key: string) {
        commands.push({method: 'incr', args: [key]});
        return this;
      },
      incrby(key: string, increment: number) {
        commands.push({method: 'incrby', args: [key, increment]});
        return this;
      },
      expire(key: string, ttl: number) {
        commands.push({method: 'expire', args: [key, ttl]});
        return this;
      },
      async exec(): Promise<[Error | null, any][]> {
        const results: [Error | null, any][] = [];
        
        for (const command of commands) {
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
    // No-op for QStash
  }

  get status(): string {
    return 'ready';
  }
}

// Singleton instance
let redisClient: QStashRedis | null = null;

export function getRedisClient(): QStashRedis {
  if (!redisClient) {
    redisClient = new QStashRedis();
  }
  return redisClient;
}

export default getRedisClient();
