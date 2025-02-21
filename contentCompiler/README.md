# Content Compiler
## Project Structure
- **contentCompiler/**
  - **.env**: Environment variables configuration file.
  - **.env.example**: Example environment variables configuration file.
  - **Dockerfile**: Docker configuration for the app.
  - **docker-compose.yml**: Docker Compose configuration.
  - **lib/**: Compiled JavaScript files.
  - **src/**: Source TypeScript files.
    - **helpers.ts**: Contains various helper functions used throughout the app.
    - **index.ts**: Entry point for the app.
    - **mainCompile.ts**: Handles the main compilation process.
    - **preCompile.ts**: Handles the pre-compilation process.
    - **scripts/**: Contains Python scripts for content compilation.
      - **compileContent.py**: Main script for compiling content.
      - **config.py**: Configuration and global variables for the Python scripts.
  - **package.json**: Project metadata and dependencies.
  - **README.md**: This file.
  - **tsconfig.json**: TypeScript configuration file.
  - **vitest.config.ts**: Configuration for running tests with Vitest.

### Purpose and Structure
- **helpers.ts**: Provides utility functions such as cloning repositories, checking out branches, compiling content, and managing temporary storage.
- **index.ts**: Initializes the Probot app and sets up event handlers for GitHub events.
- **mainCompile.ts**: Defines the main compilation workflow triggered by push events.
- **preCompile.ts**: Defines the pre-compilation workflow triggered by pull request events.
- **scripts/compileContent.py**: Python script that processes and validates Markdown files, generates reports, and handles image references.
- **scripts/config.py**: Stores configuration settings and global state variables for the Python scripts.