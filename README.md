# 🚦 Rate Limiting API Gateway

A **production-grade API Gateway** built with modern backend technologies, demonstrating enterprise-level authentication, rate limiting, and observability practices.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat&logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)

---

## 📋 Overview

This project showcases real-world backend engineering skills with a focus on **security**, **scalability**, and **observability**. Built for high-traffic scenarios, it implements JWT authentication, Redis-backed rate limiting, and comprehensive logging—all containerized for easy deployment.

**Perfect for**: Demonstrating backend expertise to recruiters and technical interviewers.

---

## ✨ Key Features

### 🔐 Authentication & Authorization
- **Secure User Registration** with bcrypt password hashing
- **JWT-based Authentication** for protected routes
- **Dual Access Control**:
  - User authentication via JWT tokens
  - API access via secure API keys
- **Middleware Protection** with token validation and expiration handling
- Centralized error handling for auth failures

### 🔑 API Key Management
- Secure API key generation and validation
- Stateless API access design for horizontal scaling
- Foundation for key rotation and per-key policies
- Isolated key management from user authentication

### ⚡ Rate Limiting
- **Redis-backed** for distributed rate limiting across multiple instances
- **Multiple Identifier Types**:
  - IP-based rate limiting
  - API key-based rate limiting
  - Custom identifier support
- **Advanced Features**:
  - Weighted request counting
  - Per-route rate limit configuration
  - Graceful degradation when Redis is unavailable
- Cluster-safe implementation

### 📊 Observability & Reliability
- **Structured Logging** with Winston
- Request tracing with unique request IDs
- Comprehensive logging: method, path, status, duration
- **Sentry Integration** for centralized error tracking
- **Health Check Endpoint** (`GET /health`)
  - Redis connectivity status
  - Application uptime
  - Service health metrics

### 🐳 Infrastructure & DevOps
- **Fully Dockerized** application
- **Docker Compose** orchestration for:
  - API service
  - Redis cache
  - PostgreSQL database
- Environment variable validation on startup
- Graceful shutdown handling (SIGTERM/SIGINT)
- Proxy-aware IP handling with `TRUST_PROXY` support
- Production-ready configuration

---

## 🛠️ Tech Stack

| Category | Technologies |
|----------|-------------|
| **Runtime** | Node.js, TypeScript |
| **Framework** | Express.js |
| **Database** | PostgreSQL with Prisma ORM |
| **Cache** | Redis |
| **Security** | JWT, bcrypt |
| **Logging** | Winston |
| **Monitoring** | Sentry |
| **DevOps** | Docker, Docker Compose |

---

## �️ Quick Start

### Using Docker (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd rate-limiting-api

# Start all services
docker-compose up --build

# The API will be available at http://localhost:5050
```

### Manual Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Set up database
npx prisma migrate dev
npx prisma generate

# Start Redis (required for rate limiting)
redis-server

# Start development server
npm run dev
```

---

## 🚀 Local Development Setup

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/rate-limiting-api-gateway.git
cd rate-limiting-api-gateway
```

2. **Configure environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start the services**
```bash
docker compose up -d --build
```

4. **Verify the application is running**
```bash
curl http://localhost:5050/health
```

The API will be available at `http://localhost:5050`

---

## 📡 API Usage

### User Registration
```bash
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

### User Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

### Access Protected Routes (JWT)
```bash
GET /api/protected/resource
Authorization: Bearer <YOUR_JWT_TOKEN>
```

### Access API Endpoints (API Key)
```bash
GET /api/data
x-api-key: <YOUR_API_KEY>
```

### Health Check
```bash
GET /health
```

---

## 📁 Project Structure

```
rate-limiting-api-gateway/
├── src/
│   ├── controllers/       # Request handlers
│   ├── routes/           # API route definitions
│   ├── services/         # Business logic
│   ├── middlewares/      # Auth, rate limiting, logging
│   ├── utils/            # Helper functions
│   ├── app.ts            # Express app configuration
│   └── server.ts         # Entry point
├── prisma/
│   └── schema.prisma     # Database schema
├── docs/                 # Additional documentation
├── docker-compose.yml    # Service orchestration
├── Dockerfile            # Container configuration
└── README.md
```

---

## 🎯 Why This Project?

This project demonstrates **production-level backend engineering skills**:

✅ **Security-First Design** - JWT authentication, bcrypt hashing, secure API keys  
✅ **Scalable Architecture** - Redis-backed rate limiting, stateless design  
✅ **Clean Code** - TypeScript, separation of concerns, middleware patterns  
✅ **Observability** - Structured logging, error tracking, health checks  
✅ **DevOps Ready** - Dockerized, environment validation, graceful shutdown  
✅ **Best Practices** - Type safety, error handling, proxy awareness

Perfect for demonstrating skills in:
- Backend API development
- Authentication & authorization systems
- Distributed systems design
- Database modeling with ORMs
- Caching strategies
- Container orchestration
- Production monitoring

---

## 🔮 Roadmap

### Planned Improvements
- [ ] Multiple rate limiting strategies (sliding window, token bucket)
- [ ] Per-key rate limit policies and quotas
- [ ] Usage analytics and metrics dashboard
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Comprehensive load testing suite
- [ ] Cloud deployment guides (AWS, GCP, Azure)
- [x] API documentation with Swagger/OpenAPI
- [ ] WebSocket support with rate limiting
- [ ] Multi-tenancy support
- [ ] Monitoring dashboards (Grafana, Prometheus)

---


## What I Learned

- Designing stateless APIs for horizontal scalability
- Implementing secure authentication and authorization flows
- Handling rate limiting in distributed systems
- Structuring backend code for maintainability and growth
- Writing production-grade logging and error handling


---


## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

---

## 📧 Contact

**Konduru Durga Prasad**  
Email: kondurudurgaprasad.2@gmail.com  
LinkedIn: [linkedin.com/in/durgaprasad23](https://www.linkedin.com/in/durgaprasad23/)  
GitHub: [@Durga1534](https://github.com/Durga1534)

---

## 🌟 Show Your Support

If you found this project helpful, please consider giving it a ⭐️!

---

<div align="center">
  <sub>Built with ❤️ by [Durga Prasad]</sub>
</div>
