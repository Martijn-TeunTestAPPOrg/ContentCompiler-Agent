# Content Compiler GitHub App

This repository contains a GitHub App built with Probot that automates the process of compiling and validating Markdown files based on taxonomy codes. The app listens to specific GitHub events and triggers pre-compilation and main compilation processes accordingly.

## Features
- **Pre-Compile**: Triggered on pull request events (`opened`, `reopened`, `synchronize`) targeting the `content` branch.
- **Main Compile**: Triggered on push events to the `content` branch.
- **Validation**: Ensures that only allowed files are changed and checks for unmerged files in pull requests.
- **Reporting**: Generates and commits reports to the repository.

## Getting Started
### Prerequisites
- Node.js
- npm
- A GitHub App with the necessary permissions and events configured

### Installation
1. Clone the repository:

2. Install dependencies:
    ```sh
    npm install
    ```

3. Create a `.env` file based on the .env.example file and fill in the required values:
    ```sh
    cp .env.example .env
    ```

### Building and Running

1. Build the project:
    ```sh
    npm run build
    ```

2. Start the app:
    ```sh
    npm start
    ```

## Configuration

The app is configured using environment variables. The following variables need to be set in the `.env` file:

- `WEBHOOK_PROXY_URL`
- `APP_ID`
- `PRIVATE_KEY`
- `WEBHOOK_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `INSTALLATION_ID`
- `GITHUB_APP_NAME=`
- `GITHUB_APP_EMAIL=`
- `CLONE_REPO_FOLDER=`
- `TEMP_STORAGE_FOLDER=`

## Usage
### Pre-Compile
The pre-compile process is triggered by pull request events (`opened`, `reopened`, `synchronize`) targeting the content branch. It performs the following steps:

1. Removes temporary folders.
2. Clones the repository.
3. Checks for changed files and validates them.
4. Compiles the content using a Python script.
5. Posts a review with the compiled content.

### Main Compile

The main compile process is triggered by push events to the content branch. It performs the following steps:

1. Removes temporary folders.
2. Clones the repository.
3. Compiles the content.
4. Copies reports to the storage folder.
5. Commits and pushes the compiled files and reports to the `staging` branch.


---

Made by
- Martijn Schuman
- Teun van der Kleij