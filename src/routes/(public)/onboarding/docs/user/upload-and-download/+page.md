# Upload and download

## Uploads

In **Home**, open the **NEW** menu in the sidebar and choose **Upload file**. A dialog lets you pick one or more files; uploads run against the **storage provider** currently selected in the top bar.

Large uploads may use chunked upload endpoints on the server; progress is shown in the dialog. **All file types are accepted**, including custom extensions (for example `.blend`, `.myext`, or any dotted suffix). There is no allowlist or blocklist — uploads are limited only by size and auth. When the browser sends a generic type, MIME is inferred from the filename: known extensions map to standard types, unknown extensions use `application/x-{ext}`, and extensionless files use `application/octet-stream`. If an upload fails, the toast shows the JSON error message from the API.

## Downloads

From a file row, use the download action to fetch the file. For folders, the app may offer a **ZIP** download when supported by the server.

## Shared and Trash

**NEW** (including upload) is disabled in **Shared** and **Trash** with a short explanation in the UI. Switch back to **Home** to add content.
