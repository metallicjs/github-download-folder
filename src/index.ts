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

// Optional injected version
declare const __APP_VERSION__: string;

function getVersion() {
   return typeof __APP_VERSION__ !== 'undefined'
    ? __APP_VERSION__
    : JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf8')).version;
}

function printHelp() {
  console.log(`
${chalk.bold('GitHub Folder Downloader')}

Usage:
  ${chalk.cyan('github-folder-downloader')} <repo> <subfolder> [target-folder]

Examples:
  ${chalk.cyan('github-folder-downloader')} metallicjs/templates saas-lite
  ${chalk.cyan('github-folder-downloader')} metallicjs/templates#dev src/components ./my-folder
  ${chalk.cyan('github-folder-downloader')} https://github.com/user/repo/tree/main/src/lib ./lib-copy

Options:
  --help        Show help
  --version     Show version
`);
}

function parseGitHubUrl(input: string): {
  owner: string;
  repo: string;
  branch?: string;
  subfolder?: string;
} {
  const shorthandRegex = /^([\w.-]+)\/([\w.-]+)(?:#(.+))?$/;
  const fullRepoRegex = /github\.com\/(.+?)\/(.+?)(?:\.git)?(?:#(.+))?$/;
  const treeUrlRegex = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)$/;

  const treeMatch = input.match(treeUrlRegex);
  if (treeMatch) {
    const [, owner, repo, branch, subfolder] = treeMatch;
    return { owner, repo, branch, subfolder };
  }

  const shorthandMatch = input.match(shorthandRegex);
  if (shorthandMatch) {
    return {
      owner: shorthandMatch[1],
      repo: shorthandMatch[2],
      branch: shorthandMatch[3]
    };
  }

  const fullRepoMatch = input.match(fullRepoRegex);
  if (fullRepoMatch) {
    return {
      owner: fullRepoMatch[1],
      repo: fullRepoMatch[2],
      branch: fullRepoMatch[3]
    };
  }

  throw new Error('Invalid GitHub repo format. Use owner/repo[#branch] or full GitHub folder URL.');
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
    tempDir = path.join(os.tmpdir(), `gh-folder-${Date.now()}`);
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
         process.exitCode=1;
    return;
      }
      const files = await fs.readdir(outputDir);
      if (files.length > 0) {
        spinner.fail(`Directory ${chalk.red(outputDir)} already exists and is not empty.`);
         process.exitCode=1;
    return;
      }
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        spinner.fail(`Error checking target path: ${err.message}`);
         process.exitCode=1;
    return;
      }
    }

    await fs.ensureDir(tempDir);
    await fs.ensureDir(outputDir);

    const stream = res.body.pipe(unzipper.Parse({ forceStream: true }));
    let filesExtracted = 0;
    let matchedSomething = false;

    const normalizedSubfolder = subfolder.replace(/\/$/, '');

    for await (const entry of stream) {
      try {
        const filePath = entry.path;
        const relativePath = filePath.replace(prefix, '');

        if (
          relativePath === normalizedSubfolder ||
          relativePath.startsWith(normalizedSubfolder + '/')
        ) {
          matchedSomething = true;
          const localPath = path.join(outputDir, relativePath.replace(normalizedSubfolder + '/', ''));

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
        spinner.warn(`Failed to extract ${entry.path}: ${err.message}`);
      }
    }

    if (!matchedSomething) {
      spinner.fail(`Subfolder "${subfolder}" not found in repo.`);
      await fs.remove(tempDir).catch(() => {});
      process.exitCode=1;
    return
    }

    spinner.succeed(`Successfully downloaded ${chalk.cyan(subfolder)} to ${chalk.green(outputDir)} (${filesExtracted} files)`);

  } catch (error: any) {
    spinner.fail(error.message);
    if (tempDir) {
      await fs.remove(tempDir).catch(() => {});
    }
    process.exitCode=1;
    return

  }
}


// --- CLI Entry ---
async function main() {
  const [, , ...args] = process.argv;

  if (args.includes('--version')) {
    console.log(`github-folder-downloader v${getVersion()}`);
    process.exit(0);
  }

  if (args.includes('--help') || args.length === 0) {
    printHelp();
    process.exit(0);
  }

  try {
    const repoInput = args[0];
    const parsed = parseGitHubUrl(repoInput);
    let subfolder = parsed.subfolder;
    let target: string | undefined;

    if (!parsed.subfolder && args.length < 2) {
  console.error(chalk.red('Subfolder path is required.'));
  printHelp();
   process.exitCode=1;
    return;
}

    if (!subfolder) {
      subfolder = args[1];
      target = args[2];
    } else {
      target = args[1];
    }

    if (!subfolder || typeof subfolder !== 'string') {
      console.error(chalk.red('Subfolder path is required.'));
      printHelp();
       process.exitCode=1;
    return;
    }

    await downloadFolder({
      repoUrl: `${parsed.owner}/${parsed.repo}${parsed.branch ? `#${parsed.branch}` : ''}`,
      subfolder,
      target
    });

  } catch (err: any) {
    console.error(chalk.red('Error:'), err.message);
     process.exitCode=1;
    return;
  }
}

main();
