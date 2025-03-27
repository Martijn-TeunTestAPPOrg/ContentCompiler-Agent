import { SimpleGit } from "simple-git";
import { Probot, Context } from "probot";
import { createCustomLogger } from "../logger.js";
import { uploadLogToR2 } from "../helpers/r2Helper.js";
import { config, getPayloadInfo, compileContent } from "../helpers/globalHelpers.js";
import { resetGitConfig, cloneRepo, configureGit, checkoutBranch, updateRemote } from "../helpers/gitHelpers.js";
import { clearTempStorage, deleteFolderRecursive, copySpecificFiles, copyFolder, deleteBuildFolder, deleteReports } from "../helpers/storageHelpers.js";


export const mainCompile = async (app: Probot, context: Context<'push'>, git: SimpleGit) => {
    const startTime = Date.now();
    const { logger, logFilePath } = createCustomLogger('mainCompile');

    const { repoOwner, repoName, user } = getPayloadInfo(context);
    logger.info(`Push event received for ${repoOwner}/${repoName}`);
    logger.info(`Push initiated by ${user}`);

    // Step 1: Reset the git configuration
    await resetGitConfig(git);

    // Step 2: Remove the temp folders
    await clearTempStorage(app, logger, config.contentRootDir, config.tempStorageDir, config.datasetDir, config.compilerDir);

    // Step 3: Clone the compiler
	await cloneRepo(app, logger, git, config.compilerRepoUrl, config.compilerDir);
    await git.cwd("src/storage/content_compiler/");
    await checkoutBranch(logger, git, "dev");

    await resetGitConfig(git);

    // Step 4: Clone the dataset
    await cloneRepo(app, logger, git, config.datasetRepoUrl, config.datasetDir);

    // Step 5: Clone the content repository
    await cloneRepo(app, logger, git, config.contentRepoUrl, config.contentRootDir);
    await git.cwd(config.contentRootDir);

    // Step 6: Sets the global git configuration
	await configureGit(git, config.gitAppName, config.gitAppEmail);

    // Step 7: Checkout to the 'content' branch
    await checkoutBranch(logger, git, config.contentSourceBranch);

    // Step 8: Compile the content
    await compileContent(logger, config.mainCompileCommand);

    // Step 9: Copy the reports to the storage folder
    await copySpecificFiles(logger, config.reportFiles, config.contentRootDir, config.tempStorageDir);

    // Step 10: Move build to temp_storage
    await copyFolder(logger, config.contentBuildDir, config.tempDestinationBuildDir);
    await deleteFolderRecursive(app, logger, config.contentBuildDir);

    // Step 11: Commit and push reports to the 'content' branch
    await updateRemote(logger, git, config.contentSourceBranch, config.reportFiles, "Reports updated");

    // Step 12: Checkout to the 'staging' branch
    await checkoutBranch(logger, git, config.stagingBranch);

    // Step 13: Remove the build directory from the 'staging' branch
    await deleteBuildFolder(app, logger, git, config.contentBuildDir);

    // Step 14: Remove the reports from the 'staging' branch
    await deleteReports(logger, git, config.contentRootDir, config.reportFiles);

    // Step 15: Move the build to the root of the repository
    await copyFolder(logger, config.tempDestinationBuildDir, config.contentBuildDir);
    await deleteFolderRecursive(app, logger, config.tempDestinationBuildDir);

    // Step 16: Move the reports to the root of the repository
    await copySpecificFiles(logger, config.reportFiles, config.tempStorageDir, config.contentRootDir);

    // Step 17: Commit and push the compiled files and reports to the 'staging' branch
    await updateRemote(logger, git, config.stagingBranch, [...config.reportFiles, 'build/'], "Compiled content updated");

    // Step 18: Remove the cloned repo directory
    await clearTempStorage(app, logger, config.contentRootDir, config.tempStorageDir, config.datasetDir, config.compilerDir);

    logger.info('Content compilation completed successfully!');
    const endTime = Date.now();
    logger.info(`Execution time: ${(endTime - startTime) / 1000 }s`);

    // Upload logs to R2
    await uploadLogToR2(logger, logFilePath);
}
