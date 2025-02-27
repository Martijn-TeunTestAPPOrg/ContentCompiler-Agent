import winston from "winston";
import { SimpleGit } from "simple-git";
import { Probot, Context } from "probot";
import { deleteFolderRecursive } from "./storageHelpers.js";


// Helper function to reset git configuration
export async function resetGitConfig(git: SimpleGit) {
    await git.cwd(process.cwd());
}

// Helper function to configure git
export async function configureGit(git: SimpleGit, gitAppName: string, gitAppEmail: string) {
    if (!gitAppName || !gitAppEmail) {
        throw new Error('Git app name or email not configured in environment variables');
    }

    // Set user info explicitly
    await git.addConfig("user.name", gitAppName, false, 'local');
    await git.addConfig("user.email", gitAppEmail, false, 'local');

    // Set committer info explicitly
    await git.addConfig("committer.name", gitAppName, false, 'local');
    await git.addConfig("committer.email", gitAppEmail, false, 'local');
}

// Helper function to clone a repo
export async function cloneRepo(app: Probot, logger: winston.Logger, git: SimpleGit, repo: string, targetDirectory: string) {
    try {
        // Remove the target directory if it exists
        deleteFolderRecursive(app, logger, targetDirectory);

        // Clones the repo to a specific folder
        await git.clone(repo, targetDirectory);
        logger.info(`Repo cloned successfully to ${targetDirectory}`);
    } catch (error: any) {
        logger.error(`Failed to clone repo ${repo}: ${error.message}`);
        throw error;
    }
}

// Helper function to checkout a branch
export async function checkoutBranch(logger: winston.Logger, git: SimpleGit, branch: string) {
    try {
        await git.checkout(branch);
        await git.pull('origin', branch);
        logger.info(`Checked out and pulled branch ${branch}`);
    } catch (error: any) {
        logger.error(`Failed to checkout or pull branch ${branch}: ${error.message}`);
        throw error;
    }
}

// Helper function to commit and push changes
export async function updateRemote(logger: winston.Logger, git: SimpleGit, branch: string, items: string[], message: string) {
    try {
        logger.info(`Committing and pushing changes to the ${branch} branch...`);

        // Ensure the remote URL is set correctly to SSH
        const remotes = await git.getRemotes(true);
        const originRemote = remotes.find(remote => remote.name === 'origin');

        if (!originRemote || !originRemote.refs.fetch.startsWith('git@github.com:')) {
            throw new Error(`Origin remote is missing or not using SSH. Found: ${originRemote?.refs.fetch}`);
        }

        await git.add(items);
        const status = await git.status();

        if (!status.isClean()) {
            await git.commit(message, undefined, {
                '--no-verify': null
            });
            await git.push('origin', branch);
            logger.info('Changes committed and pushed successfully');
        } else {
            logger.error(`No changes to commit to the ${branch} branch`);
        }
    } catch (error: any) {
        logger.error(`Failed to commit and push changes: ${error.message}`);
        throw error;
    }
}

// Helper function to see which files are changed in the PR
export async function getChangedFiles(logger: winston.Logger, git: SimpleGit, contentRootDir: string, baseBranch: string, headBranch: string) {
    try {
        logger.info(`Getting changed files between ${baseBranch} and ${headBranch}...`);

        // Fetch both branches to ensure we have the latest
        await git.cwd(contentRootDir).fetch(['origin', baseBranch]);
        await git.cwd(contentRootDir).fetch(['origin', headBranch]);
        
        // Get the diff between base and head
        const diff = await git.cwd(contentRootDir)
            .diff([`origin/${baseBranch}...origin/${headBranch}`, '--name-status']);
        
        // Parse the diff output into a more useful format
        return diff.split('\n')
            .filter(line => line.trim().length > 0)
            .map(line => {
                const [status, oldFilename, filename] = line.split('\t');
                
                // Handle renamed files (they have old and new names)
                if (status === 'R' || status.startsWith('R')) {
                    return {
                        filename,  // new name
                        oldFilename,  // old name
                        status: 'renamed'
                    };
                }

                // Handle added, modified, deleted, copied, unmerged, type_changed
                return {
                    filename: oldFilename,
                    status: status === 'A' ? 'added' :           // Added
                           status === 'M' ? 'modified' :         // Modified
                           status === 'D' ? 'deleted' :          // Deleted
                           status === 'C' ? 'copied' :           // Copied
                           status === 'U' ? 'unmerged' :         // Unmerged (conflict)
                           status === 'T' ? 'type_changed' :     // File type changed
                           status
                };
            });
    } catch (error) {
        logger.error(`Error getting PR changed files: ${error}`);
        throw error;
    }
}

// Helper function to see if the PR has illegal changes
export async function checkIllegalChanges(logger: winston.Logger, prNumber: number, changedFiles: { filename: string, status: string }[]) {
    logger.info(`Checking for illegal changes in PR ${prNumber}...`);

    // Get the report files from the environment
    const reportFiles = process.env.REPORT_FILES?.split(',') || [];

    // Filter out files that are not in the content directory or are in the report files
    // No changes outside the content directory are allowed and the report files are not allowed in content
    const illegalChangedFiles = changedFiles
        .filter(file => !file.filename.startsWith('content/') || reportFiles.some(reportFile => file.filename.startsWith(`content/${reportFile}`)))
        .map(file => `${file.filename} (${file.status})`);

    if (illegalChangedFiles.length > 0) {
        logger.warn(`Illegal changed files: `);
        logger.warn(illegalChangedFiles);
    }

    return illegalChangedFiles;
}

// Helper function to post a comment on the PR
export async function postPRReview(logger: winston.Logger, context: Context<'pull_request'>, repoOwner: string, repoName: string, prNumber: number, prEvent: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT', commentBody: string) {
    try {
        logger.info(`Posting comment on PR ${prNumber}...`);

        // Create a review requesting changes
        const review = await context.octokit.pulls.createReview({
            owner: repoOwner,
            repo: repoName,
            pull_number: prNumber,
            event: prEvent,
            body: commentBody
        });

        // Log the review ID
        logger.info(`Successfully posted comment with ID ${review.data.id}`);
    } catch (error: any) {
        logger.error(`Error posting comment: ${error}`);

        // Log the specific error details
        if (error instanceof Error) {
            logger.error(`Error message: ${error.message}`);
            logger.error(`Error stack: ${error.stack}`);
        }
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
export async function hideBotComments(logger: winston.Logger, context: Context<'pull_request'>, repoOwner: string, repoName: string, prNumber: number) {
	try {
		logger.info('Fetching all reviews on the PR...');
		const reviews = await context.octokit.paginate(
			context.octokit.pulls.listReviews,
			{
				owner: repoOwner,
				repo: repoName,
				pull_number: prNumber,
				per_page: 100,              // Fetch up to 100 reviews per page
			}
		);

		// Sort reviews by submitted_at in desc order
		reviews.sort((a, b) => new Date(b.submitted_at ?? 0).getTime() - new Date(a.submitted_at ?? 0).getTime());

		logger.info(`Fetched ${reviews.length} reviews on the PR`);

		// Filter out bot comments
		const botReviews = reviews.filter(review =>
			review.user?.login === process.env.GITHUB_APP_PR_NAME && 
			review.user?.type === "Bot"
		);

		logger.info(`Found ${botReviews.length} previous bot comments.`);

		// Hide all bot comments except the most recent one if it was posted in this run
		let count = 0;
		for (const review of botReviews) {
			if (count >= 8) {
				logger.info(`Hid 8 bot comments, stopping...`);
				break;
			}

			// Use GraphQL to minimize the review
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

			logger.info(`Minimized review with ID ${review.id}`);
			count++;
        }
    } catch (error: any) {
        logger.error(`Error hiding previous bot comments: ${error}`);

        // Log the specific error details
        if (error instanceof Error) {
            logger.error(`Error message: ${error.message}`);
            logger.error(`Error stack: ${error.stack}`);
        }
    }
}