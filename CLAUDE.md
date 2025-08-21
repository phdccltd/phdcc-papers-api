# PHDCC Papers API - Claude Code Context

## Architecture
For detailed technical architecture information, see [CLAUDE-architecture.md](./CLAUDE-architecture.md).
Imported to Claude memory via @CLAUDE-architecture.md

## Development Commands

### Testing
- `npm test` - Run full Jest test suite
- `npm run standard` - Code style checking

### Development
- `npm run dev` - Development server with hot reload
- `npm start` - Production server

### Database
- Uses Sequelize ORM with automatic table creation/sync
- SQLite for testing, MySQL for production
