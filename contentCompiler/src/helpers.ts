import path from "path";
import * as fs from "fs";
import { createHash } from "crypto";
import { exec } from "child_process";
import { Probot, Context } from "probot";

// Helper function to check if the commit is from our app
export function isAppCommit(context: Context<'push'>) {
    const sender = context.payload.sender;
    const commits = context.payload.commits || [];
    
    // Check both the sender and the commit message
    return (sender && sender.type === 'Bot' && sender.login.endsWith('[bot]')) ||
           commits.some(commit => commit.message.includes('[bot-commit]'));
}

// Helper function to get default configuration values
export function getPayloadInfo(context: Context<any>) {
    const payload = context.payload;
    const repoOwner = payload.repository.owner.login;
    const repoName = payload.repository.name;

    return { repoOwner, repoName };
}

// Helper function to clear temp storage
export function clearTempStorage(app: Probot, contentRootDir: string, tempStorageDir: string, datasetDir: string) {
    try {
        app.log.info('Clearing temp folders...');

        // Remove the content_repo folder if it exists
        if (fs.existsSync(contentRootDir)) {
            deleteFolderRecursive(app, contentRootDir);
        }
        fs.mkdirSync(contentRootDir, { recursive: true });
        app.log.info(`Created ${contentRootDir}`);

        // Remove the content_repo folder if it exists
        if (fs.existsSync(tempStorageDir)) {
            deleteFolderRecursive(app, tempStorageDir);
        }
        fs.mkdirSync(tempStorageDir, { recursive: true });
        app.log.info(`Created ${tempStorageDir}`);

        // Remove the dataset folder if it exists
        if (fs.existsSync(datasetDir)) {
            deleteFolderRecursive(app, datasetDir);
        }
        fs.mkdirSync(datasetDir, { recursive: true });
        app.log.info(`Created ${datasetDir}`);
    } catch (error: any) {
        app.log.error(`Failed to remove temp folders: ${error.message}`);
        throw error;
    }
}

// Helper function to delete a folder recursively
export function deleteFolderRecursive(app: Probot, folderPath: string) {
    if (fs.existsSync(folderPath)) {
        fs.rmSync(folderPath, { recursive: true, force: true });
    } else {
        app.log.warn(`Folder ${folderPath} does not exist`);
    }
}

// Helper function to clone a repo
export async function cloneRepo(app: Probot, repo: string, targetDirectory: string) {
    try {
        // Check if the directory exists and remove it before cloning
        if (fs.existsSync(targetDirectory)) {
            app.log.info(`Removing existing directory: ${targetDirectory}`);
            fs.rmSync(targetDirectory, { recursive: true, force: true });
        }

        await new Promise<void>((resolve, reject) => {
            exec(`git clone ${repo} ${targetDirectory}`, (error: any, stdout: any, stderr: any) => {
                if (error) {
                    app.log.error(`Error cloning repo: ${stderr}`);
                    reject(new Error(`Error cloning repo: ${stderr}`));
                    return;
                }
                app.log.info(`Repository cloned successfully to ${targetDirectory}: ${stdout}`);
                resolve();
            });
        });

        // Ensure all branches are fetched
        await new Promise<void>((resolve, reject) => {
            //@ts-ignore
            exec(`cd ${targetDirectory} && git fetch --all`, (error: any, stdout: any, stderr: any) => {
                if (error) {
                    app.log.error(`Error fetching branches: ${stderr}`);
                    reject(new Error(`Error fetching branches: ${stderr}`));
                    return;
                }
                app.log.info(`Fetched all branches for: ${repo}`);
                resolve();
            });
        });
    } catch (error: any) {
        app.log.error(`Failed to clone repo ${repo}: ${error.message}`);
        throw error;
    }
}

export async function checkoutBranch(app: Probot, branch: string, targetDirectory: string) {
    try {
        await new Promise<void>((resolve, reject) => {
            exec(`cd ${targetDirectory} && git fetch --all`, (error: any, stdout: any, stderr: any) => {
                if (error) {
                    app.log.error(`Error fetching branches before checkout: ${stderr}`);
                    reject(new Error(`Error fetching branches before checkout: ${stderr}`));
                    return;
                }
                app.log.info(`Fetched all branches before checkout: ${stdout}`);
                resolve();
            });
        });

        await new Promise<void>((resolve, reject) => {
            //@ts-ignore
            exec(`cd ${targetDirectory} && git checkout -b ${branch} origin/${branch}`, (error: any, stdout: any, stderr: any) => {
                if (error) {
                    app.log.error(`Failed to checkout branch ${branch}: ${stderr}`);
                    reject(new Error(`Failed to checkout branch ${branch}: ${stderr}`));
                    return;
                }
                app.log.info(`Checked out branch ${branch}`);
                resolve();
            });
        });

    } catch (error: any) {
        app.log.error(`Failed to checkout branch ${branch}: ${error.message}`);
        throw error;
    }
}

// Run the python parser
export async function compileContent(app: Probot, compileCommand: string) {    
    await new Promise<void>((resolve, reject) => {
        app.log.info(`Content compilation process started...`);
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
                app.log.info('Python script output:');

                if(stdoutData) {
                    app.log.info(stdoutData);
                }
                if(stderrData) {
                    app.log.info(stderrData);
                }

                app.log.info(`Content compilation process completed`);
                resolve();
            } else {
                app.log.error(`Python script failed with code ${code}`);
                app.log.error(`Error output: ${stderrData}`);
                reject(new Error(`Python script failed with code ${code}`));
            }
        });
    });
}

// Helper function to copy specific files from one directory to another
export async function copySpecificFiles(app: Probot, files: string[], srcDir: string, destDir: string) {
    try {
        app.log.info(`Copying files from ${srcDir} to ${destDir}...`);

        // Ensure destination directory exists
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        
        for (const file of files) {
            const sourcePath = path.join(srcDir, file);
            const destinationPath = path.join(destDir, file);

            // Ensure the destination directory for the file exists
            const destinationDir = path.dirname(destinationPath);
            if (!fs.existsSync(destinationDir)) {
                fs.mkdirSync(destinationDir, { recursive: true });
            }

            fs.copyFileSync(sourcePath, destinationPath);

            app.log.info(`Copied ${file} to ${destinationPath}`);
        }
    } catch (error: any) {
        app.log.error(`Failed to copy files: ${error.message}`);
        throw error;
    }
}

//Helper function to copy a folder recursively
export async function copyFolder(app: Probot, srcDir: string, destDir: string) {
    try {
        // Ensure destination directory exists
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        // Copy files and directories recursively
        fs.readdirSync(srcDir).forEach((file) => {
            const sourcePath = path.join(srcDir, file);
            const destinationPath = path.join(destDir, file);

            if (fs.lstatSync(sourcePath).isDirectory()) {
                copyFolder(app, sourcePath, destinationPath);
            } else {
                fs.copyFileSync(sourcePath, destinationPath);
            }
        });
    } catch (error: any) {
        app.log.error(`Failed to copy folder: ${error.message}`);
        throw error;
    }
}

export function listFiles(dirPath: string): string[] {
    let fileList: string[] = [];

    function readDirectory(directory: string) {
        const files = fs.readdirSync(directory);

        files.forEach((file) => {
            const fullPath = path.join(directory, file);

			if (fullPath.includes('.git')) {
				return;
			}

            if (fs.statSync(fullPath).isDirectory()) {
                readDirectory(fullPath);
            } else {
                fileList.push(fullPath);
            }
        });
    }

    readDirectory(dirPath);
    return fileList;
}

// Helper function to commit and push changes
//@ts-ignore
export async function updateRemote(app: Probot, context: Context<any>, branch: string, items: string[], message: string) {
    try {
        app.log.info(`Committing and pushing changes to the ${branch} branch...`);
    
        const { repoOwner, repoName } = getPayloadInfo(context);
        const installationId = context.payload.installation?.id;
        if (!installationId) {
            throw new Error('No installation ID found');
        }
  
        const octokit = await app.auth(installationId);
    
        // Step 1: Get the latest commit SHA of the branch
        const { data: refData } = await octokit.rest.git.getRef({
            owner: repoOwner,
            repo: repoName,
            ref: `heads/${branch}`,
        });
        const latestCommitSha = refData.object.sha;
  
        // Step 2: Get the tree associated with the latest commit
        const { data: commitData } = await octokit.rest.git.getCommit({
            owner: repoOwner,
            repo: repoName,
            commit_sha: latestCommitSha,
        });
        const baseTreeSha = commitData.tree.sha;
  
        // Step 3: Get the current tree structure
        const { data: baseTreeData } = await octokit.rest.git.getTree({
            owner: repoOwner,
            repo: repoName,
            tree_sha: baseTreeSha,
            recursive: 'true',
        });
    
        // Map existing files in the repository
        const existingFiles = new Map(
            baseTreeData.tree.map((item) => [item.path, item.sha])
        );
  
        const baseDir = path.normalize(
            process.env.CLONE_REPO_FOLDER || 'src/storage/content_repo'
        );
    
        // Track files to be included in the new tree
        const treeEntries = [];
  
        // Step 4: Process each local file
        for (const file of items) {
            const relativePath = path.relative(baseDir, file).replace(/\\/g, '/');

            const fileBuffer = await fs.readFileSync(file);

            // Detect if the file is binary
            const isBinary = fileBuffer.includes(0); // A binary file typically contains NULL bytes (0)

            // If it's a text file, normalize line endings
            let normalizedBuffer = fileBuffer;
            if (!isBinary) {
                const fileContentLF = fileBuffer.toString('utf-8').replace(/\r\n/g, '\n');
                normalizedBuffer = Buffer.from(fileContentLF, 'utf-8');
            }

            // Compute hash with original content
            const originalBlobHash = createHash('sha1')
                .update(`blob ${fileBuffer.length}\0`)
                .update(fileBuffer)
                .digest('hex');

            // Compute hash with LF-normalized content (only for text files)
            const normalizedBlobHash = isBinary
                ? originalBlobHash  // Binary files don't need a second hash
                : createHash('sha1')
                    .update(`blob ${normalizedBuffer.length}\0`)
                    .update(normalizedBuffer)
                    .digest('hex');

            // Compare against Git’s stored hash
            const existingHash = existingFiles.get(relativePath);

            if (existingHash === originalBlobHash || existingHash === normalizedBlobHash) {
                // File hasn't changed; retain the existing reference
                treeEntries.push({
                    path: relativePath,
                    mode: '100644' as "100644",
                    type: 'blob' as "blob",
                    sha: existingFiles.get(relativePath),
                });
                existingFiles.delete(relativePath);
                continue;
            } else {
                console.log('File has changed or is new; create a new blob:');
                console.log({
                    "File path": relativePath,
                    "originalBlobHash": originalBlobHash,
                    "normalizedBlobHash": normalizedBlobHash,
                    "existing hash": existingHash,
                });
            }

            // Handle encoding for GitHub API
            const content = isBinary
                ? fileBuffer.toString('base64')  // Keep binary files in base64
                : normalizedBuffer.toString('utf-8');  // Use UTF-8 for text files
            const encoding = isBinary ? 'base64' : 'utf-8';

            // Create new blob in GitHub
            const { data: blobData } = await octokit.rest.git.createBlob({
                owner: repoOwner,
                repo: repoName,
                content,
                encoding,
            });

            treeEntries.push({
                path: relativePath,
                mode: '100644' as "100644",
                type: 'blob' as "blob",
                sha: blobData.sha,
            });

            // Remove from existing files map to track deletions
            existingFiles.delete(relativePath);
        }
  
        // Step 5: Handle deletions: remaining files in existingFiles are deleted locally
        //@ts-ignore
        for (const [filePath, sha] of existingFiles) {
            // Exclude these files from the new tree to delete them
            app.log.info(`File marked for tree removal since it hasn't changed: ${filePath}`);

            treeEntries.push({
                path: filePath,
                mode: '100644' as "100644",
                type: 'blob' as "blob",
                sha: null, // This tells GitHub to delete the file
            });
        }
    
        if (treeEntries.length === 0) {
            app.log.info('No changes detected. Skipping commit.');
            return;
        }
  
        // Step 6: Create a new tree
        const { data: newTree } = await octokit.rest.git.createTree({
            owner: repoOwner,
            repo: repoName,
            tree: treeEntries,
            base_tree: baseTreeSha,
        });
    
        // Step 7: Create a new commit
        const { data: newCommit } = await octokit.rest.git.createCommit({
            owner: repoOwner,
            repo: repoName,
            message,
            tree: newTree.sha,
            parents: [latestCommitSha],
        });
  
        // Step 8: Update the branch reference to point to the new commit
        await octokit.rest.git.updateRef({
            owner: repoOwner,
            repo: repoName,
            ref: `heads/${branch}`,
            sha: newCommit.sha,
        });
    
      app.log.info(`Successfully committed changes to ${branch} branch.`);
    } catch (error: any) {
        app.log.error(`Failed to commit and push changes: ${error.message}`);
        throw error;
    }
}

// Helper function to delete the build folder
export async function deleteBuildFolder(app: Probot, contentBuildDir: string) {
    try {
        const resolvedContentBuildDir = path.resolve(contentBuildDir);
        app.log.info(`Removing the build directory from the staging branch: ${resolvedContentBuildDir}`);

        if (fs.existsSync(resolvedContentBuildDir)) {
            fs.rmSync(resolvedContentBuildDir, { recursive: true });
            deleteFolderRecursive(app, resolvedContentBuildDir);
            app.log.info(`Build directory ${resolvedContentBuildDir} removed successfully`);
        } else {
            app.log.warn(`Build directory ${resolvedContentBuildDir} does not exist!`);
        }
    } catch (error: any) {
        app.log.error(`Failed to remove the build directory from the staging branch: ${error.message}`);
        throw error;
    }
}

// Helper function to delete the reports
export async function deleteReports(app: Probot, fileDir: string, reportFiles: string[]) {
    try {
        app.log.info('Removing the reports from the staging branch...');

        for (const file of reportFiles) {
            // Get the resolved file path since the reportFiles array contains only the file names
            const resolvedFilePath = path.resolve(fileDir, file);
            if (fs.existsSync(resolvedFilePath)) {
                // Unlink and remove the file
                fs.unlinkSync(resolvedFilePath);
                app.log.info(`Report ${resolvedFilePath} removed successfully`);
            } else {
                app.log.error(`Report ${resolvedFilePath} does not exist!`);
            }
        }
    } catch (error: any) {
        app.log.error(`Failed to remove the reports from the staging branch: ${error.message}`);
        throw error;
    }
}

// Helper function to see which files are changed in the PR
export async function getChangedFiles(app: Probot, context: Context<'pull_request'>, baseBranch: string, headBranch: string) {
    try {
        app.log.info(`Getting changed files between ${baseBranch} and ${headBranch}...`);

        const { owner, repo, issue_number: pull_number } = context.issue();

        // Get the list of files changed in the pull request
        const { data: files } = await context.octokit.pulls.listFiles({
            owner,
            repo,
            pull_number,
        });

        // Parse the files into a more useful format
        return files.map(file => {
            const status = file.status;
            const filename = file.filename;
            const oldFilename = file.previous_filename;

            // Handle renamed files (they have old and new names)
            if (status === 'renamed') {
                return {
                    filename,                                   // new name
                    oldFilename,                                // old name
                    status: 'renamed'
                };
            }

            // Handle added, modified, deleted, copied, unmerged, type_changed
            return {
                filename,
                status: status === 'added' ? 'added' :           // Added
                       status === 'modified' ? 'modified' :      // Modified
                       status === 'removed' ? 'deleted' :        // Deleted
                       status === 'copied' ? 'copied' :          // Copied
                       status === 'unchanged' ? 'unmerged' :     // Unmerged (conflict)
                       status === 'changed' ? 'type_changed' :   // File type changed
                       status
            };
        });
    } catch (error) {
        app.log.error(`Error getting PR changed files: ${error}`);
        throw error;
    }
}

// Helper function to see if the PR has illegal changes
export async function checkIllegalChanges(app: Probot, prNumber: number, changedFiles: { filename: string, status: string }[]) {
    app.log.info(`Checking for illegal changes in PR ${prNumber}...`);

    const illegalChangedFiles = changedFiles
        .filter(file => !file.filename.startsWith('content/'))
        .map(file => `${file.filename} (${file.status})`);

    if (illegalChangedFiles.length > 0) {
        app.log.warn(`Illegal changed files: `);
        app.log.warn(illegalChangedFiles);
    }

    return illegalChangedFiles;
}

// Helper function to post a comment on the PR
export async function postPRReview(app: Probot, context: Context<'pull_request'>, repoOwner: string, repoName: string, prNumber: number, prEvent: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT', commentBody: string) {
    try {
        app.log.info(`Posting comment on PR ${prNumber}...`);

        // Create a review requesting changes
        const review = await context.octokit.pulls.createReview({
            owner: repoOwner,
            repo: repoName,
            pull_number: prNumber,
            event: prEvent,
            body: commentBody
        });

        // Log the review ID
        app.log.info(`Successfully posted comment with ID ${review.data.id}`);

        return review.data.id;
    } catch (error: any) {
        app.log.error(`Error posting comment: ${error}`);

        // Log the specific error details
        if (error instanceof Error) {
            app.log.error(`Error message: ${error.message}`);
            app.log.error(`Error stack: ${error.stack}`);
        }

        return undefined;
    }
}

// Helper function to hide previous bot comments
// A problem with this code is that when it hides a comment via graphql, it marks them with the classifier OUTDATED
// There's no way to do this via the Github API, so we have to use GraphQL`
// The problem with this is that the classifier is not visible in the API, so we can't check if a comment is already hidden
// This means that the code will hide all bot comments, even if they are already hidden
// To *solve* this problem, the code skips hiding the latest comments since these have already been hidden in a previous run
// This is done via the let count which is incremented for each hidden comment
// The code will only hide the first 10 comments, which is a workaround to prevent hiding all comments
// The comments are sorted by creation time in ascending order
// 10 is an arbitrary number, but it should be enough to prevent hiding all comments
// The real solution would be to use the API to check if a comment is already hidden, but this is not possible
// This is a workaround, not a solution
export async function hideBotComments(app: Probot, context: Context<'pull_request'>, repoOwner: string, repoName: string, prNumber: number, stepNineReviewId: number | undefined) {
    try {
        app.log.info('Fetching all reviews on the PR...');
		const reviews = await context.octokit.paginate(
			context.octokit.pulls.listReviews,
			{
			owner: repoOwner,
			repo: repoName,
			pull_number: prNumber,
			per_page: 100,
			}
		);

		// Sort reviews by submitted_at in desc order
		reviews.sort((a, b) => new Date(b.submitted_at ?? 0).getTime() - new Date(a.submitted_at ?? 0).getTime());

        app.log.info(`Fetched ${reviews.length} reviews on the PR`);

        // Filter out bot comments
        const botReviews = reviews.filter(review =>
            review.user?.login === process.env.GITHUB_BOT_NAME && 
            review.user?.type === "Bot"
        );

        app.log.info(`Found ${botReviews.length} previous bot comments.`);

        // Hide all bot comments except the most recent one if it was posted in this run
        let count = 0;
        for (const review of botReviews) {
            if (count >= 8) {
                app.log.info(`Hid 10 bot comments, stopping...`);
                break;
            }

            // Skip hiding the most recent comment if it was posted in this run
            if (stepNineReviewId !== undefined && review.id === stepNineReviewId) {
                app.log.info(`Skipping hiding most recent comment with ID ${review.id} since it was posted in this run`);
                continue;
            }

           //  Use GraphQL to minimize the review
            const query = `
                mutation MinimizeComment($id: ID!) {
                    minimizeComment(input: { subjectId: $id, classifier: OUTDATED }) {
                        clientMutationId
                    }
                }
            `;

            await context.octokit.graphql(query, {
                id: review.node_id,
            });

            app.log.info(`Minimized review with ID ${review.id}`);
            count++;
        }
    } catch (error: any) {
        app.log.error(`Error hiding previous bot comments: ${error}`);

        // Log the specific error details
        if (error instanceof Error) {
            app.log.error(`Error message: ${error.message}`);
            app.log.error(`Error stack: ${error.stack}`);
        }
    }
}