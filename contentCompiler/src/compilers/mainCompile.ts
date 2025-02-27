import { SimpleGit } from "simple-git";
import { Probot, Context } from "probot";
import { createCustomLogger } from "../logger.js";
import { config, getPayloadInfo, compileContent } from "../helpers/globalHelpers.js";
import { resetGitConfig, cloneRepo, configureGit, checkoutBranch, updateRemote } from "../helpers/gitHelpers.js";
import { clearTempStorage, deleteFolderRecursive, copySpecificFiles, copyFolder, deleteBuildFolder, deleteReports } from "../helpers/storageHelpers.js";


export const mainCompile = async (app: Probot, context: Context<'push'>, git: SimpleGit) => {
    const startTime = Date.now();
    const logger = createCustomLogger('mainCompile');

    const { repoOwner, repoName, user } = getPayloadInfo(context);
    logger.info(`Push event received for ${repoOwner}/${repoName}`);
    logger.info(`Push initiated by ${user}`);

    // Step 1: Reset the git configuration
    await resetGitConfig(git);

    // Step 2: Remove the temp folders
    await clearTempStorage(app, logger, config.contentRootDir, config.tempStorageDir, config.datasetDir);

    // Step 3: Clone the dataset
    await cloneRepo(app, logger, git, config.datasetRepoUrl, config.datasetDir);

    // Step 4: Clone the content repository
    await cloneRepo(app, logger, git, config.contentRepoUrl, config.contentRootDir);
    await git.cwd(config.contentRootDir);

    // Step 5: Sets the global git configuration
	await configureGit(git, config.gitAppName, config.gitAppEmail);

    // Step 6: Checkout to the 'content' branch
    await checkoutBranch(logger, git, config.contentSourceBranch);

    // Step 7: Compile the content
    await compileContent(logger, config.mainCompileCommand);

    // Step 8: Copy the reports to the storage folder
    await copySpecificFiles(logger, config.reportFiles, config.contentRootDir, config.tempStorageDir);

    // Step 9: Move build to temp_storage
    await copyFolder(logger, config.contentBuildDir, config.tempDestinationBuildDir);
    await deleteFolderRecursive(app, logger, config.contentBuildDir);

    // Step 10: Commit and push reports to the 'content' branch
    await updateRemote(logger, git, config.contentSourceBranch, config.reportFiles, "Reports updated");

    // Step 11: Checkout to the 'staging' branch
    await checkoutBranch(logger, git, config.stagingBranch);

    // Step 12: Remove the build directory from the 'staging' branch
    await deleteBuildFolder(app, logger, git, config.contentBuildDir);

    // Step 13: Remove the reports from the 'staging' branch
    await deleteReports(logger, git, config.contentRootDir, config.reportFiles);

    // Step 14: Move the build to the root of the repository
    await copyFolder(logger, config.tempDestinationBuildDir, config.contentBuildDir);
    await deleteFolderRecursive(app, logger, config.tempDestinationBuildDir);

    // Step 15: Move the reports to the root of the repository
    await copySpecificFiles(logger, config.reportFiles, config.tempStorageDir, config.contentRootDir);

    // Step 16: Commit and push the compiled files and reports to the 'staging' branch
    await updateRemote(logger, git, config.stagingBranch, [...config.reportFiles, 'build/'], "Compiled content updated");

    // Step 17: Remove the cloned repo directory
    await clearTempStorage(app, logger, config.contentRootDir, config.tempStorageDir, config.datasetDir);

    logger.info('Content compilation completed successfully!');
    const endTime = Date.now();
    logger.info(`Execution time: ${(endTime - startTime) / 1000 }s`);
}
