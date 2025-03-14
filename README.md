# **Content Compiler GitHub App**

This repository contains a GitHub App built with Probot that automates the process of compiling and validating Markdown files based on taxonomy codes. The app listens to specific GitHub events and triggers pre-compilation and main compilation processes accordingly.

## **Features**
- **Pre-Compile**: Triggered on pull request events (`opened`, `reopened`, `synchronize`) targeting the `content` branch.
- **Main Compile**: Triggered on push events to the `content` branch.
- **Validation**: Ensures that only allowed files are changed and checks for unmerged files in pull requests.
- **Reporting**: Generates and commits reports to the repository.

## Manual compile
Download the dataset and place it in `src/storage/dataset`
The filename should be `dataset.xlsx`

Copy the md source content in `src/storage/content_repo`
^ also copy the content folder so the index.md should be in: `src/storage/content_repo/content/index.md`

Open a new terminal
1. `cd contentCompiler`
2. Run `python src/scripts/compileContent.py`

Copy the compiled build folders and push them to staging and main

## **Getting Started**
### **Prerequisites**
- Node.js
- npm
- A GitHub App with the necessary permissions and events configured

### **Installation**
1. Clone the repository:

2. Install dependencies:
    ```sh
    npm install
    ```

3. Create a `.env` file based on the .env.example file and fill in the required values:
    ```sh
    cp .env.example .env
    ```

### **Building and Running**
1. Build the project:
    ```sh
    npm run build
    ```

2. Start the app:
    ```sh
    npm start
    ```

### **Docker**
1. Run the project with `docker compose up`

## **Configuration**
The app is configured using environment variables. The following variables need to be set in the `.env` file:

### App config
These environment variables are required to run the probot bot
- `WEBHOOK_PROXY_URL=`                              // This is the URL which the GitHub app posts a webhook request to, it activates this app
- `APP_ID=`                                         // The app id as seen in the GitHub app config
- `PRIVATE_KEY=`                                    // The private key which is configured in the GitHub app config
- `WEBHOOK_SECRET=`                                 // Secret for the webhook to secure communication, which is configured in the GitHub app config

### App config
These environment variables are required for the inner workings.
Some of these variables are already filled in `.env.example`

- `GITHUB_APP_PR_NAME=`                             // Name of the GitHub App which is shown in the preCompile PR comments, this has to be the same as the GitHub app name 
- `GITHUB_USER_NAME=`                               // Username of the custom GitHub account which is used for the commits
- `GITHUB_USER_EMAIL=`                              // Email of the custom GitHub account which is used for the commits
- `LEERLIJN_CONTENT_REPO_URL=`                      // URL for the leerlijn content repo, this has to be a SSH URL
- `DATASET_REPO_URL=`                               // URL for the leerlijn content dataset repo, this has to be a SSH URL
- `CLONE_REPO_FOLDER=`                              // Location where the leerlijn content repo is cloned to
- `CLONE_REPO_BUILD_FOLDER=`                        // Location where the build folder is, in the current version this is in a subdirectory of CLONE_REPO_FOLDER
- `TEMP_STORAGE_FOLDER=`                            // Location where the files are stored during the proces, this has to be outside of the cloned repo folder
- `TEMP_STORAGE_BUILD_FOLDER=`                      // Location where the build folder is, in the current version this is in a subdirectory of TEMP_STORAGE_FOLDER
- `DATASET_FOLDER=`                                 // Location where the dataset is cloned to
- `REPORT_FILES=`                                   // Names of the report files, separated by a comma
- `CONTENT_SRC_BRANCH=`                             // Name of the branch where the src md content is in
- `STAGING_BRANCH=`                                 // Name of the branch where the compiled files have to go to
- `MAIN_COMPILE_COMMAND=`                           // Command which is used to activate the Python mainCompile
- `PRE_COMPILE_COMMAND=`                            // Command which is used to activate the Python preCompile

## **Usage**
### **Pre-Compile**
The pre-compile process is triggered by pull request events (`opened`, `reopened`, `synchronize`) targeting the content branch. It performs the following steps:

1. Removes temporary folders.
2. Clones the repository.
3. Checks for changed files and validates them.
4. Compiles the content using a Python script.
5. Checks for illegal changed files (files outside of the `content` folder)
5.1 If found it posts a review
6. Posts a review with the contents of `content_report.md`

### **Main Compile**
The main compile process is triggered by push events to the content branch. It performs the following steps:

1. Removes temporary folders.
2. Clones the repository.
3. Compiles the content.
4. Commits and pushes the report to the `content` branch
5. Commits and pushes the compiled files and reports to the `staging` branch.


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
Move both the private (`id_rsa_github_bot`) and public (`id_rsa_github_bot.pub`) keys to the `.ssh` folder in the root of `contentCompiler`:  


### _Local testing_
Run:
```sh
mv id_rsa_github_bot* ~/.ssh/
```

#### **4. Test SSH Connection**  
Run:  
```sh
ssh -T git@github.com
```
Expected output:  
```sh
Hi [your-username]! You've successfully authenticated, but GitHub does not provide shell access.
```
If this fails, run to make a new SSH key:  
```sh
ssh -i ~/.ssh/id_rsa_github_bot -T git@github.com
```

---

Made by
- Martijn Schuman
- Teun van der Kleij