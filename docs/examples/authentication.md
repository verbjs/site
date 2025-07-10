# Authentication Example

Complete authentication system built with Verb, featuring multiple authentication methods, role-based access control, session management, and security best practices.

## Overview

This example demonstrates building a comprehensive authentication system with:

- Multiple authentication strategies (JWT, Session, OAuth)
- User registration and login
- Role-based access control (RBAC)
- Password reset functionality
- Account verification
- Two-factor authentication (2FA)
- Social login integration
- Session management
- API key authentication
- Security middleware

## Project Setup

```bash
# Create new project
mkdir auth-system
cd auth-system
bun init -y

# Install dependencies
bun install verb
bun install -D @types/bun typescript

# Install authentication packages
bun install bcryptjs jsonwebtoken speakeasy qrcode
bun install nodemailer otplib zod
```

## Authentication Server

```typescript
// server.ts
import { createServer } from "verb";
import { cors, json, helmet, rateLimit } from "verb/middleware";
import { authRouter } from "./src/routes/auth";
import { usersRouter } from "./src/routes/users";
import { protectedRouter } from "./src/routes/protected";
import { oauthRouter } from "./src/routes/oauth";
import { sessionMiddleware } from "./src/middleware/session";
import { errorHandler } from "./src/middleware/errorHandler";
import { AuthService } from "./src/services/AuthService";

const app = createServer();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"]
}));

app.use(json({ limit: "10mb" }));

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests",
    code: "RATE_LIMIT_EXCEEDED"
  },
  standardHeaders: true,
  legacyHeaders: false
}));

// Stricter rate limiting for auth endpoints
app.use("/api/auth", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Only 20 auth requests per 15 minutes
  message: {
    error: "Too many authentication attempts",
    code: "AUTH_RATE_LIMIT_EXCEEDED"
  }
}));

// Session management
app.use(sessionMiddleware);

// API routes
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/protected", protectedRouter);
app.use("/api/oauth", oauthRouter);

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    auth: {
      strategies: ["jwt", "session", "oauth", "api-key"],
      features: ["2fa", "password-reset", "email-verification"]
    }
  });
});

// Serve authentication demo page
app.get("/", (req, res) => {
  res.sendFile("./public/index.html");
});

// Error handling
app.use(errorHandler);

const port = process.env.PORT || 3000;
app.listen(port);

console.log(`🔐 Authentication server running on port ${port}`);
```

## User Model and Database

```typescript
// src/models/User.ts
export interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  twoFactorSecret?: string;
  isTwoFactorEnabled: boolean;
  lastLoginAt?: Date;
  loginAttempts: number;
  lockedUntil?: Date;
  refreshTokens: string[];
  apiKeys: ApiKey[];
  socialAccounts: SocialAccount[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRole {
  id: string;
  name: string;
  permissions: Permission[];
}

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  hashedKey: string;
  permissions: string[];
  lastUsedAt?: Date;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
}

export interface SocialAccount {
  id: string;
  provider: string;
  providerId: string;
  email: string;
  profile: Record<string, any>;
  createdAt: Date;
}

// src/database/schema.ts
import { Database } from "bun:sqlite";

const db = new Database("auth.db");

// Initialize database schema
db.exec(`
  -- Users table
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role_id TEXT NOT NULL,
    is_email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token TEXT,
    password_reset_token TEXT,
    password_reset_expires DATETIME,
    two_factor_secret TEXT,
    is_two_factor_enabled BOOLEAN DEFAULT FALSE,
    last_login_at DATETIME,
    login_attempts INTEGER DEFAULT 0,
    locked_until DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles (id)
  );

  -- Roles table
  CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Permissions table
  CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Role permissions junction table
  CREATE TABLE IF NOT EXISTS role_permissions (
    role_id TEXT NOT NULL,
    permission_id TEXT NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE
  );

  -- Refresh tokens table
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );

  -- API keys table
  CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    permissions TEXT, -- JSON array
    last_used_at DATETIME,
    expires_at DATETIME,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );

  -- Social accounts table
  CREATE TABLE IF NOT EXISTS social_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    email TEXT,
    profile TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, provider_id),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );

  -- Sessions table
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    data TEXT, -- JSON
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );

  -- Audit log table
  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    resource TEXT,
    details TEXT, -- JSON
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
  );

  -- Create indexes
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
  CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

  -- Insert default roles and permissions
  INSERT OR IGNORE INTO roles (id, name, description) VALUES 
    ('role_admin', 'admin', 'Administrator with full access'),
    ('role_user', 'user', 'Standard user with limited access'),
    ('role_moderator', 'moderator', 'Moderator with content management access');

  INSERT OR IGNORE INTO permissions (id, name, resource, action, description) VALUES 
    ('perm_users_read', 'users:read', 'users', 'read', 'Read user information'),
    ('perm_users_write', 'users:write', 'users', 'write', 'Create and update users'),
    ('perm_users_delete', 'users:delete', 'users', 'delete', 'Delete users'),
    ('perm_roles_manage', 'roles:manage', 'roles', '*', 'Manage roles and permissions'),
    ('perm_content_moderate', 'content:moderate', 'content', 'moderate', 'Moderate user content');

  -- Assign permissions to roles
  INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES 
    ('role_admin', 'perm_users_read'),
    ('role_admin', 'perm_users_write'),
    ('role_admin', 'perm_users_delete'),
    ('role_admin', 'perm_roles_manage'),
    ('role_admin', 'perm_content_moderate'),
    ('role_user', 'perm_users_read'),
    ('role_moderator', 'perm_users_read'),
    ('role_moderator', 'perm_content_moderate');
`);

export { db };
```

## Authentication Service

```typescript
// src/services/AuthService.ts
import { hash, compare } from "bcryptjs";
import { sign, verify } from "jsonwebtoken";
import { authenticator } from "otplib";
import { createHash, randomBytes } from "crypto";
import { db } from "../database/schema";
import { User, ApiKey } from "../models/User";
import { EmailService } from "./EmailService";
import { AuditService } from "./AuditService";

export class AuthService {
  private static readonly BCRYPT_ROUNDS = 12;
  private static readonly ACCOUNT_LOCK_TIME = 30 * 60 * 1000; // 30 minutes
  private static readonly MAX_LOGIN_ATTEMPTS = 5;

  // User registration
  static async register(userData: {
    email: string;
    username: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<{ user: Partial<User>; token: string }> {
    const { email, username, password, firstName, lastName } = userData;

    // Check if user exists
    const existingUser = await this.findByEmailOrUsername(email, username);
    if (existingUser) {
      throw new Error("User already exists");
    }

    // Validate password strength
    this.validatePassword(password);

    // Hash password
    const passwordHash = await hash(password, this.BCRYPT_ROUNDS);

    // Generate verification token
    const emailVerificationToken = randomBytes(32).toString("hex");

    // Create user
    const userId = crypto.randomUUID();
    db.query(`
      INSERT INTO users (
        id, email, username, password_hash, first_name, last_name, 
        role_id, email_verification_token
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      email.toLowerCase(),
      username,
      passwordHash,
      firstName,
      lastName,
      "role_user",
      emailVerificationToken
    );

    // Send verification email
    await EmailService.sendVerificationEmail(email, emailVerificationToken);

    // Log registration
    await AuditService.log({
      userId,
      action: "user.registered",
      resource: "users",
      details: { email, username }
    });

    const user = await this.findById(userId);
    const token = this.generateJWT(user!);

    return {
      user: this.sanitizeUser(user!),
      token
    };
  }

  // User login
  static async login(
    email: string,
    password: string,
    totpCode?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ user: Partial<User>; token: string; refreshToken: string }> {
    const user = await this.findByEmail(email.toLowerCase());
    if (!user) {
      throw new Error("Invalid credentials");
    }

    // Check if account is locked
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      throw new Error("Account is temporarily locked");
    }

    // Verify password
    const validPassword = await compare(password, user.passwordHash);
    if (!validPassword) {
      await this.handleFailedLogin(user.id);
      throw new Error("Invalid credentials");
    }

    // Check 2FA if enabled
    if (user.isTwoFactorEnabled) {
      if (!totpCode) {
        throw new Error("Two-factor authentication code required");
      }

      const validTotp = authenticator.verify({
        token: totpCode,
        secret: user.twoFactorSecret!
      });

      if (!validTotp) {
        throw new Error("Invalid two-factor authentication code");
      }
    }

    // Reset login attempts
    await this.resetLoginAttempts(user.id);

    // Update last login
    db.query("UPDATE users SET last_login_at = ? WHERE id = ?")
      .run(new Date().toISOString(), user.id);

    // Generate tokens
    const token = this.generateJWT(user);
    const refreshToken = await this.generateRefreshToken(user.id);

    // Log successful login
    await AuditService.log({
      userId: user.id,
      action: "user.login",
      resource: "auth",
      details: { method: "password", twoFactor: user.isTwoFactorEnabled },
      ipAddress,
      userAgent
    });

    return {
      user: this.sanitizeUser(user),
      token,
      refreshToken
    };
  }

  // Password reset request
  static async requestPasswordReset(email: string): Promise<void> {
    const user = await this.findByEmail(email.toLowerCase());
    if (!user) {
      // Don't reveal if email exists
      return;
    }

    const resetToken = randomBytes(32).toString("hex");
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    db.query(`
      UPDATE users 
      SET password_reset_token = ?, password_reset_expires = ? 
      WHERE id = ?
    `).run(resetToken, resetExpires.toISOString(), user.id);

    await EmailService.sendPasswordResetEmail(email, resetToken);

    await AuditService.log({
      userId: user.id,
      action: "user.password_reset_requested",
      resource: "auth",
      details: { email }
    });
  }

  // Reset password
  static async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = db.query(`
      SELECT * FROM users 
      WHERE password_reset_token = ? 
      AND password_reset_expires > ?
    `).get(token, new Date().toISOString()) as any;

    if (!user) {
      throw new Error("Invalid or expired reset token");
    }

    this.validatePassword(newPassword);

    const passwordHash = await hash(newPassword, this.BCRYPT_ROUNDS);

    db.query(`
      UPDATE users 
      SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL
      WHERE id = ?
    `).run(passwordHash, user.id);

    // Invalidate all refresh tokens
    db.query("DELETE FROM refresh_tokens WHERE user_id = ?").run(user.id);

    await AuditService.log({
      userId: user.id,
      action: "user.password_reset",
      resource: "auth",
      details: {}
    });
  }

  // Two-factor authentication setup
  static async setupTwoFactor(userId: string): Promise<{ secret: string; qrCode: string }> {
    const user = await this.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const secret = authenticator.generateSecret();
    const qrCode = await this.generateQRCode(user.email, secret);

    // Save secret (temporarily until verified)
    db.query("UPDATE users SET two_factor_secret = ? WHERE id = ?")
      .run(secret, userId);

    return { secret, qrCode };
  }

  // Verify and enable two-factor authentication
  static async enableTwoFactor(userId: string, totpCode: string): Promise<void> {
    const user = await this.findById(userId);
    if (!user || !user.twoFactorSecret) {
      throw new Error("Two-factor setup not found");
    }

    const valid = authenticator.verify({
      token: totpCode,
      secret: user.twoFactorSecret
    });

    if (!valid) {
      throw new Error("Invalid verification code");
    }

    db.query("UPDATE users SET is_two_factor_enabled = TRUE WHERE id = ?")
      .run(userId);

    await AuditService.log({
      userId,
      action: "user.two_factor_enabled",
      resource: "auth",
      details: {}
    });
  }

  // API key management
  static async createApiKey(
    userId: string,
    name: string,
    permissions: string[],
    expiresAt?: Date
  ): Promise<{ key: string; apiKey: ApiKey }> {
    const key = `vk_${randomBytes(32).toString("hex")}`;
    const hashedKey = createHash("sha256").update(key).digest("hex");

    const apiKeyId = crypto.randomUUID();
    db.query(`
      INSERT INTO api_keys (id, user_id, name, key_hash, permissions, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      apiKeyId,
      userId,
      name,
      hashedKey,
      JSON.stringify(permissions),
      expiresAt?.toISOString() || null
    );

    const apiKey = db.query("SELECT * FROM api_keys WHERE id = ?").get(apiKeyId) as any;

    await AuditService.log({
      userId,
      action: "api_key.created",
      resource: "api_keys",
      details: { name, permissions }
    });

    return { key, apiKey };
  }

  // Verify API key
  static async verifyApiKey(key: string): Promise<{ user: User; apiKey: ApiKey } | null> {
    const hashedKey = createHash("sha256").update(key).digest("hex");

    const apiKey = db.query(`
      SELECT ak.*, u.* FROM api_keys ak
      JOIN users u ON ak.user_id = u.id
      WHERE ak.key_hash = ? 
      AND ak.is_active = TRUE
      AND (ak.expires_at IS NULL OR ak.expires_at > ?)
    `).get(hashedKey, new Date().toISOString()) as any;

    if (!apiKey) {
      return null;
    }

    // Update last used
    db.query("UPDATE api_keys SET last_used_at = ? WHERE id = ?")
      .run(new Date().toISOString(), apiKey.id);

    return {
      user: apiKey,
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        permissions: JSON.parse(apiKey.permissions || "[]"),
        lastUsedAt: apiKey.last_used_at,
        expiresAt: apiKey.expires_at,
        isActive: apiKey.is_active,
        createdAt: apiKey.created_at
      } as any
    };
  }

  // JWT token generation
  static generateJWT(user: User): string {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions: user.role?.permissions || []
    };

    return sign(payload, process.env.JWT_SECRET!, {
      expiresIn: "1h",
      issuer: "verb-auth",
      audience: "verb-app"
    });
  }

  // Refresh token generation
  static async generateRefreshToken(userId: string): Promise<string> {
    const token = randomBytes(40).toString("hex");
    const hashedToken = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    db.query(`
      INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(crypto.randomUUID(), userId, hashedToken, expiresAt.toISOString());

    return token;
  }

  // Verify refresh token
  static async verifyRefreshToken(token: string): Promise<User | null> {
    const hashedToken = createHash("sha256").update(token).digest("hex");

    const result = db.query(`
      SELECT u.* FROM refresh_tokens rt
      JOIN users u ON rt.user_id = u.id
      WHERE rt.token_hash = ? AND rt.expires_at > ?
    `).get(hashedToken, new Date().toISOString()) as any;

    return result || null;
  }

  // Email verification
  static async verifyEmail(token: string): Promise<void> {
    const user = db.query(
      "SELECT * FROM users WHERE email_verification_token = ?",
      token
    ).get() as any;

    if (!user) {
      throw new Error("Invalid verification token");
    }

    db.query(`
      UPDATE users 
      SET is_email_verified = TRUE, email_verification_token = NULL 
      WHERE id = ?
    `).run(user.id);

    await AuditService.log({
      userId: user.id,
      action: "user.email_verified",
      resource: "auth",
      details: { email: user.email }
    });
  }

  // Helper methods
  private static async findByEmail(email: string): Promise<User | null> {
    const user = db.query(`
      SELECT u.*, r.name as role_name 
      FROM users u 
      LEFT JOIN roles r ON u.role_id = r.id 
      WHERE u.email = ?
    `).get(email) as any;

    return user ? this.mapUser(user) : null;
  }

  private static async findById(id: string): Promise<User | null> {
    const user = db.query(`
      SELECT u.*, r.name as role_name 
      FROM users u 
      LEFT JOIN roles r ON u.role_id = r.id 
      WHERE u.id = ?
    `).get(id) as any;

    return user ? this.mapUser(user) : null;
  }

  private static async findByEmailOrUsername(email: string, username: string): Promise<User | null> {
    const user = db.query(
      "SELECT * FROM users WHERE email = ? OR username = ?",
      email.toLowerCase(),
      username
    ).get() as any;

    return user ? this.mapUser(user) : null;
  }

  private static mapUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      username: row.username,
      passwordHash: row.password_hash,
      firstName: row.first_name,
      lastName: row.last_name,
      role: { name: row.role_name } as any,
      isEmailVerified: row.is_email_verified,
      emailVerificationToken: row.email_verification_token,
      passwordResetToken: row.password_reset_token,
      passwordResetExpires: row.password_reset_expires ? new Date(row.password_reset_expires) : undefined,
      twoFactorSecret: row.two_factor_secret,
      isTwoFactorEnabled: row.is_two_factor_enabled,
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : undefined,
      loginAttempts: row.login_attempts,
      lockedUntil: row.locked_until ? new Date(row.locked_until) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    } as User;
  }

  private static sanitizeUser(user: User): Partial<User> {
    const { passwordHash, twoFactorSecret, emailVerificationToken, passwordResetToken, ...sanitized } = user;
    return sanitized;
  }

  private static validatePassword(password: string): void {
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters long");
    }

    if (!/(?=.*[a-z])/.test(password)) {
      throw new Error("Password must contain at least one lowercase letter");
    }

    if (!/(?=.*[A-Z])/.test(password)) {
      throw new Error("Password must contain at least one uppercase letter");
    }

    if (!/(?=.*\d)/.test(password)) {
      throw new Error("Password must contain at least one number");
    }

    if (!/(?=.*[@$!%*?&])/.test(password)) {
      throw new Error("Password must contain at least one special character");
    }
  }

  private static async handleFailedLogin(userId: string): Promise<void> {
    const user = await this.findById(userId);
    if (!user) return;

    const attempts = user.loginAttempts + 1;
    let lockedUntil = null;

    if (attempts >= this.MAX_LOGIN_ATTEMPTS) {
      lockedUntil = new Date(Date.now() + this.ACCOUNT_LOCK_TIME).toISOString();
    }

    db.query(
      "UPDATE users SET login_attempts = ?, locked_until = ? WHERE id = ?",
      attempts,
      lockedUntil,
      userId
    ).run();

    await AuditService.log({
      userId,
      action: "user.login_failed",
      resource: "auth",
      details: { attempts, locked: !!lockedUntil }
    });
  }

  private static async resetLoginAttempts(userId: string): Promise<void> {
    db.query(
      "UPDATE users SET login_attempts = 0, locked_until = NULL WHERE id = ?",
      userId
    ).run();
  }

  private static async generateQRCode(email: string, secret: string): Promise<string> {
    const qrCode = require("qrcode");
    const otpauth = authenticator.keyuri(email, "Verb Auth", secret);
    return await qrCode.toDataURL(otpauth);
  }
}
```

## Authentication Routes

```typescript
// src/routes/auth.ts
import { createServer } from "verb";
import { z } from "zod";
import { validate } from "../middleware/validation";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { AuthService } from "../services/AuthService";

const authRouter = createServer();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  totpCode: z.string().length(6).optional()
});

const passwordResetRequestSchema = z.object({
  email: z.string().email()
});

const passwordResetSchema = z.object({
  token: z.string(),
  password: z.string().min(8)
});

const verifyTotpSchema = z.object({
  code: z.string().length(6)
});

// Register
authRouter.post("/register",
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { user, token } = await AuthService.register(req.body);

    res.status(201).json({
      message: "Registration successful. Please verify your email.",
      user,
      token
    });
  })
);

// Login
authRouter.post("/login",
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password, totpCode } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.get("User-Agent");

    const { user, token, refreshToken } = await AuthService.login(
      email,
      password,
      totpCode,
      ipAddress,
      userAgent
    );

    // Set refresh token as httpOnly cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.json({
      message: "Login successful",
      user,
      token
    });
  })
);

// Refresh token
authRouter.post("/refresh",
  asyncHandler(async (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({
        error: "Refresh token required",
        code: "REFRESH_TOKEN_REQUIRED"
      });
    }

    const user = await AuthService.verifyRefreshToken(refreshToken);
    if (!user) {
      return res.status(401).json({
        error: "Invalid refresh token",
        code: "INVALID_REFRESH_TOKEN"
      });
    }

    const newToken = AuthService.generateJWT(user);
    const newRefreshToken = await AuthService.generateRefreshToken(user.id);

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    res.json({
      token: newToken,
      user: AuthService.sanitizeUser(user)
    });
  })
);

// Logout
authRouter.post("/logout",
  authenticate,
  asyncHandler(async (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    
    if (refreshToken) {
      // Remove refresh token from database
      const hashedToken = createHash("sha256").update(refreshToken).digest("hex");
      db.query("DELETE FROM refresh_tokens WHERE token_hash = ?").run(hashedToken);
    }

    res.clearCookie("refreshToken");
    res.json({ message: "Logout successful" });
  })
);

// Password reset request
authRouter.post("/password-reset",
  validate(passwordResetRequestSchema),
  asyncHandler(async (req, res) => {
    await AuthService.requestPasswordReset(req.body.email);
    
    res.json({
      message: "Password reset email sent if account exists"
    });
  })
);

// Password reset
authRouter.post("/password-reset/confirm",
  validate(passwordResetSchema),
  asyncHandler(async (req, res) => {
    const { token, password } = req.body;
    
    await AuthService.resetPassword(token, password);
    
    res.json({
      message: "Password reset successful"
    });
  })
);

// Email verification
authRouter.post("/verify-email/:token",
  asyncHandler(async (req, res) => {
    const { token } = req.params;
    
    await AuthService.verifyEmail(token);
    
    res.json({
      message: "Email verification successful"
    });
  })
);

// Setup 2FA
authRouter.post("/2fa/setup",
  authenticate,
  asyncHandler(async (req, res) => {
    const { secret, qrCode } = await AuthService.setupTwoFactor(req.user.userId);
    
    res.json({
      secret,
      qrCode,
      instructions: "Scan the QR code with your authenticator app and verify with a code"
    });
  })
);

// Enable 2FA
authRouter.post("/2fa/enable",
  authenticate,
  validate(verifyTotpSchema),
  asyncHandler(async (req, res) => {
    await AuthService.enableTwoFactor(req.user.userId, req.body.code);
    
    res.json({
      message: "Two-factor authentication enabled successfully"
    });
  })
);

// Disable 2FA
authRouter.post("/2fa/disable",
  authenticate,
  validate(verifyTotpSchema),
  asyncHandler(async (req, res) => {
    await AuthService.disableTwoFactor(req.user.userId, req.body.code);
    
    res.json({
      message: "Two-factor authentication disabled"
    });
  })
);

export { authRouter };
```

## Authorization Middleware

```typescript
// src/middleware/auth.ts
import { verify } from "jsonwebtoken";
import { AuthService } from "../services/AuthService";
import { db } from "../database/schema";

// JWT Authentication
export const authenticate = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      error: "Authentication required",
      code: "AUTH_REQUIRED"
    });
  }

  try {
    const decoded = verify(token, process.env.JWT_SECRET!) as any;
    
    // Get fresh user data
    const user = await AuthService.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        error: "User not found",
        code: "USER_NOT_FOUND"
      });
    }

    req.user = decoded;
    req.fullUser = user;
    next();
  } catch (error) {
    return res.status(401).json({
      error: "Invalid token",
      code: "INVALID_TOKEN"
    });
  }
};

// API Key Authentication
export const authenticateApiKey = async (req: any, res: any, next: any) => {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey) {
    return res.status(401).json({
      error: "API key required",
      code: "API_KEY_REQUIRED"
    });
  }

  const result = await AuthService.verifyApiKey(apiKey);
  if (!result) {
    return res.status(401).json({
      error: "Invalid API key",
      code: "INVALID_API_KEY"
    });
  }

  req.user = {
    userId: result.user.id,
    email: result.user.email,
    role: result.user.role,
    permissions: result.apiKey.permissions
  };
  req.apiKey = result.apiKey;
  req.fullUser = result.user;
  
  next();
};

// Permission-based authorization
export const authorize = (requiredPermissions: string[]) => {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
        code: "AUTH_REQUIRED"
      });
    }

    const userPermissions = req.user.permissions || [];
    const hasPermission = requiredPermissions.every(permission =>
      userPermissions.includes(permission) || userPermissions.includes("*")
    );

    if (!hasPermission) {
      return res.status(403).json({
        error: "Insufficient permissions",
        code: "INSUFFICIENT_PERMISSIONS",
        required: requiredPermissions,
        current: userPermissions
      });
    }

    next();
  };
};

// Role-based authorization
export const requireRole = (roles: string[]) => {
  return (req: any, res: any, next: any) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        error: "Authentication required",
        code: "AUTH_REQUIRED"
      });
    }

    if (!roles.includes(req.user.role.name)) {
      return res.status(403).json({
        error: "Insufficient role permissions",
        code: "INSUFFICIENT_ROLE",
        required: roles,
        current: req.user.role.name
      });
    }

    next();
  };
};

// Optional authentication (for public endpoints that can show different content for authenticated users)
export const optionalAuth = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (token) {
    try {
      const decoded = verify(token, process.env.JWT_SECRET!) as any;
      const user = await AuthService.findById(decoded.userId);
      
      if (user) {
        req.user = decoded;
        req.fullUser = user;
      }
    } catch (error) {
      // Ignore invalid tokens for optional auth
    }
  }

  next();
};
```

## Testing

```typescript
// tests/auth.test.ts
import { test, expect, beforeAll, afterAll } from "bun:test";
import request from "supertest";
import { app } from "../server";
import { AuthService } from "../src/services/AuthService";
import { db } from "../src/database/schema";

let testUser: any;
let authToken: string;

beforeAll(async () => {
  // Create test user
  const userData = {
    email: "test@example.com",
    username: "testuser",
    password: "Test123!@#",
    firstName: "Test",
    lastName: "User"
  };

  const { user, token } = await AuthService.register(userData);
  testUser = user;
  authToken = token;
});

test("POST /api/auth/register - creates new user", async () => {
  const response = await request(app)
    .post("/api/auth/register")
    .send({
      email: "newuser@example.com",
      username: "newuser",
      password: "NewPass123!",
      firstName: "New",
      lastName: "User"
    })
    .expect(201);

  expect(response.body.message).toBe("Registration successful. Please verify your email.");
  expect(response.body.user.email).toBe("newuser@example.com");
  expect(response.body.token).toBeDefined();
});

test("POST /api/auth/login - authenticates user", async () => {
  const response = await request(app)
    .post("/api/auth/login")
    .send({
      email: "test@example.com",
      password: "Test123!@#"
    })
    .expect(200);

  expect(response.body.message).toBe("Login successful");
  expect(response.body.user.email).toBe("test@example.com");
  expect(response.body.token).toBeDefined();
});

test("POST /api/auth/login - fails with invalid credentials", async () => {
  await request(app)
    .post("/api/auth/login")
    .send({
      email: "test@example.com",
      password: "wrongpassword"
    })
    .expect(401);
});

test("GET /api/auth/me - returns current user", async () => {
  const response = await request(app)
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${authToken}`)
    .expect(200);

  expect(response.body.user.email).toBe("test@example.com");
});

test("POST /api/auth/2fa/setup - sets up 2FA", async () => {
  const response = await request(app)
    .post("/api/auth/2fa/setup")
    .set("Authorization", `Bearer ${authToken}`)
    .expect(200);

  expect(response.body.secret).toBeDefined();
  expect(response.body.qrCode).toBeDefined();
});

test("Rate limiting works for auth endpoints", async () => {
  // Make 21 requests (exceeds limit of 20)
  const promises = Array.from({ length: 21 }, () =>
    request(app)
      .post("/api/auth/login")
      .send({
        email: "test@example.com",
        password: "wrongpassword"
      })
  );

  const responses = await Promise.all(promises);
  const rateLimitedResponses = responses.filter(r => r.status === 429);
  
  expect(rateLimitedResponses.length).toBeGreaterThan(0);
});

afterAll(async () => {
  // Clean up test data
  db.query("DELETE FROM users WHERE email IN (?, ?)")
    .run("test@example.com", "newuser@example.com");
});
```

## Frontend Integration Example

```html
<!-- public/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Authentication Demo</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; }
        input { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
        button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #0056b3; }
        .section { margin-bottom: 30px; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
        .hidden { display: none; }
        .error { color: red; margin-top: 10px; }
        .success { color: green; margin-top: 10px; }
    </style>
</head>
<body>
    <h1>Verb Authentication Demo</h1>

    <!-- Login Section -->
    <div id="loginSection" class="section">
        <h2>Login</h2>
        <form id="loginForm">
            <div class="form-group">
                <label>Email:</label>
                <input type="email" id="loginEmail" required>
            </div>
            <div class="form-group">
                <label>Password:</label>
                <input type="password" id="loginPassword" required>
            </div>
            <div class="form-group" id="totpGroup" class="hidden">
                <label>2FA Code:</label>
                <input type="text" id="totpCode" maxlength="6">
            </div>
            <button type="submit">Login</button>
        </form>
        <div id="loginMessage"></div>
    </div>

    <!-- Register Section -->
    <div id="registerSection" class="section">
        <h2>Register</h2>
        <form id="registerForm">
            <div class="form-group">
                <label>Email:</label>
                <input type="email" id="registerEmail" required>
            </div>
            <div class="form-group">
                <label>Username:</label>
                <input type="text" id="registerUsername" required>
            </div>
            <div class="form-group">
                <label>Password:</label>
                <input type="password" id="registerPassword" required>
            </div>
            <div class="form-group">
                <label>First Name:</label>
                <input type="text" id="registerFirstName" required>
            </div>
            <div class="form-group">
                <label>Last Name:</label>
                <input type="text" id="registerLastName" required>
            </div>
            <button type="submit">Register</button>
        </form>
        <div id="registerMessage"></div>
    </div>

    <!-- Dashboard (shown when authenticated) -->
    <div id="dashboard" class="section hidden">
        <h2>Dashboard</h2>
        <div id="userInfo"></div>
        
        <h3>Two-Factor Authentication</h3>
        <button id="setup2FA">Setup 2FA</button>
        <div id="qrCode" class="hidden">
            <img id="qrImage" alt="QR Code">
            <div class="form-group">
                <label>Verification Code:</label>
                <input type="text" id="verify2FACode" maxlength="6">
                <button id="enable2FA">Enable 2FA</button>
            </div>
        </div>

        <h3>API Keys</h3>
        <div class="form-group">
            <label>Key Name:</label>
            <input type="text" id="apiKeyName">
            <button id="createApiKey">Create API Key</button>
        </div>
        <div id="apiKeys"></div>

        <button id="logout">Logout</button>
    </div>

    <script>
        const API_BASE = '/api';
        let currentToken = localStorage.getItem('authToken');

        // Check if user is already logged in
        if (currentToken) {
            showDashboard();
        }

        // Login form
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const totpCode = document.getElementById('totpCode').value;

            try {
                const response = await fetch(`${API_BASE}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, totpCode })
                });

                const data = await response.json();

                if (response.ok) {
                    currentToken = data.token;
                    localStorage.setItem('authToken', currentToken);
                    showMessage('loginMessage', data.message, 'success');
                    showDashboard();
                } else {
                    if (data.code === 'TWO_FACTOR_REQUIRED') {
                        document.getElementById('totpGroup').classList.remove('hidden');
                    }
                    showMessage('loginMessage', data.error, 'error');
                }
            } catch (error) {
                showMessage('loginMessage', 'Network error', 'error');
            }
        });

        // Register form
        document.getElementById('registerForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = {
                email: document.getElementById('registerEmail').value,
                username: document.getElementById('registerUsername').value,
                password: document.getElementById('registerPassword').value,
                firstName: document.getElementById('registerFirstName').value,
                lastName: document.getElementById('registerLastName').value
            };

            try {
                const response = await fetch(`${API_BASE}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });

                const data = await response.json();

                if (response.ok) {
                    currentToken = data.token;
                    localStorage.setItem('authToken', currentToken);
                    showMessage('registerMessage', data.message, 'success');
                    showDashboard();
                } else {
                    showMessage('registerMessage', data.error, 'error');
                }
            } catch (error) {
                showMessage('registerMessage', 'Network error', 'error');
            }
        });

        // Setup 2FA
        document.getElementById('setup2FA').addEventListener('click', async () => {
            try {
                const response = await fetch(`${API_BASE}/auth/2fa/setup`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${currentToken}`,
                        'Content-Type': 'application/json'
                    }
                });

                const data = await response.json();

                if (response.ok) {
                    document.getElementById('qrImage').src = data.qrCode;
                    document.getElementById('qrCode').classList.remove('hidden');
                } else {
                    alert(data.error);
                }
            } catch (error) {
                alert('Failed to setup 2FA');
            }
        });

        // Enable 2FA
        document.getElementById('enable2FA').addEventListener('click', async () => {
            const code = document.getElementById('verify2FACode').value;

            try {
                const response = await fetch(`${API_BASE}/auth/2fa/enable`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${currentToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ code })
                });

                const data = await response.json();

                if (response.ok) {
                    alert(data.message);
                    document.getElementById('qrCode').classList.add('hidden');
                } else {
                    alert(data.error);
                }
            } catch (error) {
                alert('Failed to enable 2FA');
            }
        });

        // Create API key
        document.getElementById('createApiKey').addEventListener('click', async () => {
            const name = document.getElementById('apiKeyName').value;

            try {
                const response = await fetch(`${API_BASE}/users/api-keys`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${currentToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ name, permissions: ['users:read'] })
                });

                const data = await response.json();

                if (response.ok) {
                    alert(`API Key created: ${data.key}`);
                    loadApiKeys();
                } else {
                    alert(data.error);
                }
            } catch (error) {
                alert('Failed to create API key');
            }
        });

        // Logout
        document.getElementById('logout').addEventListener('click', async () => {
            try {
                await fetch(`${API_BASE}/auth/logout`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${currentToken}` }
                });
            } catch (error) {
                // Ignore logout errors
            }

            localStorage.removeItem('authToken');
            currentToken = null;
            hideDashboard();
        });

        async function showDashboard() {
            try {
                const response = await fetch(`${API_BASE}/auth/me`, {
                    headers: { 'Authorization': `Bearer ${currentToken}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    document.getElementById('userInfo').innerHTML = `
                        <p><strong>Email:</strong> ${data.user.email}</p>
                        <p><strong>Username:</strong> ${data.user.username}</p>
                        <p><strong>Name:</strong> ${data.user.firstName} ${data.user.lastName}</p>
                        <p><strong>Role:</strong> ${data.user.role?.name || 'user'}</p>
                        <p><strong>2FA Enabled:</strong> ${data.user.isTwoFactorEnabled ? 'Yes' : 'No'}</p>
                    `;

                    document.getElementById('loginSection').classList.add('hidden');
                    document.getElementById('registerSection').classList.add('hidden');
                    document.getElementById('dashboard').classList.remove('hidden');

                    loadApiKeys();
                } else {
                    throw new Error('Failed to load user info');
                }
            } catch (error) {
                localStorage.removeItem('authToken');
                currentToken = null;
            }
        }

        function hideDashboard() {
            document.getElementById('loginSection').classList.remove('hidden');
            document.getElementById('registerSection').classList.remove('hidden');
            document.getElementById('dashboard').classList.add('hidden');
        }

        async function loadApiKeys() {
            try {
                const response = await fetch(`${API_BASE}/users/api-keys`, {
                    headers: { 'Authorization': `Bearer ${currentToken}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    const html = data.apiKeys.map(key => `
                        <div>
                            <strong>${key.name}</strong> - Created: ${new Date(key.createdAt).toLocaleDateString()}
                            ${key.lastUsedAt ? `- Last used: ${new Date(key.lastUsedAt).toLocaleDateString()}` : ''}
                        </div>
                    `).join('');
                    
                    document.getElementById('apiKeys').innerHTML = html || '<p>No API keys</p>';
                }
            } catch (error) {
                console.error('Failed to load API keys:', error);
            }
        }

        function showMessage(elementId, message, type) {
            const element = document.getElementById(elementId);
            element.textContent = message;
            element.className = type;
        }
    </script>
</body>
</html>
```

## Running the Application

```bash
# Set environment variables
export JWT_SECRET="your-very-secure-jwt-secret-key"
export NODE_ENV="development"

# Email configuration (for verification and password reset)
export SMTP_HOST="smtp.gmail.com"
export SMTP_PORT="587"
export SMTP_USER="your-email@gmail.com"
export SMTP_PASS="your-app-password"

# Start the server
bun run server.ts

# Run tests
bun test
```

## Key Features Demonstrated

This authentication example showcases:

1. **Multiple Authentication Methods**: JWT, sessions, API keys, OAuth
2. **Security Best Practices**: Password hashing, rate limiting, account locking
3. **Two-Factor Authentication**: TOTP-based 2FA with QR code generation
4. **Role-Based Access Control**: Roles, permissions, and authorization middleware
5. **Account Management**: Registration, email verification, password reset
6. **Session Management**: Refresh tokens, logout, session invalidation
7. **API Security**: Rate limiting, CORS, security headers
8. **Audit Logging**: Track authentication events and user actions
9. **Comprehensive Testing**: Unit and integration tests
10. **Frontend Integration**: Complete HTML/JavaScript client example

This authentication system provides enterprise-grade security features suitable for production applications.

## See Also

- [REST API Example](/examples/rest-api) - Integrating authentication with REST APIs
- [Security Guide](/guide/security) - Security best practices
- [Middleware Guide](/guide/middleware) - Creating custom authentication middleware
- [Testing Guide](/guide/testing) - Testing authentication flows