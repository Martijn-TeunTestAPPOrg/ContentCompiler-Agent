import path from "path";
import * as fs from "fs";
import { SimpleGit } from "simple-git";
import { Probot, Context } from "probot";
import { getPayloadInfo, clearTempStorage, cloneRepo, configureGit, checkoutBranch, compileContent, deleteFolderRecursive, copySpecificFiles, getChangedFiles, checkIllegalChanges, postPRReview, hideBotComments } from "./helpers.js";

// This variable is used to keep track of the steps that have been executed
var stepNineReviewId: number | undefined;

const gitAppName: string = process.env.GITHUB_APP_NAME || '';
const gitAppEmail: string = process.env.GITHUB_APP_EMAIL || '';
const contentRepoUrl: string = process.env.LEERLIJN_CONTENT_REPO_URL || '';
const datasetRepoUrl: string = process.env.DATASET_REPO_URL || '';
const datasetDir: string = process.env.DATASET_FOLDER || 'src/storage/dataset';
const contentRootDir: string = process.env.CLONE_REPO_FOLDER || 'src/storage/content_repo';
const tempStorageDir: string = process.env.TEMP_STORAGE_FOLDER || 'src/storage/temp_storage';
const compileCommand: string = process.env.PRE_COMPILE_COMMAND || 'python src/scripts/compileContent.py --skip-link-check';


export const preCompile = async (app: Probot, context: Context<'pull_request'>, git: SimpleGit) => {
    const startTime = Date.now();

    const { repoOwner, repoName, } = getPayloadInfo(context);
    
    const payload = context.payload;
    const prNumber = payload.number;
    const baseBranch = payload.pull_request.base.ref;
    const headBranch = payload.pull_request.head.ref;
    
    let changedFiles: any[] = [];

    app.log.info(`Pull request ${prNumber} opened for ${repoOwner}/${repoName}`);
    app.log.info(`Base branch: ${baseBranch}`);
    app.log.info(`Head branch: ${headBranch}`);

    // Step 1: Remove the temp folders
    await clearTempStorage(app, contentRootDir, tempStorageDir, datasetDir);

    // Step 2: Clone the dataset
    await cloneRepo(app, git, datasetRepoUrl, datasetDir);

    // Step 3: Sets the global git configuration
    await configureGit(git, gitAppName, gitAppEmail);

    // Step 4: Clone the content repository
    await cloneRepo(app, git, contentRepoUrl, contentRootDir);
    await git.cwd(contentRootDir);

    // Step 5: Checkout to the 'head' branch
    await checkoutBranch(app, git, headBranch);

    // Step 6: Get the changed files in the PR
    changedFiles = await getChangedFiles(app, git, contentRootDir, baseBranch, headBranch);

    // Step 7: Check for illegal changed files
    const illegalChangedFiles: string[] = await checkIllegalChanges(app, prNumber, changedFiles);

    // Step 7.1: Post a review if there are illegal changes
    if (illegalChangedFiles.length > 0) {
        const formattedFiles = illegalChangedFiles.join('\n');
        const commentBody = `# **Aanpassingen buiten content gevonden, niet toegestaan!** \n ## Gevonden bestanden: \n \`\`\` \n ${formattedFiles} \n \`\`\` \n\n Gelieve alleen aanpassingen te maken in de content map.`;
        stepNineReviewId = await postPRReview(app, context, repoOwner, repoName, prNumber, 'REQUEST_CHANGES', commentBody);
    }

    // Step 8: Copy the changed files to the storage folder
    await copySpecificFiles(app, 
        changedFiles
            .filter(({ status }) => 
                ['added', 'modified', 'renamed', 'copied', 'type_changed'].includes(status)
            )
            .map(({ filename }) => filename), 
        contentRootDir, tempStorageDir);

    // Step 9: Remove the cloned repository
    try {
        app.log.info('Removing the cloned repository...');
        await deleteFolderRecursive(app, contentRootDir);
    } catch (error) {
        app.log.error(`Error deleting cloned repository: ${error}`);
        throw error;
    }

    // Step 10: Move the temp storage folder to the cloned repo folder
    try {
        app.log.info('Moving the temp storage folder to the cloned repo folder...');
        fs.renameSync(tempStorageDir, contentRootDir);
    } catch (error) {
        app.log.error(`Error moving temp storage folder: ${error}`);
        throw error;
    }

    // Step 11: Compile the content
    await compileContent(app, compileCommand);

    // Step 12: Hide previous bot comments before posting a new one
    await hideBotComments(app, context, repoOwner, repoName, prNumber, stepNineReviewId);

    // Step 13: Create a review with the compiled content
    // Read the content report file and post it as a review body
    const reportPath = path.join(contentRootDir, 'content_report.md');
    const reportContent = fs.readFileSync(reportPath, 'utf8');
    const action = illegalChangedFiles.length > 0 ? 'REQUEST_CHANGES' : 'APPROVE';
    await postPRReview(app, context, repoOwner, repoName, prNumber, action, reportContent);

    // Step 14: Remove the temp storage folder
    await clearTempStorage(app, contentRootDir, tempStorageDir, datasetDir);

    app.log.info('Pre-compile completed successfully');
    stepNineReviewId = undefined;

    const endTime = Date.now();
    app.log.info(`Execution time: ${(endTime - startTime) / 1000 }s`);
}
