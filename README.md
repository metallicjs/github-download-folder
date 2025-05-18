# Github Folder Downloader

A zero-config CLI tool to download specific folders from a GitHub repository — without cloning the whole repo.

Use the ***online web version*** here, https://download-folder.github.io/

## ✨ Features

- Download any subfolder from a GitHub repository ZIP
- Supports both full GitHub URLs and shorthand syntax (`owner/repo[#branch]`)
- Specify a custom target directory
- Automatically detects the default branch if none is specified
- Real-time file extraction progress with elegant terminal UI
- Safety checks to prevent accidental file overwrites
- Graceful error handling and cleanup
- Works with `npx` — no install required

## 📦 Installation

### Global

```bash
npm install -g folder-downloader@latest
```

### Local
```bash
npm install folder-downloader@latest

```

### Temporary via `npx`
```bash
npx folder-downloader@latest metallicjs/templates saas-lite
```

## 🚀 Usage
```bash
folder-downloader <repo> <subfolder> [target-folder]

```

You can use either of the following for <repo>:

 - Full GitHub URL (e.g. https://github.com/user/repo)

 - Shorthand syntax (e.g. user/repo or user/repo#branch)

### Arguments

| Argument          | Description                                                        |
| ----------------- | ------------------------------------------------------------------ |
| `<repo>`          | GitHub repository in full URL or shorthand (`owner/repo[#branch]`) |
| `<subfolder>`     | Subdirectory path in the repo to extract                           |
| `[target-folder]` | Optional: Where to save locally (defaults to subfolder name)       |


## 📘 Examples
### Download from default branch using shorthand
```bash
npx folder-downloader@latest metallicjs/templates saas-lite

```
### Download using full GitHub URL
```bash
npx folder-downloader@latest https://github.com/metallicjs/templates saas-lite

```

### Download from a specific branch
```bash
npx folder-downloader@latest metallicjs/templates#main saas-lite

```
### Download to a custom folder
```bash
npx folder-downloader@latest metallicjs/templates saas-lite my-app-folder

```

## ⚙️ How It Works
 1. Parses the repo input and identifies the branch (or fetches the default)

 2. Downloads the ZIP archive of the branch

 3. Extracts only the specified folder

 4. Writes extracted files to the chosen output directory

 5. Provides real-time file count and progress updates

 ## 🛡️ Safety Features
 1. Prevents overwriting existing files or folders

 2. Detects and blocks extraction if target is a non-empty directory

 3. Cleans up temporary files on failure

 4. Counts and reports total extracted files

 5. Detailed error messages for bad URLs or missing folders

 ## 🔧 Technical Details
### Dependencies
 - `chalk`: Colorful console output

 - `fs-extra`: File system utilities

 - `node-fetch`: HTTP requests

 - `ora`: Terminal spinners

 - `unzipper`: ZIP file streaming

### Dev Dependencies
 - TypeScript

 - tsup (bundler)

 - ts-node (for development)


 ## 🛠 Development

 ### Clone this repo
```bash
git clone https://github.com/yourusername/folder-downloader.git
```
### Install deps
```cd folder-downloader
npm install
```


## Scripts
`npm run build` – Build the project

`npm run dev` – Watch + build on changes

`npm run prepublishOnly` – Build before publish

## 📄 License
ISC

## 👤 Author
Kehinde Oke