# PHDCC Papers API - Architecture Overview

## Project Overview
The PHDCC Papers API is a Node.js/Express.js RESTful API server for managing journal and conference paper submissions and reviews. It handles user authentication, paper submissions, reviewer assignments, grading workflows, and email notifications in an academic publishing context.

**🚀 Target Deployment: Google Cloud Run** (containerized serverless deployment)

## Technology Stack
- **Runtime**: Node.js 22.x LTS
- **Framework**: Express.js 5.x
- **Database**: Cloud SQL MySQL 8.0 (production) / SQLite (testing)
- **ORM**: Sequelize 6.x
- **Authentication**: Passport.js with JWT
- **Email**: Nodemailer
- **Testing**: Jest
- **File Storage**: Google Cloud Storage (production) / Mock (testing)
- **Deployment**: Google Cloud Run (Docker containers)
- ~~**Process Management**: PM2~~ **DEPRECATED** - Legacy traditional server deployment only

## Directory Structure

```
phdcc-papers-api/
├── app.js              # Main Express application setup
├── server.js           # HTTP server entry point
├── db.js               # Database connection configuration
├── logger.js           # Logging system with file rotation
├── utils.js            # Utility functions (email, responses)
├── task.js             # Background task scheduler for reminders
├── models/             # Sequelize database models
├── routes/             # API route handlers
├── tests/              # Test files and helpers
├── public/             # Static files
├── log/                # Application logs
├── docs/               # Documentation assets
├── scripts/            # Data setup scripts
├── coverage/           # Test coverage reports
└── node_modules/       # Dependencies
```

## Application Entry Points

### Primary Entry Points
1. **server.js:1** - Main server startup script that loads environment variables and starts HTTP server
2. **app.js:1** - Core Express application configuration and middleware setup

### Server Initialization Flow
1. `server.js` loads environment variables from `.env` file
2. Creates HTTP server using `app.js` 
3. `app.js` initializes database connection, models, and middleware
4. Routes are mounted and background tasks are scheduled
5. Server listens on configured port (default 3333)

## Database Architecture

### Database Connection
- **File**: `db.js:1`
- **Testing**: SQLite in-memory database
- **Production**: MySQL with connection pooling
- **ORM**: Sequelize with automatic table creation/updates

### Core Database Models (models/)

#### User Management
- **users.js** - User accounts with roles and authentication
- **userpubs.js** - User-publication relationships

#### Publication Management  
- **sites.js** - Multi-tenant site configuration
- **pubs.js** - Publications/journals/conferences
- **pubroles.js** - Role definitions within publications
- **pubuserroles.js** - User role assignments

#### Submission Workflow
- **flows.js** - Submission workflow definitions
- **flowstages.js** - Workflow stages
- **flowstatuses.js** - Status definitions
- **submits.js** - Paper/abstract submissions
- **submitstatuses.js** - Submission status tracking
- **submitreviewers.js** - Reviewer assignments

#### Review & Grading System
- **flowgrades.js** - Grade/score definitions  
- **flowgradescores.js** - Grade scoring criteria
- **submitgradings.js** - Review scores and comments

#### Forms & Content
- **formfields.js** - Dynamic form field definitions
- **entries.js** - Form submissions
- **entryvalues.js** - Form field values
- **sitepages.js** - CMS-style page content

#### Communication
- **pubmailtemplates.js** - Email templates
- **pubrolemessages.js** - Role-based messaging

#### System Tracking
- **logs.js** - Application logs
- **actionlogs.js** - User action audit trail

### Model Relationships
Models are interconnected through Sequelize associations defined in each model's `associate()` method, creating foreign key relationships for data integrity.

## API Routes Architecture

### Route Organization (routes/)
- **index.js:1** - Main router with authentication middleware and route mounting
- **auth.js** - User authentication (login, register, password reset)
- **users.js** - User management and role assignments  
- **pubs.js** - Publication management
- **submits.js** - Paper submission handling
- **reviewers.js** - Reviewer assignment and management
- **gradings.js** - Review scoring and grading
- **downloads.js** - File download handling
- **mail.js** - Email template management
- **sitepages.js** - Content management
- **sitepagessuper.js** - Super admin content management
- **acceptings.js** - Acceptance workflow handling

### Route Structure Pattern
1. **Authentication Check** - JWT-based authentication via Passport.js
2. **Site Resolution** - Multi-tenant site identification from request headers
3. **Permission Validation** - Role-based access control
4. **Business Logic** - Route-specific operations
5. **Response Formatting** - Standardized JSON responses via `utils.js`

### Utility Modules
- **dbutils.js** - Database helper functions
- **mailutils.js** - Email sending utilities

## Core Application Architecture

### Functional Programming Approach
The codebase follows a functional programming style with:
- **Utility Functions**: `utils.js:1` provides core response handlers (`returnOK`, `giveup`, `exterminate`)
- **Middleware Chain**: Express middleware for authentication, site resolution, and request processing
- **Async/Await**: Modern async patterns throughout the codebase

### Key Utility Functions
- **utils.js:23** - `returnOK()` - Standard success response formatter
- **utils.js:16** - `giveup()` - Standard error response handler  
- **utils.js:9** - `exterminate()` - Critical error handler
- **utils.js:43** - `asyncMail()` - Asynchronous email sending

### Background Task System
- **task.js:1** - Automated reminder email system
- Runs on configurable intervals to send review reminders
- Uses Handlebars templating for dynamic email content
- Tracks sent reminders to prevent duplicates

## Configuration Files

### Environment Configuration
- **.env** - Environment variables (database, JWT secrets, email settings)
- **package.json:1** - Project metadata, dependencies, and NPM scripts

### Testing Configuration  
- **jest.config.js:1** - Jest testing framework configuration
- **jest.setup.js** - Test environment setup
- **jest.once.js** - Global test setup

### Deployment Configuration
- **Dockerfile** - Container definition for Cloud Run deployment
- **.dockerignore** - Files excluded from container image
- ~~**Web.config**~~ - **DEPRECATED** - IIS configuration (legacy Windows deployment)
- ~~**PM2 ecosystem files**~~ - **DEPRECATED** - Legacy traditional server deployment

## Documentation & Testing

### Documentation Location
- **README.md:1** - Comprehensive setup and deployment guide
- **docs/** - Contains project assets (logos, images)
- **LICENCE** - MIT license
- This architecture document

### Testing Infrastructure
- **tests/** - Comprehensive test suite with ~40 test files
- **tests/testhelper.js** - Shared testing utilities
- **tests/maketestsite.js** - Test site setup
- **tests/runscript.js** - Test script runner
- **tests/files/** - Test file fixtures
- **scripts/tests/** - API test scenarios in JSON format

### Test Coverage
- Configured for comprehensive code coverage reporting
- Coverage reports generated in `coverage/` directory

## Development Workflow

### Getting Started
1. Clone repository and run `npm install`
2. Configure `.env` file with database and email settings  
3. Run `npm run dev` for development with hot reload
4. Run `npm test` for full test suite
5. Use `npm run standard` for code linting

### Key NPM Scripts
- `npm run dev` - Development server with console logging
- `npm run start` - Production server
- `npm test` - Run Jest test suite
- `npm run standard` - Code style checking

### Database Management
- Automatic table creation/updates via Sequelize sync
- Test database reset functionality for testing
- Migration-ready architecture (though currently using sync)

## Security Considerations

### Authentication & Authorization
- JWT-based authentication with configurable secrets
- Role-based access control throughout API
- Password hashing with bcrypt
- Request IP tracking and logging

### Data Protection
- SQL injection protection via Sequelize ORM
- CORS configuration for cross-origin requests
- Comprehensive request/response logging
- Audit trail via actionlogs table

### Email Security
- Configurable email transports (SMTP/sendmail)
- Email rate limiting and validation
- BCC functionality for administrative oversight

## Deployment Architecture

### Current Production Deployment: Google Cloud Run

**Target Architecture (Active Development):**
- **Platform**: Google Cloud Run (fully managed serverless containers)
- **Runtime**: Node.js 22 LTS in Docker container
- **Database**: Cloud SQL for MySQL 8.0
- **File Storage**: Google Cloud Storage (GCS)
- **Background Tasks**: Cloud Scheduler → HTTP endpoint
- **Logging**: Google Cloud Logging (stdout/stderr capture)
- **Scaling**: Automatic horizontal scaling (0 to N instances)
- **SSL/HTTPS**: Automatic via Cloud Run managed certificates
- **Cost**: ~$55-80/month (see CLOUD-RUN-README.md for details)

**Migration Documentation:**
- See **CLOUD-RUN-README.md** for migration overview
- See **CLOUD-RUN-MIGRATION-GUIDE.md** for complete technical guide
- See **ENVIRONMENT-PARITY-PLAN.md** for local/CI/production parity

### ~~Legacy: Traditional Server Deployment~~ **DEPRECATED**

The following deployment model is **no longer used** and maintained for historical reference only:

<details>
<summary>Click to expand legacy PM2 deployment details</summary>

**Legacy Requirements (No Longer Used):**
- Node.js runtime environment on physical/virtual server
- MySQL database server on localhost
- Process manager (PM2) for process lifecycle
- Reverse proxy (Apache/Nginx) for SSL and routing
- Manual SSL certificate management (Let's Encrypt)
- Local filesystem storage for uploaded documents
- Cron jobs or PM2 cron for background tasks

**Why Deprecated:**
- Manual server maintenance required
- No automatic scaling
- Single point of failure
- File storage not replicated
- Requires SSH access for deployments
- PM2 log management complexity

**Migration Status:** Completed migration to Cloud Run (see CLOUD-RUN-README.md)
</details>

### Multi-Tenant Support
- Site-based configuration in database
- Host header resolution for site identification
- Configurable settings per publication/site

This architecture supports a scalable, maintainable academic paper submission and review system with comprehensive workflow management, role-based access control, and automated communication features.