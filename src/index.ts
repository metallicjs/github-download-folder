import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import fetch from 'node-fetch';
import unzipper from 'unzipper';
import chalk from 'chalk';
import ora from 'ora';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


declare const __APP_VERSION__: string;


function getVersion() {
  try {
  
    return __APP_VERSION__;
  } catch (e) {
    // Fallback to reading from package.json directly
    const pkg = JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
    return pkg.version;
  }
}

function printHelp() {
  console.log(`
${chalk.bold('GitHub Folder Downloader')}

Usage:
  ${chalk.cyan('github-folder-downloader')} <repo> <subfolder> [target-folder]

Examples:
  ${chalk.cyan('github-folder-downloader')} metallicjs/templates saas-lite
  ${chalk.cyan('github-folder-downloader')} metallicjs/templates#dev src/components ./my-folder
  ${chalk.cyan('github-folder-downloader')} https://github.com/user/repo src/lib ./lib-copy

Options:
  --help        Show help
  --version     Show version
`);
}

function parseGitHubUrl2(url: string): { owner: string, repo: string, branch?: string } {
  const regex = /github\.com\/(.+?)\/(.+?)(?:\.git)?(?:#(.+))?$/;
  const match = url.match(regex);
  if (!match) throw new Error('Invalid GitHub repo URL.');
  return {
    owner: match[1],
    repo: match[2],
    branch: match[3] 
  };
}


function parseGitHubUrl(input: string): { owner: string, repo: string, branch?: string } {
  // Handle shorthand like metallicjs/templates[#branch]
  const shorthandRegex = /^([\w.-]+)\/([\w.-]+)(?:#(.+))?$/;
  const urlRegex = /github\.com\/(.+?)\/(.+?)(?:\.git)?(?:#(.+))?$/;

  let match = input.match(shorthandRegex);
  if (match) {
    return {
      owner: match[1],
      repo: match[2],
      branch: match[3]
    };
  }

  match = input.match(urlRegex);
  if (match) {
    return {
      owner: match[1],
      repo: match[2],
      branch: match[3]
    };
  }

  throw new Error('Invalid GitHub repo format. Use owner/repo[#branch] or full GitHub URL.');
}
async function getDefaultBranch(owner: string, repo: string): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
  if (!res.ok) throw new Error(`Failed to fetch repo metadata: ${res.statusText}`);
  const data = await res.json() as { default_branch: string };
  return data.default_branch;
  
}

async function downloadFolder({
  repoUrl,
  subfolder,
  target
}: {
  repoUrl: string;
  subfolder: string;
  target?: string;
}) {
  const spinner = ora('Preparing download...').start();
  let tempDir: string | null = null;

  try {
    const { owner, repo, branch } = parseGitHubUrl(repoUrl);
    const finalBranch = branch || await getDefaultBranch(owner, repo);
    const zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${finalBranch}.zip`;
   const tempDir = path.join(os.tmpdir(), `gh-folder-${Date.now()}`);
    const prefix = `${repo}-${finalBranch}/`;

    spinner.text = `Fetching ZIP from ${chalk.cyan(branch ? `${branch}` : `default branch`)}`;

    const res = await fetch(zipUrl);
    if (!res.ok) throw new Error(`Failed to download ZIP: ${res.statusText}`);
    if (!res.body) throw new Error("Error fetching data");
 
    const defaultDirName = path.basename(subfolder.replace(/\/$/, '')) || 'downloaded-folder';
    const outputDir = path.resolve(process.cwd(), target || defaultDirName);

    try {

      const stats = await fs.stat(outputDir);
      if (stats.isFile()) {
        spinner.fail(`Target ${chalk.red(outputDir)} exists as a file. Please remove it or choose another name.`);
        process.exit(1);
      }
      const files = await fs.readdir(outputDir);
      if (files.length > 0) {
        spinner.fail(`Directory ${chalk.red(outputDir)} already exists and is not empty.`);
        process.exit(1);
      }
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        spinner.fail(`Error checking target path: ${err.message}`);
        process.exit(1);
      }
    }

    await fs.ensureDir(tempDir);
    await fs.ensureDir(outputDir);

    const stream = res.body.pipe(unzipper.Parse({ forceStream: true }));
    let filesExtracted = 0;
    let hasErrors = false;

    for await (const entry of stream) {
      try {
        const filePath = entry.path;
        const relativePath = filePath.replace(prefix, '');

        if (relativePath.startsWith(subfolder + '/')) {
          const localPath = path.join(outputDir, relativePath.replace(subfolder + '/', ''));

          if (entry.type === 'Directory') {
            await fs.ensureDir(localPath);
          } else {
            await fs.ensureDir(path.dirname(localPath));
            await new Promise((resolve, reject) => {
              entry.pipe(fs.createWriteStream(localPath))
                .on('finish', resolve)
                .on('error', reject);
            });
            filesExtracted++;
            spinner.text = `Extracted ${filesExtracted} files...`;
          }
        } else {
          entry.autodrain();
        }
      } catch (err: any) {
        hasErrors = true;
        spinner.warn(`Failed to extract ${entry.path}: ${err.message}`);
      }
    }

    if (hasErrors) {
      spinner.warn(`Download completed with some errors. Check output above.`);
    } else {
      spinner.succeed(`Successfully downloaded ${chalk.cyan(subfolder)} to ${chalk.green(outputDir)} (${filesExtracted} files)`);
    }

  } catch (error: any) {
    spinner.fail(error.message);
    if (tempDir) {
      await fs.remove(tempDir).catch(() => {});
    }
    process.exit(1);
  }
}

// --- CLI Handling ---
const [, , ...args] = process.argv;

if (args.includes('--version')) {
  console.log(`folder-downloader v${getVersion()}`);
  process.exit(0);
}

if (args.includes('--help') || args.length === 0) {
  printHelp();
  process.exit(0);
}

const [ repoUrl, subfolder, target ] = args;

if (!repoUrl || !subfolder) {
  console.error(chalk.red('Missing required arguments.'));
  printHelp();
  process.exit(1);
}

downloadFolder({ repoUrl, subfolder, target });
