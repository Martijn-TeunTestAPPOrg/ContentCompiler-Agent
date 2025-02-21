import { simpleGit } from "simple-git";
import { Probot, Context } from "probot";
import { getPayloadInfo, resetGit, getInstallationId, configureGit, clearTempStorage, cloneRepo, checkoutBranch, compileContent, deleteFolderRecursive, copySpecificFiles, copyFolder, updateRemote, deleteBuildFolder, deleteReports, listFiles } from "./helpers.js";


let git = simpleGit();
const gitAppName: string = process.env.GITHUB_APP_NAME || '';
const gitAppEmail: string = process.env.GITHUB_APP_EMAIL || '';
const contentRepoUrl: string = process.env.LEERLIJN_CONTENT_REPO_URL || '';
const contentSourceBranch: string = process.env.CONTENT_BRANCH || 'content';
const stagingBranch: string = process.env.STAGING_BRANCH || 'staging';
const datasetRepoUrl: string = process.env.DATASET_REPO_URL || '';
const datasetDir: string = process.env.DATASET_FOLDER || 'src/storage/dataset';
const reportFiles: string[] = process.env.REPORT_FILES?.split(',') || [];
const contentRootDir: string = process.env.CLONE_REPO_FOLDER || 'src/storage/content_repo';
const contentBuildDir: string = process.env.CLONE_REPO_BUILD_FOLDER || "src/storage/content_repo/build";
const tempStorageDir: string = process.env.TEMP_STORAGE_FOLDER || 'src/storage/temp_storage';
const tempDestinationBuildDir: string = process.env.TEMP_STORAGE_BUILD_FOLDER || 'src/storage/temp_storage/build';
const compileCommand: string = process.env.MAIN_COMPILE_COMMAND || 'python src/scripts/compileContent.py';


export const mainCompile = async (app: Probot, context: Context<'push'>) => {
    const startTime = Date.now();

    const { repoOwner, repoName } = getPayloadInfo(context);
    
    app.log.info(`Push event received for ${repoOwner}/${repoName}`);

    // Step 1: Reset git settings
    git = await resetGit(git);

    // Step 2: Get the installation token
    const token = await getInstallationId(app, context);

    // Step 3: Configure git context so it can push to the Leerlijn SE repo
    const remoteUrl = `https://x-access-token:${token}@github.com/${repoOwner}/${repoName}.git`;
    await configureGit(git, gitAppName, gitAppEmail);

    // Step 4: Remove the temp folders
    await clearTempStorage(app, contentRootDir, tempStorageDir, datasetDir);

    // Step 5: Clone the dataset
    await cloneRepo(app, git, datasetRepoUrl, datasetDir);

    // Step 6: Clone the content repository
    await cloneRepo(app, git, contentRepoUrl, contentRootDir);
    await git.cwd(contentRootDir);
    await git.remote(['set-url', 'origin', remoteUrl]);

    // Step 7: Checkout to the 'content' branch
    await checkoutBranch(app, git, contentSourceBranch);

    // Step 8: Compile the content
    await compileContent(app, compileCommand);

    // Step 9: Copy the reports to the storage folder
    await copySpecificFiles(app, reportFiles, contentRootDir, tempStorageDir);

    // Step 10: Move build to temp_storage
    await copyFolder(app, contentBuildDir, tempDestinationBuildDir);
    await deleteFolderRecursive(app, contentBuildDir);

    // Step 11: Commit and push reports to the 'content' branch
    const contentRootDirFiles = listFiles(contentRootDir);
    await updateRemote(app, context, contentSourceBranch, contentRootDirFiles, "Reports updated");

    // Step 12: Remove everything from content_repo
    try {
        app.log.info(`Removing cloned repository ${repoName}...`);
        await deleteFolderRecursive(app, contentRootDir);
    } catch (error: any) {
        app.log.error(`Failed to remove cloned repo: ${error.message}`);
        throw error;
    }

    // Step 13: Reset git settings
    git = await resetGit(git);

    // Step 14: Clone the content repository
    await cloneRepo(app, git, contentRepoUrl, contentRootDir);
    await git.cwd(contentRootDir);
    await git.remote(['set-url', 'origin', remoteUrl]);

    // Step 15: Checkout to the 'staging' branch
    await checkoutBranch(app, git, stagingBranch);

    // Step 16: Remove the build directory from the 'staging' branch
    await deleteBuildFolder(app, git, contentBuildDir);

    // Step 17: Remove the reports from the 'staging' branch
    await deleteReports(app, git, contentRootDir, reportFiles);

    // Step 18: Move the build to the root of the repository
    await copyFolder(app, tempDestinationBuildDir, contentBuildDir);
    await deleteFolderRecursive(app, tempDestinationBuildDir);

    // Step 19: Move the reports to the root of the repository
    await copySpecificFiles(app, reportFiles, tempStorageDir, contentRootDir);

    // Step 20: Commit and push the compiled files and reports to the 'staging' branch
    const stagingRootDirFiles = listFiles(contentRootDir);
    await updateRemote(app, context, stagingBranch, stagingRootDirFiles, "Compiled content updated");
    // await updateRemote(app, git, stagingBranch, [...reportFiles, 'build/'], "Compiled content updated");

    // Step 21: Remove the cloned repo directory
    await clearTempStorage(app, contentRootDir, tempStorageDir, datasetDir);

    app.log.info('Content compilation completed successfully!');

    const endTime = Date.now();
    const elapsedTime = (endTime - startTime) / 1000;
    app.log.info(`Elapsed time: ${elapsedTime} seconds`);
}
