# 🤝 Contributing Guidelines

Thank you for your interest in contributing to Rate Limiting API! We welcome contributions from developers of all experience levels.

## Code of Conduct

Be respectful, inclusive, and constructive in all interactions. We're building a welcoming community.

## Getting Started

### 1. Fork and Clone

```bash
# Fork the repository on GitHub
# Clone your fork
git clone https://github.com/YOUR_USERNAME/rate-limiting-api.git
cd rate-limiting-api

# Add upstream remote
git remote add upstream https://github.com/ORIGINAL_OWNER/rate-limiting-api.git
```

### 2. Set Up Development Environment

```bash
npm install
cp .env.example .env
docker-compose up -d
npm run db:migrate
npm run dev
```

### 3. Create Feature Branch

```bash
# Update main
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feat/your-feature-name
```

## Development Workflow

### Before Writing Code

1. Check [open issues](https://github.com/your-repo/issues) to avoid duplicate work
2. Open an issue describing your proposal (especially for large features)
3. Wait for feedback before starting

### Code Standards

#### TypeScript

- Strict mode enabled
- Explicit return types on functions
- No `any` types (request exception if truly needed)
- Comprehensive error handling

```typescript
// ✅ Good
async function getUserById(id: string): Promise<User | null> {
  if (!id) throw new ValidationError('ID required');
  return prisma.user.findUnique({ where: { id } });
}

// ❌ Avoid
async function getUserById(id: any) {
  return prisma.user.findUnique({ where: { id } });
}
```

#### Naming Conventions

```typescript
// Constants: UPPER_SNAKE_CASE
const DEFAULT_RATE_LIMIT = 100;
const JWT_EXPIRATION_TIME = '1h';

// Variables & functions: camelCase
const userData = await fetchUser();
function createApiKey() {}

// Classes: PascalCase
class RateLimiter {}
class AuthenticationError extends AppError {}

// Interfaces: PascalCase, usually with I prefix for clarity
interface IUser {
  id: string;
  email: string;
}
```

#### Error Handling

```typescript
// ✅ Good - custom errors with context
throw new ValidationError('Email already registered', { email });

// ✅ Good - error recovery
const redisData = await redis.get(key).catch(() => null);

// ❌ Avoid - silent failures
try {
  await saveData();
} catch (err) {
  // Silently ignore - BAD!
}

// ❌ Avoid - generic errors
throw new Error('something went wrong');
```

#### Comments & Documentation

```typescript
/**
 * Generate a secure API key for authenticated requests
 * @param userId - The user ID to associate with the key
 * @param name - Human-readable name for the key
 * @returns The generated API key and metadata
 * @throws ValidationError if userId or name is invalid
 */
export async function generateApiKey(userId: string, name: string): Promise<ApiKey> {
  // Implementation
}
```

### Testing Requirements

All code must include tests:

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage (aim for >80%)
npm run test:coverage
```

**Testing guidelines:**
- One `describe()` block per function
- Test happy path + error cases
- Use meaningful test names
- Mock external dependencies

Example:

```typescript
describe('loginUser', () => {
  it('should return token and user on valid credentials', async () => {
    const result = await loginUser('user@test.com', 'ValidPass123!');
    expect(result.token).toBeDefined();
    expect(result.user.email).toBe('user@test.com');
  });

  it('should throw AuthenticationError on invalid password', async () => {
    await expect(loginUser('user@test.com', 'wrong')).rejects.toThrow(
      AuthenticationError
    );
  });

  it('should throw NotFoundError if user does not exist', async () => {
    await expect(loginUser('nonexistent@test.com', 'Pass123!')).rejects.toThrow(
      NotFoundError
    );
  });
});
```

### Code Quality Checks

```bash
# Format code
npm run format

# Check formatting
npm run format:check

# Lint
npm run lint

# Fix lint issues
npm run lint:fix

# Type check
npm run type-check

# Run all checks
npm run pre-commit
```

## Commit Guidelines

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Type

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation
- **style**: Formatting (no code change)
- **refactor**: Code refactoring
- **perf**: Performance improvement
- **test**: Test additions/changes
- **chore**: Dependencies, build, CI/CD
- **security**: Security fix

#### Scope

Optional - the part of code affected: `auth`, `rate-limiter`, `db`, etc.

#### Subject

- Imperative mood: "add" not "added"
- Don't capitalize first letter
- No period at end
- Max 50 characters

#### Examples

```
feat(auth): add password strength validation
fix(rate-limiter): handle Redis connection timeout gracefully
docs(setup): add environment variables documentation
test(auth): add unit tests for login endpoint
chore: update dependencies
```

## Pull Request Process

### 1. Prepare Your Branch

```bash
# Update from upstream
git fetch upstream
git rebase upstream/main

# Squash related commits
git rebase -i upstream/main
```

### 2. Push and Create PR

```bash
git push origin feat/your-feature-name
```

Go to GitHub and create a Pull Request.

### 3. PR Description Template

```markdown
## Description
Clearly describe what this PR does and why.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Breaking change

## Related Issue
Closes #123

## Testing
Describe testing performed:
- [ ] Unit tests added
- [ ] Integration tests added
- [ ] Manual testing done

## Checklist
- [ ] Code follows style guidelines
- [ ] Tests pass locally: `npm test`
- [ ] Linting passes: `npm run lint`
- [ ] Type checking passes: `npm run type-check`
- [ ] Documentation updated if needed
```

### 4. Review Process

- At least one approval required
- CI checks must pass
- No merge conflicts
- Coverage should not decrease

### 5. Merge

Once approved:
```bash
# Maintainers will merge with squash
# Your branch will be deleted
```

## Adding Features

### Database Schema Change

1. Modify `prisma/schema.prisma`
2. Create migration: `npm run db:migrate`
3. Name it descriptively: `add_user_preferences`
4. Add corresponding types/interfaces
5. Add tests for new schema

### New Endpoint

1. Create controller in `controllers/`
2. Add routes in `routes/`
3. Add validation schemas
4. Add comprehensive tests
5. Update OpenAPI spec in `docs/openapi.yaml`

### New Middleware

1. Create in `middlewares/`
2. Export clearly with JSDoc comments
3. Add to `app.ts` in correct order
4. Add tests
5. Document in `ARCHITECTURE.md`

## Reporting Issues

### Bug Reports

Include:
- Clear description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Environment info (Node version, OS, etc.)
- Error logs/screenshots

### Feature Requests

Include:
- Use case and benefits
- Proposed implementation (optional)
- Any alternatives considered

## Documentation

When adding features, update:
- JSDoc comments in code
- `README.md` if user-facing
- `ARCHITECTURE.md` if technical detail
- `API_ROUTES.md` if new endpoint
- Tests are your documentation too!

## Performance Considerations

When optimizing, benchmark:

```bash
# Use node profiler
node --prof server.ts
node --prof-process isolate-*.log > profile.txt

# Check memory
node --max-old-space-size=512 server.ts
```

## Security

- No secrets in code
- Validate all inputs (use Zod)
- Use parameterized queries (Prisma does this)
- Follow OWASP guidelines
- Report security vulnerabilities privately to maintainers

## Questions?

- 💬 Open a [Discussion](https://github.com/your-repo/discussions)
- 📖 Read [ARCHITECTURE.md](./ARCHITECTURE.md)
- 🚀 Check [SETUP.md](./SETUP.md)

## Recognition

Contributors will be listed in `CONTRIBUTORS.md`. Thank you for improving this project! 🌟
