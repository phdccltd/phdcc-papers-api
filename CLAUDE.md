# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture
For detailed technical architecture information, see [CLAUDE-architecture.md](./CLAUDE-architecture.md).
Imported to Claude memory via @CLAUDE-architecture.md

## Development Commands

### Testing
- `npm test` - Run full Jest test suite (must run with `--runInBand` flag to execute sequentially)
- `npm run testci` - CI-friendly test run
- Run single test: `npx jest tests/login_ok.test.js --runInBand`
- `npm run standard` - Code style checking (StandardJS)

### Development
- `npm run dev` - Development server with console logging (port from .env or 3333)
- `npm start` - Production server
- `npm run forclient` - Development mode for testing with client code

### Key Architecture Notes

#### Database & Models
- **Database Auto-Sync**: Sequelize automatically creates/updates tables on server start via `sequelize.sync({ alter: true })` in app.js:37
- **SQLite for tests**: In-memory database, MySQL for production
- **Model Associations**: Defined in each model's `associate()` method in models/
- **Multi-tenant**: Site configuration stored in `sites` table, resolved via host headers

#### Response Patterns
All routes use standardized response helpers from utils.js:
- `returnOK(res, data)` - Success responses
- `giveup(req, res, msg)` - User-facing errors
- `exterminate(req, res, err)` - Critical errors

#### Authentication Flow
1. JWT-based auth via Passport.js
2. Routes in routes/index.js check authentication before business logic
3. Site resolution from request headers happens early in middleware chain
4. Role-based permissions validated per-route

#### Background Tasks
- `task.js` runs automated reminder emails on intervals
- Startup delay: env var `ST` (default 15 seconds)
- Interval: env var `IM` (default 17 minutes)
- Uses Handlebars templates for email content

#### File Uploads
- Handled via Multer middleware
- Temporary files in `/tmp/papers/` subdirectory
- Permanent storage in directory specified by site settings
- Test fixtures in `tests/files/`

### Testing Patterns
- Each test suite initializes a fresh test site via `tests/maketestsite.js`
- Test helper utilities in `tests/testhelper.js`
- API test scenarios defined as JSON in `scripts/tests/`
- Tests must run sequentially (--runInBand) to avoid file system conflicts

### Environment Setup
Required .env variables (see README.md:203-218 for full list):
- `PORT` - Server port (default 3333)
- `DATABASE`, `DBUSER`, `DBPASS` - Database connection
- `JWT_SECRET` - Authentication secret
- `RECAPTCHA_SECRET_KEY`, `RECAPTCHA_BYPASS` - reCAPTCHA config
- `BASEURL` - API base path (typically `/api`)
- `LOGMODE=console` - Enable console logging in development

### Common Development Patterns
- **Adding new routes**: Add to routes/, mount in routes/index.js, follow authentication middleware pattern
- **New models**: Create in models/, define associations in `associate()`, auto-synced on server start
- **Email templates**: Stored in `pubmailtemplates` table, use Handlebars syntax
- **Logging**: Use `logger.js` functions - logs to both files (log/) and database (logs table)
