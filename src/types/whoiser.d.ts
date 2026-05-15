declare module 'whoiser' {
    export interface WhoisResult {
      [key: string]: any;
    }
  
    export function domain(domain: string, options?: any): Promise<WhoisResult>;
    export function query(domain: string, options?: any): Promise<any>;
    export function ip(ip: string, options?: any): Promise<any>;
  }