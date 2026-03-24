# API Routes Documentation

## 🚀 Available Endpoints

### 🔐 Authentication Routes (`/api/v1/auth`)

#### POST `/api/v1/auth/register`
Register a new user account.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "Password123!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "createdAt": "2024-03-24T14:34:55.729Z"
    },
    "token": "jwt_token_here"
  }
}
```

#### POST `/api/v1/auth/login`
Login with email and password.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "Password123!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "token": "jwt_token_here"
  }
}
```

---

### 🔑 API Key Routes (`/api/v1/api-keys`)

#### POST `/api/v1/api-keys`
Create a new API key (requires authentication).

**Headers:**
```
Authorization: Bearer jwt_token
```

**Request Body:**
```json
{
  "name": "My API Key",
  "planId": "basic"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "apiKey": {
      "id": "uuid",
      "keyId": "key_id_here",
      "name": "My API Key",
      "key": "sk_live_...", // Only shown once during creation
      "status": "active",
      "createdAt": "2024-03-24T14:34:55.729Z"
    }
  }
}
```

#### GET `/api/v1/api-keys`
Get all API keys for the authenticated user.

**Headers:**
```
Authorization: Bearer jwt_token
```

**Response:**
```json
{
  "success": true,
  "data": {
    "apiKeys": [
      {
        "id": "uuid",
        "keyId": "key_id_here",
        "name": "My API Key",
        "status": "active",
        "createdAt": "2024-03-24T14:34:55.729Z"
      }
    ]
  }
}
```

#### DELETE `/api/v1/api-keys/:id`
Delete an API key.

**Headers:**
```
Authorization: Bearer jwt_token
```

**Response:**
```json
{
  "success": true,
  "message": "API key deleted successfully"
}
```

---

### 🛡️ Protected Routes (`/api/v1/protected`)

#### GET `/api/v1/protected/ping`
Test endpoint protected by JWT authentication.

**Headers:**
```
Authorization: Bearer jwt_token
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "pong",
    "timestamp": "2024-03-24T14:34:55.729Z"
  }
}
```

#### GET `/api/v1/protected/user`
Get current user profile.

**Headers:**
```
Authorization: Bearer jwt_token
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "createdAt": "2024-03-24T14:34:55.729Z"
    }
  }
}
```

---

### 🔓 Public API Routes (`/api/v1/public`)

#### GET `/api/v1/public/ping`
Public ping endpoint for testing API connectivity.

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "pong",
    "timestamp": "2024-03-24T14:34:55.729Z"
  }
}
```

#### GET `/api/v1/public/info`
Get API information and rate limits.

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "Rate Limiting API",
    "version": "1.0.0",
    "rateLimits": {
      "auth": {
        "windowMs": 900000,
        "maxRequests": 5
      },
      "api": {
        "windowMs": 60000,
        "maxRequests": 100
      }
    }
  }
}
```

---

### 📊 API Key Protected Routes (`/api/v1/api`)

These routes require API key authentication.

#### GET `/api/v1/api/ping`
Test endpoint protected by API key.

**Headers:**
```
X-API-Key: sk_live_your_api_key_here
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "pong",
    "timestamp": "2024-03-24T14:34:55.729Z"
  }
}
```

#### GET `/api/v1/api/usage`
Get API usage statistics for your API key.

**Headers:**
```
X-API-Key: sk_live_your_api_key_here
```

**Response:**
```json
{
  "success": true,
  "data": {
    "usage": {
      "currentPeriod": {
        "requests": 45,
        "limit": 1000,
        "resetAt": "2024-03-25T00:00:00.000Z"
      },
      "totalRequests": 1250
    }
  }
}
```

---

### 🏥 Health & System Routes

#### GET `/health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "redis": {
    "connected": true,
    "pong": true
  },
  "uptimeSeconds": 120,
  "timestamp": 1774357849539
}
```

#### GET `/api/v1/docs`
Swagger/OpenAPI documentation (if enabled).

---

## 🚦 Rate Limiting

### Rate Limits by Endpoint Type:

- **Authentication endpoints** (`/api/v1/auth/*`): 5 requests per 15 minutes
- **General API endpoints** (`/api/v1/api/*`): 100 requests per minute
- **API Key endpoints** (`/api/v1/api-keys/*`): 10 requests per minute
- **Public endpoints** (`/api/v1/public/*`): 1000 requests per hour

### Rate Limit Headers:

All responses include rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1648044000
```

---

## 🔐 Authentication Methods

### 1. JWT Authentication
Use for user-specific routes:
```
Authorization: Bearer your_jwt_token
```

### 2. API Key Authentication
Use for API-specific routes:
```
X-API-Key: sk_live_your_api_key_here
```

---

## 📝 Error Responses

All errors follow this format:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {}
  },
  "timestamp": "2024-03-24T14:34:55.729Z"
}
```

### Common Error Codes:

- `VALIDATION_ERROR` - Invalid request data
- `UNAUTHORIZED` - Missing or invalid authentication
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INTERNAL_SERVER_ERROR` - Server error

---

## 🧪 Testing Examples

### Test Registration:
```bash
curl -X POST http://localhost:5050/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"Password123!"}'
```

### Test Login:
```bash
curl -X POST http://localhost:5050/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Password123!"}'
```

### Test Protected Route:
```bash
curl -X GET http://localhost:5050/api/v1/protected/ping \
  -H "Authorization: Bearer your_jwt_token"
```

### Test API Key Route:
```bash
curl -X GET http://localhost:5050/api/v1/api/ping \
  -H "X-API-Key: sk_live_your_api_key_here"
```

---

## 📚 Quick Start

1. **Register a user** to get a JWT token
2. **Create an API key** using the JWT token
3. **Use the API key** to access protected routes
4. **Monitor usage** with the usage endpoint

---

## 🔗 Related Documentation

- [Rate Limiting Examples](./RATE_LIMITER_EXAMPLES.md)
- [Environment Configuration](./.env.example)
- [Docker Setup](./README.Docker.md)
