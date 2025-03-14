import winston from "winston";
import { Context } from "probot";
import { exec } from "child_process";

// Configuration object
export const config = {
    gitAppName: process.env.GITHUB_USER_NAME || '',
    gitAppEmail: process.env.GITHUB_USER_EMAIL || '',
    compilerRepoUrl: process.env.COMPILER_REPO_URL || '',
    compilerDir: process.env.COMPILER_FOLDER || 'src/storage/content_compiler/compiler',
    contentRepoUrl: process.env.LEERLIJN_CONTENT_REPO_URL || '',
    datasetRepoUrl: process.env.DATASET_REPO_URL || '',
    datasetDir: process.env.DATASET_FOLDER || 'src/storage/content_compiler/dataset/',
    contentRootDir: process.env.CLONE_REPO_FOLDER || 'src/storage/content_compiler/content_repo',
    tempStorageDir: process.env.TEMP_STORAGE_FOLDER || 'src/storage/temp_storage',
    contentBuildDir: process.env.CLONE_REPO_BUILD_FOLDER || 'src/storage/content_compiler/content_repo/build',
    contentSourceFolder: process.env.CONTENT_SOURCE_FOLDER || 'src/storage/content_compiler/content_repo/content',
    tempDestinationBuildDir: process.env.TEMP_STORAGE_BUILD_FOLDER || 'src/storage/temp_storage/build',
    reportFiles: process.env.REPORT_FILES?.split(',') || [],
    contentSourceBranch: process.env.CONTENT_BRANCH || 'content',
    stagingBranch: process.env.STAGING_BRANCH || 'staging',
    mainCompileCommand: process.env.MAIN_COMPILE_COMMAND || 'python src/storage/content_compiler/compiler/runTest.py',
    preCompileCommand: process.env.PRE_COMPILE_COMMAND || 'python src/storage/content_compiler/compiler/runTest.py --skip-link-check',
};

// Function to handle errors
export function handleError(logger: winston.Logger, customMessage: string, error: any) {
    logger.error(customMessage);

    if (error instanceof Error) {
        logger.error(`Error message: ${error.message}`);
    }
    logger.error(`Error stack: ${error.stack}`);
    throw error;
}

// Helper function to check if the commit is from our app
export function isAppCommit(context: Context<'push'>) {
    const sender = context.payload.sender;
    const commits = context.payload.commits || [];

    // Check both the sender and the commit message
    return (sender && sender.type === 'Bot' && sender.login.includes('[bot]')) ||
           commits.some(commit => commit.message.includes('[bot-commit]') || commit.author.username?.includes('ContentCompiler'));
}

// Helper function to get payload information from the webhook
export function getPayloadInfo(context: Context<any>) {
    const payload = context.payload;
    const repoOwner = payload.repository.owner.login;
    const repoName = payload.repository.name;
    const action = payload.action;
    const user = payload.sender.login;

    return { repoOwner, repoName, action, user };
}

// Run the python parser
export async function compileContent(logger: winston.Logger, compileCommand: string) {    
    await new Promise<void>((resolve, reject) => {
        logger.info(`Content compilation process started...`);
        const pythonProcess = exec(compileCommand);
        
        let stdoutData = '';
        let stderrData = '';

        // Collect stdout data
        pythonProcess.stdout?.on('data', (data: any) => {
            stdoutData += data;
        });

        // Collect stderr data
        pythonProcess.stderr?.on('data', (data: any) => {
            stderrData += data;
        });

        // Handle process completion
        pythonProcess.on('close', (code: any) => {
            if (code === 0) {
                logger.info('Python script output:');

                if(stdoutData) {
                    logger.info(stdoutData);
                }
                if(stderrData) {
                    logger.info(stderrData);
                }

                logger.info(`Content compilation process completed`);
                resolve();
            } else {
                logger.error(`Python script failed with code ${code}`);
                logger.error(`Error output: ${stderrData}`);
                reject(new Error(`Python script failed with code ${code}`));
            }
        });
    });
}
