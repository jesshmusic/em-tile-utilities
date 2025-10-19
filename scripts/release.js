#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

// Get version type from command line argument
const versionType = process.argv[2] || 'minor';

if (!['patch', 'minor', 'major'].includes(versionType)) {
  console.error('Invalid version type. Use: patch, minor, or major');
  process.exit(1);
}

// Read current versions
const packagePath = path.join(__dirname, '../package.json');
const modulePath = path.join(__dirname, '../module.json');
const changelogPath = path.join(__dirname, '../CHANGELOG.md');

const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const moduleJson = JSON.parse(fs.readFileSync(modulePath, 'utf8'));

// Parse current version
const currentVersion = packageJson.version;
const [major, minor, patch] = currentVersion.split('.').map(Number);

// Calculate new version
let newVersion;
switch (versionType) {
  case 'major':
    newVersion = `${major + 1}.0.0`;
    break;
  case 'minor':
    newVersion = `${major}.${minor + 1}.0`;
    break;
  case 'patch':
    newVersion = `${major}.${minor}.${patch + 1}`;
    break;
}

console.log(`Bumping version from ${currentVersion} to ${newVersion}`);

// Update package.json
packageJson.version = newVersion;
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');

// Update module.json
moduleJson.version = newVersion;
// Update download URL to match new version
moduleJson.download = `https://github.com/jesshmusic/em-tile-utilities/releases/download/v${newVersion}/module.zip`;
fs.writeFileSync(modulePath, JSON.stringify(moduleJson, null, 2) + '\n');

// Generate changelog
function getGitLog(fromTag) {
  try {
    const command = fromTag
      ? `git log ${fromTag}..HEAD --pretty=format:"%s" --no-merges`
      : `git log --pretty=format:"%s" --no-merges -20`;
    return execSync(command, { encoding: 'utf8' })
      .split('\n')
      .filter(line => line.trim());
  } catch (error) {
    console.warn('Could not get git log:', error.message);
    return [];
  }
}

function getLastTag() {
  try {
    return execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
  } catch (error) {
    return null;
  }
}

function categorizeCommits(commits) {
  const categories = {
    features: [],
    fixes: [],
    changes: [],
    other: []
  };

  commits.forEach(commit => {
    const lower = commit.toLowerCase();
    if (lower.startsWith('feat:') || lower.startsWith('feature:') || lower.includes('add ')) {
      categories.features.push(commit.replace(/^(feat|feature):\s*/i, ''));
    } else if (lower.startsWith('fix:') || lower.includes('fix ')) {
      categories.fixes.push(commit.replace(/^fix:\s*/i, ''));
    } else if (lower.startsWith('chore:') || lower.startsWith('refactor:') || lower.startsWith('update:')) {
      categories.changes.push(commit.replace(/^(chore|refactor|update):\s*/i, ''));
    } else if (!lower.startsWith('build:') && !lower.startsWith('ci:')) {
      categories.other.push(commit);
    }
  });

  return categories;
}

// Get commits since last tag
const lastTag = getLastTag();
const commits = getGitLog(lastTag);
const categories = categorizeCommits(commits);

// Read existing changelog or create new one
let changelog = '';
if (fs.existsSync(changelogPath)) {
  changelog = fs.readFileSync(changelogPath, 'utf8');
}

// Generate new changelog entry
const date = new Date().toISOString().split('T')[0];
let newEntry = `## [${newVersion}] - ${date}\n\n`;

if (categories.features.length > 0) {
  newEntry += `### Added\n`;
  categories.features.forEach(commit => {
    newEntry += `- ${commit}\n`;
  });
  newEntry += '\n';
}

if (categories.fixes.length > 0) {
  newEntry += `### Fixed\n`;
  categories.fixes.forEach(commit => {
    newEntry += `- ${commit}\n`;
  });
  newEntry += '\n';
}

if (categories.changes.length > 0) {
  newEntry += `### Changed\n`;
  categories.changes.forEach(commit => {
    newEntry += `- ${commit}\n`;
  });
  newEntry += '\n';
}

if (categories.other.length > 0) {
  newEntry += `### Other\n`;
  categories.other.forEach(commit => {
    newEntry += `- ${commit}\n`;
  });
  newEntry += '\n';
}

// Insert new entry at the top of changelog
if (!changelog.startsWith('# Changelog')) {
  changelog = '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n' + changelog;
}

const lines = changelog.split('\n');
const headerEndIndex = lines.findIndex((line, i) => i > 0 && line.startsWith('## '));
if (headerEndIndex > 0) {
  lines.splice(headerEndIndex, 0, newEntry);
} else {
  lines.push('\n' + newEntry);
}

changelog = lines.join('\n');
fs.writeFileSync(changelogPath, changelog);

console.log('✓ Updated package.json');
console.log('✓ Updated module.json');
console.log('✓ Updated CHANGELOG.md');
console.log(`\nNew version: ${newVersion}`);
