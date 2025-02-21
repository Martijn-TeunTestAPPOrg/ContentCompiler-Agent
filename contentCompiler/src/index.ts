import { Probot } from "probot";
import { isAppCommit } from "./helpers.js";
import { preCompile } from "./preCompile.js";
import { mainCompile } from "./mainCompile.js";


export default (app: Probot) => {
	// Main compile
	app.on("push", async (context) => {
		// Skip if this is a commit from our app
		if (isAppCommit(context)) {
			return;
		}

		// Only proceed if the target branch is 'content'
		if (context.payload.ref === "refs/heads/content") {
			await mainCompile(app, context);
		}
	});

	// Pre compile
	app.on(["pull_request.opened", "pull_request.reopened", "pull_request.synchronize"], async (context) => {
		// Only proceed if the target branch is 'content'
		if (context.payload.pull_request.base.ref === 'content') {
			await preCompile(app, context);
		}
	});	
};
