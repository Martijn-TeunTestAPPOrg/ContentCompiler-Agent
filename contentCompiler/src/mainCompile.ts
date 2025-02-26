import { SimpleGit } from "simple-git";
import { Probot, Context } from "probot";
import { getPayloadInfo, resetGitConfig, clearTempStorage, cloneRepo, configureGit, checkoutBranch, compileContent, deleteFolderRecursive, copySpecificFiles, copyFolder, updateRemote, deleteBuildFolder, deleteReports } from "./helpers.js";


const gitAppName: string = process.env.GITHUB_USER_NAME || '';
const gitAppEmail: string = process.env.GITHUB_USER_EMAIL || '';
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


export const mainCompile = async (app: Probot, context: Context<'push'>, git: SimpleGit) => {
    const startTime = Date.now();

    const { repoOwner, repoName } = getPayloadInfo(context);
    app.log.info(`Push event received for ${repoOwner}/${repoName}`);

    // Step 1: Reset the git configuration
    await resetGitConfig(git);

    // Step 2: Remove the temp folders
    await clearTempStorage(app, contentRootDir, tempStorageDir, datasetDir);

    // Step 3: Clone the dataset
    await cloneRepo(app, git, datasetRepoUrl, datasetDir);

    // Step 4: Clone the content repository
    await cloneRepo(app, git, contentRepoUrl, contentRootDir);
    await git.cwd(contentRootDir);

    // Step 5: Sets the global git configuration
	await configureGit(git, gitAppName, gitAppEmail);

    // Step 6: Checkout to the 'content' branch
    await checkoutBranch(app, git, contentSourceBranch);

    // Step 7: Compile the content
    await compileContent(app, compileCommand);

    // Step 8: Copy the reports to the storage folder
    await copySpecificFiles(app, reportFiles, contentRootDir, tempStorageDir);

    // Step 9: Move build to temp_storage
    await copyFolder(app, contentBuildDir, tempDestinationBuildDir);
    await deleteFolderRecursive(app, contentBuildDir);

    // Step 10: Commit and push reports to the 'content' branch
    await updateRemote(app, git, contentSourceBranch, reportFiles, "Reports updated");

    // Step 11: Checkout to the 'staging' branch
    await checkoutBranch(app, git, stagingBranch);

    // Step 12: Remove the build directory from the 'staging' branch
    await deleteBuildFolder(app, git, contentBuildDir);

    // Step 13: Remove the reports from the 'staging' branch
    await deleteReports(app, git, contentRootDir, reportFiles);

    // Step 14: Move the build to the root of the repository
    await copyFolder(app, tempDestinationBuildDir, contentBuildDir);
    await deleteFolderRecursive(app, tempDestinationBuildDir);

    // Step 15: Move the reports to the root of the repository
    await copySpecificFiles(app, reportFiles, tempStorageDir, contentRootDir);

    // Step 16: Commit and push the compiled files and reports to the 'staging' branch
    await updateRemote(app, git, stagingBranch, [...reportFiles, 'build/'], "Compiled content updated");

    // Step 17: Remove the cloned repo directory
    await clearTempStorage(app, contentRootDir, tempStorageDir, datasetDir);

    app.log.info('Content compilation completed successfully!');
    const endTime = Date.now();
    app.log.info(`Execution time: ${(endTime - startTime) / 1000 }s`);
}
