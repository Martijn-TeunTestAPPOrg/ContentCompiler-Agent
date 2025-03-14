import path from "path";
import * as fs from "fs";
import { SimpleGit } from "simple-git";
import { Probot, Context } from "probot";
import { createCustomLogger } from "../logger.js";
import { uploadLogToR2 } from "../helpers/r2Helper.js";
import { config, handleError, getPayloadInfo, compileContent } from "../helpers/globalHelpers.js";
import { clearTempStorage, deleteFolderRecursive, copySpecificFiles, copyFolder } from "../helpers/storageHelpers.js";
import { resetGitConfig, cloneRepo, configureGit, checkoutBranch, getChangedFiles, checkIllegalChanges, postPRReview, hideBotComments } from "../helpers/gitHelpers.js";


export const preCompile = async (app: Probot, context: Context<'pull_request'>, git: SimpleGit) => {
	const startTime = Date.now();
    const { logger, logFilePath } = createCustomLogger('preCompile');

	const { repoOwner, repoName, action, user } = getPayloadInfo(context);

	const payload = context.payload;
	const prNumber = payload.number;
	const baseBranch = payload.pull_request.base.ref;
	const headBranch = payload.pull_request.head.ref;

	let changedFiles: any[] = [];

    logger.info(`Pull request ${prNumber} ${action} for ${repoOwner}/${repoName} initiated by ${user}`);
    logger.info(`Base branch: ${baseBranch}`);
    logger.info(`Head branch: ${headBranch}`);

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

	// Step 6: Hide previous bot comments before posting a new one
	await hideBotComments(logger, context, repoOwner, repoName, prNumber);

	// Step 7: Checkout to the 'head' branch
	await checkoutBranch(logger, git, headBranch);

    // Step 8: Get the changed files in the PR
    changedFiles = await getChangedFiles(logger, git, config.contentRootDir, baseBranch, headBranch);

	// Step 9: Check for illegal changed files
	const illegalChangedFiles: string[] = await checkIllegalChanges(logger, prNumber, changedFiles);

    // Step 9.1: Post a review if there are illegal changes
    if (illegalChangedFiles.length > 0) {
        const formattedFiles = illegalChangedFiles.join('\n');
        const commentBody = `# **Aanpassingen buiten content gevonden, niet toegestaan!** \n ## Gevonden bestanden: \n \`\`\` \n ${formattedFiles} \n \`\`\` \n\n Gelieve alleen aanpassingen te maken in de content map.`;
        await postPRReview(logger, context, repoOwner, repoName, prNumber, 'REQUEST_CHANGES', commentBody);
    }

    // Step 10: Copy the changed files to the storage folder
	await copySpecificFiles(logger,
		changedFiles
			.filter(({ status }) => 
				['added', 'modified', 'renamed', 'copied', 'type_changed'].includes(status)
			)
			.map(({ filename }) => filename), 
		config.contentRootDir, config.tempStorageDir);

	// Step 11: Remove the cloned repository
	try {
		logger.info('Removing the cloned repository...');
		await deleteFolderRecursive(app, logger, config.contentRootDir);
	} catch (error) {
		handleError(logger, 'Failed to remove cloned repository', error);
	}

	// Step 12: Move the temp storage folder to the cloned repo folder
	logger.info('Moving the temp storage folder to the cloned repo folder...');
	await copyFolder(logger, config.tempStorageDir, config.contentRootDir);

	// Step 12.1: Create the content source folder if it doesn't exist
	if(!fs.existsSync(config.contentSourceFolder)) {
		logger.warn("Content source folder does not exist. Creating so the script doesn't error...");
		fs.mkdirSync(config.contentSourceFolder, { recursive: true });
	}

	// Step 13: Compile the content
	await compileContent(logger, config.preCompileCommand);

	// Step 14: Create a review with the compiled content
	// Read the content report file and post it as a review body
	const reportPath = path.join(config.contentRootDir, 'content_report.md');
	const reportContent = fs.readFileSync(reportPath, 'utf8');
	const reviewAction = illegalChangedFiles.length > 0 ? 'REQUEST_CHANGES' : 'APPROVE';
	await postPRReview(logger, context, repoOwner, repoName, prNumber, reviewAction, reportContent);

	// Step 15: Remove the temp storage folder
	await clearTempStorage(app, logger, config.contentRootDir, config.tempStorageDir, config.datasetDir);

	logger.info('Pre-compile completed successfully');

	const endTime = Date.now();
	logger.info(`Execution time: ${(endTime - startTime) / 1000 }s`);

	
	// Upload logs to R2
	await uploadLogToR2(logger, logFilePath);
}
