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


## Github user config
You're off to a great start! Here are a few **missing steps** and improvements to make sure your colleagues can fully set up their bot authentication.  

---

### **🔹 What’s Missing?**  
✅ **Configuring SSH to use the key automatically**  
✅ **Setting up the correct Git username & email**  
✅ **Updating `~/.ssh/config` for easier SSH usage**  
✅ **Configuring Git to use SSH instead of HTTPS**  
✅ **Testing SSH-based Git operations (clone, commit, push)**  

---

### **🔹 Updated Steps for README**  

## **GitHub User Configuration for Bot Authentication**
### **1. Generate an SSH Key**  
Run the following command to create a new SSH key:  
```sh
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"
```
1.1 **Name the key**: `id_rsa_github_bot`  
1.2 **Leave the passphrase empty** when prompted  

### **2. Add the SSH Key to GitHub**  
Go to **GitHub.com → Settings → SSH and GPG keys → New SSH Key**, then:  
- **Title**: `BotAuth`  
- **Key Type**: `Authentication`  
- **Key**: Copy & paste the contents of `id_rsa_github_bot.pub`  

### **3. Move the Key to the Correct Location**  
Move both the private (`id_rsa_github_bot`) and public (`id_rsa_github_bot.pub`) keys to the `.ssh` folder:  
```sh
mv id_rsa_github_bot* ~/.ssh/
```

### **4. Test SSH Connection**  
Run:  
```sh
ssh -T git@github.com
```
Expected output:  
```sh
Hi [your-username]! You've successfully authenticated, but GitHub does not provide shell access.
```
If this fails, run:  
```sh
ssh -i ~/.ssh/id_rsa_github_bot -T git@github.com
```

---

Made by
- Martijn Schuman
- Teun van der Kleij