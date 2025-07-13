# CI/CD Pipelines for Verb Framework

This guide provides comprehensive CI/CD pipeline examples for testing, building, and deploying Verb applications across different platforms.

## GitHub Actions

### Basic Test Pipeline

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        bun-version: [1.0.0, latest]
        
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Setup Bun
      uses: oven-sh/setup-bun@v1
      with:
        bun-version: ${{ matrix.bun-version }}
        
    - name: Install dependencies
      run: bun install
      
    - name: Run linting
      run: bun run lint
      
    - name: Run type checking
      run: bun run typecheck
      
    - name: Run unit tests
      run: bun test
      
    - name: Run integration tests
      run: bun run test:integration
      
    - name: Upload test results
      uses: actions/upload-artifact@v4
      if: always()
      with:
        name: test-results-${{ matrix.bun-version }}
        path: |
          coverage/
          test-results.xml
```

### Multi-Platform Testing

```yaml
# .github/workflows/multi-platform.yml
name: Multi-Platform Testing

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test-matrix:
    runs-on: ${{ matrix.os }}
    
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        bun-version: [latest]
        architecture: [x64]
        include:
          - os: ubuntu-latest
            architecture: arm64
          - os: macos-latest
            architecture: arm64
        
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Setup Bun
      uses: oven-sh/setup-bun@v1
      with:
        bun-version: ${{ matrix.bun-version }}
        
    - name: Install dependencies
      run: bun install
      
    - name: Run tests
      run: bun test
      
    - name: Test WebSocket connections
      run: bun run test:websocket
      
    - name: Test UDP/TCP protocols
      run: bun run test:protocols
      
    - name: Performance benchmarks
      run: bun run benchmark
      if: matrix.os == 'ubuntu-latest' && matrix.architecture == 'x64'
      
    - name: Upload benchmark results
      uses: actions/upload-artifact@v4
      if: matrix.os == 'ubuntu-latest' && matrix.architecture == 'x64'
      with:
        name: benchmark-results
        path: benchmarks/results/
```

### Security Scanning Pipeline

```yaml
# .github/workflows/security.yml
name: Security Scanning

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]
  schedule:
    - cron: '0 2 * * 1' # Weekly on Monday

jobs:
  security-scan:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Setup Bun
      uses: oven-sh/setup-bun@v1
      
    - name: Install dependencies
      run: bun install
      
    - name: Run dependency audit
      run: bun audit
      
    - name: Run CodeQL Analysis
      uses: github/codeql-action/init@v3
      with:
        languages: typescript, javascript
        
    - name: Autobuild
      uses: github/codeql-action/autobuild@v3
      
    - name: Perform CodeQL Analysis
      uses: github/codeql-action/analyze@v3
      
    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        scan-type: 'fs'
        scan-ref: '.'
        format: 'sarif'
        output: 'trivy-results.sarif'
        
    - name: Upload Trivy scan results
      uses: github/codeql-action/upload-sarif@v3
      with:
        sarif_file: 'trivy-results.sarif'
        
    - name: OWASP Dependency Check
      uses: dependency-check/Dependency-Check_Action@main
      with:
        project: 'verb-app'
        path: '.'
        format: 'JSON'
        
    - name: Upload OWASP results
      uses: actions/upload-artifact@v4
      with:
        name: owasp-dependency-check
        path: reports/
```

### Performance Regression Testing

```yaml
# .github/workflows/performance.yml
name: Performance Testing

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  performance-test:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Setup Bun
      uses: oven-sh/setup-bun@v1
      
    - name: Install dependencies
      run: bun install
      
    - name: Build application
      run: bun run build
      
    - name: Start application
      run: |
        bun run start &
        sleep 10
        
    - name: Run performance tests
      run: |
        bun run test:performance
        bun run benchmark:load
        
    - name: Download baseline results
      uses: actions/download-artifact@v4
      with:
        name: baseline-performance
        path: baseline/
      continue-on-error: true
      
    - name: Compare performance
      run: |
        bun run scripts/compare-performance.ts baseline/ current/
        
    - name: Upload current results as baseline
      uses: actions/upload-artifact@v4
      if: github.ref == 'refs/heads/main'
      with:
        name: baseline-performance
        path: current/
        
    - name: Comment performance results
      uses: actions/github-script@v7
      if: github.event_name == 'pull_request'
      with:
        script: |
          const fs = require('fs');
          const path = './performance-comparison.md';
          if (fs.existsSync(path)) {
            const body = fs.readFileSync(path, 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: body
            });
          }
```

### Docker-based Testing

```yaml
# .github/workflows/docker-test.yml
name: Docker Testing

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  docker-test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: testdb
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
          
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Build Docker image
      run: docker build -t verb-app:test .
      
    - name: Run tests in container
      run: |
        docker run --rm \
          --network host \
          -e DATABASE_URL=postgresql://postgres:testpass@localhost:5432/testdb \
          -e REDIS_URL=redis://localhost:6379 \
          verb-app:test bun test
          
    - name: Test container networking
      run: |
        docker run -d --name verb-test \
          -p 3000:3000 \
          verb-app:test
        
        sleep 5
        
        # Test HTTP
        curl -f http://localhost:3000/health
        
        # Test WebSocket
        bun run scripts/test-websocket.ts ws://localhost:3000
        
        docker stop verb-test
        docker rm verb-test
        
    - name: Security scan of Docker image
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: 'verb-app:test'
        format: 'sarif'
        output: 'docker-trivy-results.sarif'
        
    - name: Upload Docker scan results
      uses: github/codeql-action/upload-sarif@v3
      with:
        sarif_file: 'docker-trivy-results.sarif'
```

### Deployment Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [ main ]
    tags: [ 'v*' ]

jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: staging
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Setup Bun
      uses: oven-sh/setup-bun@v1
      
    - name: Install dependencies
      run: bun install
      
    - name: Build application
      run: bun run build
      
    - name: Deploy to Railway
      uses: railway-app/cli@v2
      with:
        command: deploy
      env:
        RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
        
    - name: Run smoke tests
      run: |
        sleep 30
        bun run test:smoke https://staging.myapp.railway.app
        
  deploy-production:
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/tags/v')
    environment: production
    needs: [test, security-scan]
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Setup Bun
      uses: oven-sh/setup-bun@v1
      
    - name: Install dependencies
      run: bun install
      
    - name: Build application
      run: bun run build
      
    - name: Deploy to Fly.io
      uses: superfly/flyctl-actions/setup-flyctl@master
    - run: flyctl deploy --remote-only
      env:
        FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
        
    - name: Run production smoke tests
      run: |
        sleep 60
        bun run test:smoke https://myapp.fly.dev
        
    - name: Create GitHub release
      uses: actions/create-release@v1
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      with:
        tag_name: ${{ github.ref }}
        release_name: Release ${{ github.ref }}
        draft: false
        prerelease: false
```

## GitLab CI

### Basic GitLab Pipeline

```yaml
# .gitlab-ci.yml
stages:
  - install
  - lint
  - test
  - security
  - build
  - deploy

variables:
  BUN_VERSION: "latest"

cache:
  paths:
    - node_modules/
    - .bun/

install:
  stage: install
  image: oven/bun:$BUN_VERSION
  script:
    - bun install
  artifacts:
    paths:
      - node_modules/
    expire_in: 1 hour

lint:
  stage: lint
  image: oven/bun:$BUN_VERSION
  script:
    - bun run lint
    - bun run typecheck
  dependencies:
    - install

test:unit:
  stage: test
  image: oven/bun:$BUN_VERSION
  script:
    - bun test --coverage
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura.xml
    paths:
      - coverage/
  dependencies:
    - install

test:integration:
  stage: test
  image: oven/bun:$BUN_VERSION
  services:
    - postgres:15
    - redis:7
  variables:
    DATABASE_URL: "postgresql://postgres:testpass@postgres:5432/testdb"
    REDIS_URL: "redis://redis:6379"
    POSTGRES_DB: testdb
    POSTGRES_PASSWORD: testpass
  script:
    - bun run test:integration
  dependencies:
    - install

security:dependency-scan:
  stage: security
  image: oven/bun:$BUN_VERSION
  script:
    - bun audit
  allow_failure: true
  dependencies:
    - install

security:sast:
  stage: security
  include:
    - template: Security/SAST.gitlab-ci.yml
  variables:
    SAST_EXCLUDED_PATHS: "node_modules, coverage"

build:
  stage: build
  image: oven/bun:$BUN_VERSION
  script:
    - bun run build
  artifacts:
    paths:
      - dist/
    expire_in: 1 week
  dependencies:
    - install
  only:
    - main
    - tags

deploy:staging:
  stage: deploy
  image: oven/bun:$BUN_VERSION
  script:
    - echo "Deploying to staging..."
    - bun run deploy:staging
  environment:
    name: staging
    url: https://staging.myapp.com
  dependencies:
    - build
  only:
    - main

deploy:production:
  stage: deploy
  image: oven/bun:$BUN_VERSION
  script:
    - echo "Deploying to production..."
    - bun run deploy:production
  environment:
    name: production
    url: https://myapp.com
  dependencies:
    - build
  when: manual
  only:
    - tags
```

### GitLab Multi-Platform Testing

```yaml
# .gitlab-ci.yml (multi-platform section)
.test_template: &test_template
  stage: test
  script:
    - bun install
    - bun test
    - bun run test:protocols

test:linux-x64:
  <<: *test_template
  image: oven/bun:latest
  tags:
    - linux
    - x64

test:linux-arm64:
  <<: *test_template
  image: oven/bun:latest
  tags:
    - linux
    - arm64

test:macos:
  <<: *test_template
  tags:
    - macos
  before_script:
    - curl -fsSL https://bun.sh/install | bash
    - export PATH="$HOME/.bun/bin:$PATH"
```

## Jenkins

### Jenkins Pipeline

```groovy
// Jenkinsfile
pipeline {
    agent any
    
    environment {
        BUN_VERSION = 'latest'
        NODE_ENV = 'test'
    }
    
    options {
        timeout(time: 30, unit: 'MINUTES')
        retry(3)
    }
    
    stages {
        stage('Setup') {
            steps {
                script {
                    // Install Bun
                    sh '''
                        if ! command -v bun &> /dev/null; then
                            curl -fsSL https://bun.sh/install | bash
                            export PATH="$HOME/.bun/bin:$PATH"
                        fi
                        bun --version
                    '''
                }
            }
        }
        
        stage('Install Dependencies') {
            steps {
                sh 'bun install'
            }
        }
        
        stage('Lint & Type Check') {
            parallel {
                stage('Lint') {
                    steps {
                        sh 'bun run lint'
                    }
                }
                stage('Type Check') {
                    steps {
                        sh 'bun run typecheck'
                    }
                }
            }
        }
        
        stage('Test') {
            parallel {
                stage('Unit Tests') {
                    steps {
                        sh 'bun test --reporter=junit --outfile=unit-test-results.xml'
                    }
                    post {
                        always {
                            junit 'unit-test-results.xml'
                        }
                    }
                }
                
                stage('Integration Tests') {
                    steps {
                        sh '''
                            docker-compose up -d postgres redis
                            sleep 10
                            bun run test:integration
                            docker-compose down
                        '''
                    }
                }
                
                stage('Protocol Tests') {
                    steps {
                        sh 'bun run test:protocols'
                    }
                }
            }
        }
        
        stage('Security Scan') {
            steps {
                sh 'bun audit'
                
                script {
                    try {
                        sh 'npm install -g @cyclonedx/bom'
                        sh 'cyclonedx-bom -o sbom.json'
                        archiveArtifacts artifacts: 'sbom.json'
                    } catch (Exception e) {
                        echo "SBOM generation failed: ${e.getMessage()}"
                    }
                }
            }
        }
        
        stage('Performance Test') {
            when {
                branch 'main'
            }
            steps {
                sh '''
                    bun run build
                    bun run start &
                    sleep 10
                    bun run test:performance
                    pkill -f "bun run start" || true
                '''
            }
        }
        
        stage('Build') {
            when {
                anyOf {
                    branch 'main'
                    tag pattern: 'v\\d+\\.\\d+\\.\\d+', comparator: 'REGEXP'
                }
            }
            steps {
                sh 'bun run build'
                archiveArtifacts artifacts: 'dist/**/*'
            }
        }
        
        stage('Deploy') {
            when {
                branch 'main'
            }
            steps {
                script {
                    if (env.BRANCH_NAME == 'main') {
                        sh 'bun run deploy:staging'
                    } else if (env.TAG_NAME?.startsWith('v')) {
                        input message: 'Deploy to production?', ok: 'Deploy'
                        sh 'bun run deploy:production'
                    }
                }
            }
        }
    }
    
    post {
        always {
            cleanWs()
        }
        success {
            slackSend channel: '#deployments',
                     color: 'good',
                     message: "✅ Build succeeded for ${env.JOB_NAME} - ${env.BUILD_NUMBER}"
        }
        failure {
            slackSend channel: '#deployments',
                     color: 'danger',
                     message: "❌ Build failed for ${env.JOB_NAME} - ${env.BUILD_NUMBER}"
        }
    }
}
```

## Docker-Compose for CI Testing

```yaml
# docker-compose.ci.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.test
    depends_on:
      - postgres
      - redis
    environment:
      - DATABASE_URL=postgresql://postgres:testpass@postgres:5432/testdb
      - REDIS_URL=redis://redis:6379
      - NODE_ENV=test
    command: bun test
    
  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=testdb
      - POSTGRES_PASSWORD=testpass
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
      
  redis:
    image: redis:7
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
      
  performance-test:
    build:
      context: .
      dockerfile: Dockerfile.test
    depends_on:
      - app
    command: bun run test:performance
    environment:
      - TARGET_URL=http://app:3000
```

## Performance Testing Scripts

```typescript
// scripts/performance-test.ts
import { performance } from 'perf_hooks';

interface BenchmarkResult {
  name: string;
  duration: number;
  requestsPerSecond: number;
  averageLatency: number;
  errors: number;
}

class PerformanceTester {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async runBenchmark(
    path: string,
    duration: number = 30000,
    concurrency: number = 10
  ): Promise<BenchmarkResult> {
    const startTime = performance.now();
    const endTime = startTime + duration;
    let requestCount = 0;
    let errorCount = 0;
    let totalLatency = 0;

    const workers: Promise<void>[] = [];

    for (let i = 0; i < concurrency; i++) {
      workers.push(this.worker(path, endTime, (latency, error) => {
        requestCount++;
        if (error) errorCount++;
        else totalLatency += latency;
      }));
    }

    await Promise.all(workers);

    const actualDuration = performance.now() - startTime;
    const requestsPerSecond = (requestCount / actualDuration) * 1000;
    const averageLatency = totalLatency / (requestCount - errorCount);

    return {
      name: path,
      duration: actualDuration,
      requestsPerSecond,
      averageLatency,
      errors: errorCount,
    };
  }

  private async worker(
    path: string,
    endTime: number,
    onComplete: (latency: number, error: boolean) => void
  ): Promise<void> {
    while (performance.now() < endTime) {
      const start = performance.now();
      try {
        const response = await fetch(`${this.baseUrl}${path}`);
        const latency = performance.now() - start;
        onComplete(latency, !response.ok);
      } catch (error) {
        const latency = performance.now() - start;
        onComplete(latency, true);
      }
    }
  }
}

// Usage
async function main() {
  const tester = new PerformanceTester(process.env.TARGET_URL || 'http://localhost:3000');
  
  const results = await Promise.all([
    tester.runBenchmark('/api/health'),
    tester.runBenchmark('/api/users'),
    tester.runBenchmark('/api/products'),
  ]);

  console.log('Performance Test Results:');
  results.forEach(result => {
    console.log(`${result.name}: ${result.requestsPerSecond.toFixed(2)} req/s, ${result.averageLatency.toFixed(2)}ms avg latency, ${result.errors} errors`);
  });

  // Save results for comparison
  await Bun.write('performance-results.json', JSON.stringify(results, null, 2));
}

if (import.meta.main) {
  main().catch(console.error);
}
```

This comprehensive CI/CD setup provides robust testing, security scanning, and deployment automation for Verb framework applications across multiple platforms and environments.