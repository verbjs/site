# Cross-Runtime Compatibility

Comprehensive research and implementation guide for building Verb applications that work seamlessly across Bun, Node.js, and other JavaScript runtimes.

## Overview

Cross-runtime compatibility ensures your Verb applications can run on multiple JavaScript runtimes without modification. This guide covers:

1. **Runtime Detection**: Identifying the current runtime environment
2. **API Abstraction**: Creating unified interfaces across runtimes
3. **Feature Polyfills**: Filling runtime-specific gaps
4. **Build Strategies**: Packaging for multiple targets
5. **Testing Approaches**: Validating across all supported runtimes

## Runtime Detection and Abstraction

### Universal Runtime Detector

```typescript
// runtime-detector.ts - Comprehensive runtime detection
export interface RuntimeInfo {
  name: "bun" | "node" | "deno" | "browser" | "unknown";
  version: string;
  capabilities: {
    nativeModules: boolean;
    workers: boolean;
    sqlite: boolean;
    ffi: boolean;
    typescript: boolean;
  };
}

export class RuntimeDetector {
  static detect(): RuntimeInfo {
    // Bun detection
    if (typeof Bun !== "undefined") {
      return {
        name: "bun",
        version: Bun.version,
        capabilities: {
          nativeModules: true,
          workers: true,
          sqlite: true,
          ffi: true,
          typescript: true
        }
      };
    }

    // Deno detection
    if (typeof Deno !== "undefined") {
      return {
        name: "deno",
        version: Deno.version.deno,
        capabilities: {
          nativeModules: false,
          workers: true,
          sqlite: false,
          ffi: true,
          typescript: true
        }
      };
    }

    // Node.js detection
    if (typeof process !== "undefined" && process.versions?.node) {
      return {
        name: "node",
        version: process.version,
        capabilities: {
          nativeModules: true,
          workers: true,
          sqlite: false,
          ffi: false,
          typescript: false
        }
      };
    }

    // Browser detection
    if (typeof window !== "undefined") {
      return {
        name: "browser",
        version: navigator.userAgent,
        capabilities: {
          nativeModules: false,
          workers: true,
          sqlite: false,
          ffi: false,
          typescript: false
        }
      };
    }

    return {
      name: "unknown",
      version: "unknown",
      capabilities: {
        nativeModules: false,
        workers: false,
        sqlite: false,
        ffi: false,
        typescript: false
      }
    };
  }

  static isBun(): boolean {
    return this.detect().name === "bun";
  }

  static isNode(): boolean {
    return this.detect().name === "node";
  }

  static isDeno(): boolean {
    return this.detect().name === "deno";
  }

  static isBrowser(): boolean {
    return this.detect().name === "browser";
  }

  static hasCapability(capability: keyof RuntimeInfo["capabilities"]): boolean {
    return this.detect().capabilities[capability];
  }
}
```

### Universal File System API

```typescript
// fs-universal.ts - Cross-runtime file system abstraction
export interface UniversalFS {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  readdir(path: string): Promise<string[]>;
}

class BunFS implements UniversalFS {
  async readFile(path: string): Promise<string> {
    const file = Bun.file(path);
    return await file.text();
  }

  async writeFile(path: string, content: string): Promise<void> {
    await Bun.write(path, content);
  }

  async exists(path: string): Promise<boolean> {
    const file = Bun.file(path);
    return await file.exists();
  }

  async mkdir(path: string): Promise<void> {
    await Bun.write(path + "/.gitkeep", "");
  }

  async readdir(path: string): Promise<string[]> {
    const glob = new Bun.Glob("*");
    return Array.from(glob.scanSync(path));
  }
}

class NodeFS implements UniversalFS {
  private fs = require("fs").promises;

  async readFile(path: string): Promise<string> {
    return await this.fs.readFile(path, "utf-8");
  }

  async writeFile(path: string, content: string): Promise<void> {
    await this.fs.writeFile(path, content);
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  async mkdir(path: string): Promise<void> {
    await this.fs.mkdir(path, { recursive: true });
  }

  async readdir(path: string): Promise<string[]> {
    return await this.fs.readdir(path);
  }
}

class DenoFS implements UniversalFS {
  async readFile(path: string): Promise<string> {
    return await Deno.readTextFile(path);
  }

  async writeFile(path: string, content: string): Promise<void> {
    await Deno.writeTextFile(path, content);
  }

  async exists(path: string): Promise<boolean> {
    try {
      await Deno.stat(path);
      return true;
    } catch {
      return false;
    }
  }

  async mkdir(path: string): Promise<void> {
    await Deno.mkdir(path, { recursive: true });
  }

  async readdir(path: string): Promise<string[]> {
    const entries = [];
    for await (const entry of Deno.readDir(path)) {
      entries.push(entry.name);
    }
    return entries;
  }
}

export function createFS(): UniversalFS {
  const runtime = RuntimeDetector.detect();
  
  switch (runtime.name) {
    case "bun":
      return new BunFS();
    case "node":
      return new NodeFS();
    case "deno":
      return new DenoFS();
    default:
      throw new Error(`Unsupported runtime: ${runtime.name}`);
  }
}
```

### Universal HTTP Client

```typescript
// http-universal.ts - Cross-runtime HTTP client
export interface HTTPResponse {
  status: number;
  headers: Record<string, string>;
  text(): Promise<string>;
  json<T = any>(): Promise<T>;
}

export interface HTTPClient {
  get(url: string, options?: RequestInit): Promise<HTTPResponse>;
  post(url: string, body?: any, options?: RequestInit): Promise<HTTPResponse>;
  put(url: string, body?: any, options?: RequestInit): Promise<HTTPResponse>;
  delete(url: string, options?: RequestInit): Promise<HTTPResponse>;
}

class UniversalHTTPResponse implements HTTPResponse {
  constructor(
    public status: number,
    public headers: Record<string, string>,
    private response: Response
  ) {}

  async text(): Promise<string> {
    return await this.response.text();
  }

  async json<T = any>(): Promise<T> {
    return await this.response.json();
  }
}

class BunHTTPClient implements HTTPClient {
  async get(url: string, options?: RequestInit): Promise<HTTPResponse> {
    const response = await fetch(url, { ...options, method: "GET" });
    return this.createResponse(response);
  }

  async post(url: string, body?: any, options?: RequestInit): Promise<HTTPResponse> {
    const response = await fetch(url, {
      ...options,
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        ...options?.headers
      }
    });
    return this.createResponse(response);
  }

  async put(url: string, body?: any, options?: RequestInit): Promise<HTTPResponse> {
    const response = await fetch(url, {
      ...options,
      method: "PUT",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        ...options?.headers
      }
    });
    return this.createResponse(response);
  }

  async delete(url: string, options?: RequestInit): Promise<HTTPResponse> {
    const response = await fetch(url, { ...options, method: "DELETE" });
    return this.createResponse(response);
  }

  private createResponse(response: Response): HTTPResponse {
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return new UniversalHTTPResponse(response.status, headers, response);
  }
}

// Node.js and Deno can use the same implementation since they support fetch
export function createHTTPClient(): HTTPClient {
  // All modern runtimes support fetch API
  return new BunHTTPClient();
}
```

## Database Abstraction Layer

### Universal Database Interface

```typescript
// database-universal.ts - Cross-runtime database abstraction
export interface DatabaseRow {
  [key: string]: any;
}

export interface Database {
  query(sql: string, params?: any[]): Promise<DatabaseRow[]>;
  execute(sql: string, params?: any[]): Promise<{ changes: number; lastInsertRowid?: number }>;
  close(): Promise<void>;
  transaction<T>(fn: (db: Database) => Promise<T>): Promise<T>;
}

class BunDatabase implements Database {
  private db: any;

  constructor(path: string) {
    const { Database } = require("bun:sqlite");
    this.db = new Database(path);
  }

  async query(sql: string, params: any[] = []): Promise<DatabaseRow[]> {
    const stmt = this.db.query(sql);
    return stmt.all(...params);
  }

  async execute(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid?: number }> {
    const stmt = this.db.query(sql);
    const result = stmt.run(...params);
    return {
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid
    };
  }

  async close(): Promise<void> {
    this.db.close();
  }

  async transaction<T>(fn: (db: Database) => Promise<T>): Promise<T> {
    const transaction = this.db.transaction(() => {
      return fn(this);
    });
    return transaction();
  }
}

class NodeDatabase implements Database {
  private db: any;

  constructor(path: string) {
    const Database = require("better-sqlite3");
    this.db = new Database(path);
  }

  async query(sql: string, params: any[] = []): Promise<DatabaseRow[]> {
    const stmt = this.db.prepare(sql);
    return stmt.all(params);
  }

  async execute(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid?: number }> {
    const stmt = this.db.prepare(sql);
    const result = stmt.run(params);
    return {
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid
    };
  }

  async close(): Promise<void> {
    this.db.close();
  }

  async transaction<T>(fn: (db: Database) => Promise<T>): Promise<T> {
    const transaction = this.db.transaction(() => {
      return fn(this);
    });
    return transaction();
  }
}

export function createDatabase(path: string): Database {
  const runtime = RuntimeDetector.detect();
  
  switch (runtime.name) {
    case "bun":
      return new BunDatabase(path);
    case "node":
      return new NodeDatabase(path);
    case "deno":
      // Deno doesn't have native SQLite, would need WASM version
      throw new Error("SQLite not supported in Deno runtime");
    default:
      throw new Error(`Database not supported in ${runtime.name} runtime`);
  }
}
```

## Universal Environment Management

```typescript
// env-universal.ts - Cross-runtime environment variables
export interface EnvironmentConfig {
  get(key: string): string | undefined;
  get(key: string, defaultValue: string): string;
  set(key: string, value: string): void;
  has(key: string): boolean;
  getAll(): Record<string, string>;
}

class UniversalEnvironment implements EnvironmentConfig {
  private env: Record<string, string>;

  constructor() {
    const runtime = RuntimeDetector.detect();
    
    switch (runtime.name) {
      case "bun":
      case "node":
        this.env = process.env as Record<string, string>;
        break;
      case "deno":
        this.env = Object.fromEntries(Object.entries(Deno.env.toObject()));
        break;
      case "browser":
        // In browser, use a predefined config or localStorage
        this.env = this.loadBrowserEnv();
        break;
      default:
        this.env = {};
    }
  }

  get(key: string): string | undefined;
  get(key: string, defaultValue: string): string;
  get(key: string, defaultValue?: string): string | undefined {
    return this.env[key] ?? defaultValue;
  }

  set(key: string, value: string): void {
    this.env[key] = value;
    
    const runtime = RuntimeDetector.detect();
    if (runtime.name === "deno") {
      Deno.env.set(key, value);
    } else if (runtime.name === "node" || runtime.name === "bun") {
      process.env[key] = value;
    }
  }

  has(key: string): boolean {
    return key in this.env;
  }

  getAll(): Record<string, string> {
    return { ...this.env };
  }

  private loadBrowserEnv(): Record<string, string> {
    // In browser, load from window object or localStorage
    if (typeof window !== "undefined") {
      return (window as any).__ENV__ || {};
    }
    return {};
  }
}

export const env = new UniversalEnvironment();
```

## Build and Packaging Strategies

### Universal Build Configuration

```typescript
// build-config.ts - Multi-runtime build configuration
export interface BuildTarget {
  runtime: "bun" | "node" | "deno" | "browser";
  format: "esm" | "cjs" | "iife";
  platform: "server" | "browser" | "universal";
  minify: boolean;
  sourcemap: boolean;
}

export const buildTargets: BuildTarget[] = [
  {
    runtime: "bun",
    format: "esm",
    platform: "server",
    minify: false,
    sourcemap: true
  },
  {
    runtime: "node",
    format: "cjs",
    platform: "server",
    minify: false,
    sourcemap: true
  },
  {
    runtime: "deno",
    format: "esm",
    platform: "server",
    minify: false,
    sourcemap: true
  },
  {
    runtime: "browser",
    format: "esm",
    platform: "browser",
    minify: true,
    sourcemap: true
  }
];

export async function buildForTarget(target: BuildTarget) {
  const runtime = RuntimeDetector.detect();
  
  if (runtime.name === "bun") {
    return await buildWithBun(target);
  } else if (runtime.name === "node") {
    return await buildWithEsbuild(target);
  } else if (runtime.name === "deno") {
    return await buildWithDeno(target);
  }
  
  throw new Error(`Build not supported for ${runtime.name}`);
}

async function buildWithBun(target: BuildTarget) {
  await Bun.build({
    entrypoints: ["./src/index.ts"],
    outdir: `./dist/${target.runtime}`,
    format: target.format as any,
    minify: target.minify,
    sourcemap: target.sourcemap ? "external" : "none",
    target: target.platform === "browser" ? "browser" : "bun"
  });
}

async function buildWithEsbuild(target: BuildTarget) {
  const esbuild = require("esbuild");
  
  await esbuild.build({
    entryPoints: ["./src/index.ts"],
    outdir: `./dist/${target.runtime}`,
    format: target.format,
    minify: target.minify,
    sourcemap: target.sourcemap,
    platform: target.platform === "browser" ? "browser" : "node",
    target: target.runtime === "node" ? "node18" : "es2022"
  });
}

async function buildWithDeno(target: BuildTarget) {
  // Deno uses native bundling
  const command = new Deno.Command("deno", {
    args: [
      "bundle",
      "./src/index.ts",
      `./dist/${target.runtime}/index.js`
    ]
  });
  
  await command.output();
}
```

### Package.json for Multi-Runtime Support

```json
{
  "name": "verb-universal-app",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/node/index.js",
  "module": "./dist/bun/index.js",
  "browser": "./dist/browser/index.js",
  "deno": "./dist/deno/index.js",
  "exports": {
    ".": {
      "bun": "./dist/bun/index.js",
      "node": "./dist/node/index.js",
      "deno": "./dist/deno/index.js",
      "browser": "./dist/browser/index.js",
      "default": "./dist/node/index.js"
    }
  },
  "engines": {
    "node": ">=18.0.0",
    "bun": ">=1.0.0"
  },
  "scripts": {
    "build": "npm run build:all",
    "build:all": "npm run build:bun && npm run build:node && npm run build:deno",
    "build:bun": "bun run build-script.ts bun",
    "build:node": "node build-script.js node",
    "build:deno": "deno run --allow-all build-script.ts deno",
    "test": "npm run test:all",
    "test:all": "npm run test:bun && npm run test:node && npm run test:deno",
    "test:bun": "bun test",
    "test:node": "node --test",
    "test:deno": "deno test"
  },
  "dependencies": {
    "verb": "latest"
  },
  "devDependencies": {
    "esbuild": "^0.19.0",
    "typescript": "^5.0.0"
  }
}
```

## Testing Across Runtimes

### Universal Test Runner

```typescript
// test-runner.ts - Cross-runtime test execution
export interface TestCase {
  name: string;
  fn: () => Promise<void> | void;
  skip?: boolean;
  timeout?: number;
}

export class UniversalTestRunner {
  private tests: TestCase[] = [];
  private runtime = RuntimeDetector.detect();

  test(name: string, fn: () => Promise<void> | void, options?: { skip?: boolean; timeout?: number }) {
    this.tests.push({
      name,
      fn,
      skip: options?.skip,
      timeout: options?.timeout || 5000
    });
  }

  async run(): Promise<{ passed: number; failed: number; skipped: number }> {
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    console.log(`Running tests on ${this.runtime.name} ${this.runtime.version}`);
    console.log("=".repeat(50));

    for (const test of this.tests) {
      if (test.skip) {
        console.log(`⏭️  SKIP: ${test.name}`);
        skipped++;
        continue;
      }

      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Test timeout")), test.timeout);
        });

        await Promise.race([
          Promise.resolve(test.fn()),
          timeoutPromise
        ]);

        console.log(`✅ PASS: ${test.name}`);
        passed++;
      } catch (error) {
        console.log(`❌ FAIL: ${test.name}`);
        console.log(`   Error: ${error.message}`);
        failed++;
      }
    }

    console.log("=".repeat(50));
    console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);

    return { passed, failed, skipped };
  }
}

// Usage example
const runner = new UniversalTestRunner();

runner.test("should detect runtime correctly", () => {
  const runtime = RuntimeDetector.detect();
  if (runtime.name === "unknown") {
    throw new Error("Could not detect runtime");
  }
});

runner.test("should read files universally", async () => {
  const fs = createFS();
  const content = await fs.readFile("./package.json");
  if (!content.includes("verb")) {
    throw new Error("Could not read package.json correctly");
  }
});

runner.test("should make HTTP requests", async () => {
  const http = createHTTPClient();
  const response = await http.get("https://httpbin.org/json");
  const data = await response.json();
  if (!data.slideshow) {
    throw new Error("Invalid response from httpbin");
  }
});

// Run tests
if (import.meta.main) {
  await runner.run();
}
```

### Runtime-Specific Test Configuration

```typescript
// test-config.ts - Runtime-specific test settings
export interface TestConfig {
  timeout: number;
  retries: number;
  parallel: boolean;
  coverage: boolean;
  reporters: string[];
}

export function getTestConfig(): TestConfig {
  const runtime = RuntimeDetector.detect();
  
  const baseConfig: TestConfig = {
    timeout: 5000,
    retries: 0,
    parallel: true,
    coverage: true,
    reporters: ["default"]
  };

  switch (runtime.name) {
    case "bun":
      return {
        ...baseConfig,
        timeout: 3000, // Bun is faster
        parallel: true,
        reporters: ["default", "json"]
      };
      
    case "node":
      return {
        ...baseConfig,
        timeout: 5000,
        parallel: true,
        reporters: ["default", "junit"]
      };
      
    case "deno":
      return {
        ...baseConfig,
        timeout: 4000,
        parallel: false, // Deno test runner limitations
        coverage: false // Different coverage system
      };
      
    default:
      return baseConfig;
  }
}
```

## Performance Optimization Across Runtimes

### Runtime-Specific Optimizations

```typescript
// optimizations.ts - Runtime-specific performance optimizations
export class PerformanceOptimizer {
  static async optimizeForRuntime<T>(
    implementations: {
      bun?: () => Promise<T>;
      node?: () => Promise<T>;
      deno?: () => Promise<T>;
      fallback: () => Promise<T>;
    }
  ): Promise<T> {
    const runtime = RuntimeDetector.detect();
    
    try {
      switch (runtime.name) {
        case "bun":
          return implementations.bun ? await implementations.bun() : await implementations.fallback();
        case "node":
          return implementations.node ? await implementations.node() : await implementations.fallback();
        case "deno":
          return implementations.deno ? await implementations.deno() : await implementations.fallback();
        default:
          return await implementations.fallback();
      }
    } catch (error) {
      console.warn(`Runtime-specific implementation failed, using fallback: ${error.message}`);
      return await implementations.fallback();
    }
  }

  static createOptimizedBuffer(size: number): ArrayBuffer | Buffer {
    const runtime = RuntimeDetector.detect();
    
    if (runtime.name === "bun" || runtime.name === "node") {
      return Buffer.allocUnsafe(size);
    } else {
      return new ArrayBuffer(size);
    }
  }

  static async readFileOptimized(path: string): Promise<string> {
    return await this.optimizeForRuntime({
      bun: async () => {
        const file = Bun.file(path);
        return await file.text();
      },
      node: async () => {
        const fs = require("fs").promises;
        return await fs.readFile(path, "utf-8");
      },
      deno: async () => {
        return await Deno.readTextFile(path);
      },
      fallback: async () => {
        throw new Error("File reading not supported in this runtime");
      }
    });
  }
}
```

## Error Handling and Compatibility

### Universal Error Types

```typescript
// errors-universal.ts - Cross-runtime error handling
export class UniversalError extends Error {
  public readonly code: string;
  public readonly runtime: string;
  public readonly originalError?: Error;

  constructor(message: string, code: string, originalError?: Error) {
    super(message);
    this.name = "UniversalError";
    this.code = code;
    this.runtime = RuntimeDetector.detect().name;
    this.originalError = originalError;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      runtime: this.runtime,
      stack: this.stack,
      originalError: this.originalError?.message
    };
  }
}

export class RuntimeCompatibilityError extends UniversalError {
  constructor(feature: string, runtime: string) {
    super(
      `Feature '${feature}' is not supported in ${runtime} runtime`,
      "RUNTIME_INCOMPATIBLE"
    );
  }
}

export function handleRuntimeError(error: unknown): UniversalError {
  if (error instanceof UniversalError) {
    return error;
  }

  if (error instanceof Error) {
    return new UniversalError(error.message, "GENERIC_ERROR", error);
  }

  return new UniversalError(
    `Unknown error: ${String(error)}`,
    "UNKNOWN_ERROR"
  );
}
```

## Documentation and Best Practices

### Cross-Runtime Development Guidelines

```markdown
# Cross-Runtime Development Best Practices

## 1. Always Use Runtime Detection
```typescript
const runtime = RuntimeDetector.detect();
if (!runtime.capabilities.sqlite) {
  throw new RuntimeCompatibilityError("SQLite", runtime.name);
}
```

## 2. Prefer Universal APIs
- Use `fetch()` instead of runtime-specific HTTP clients
- Use `ReadableStream` instead of Node.js streams
- Use `URL` and `URLSearchParams` for URL manipulation

## 3. Graceful Degradation
- Always provide fallback implementations
- Test each runtime-specific code path
- Document runtime requirements clearly

## 4. Environment Consistency
- Use the universal environment abstraction
- Validate required environment variables at startup
- Provide sensible defaults for optional configuration

## 5. Error Handling
- Use universal error types
- Include runtime information in error messages
- Test error scenarios across all runtimes
```

This comprehensive cross-runtime compatibility guide ensures Verb applications can run seamlessly across Bun, Node.js, Deno, and even browser environments with appropriate abstractions and fallbacks.