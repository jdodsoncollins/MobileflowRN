# Privacy

Mobileflow connects to Webflow after you authorize access through OAuth. The app uses the resulting token to load and modify data for sites available to your Webflow account.

## Data handling

- OAuth tokens use the platform secure credential store.
- Activity history, publish rate-limit state, and site agent instructions remain in local app storage.
- Agent instructions are not written to Webflow.
- Photo uploads send the image you select to Webflow for the selected site's asset library.
- The optional native planner processes command context on the device. Unsupported devices use the local heuristic planner.
- The OAuth token exchange passes through the configured token proxy. The client secret remains on that server.

Mobileflow does not include advertising or analytics SDKs in this repository. Webflow and the configured token proxy process requests under their own policies.

## Permissions

Mobileflow requests photo library access when you choose a photo to upload. It does not request microphone access. Android backups are disabled for app data.

## Deleting local data

Disconnect Webflow to remove the stored OAuth session. Removing the app clears its remaining local app data according to the operating system's behavior.

Questions can be filed through the repository's security contact for sensitive matters or its issue tracker for general privacy questions.
