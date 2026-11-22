# Publishing the simulator on GitHub Pages

The repository deploys itself. Every push to `main` runs **`.github/workflows/deploy.yml`**, which:

1. syntax-checks every JavaScript module
2. runs `python build.py`
3. copies the example circuits and the tutorial video into the site
4. publishes `dist/` to GitHub Pages

You only have to create the repository and switch Pages on once.

## 1. Create the repository on GitHub

1. Sign in at <https://github.com> → **+** (top right) → **New repository**.
2. Name: `control-lab-simulator` (any name works; it becomes part of the address).
3. Choose **Public**. GitHub Pages is free for public repositories.
4. Leave *Add a README*, *.gitignore* and *license* **unticked**, because this folder already has them.
5. Click **Create repository**.

## 2. Upload the files

### Option A: GitHub Desktop (no commands)

1. Install GitHub Desktop and sign in.
2. **File → Add local repository…** and choose this folder. If it says the folder isn't a Git repository, click **create a repository**, then **Create repository**.
3. Make sure the branch is called **main**. Rename it under **Branch → Rename** if needed.
4. Click **Publish repository**. Untick *Keep this code private* if you want the site public, and use the same name as in step 1.

### Option B: command line

From inside this folder:

```bash
git init -b main          # skip if the folder is already a repository
git add .
git commit -m "Control Lab simulator"
git remote add origin https://github.com/mohamed-belal-10/control-lab-simulator.git
git push -u origin main
```

> Don't upload the files by dragging them into the GitHub web page. Browsers often skip hidden folders, and the `.github/` folder holds the deployment workflow.

## 3. Turn on GitHub Pages

1. In the repository on GitHub, open **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Open the **Actions** tab and wait for **Deploy website** to show a green tick (about a minute). If it ran before Pages was switched on, click it → **Re-run all jobs**.
4. The address appears on the run and on **Settings → Pages**:
   `https://mohamed-belal-10.github.io/control-lab-simulator/`

The site also serves the example circuits at `/examples/*.ccs` and the tutorial at `/media/tutorial.mp4`.

## 4. Using your own fork

If you fork this repository, replace `mohamed-belal-10` in `README.md`, `CONTRIBUTING.md` and this file (the badges and the live link) with your GitHub user name, then commit and push.

## Updating the site

Edit the files in `src/`, check your change locally (`python build.py`, then open `dist/index.html`), and commit and push. The workflow publishes the new version automatically. The **Tests** workflow runs the browser test suite on every push and pull request.

## Troubleshooting

| Problem | Fix |
|---|---|
| The *Deploy website* run fails at **Deploy** with "Pages not enabled" | Do step 3 (Source: GitHub Actions), then re-run the workflow. |
| 404 at the address | Wait a minute after the first green run. Check that the address ends with the repository name and a `/`. |
| The workflow never starts | Check that the `.github/workflows/` folder was uploaded and that the branch is `main`. |
| Old version still showing | Hard-refresh the browser (<kbd>Ctrl</kbd>+<kbd>F5</kbd>). Pages caches for a few minutes. |
| The *Tests* workflow fails | Open the run log: each test prints PASS/FAIL with the reason. Run `python tests/test_simulator.py` locally. |
| **Trace with AI** is greyed out on the website | Expected. It needs the claude.ai environment. The automatic Circuit Check works everywhere. |
