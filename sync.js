import fs from 'fs';
import https from 'https';
import path from 'path';
import { execSync } from 'child_process';

const username = process.env.LEETCODE_USERNAME || 'smani';
const readmePath = path.resolve('README.md');
const solvedJsonPath = path.resolve('leetcode-solved.json');

console.log(`Starting LeetCode sync for user: ${username}`);

// Helper to make HTTPS requests
function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Failed to parse JSON: ${e.message}`));
          }
        } else {
          reject(new Error(`Request failed with status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(postData);
    req.end();
  });
}

// Fetch user's recent submissions
async function fetchRecentSubmissions(username) {
  const query = JSON.stringify({
    query: `
      query userRecentSubmissions($username: String!, $limit: Int) {
        recentSubmissionList(username: $username, limit: $limit) {
          title
          titleSlug
          timestamp
          statusDisplay
          lang
        }
      }
    `,
    variables: { username, limit: 20 }
  });

  const options = {
    hostname: 'leetcode.com',
    path: '/graphql',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://leetcode.com/'
    }
  };

  const json = await makeRequest(options, query);
  return json.data?.recentSubmissionList || [];
}

// Fetch problem details (ID, Title, Difficulty)
async function fetchProblemDetails(titleSlug) {
  const query = JSON.stringify({
    query: `
      query questionData($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          questionFrontendId
          title
          difficulty
        }
      }
    `,
    variables: { titleSlug }
  });

  const options = {
    hostname: 'leetcode.com',
    path: '/graphql',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://leetcode.com/'
    }
  };

  const json = await makeRequest(options, query);
  return json.data?.question || null;
}

// Execute command helper
function runCmd(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch (err) {
    console.error(`Command failed: ${cmd}\nError: ${err.message}`);
    throw err;
  }
}

async function main() {
  // Load local solved cache
  let solvedDb = { solved: {} };
  if (fs.existsSync(solvedJsonPath)) {
    try {
      solvedDb = JSON.parse(fs.readFileSync(solvedJsonPath, 'utf8'));
      if (!solvedDb.solved) solvedDb.solved = {};
    } catch (e) {
      console.warn('Could not parse leetcode-solved.json, resetting database.');
    }
  }

  // Fetch recent submissions
  let submissions = [];
  try {
    submissions = await fetchRecentSubmissions(username);
  } catch (err) {
    console.error('Failed to fetch recent submissions:', err.message);
    process.exit(1);
  }

  // Filter for Accepted submissions
  const acceptedSubmissions = submissions.filter(sub => sub.statusDisplay === 'Accepted');
  console.log(`Found ${acceptedSubmissions.length} recent accepted submissions.`);

  if (acceptedSubmissions.length === 0) {
    console.log('No new accepted submissions to process.');
    process.exit(0);
  }

  // Group by titleSlug and sort chronologically (oldest first) so git commits follow the correct order
  const uniqueSubmissions = [];
  const seenSlugs = new Set();
  
  for (let i = acceptedSubmissions.length - 1; i >= 0; i--) {
    const sub = acceptedSubmissions[i];
    if (!seenSlugs.has(sub.titleSlug)) {
      seenSlugs.add(sub.titleSlug);
      uniqueSubmissions.push(sub);
    }
  }

  const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';

  if (isGitHubActions) {
    // Configure Git
    console.log('Configuring local Git credentials inside runner...');
    runCmd('git config --local user.email "github-actions[bot]@users.noreply.github.com"');
    runCmd('git config --local user.name "github-actions[bot]"');
  }

  let newSolvesCount = 0;

  for (const sub of uniqueSubmissions) {
    // Check if already in solved cache
    if (solvedDb.solved[sub.titleSlug]) {
      continue;
    }

    console.log(`Processing new solved problem: ${sub.title}...`);
    
    // Fetch detailed details (question ID, difficulty)
    let details = null;
    try {
      details = await fetchProblemDetails(sub.titleSlug);
    } catch (err) {
      console.error(`Failed to fetch details for ${sub.titleSlug}:`, err.message);
      continue;
    }

    if (!details) {
      console.warn(`Could not load details for slug: ${sub.titleSlug}`);
      continue;
    }

    const qNumber = details.questionFrontendId;
    const qTitle = details.title;
    const qDiff = details.difficulty;
    const qLang = sub.lang;
    const dateStr = new Date(parseInt(sub.timestamp) * 1000).toISOString().split('T')[0];

    // Mark as solved
    solvedDb.solved[sub.titleSlug] = {
      id: qNumber,
      title: qTitle,
      difficulty: qDiff,
      language: qLang,
      date: dateStr
    };
    newSolvesCount++;

    // Write updated database file
    fs.writeFileSync(solvedJsonPath, JSON.stringify(solvedDb, null, 2), 'utf8');

    // Update README.md list
    if (fs.existsSync(readmePath)) {
      let readme = fs.readFileSync(readmePath, 'utf8');
      const startTag = '<!-- LEETCODE_START -->';
      const endTag = '<!-- LEETCODE_END -->';
      const startIndex = readme.indexOf(startTag);
      const endIndex = readme.indexOf(endTag);

      if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
        // Build the table rows from solved database
        let tableRows = '';
        const sortedSolved = Object.values(solvedDb.solved).sort((a, b) => parseInt(a.id) - parseInt(b.id));
        
        for (const item of sortedSolved) {
          const diffEmoji = item.difficulty === 'Easy' ? '🟢' : item.difficulty === 'Medium' ? '🟡' : '🔴';
          tableRows += `| ${item.id} | ${item.title} | ${diffEmoji} ${item.difficulty} | \`${item.language}\` | ${item.date} |\n`;
        }

        const statsSection = `${startTag}
### 📊 My Solved Problems (${sortedSolved.length})

| Problem ID | Title | Difficulty | Language | Date Solved |
| :---: | :--- | :---: | :---: | :---: |
${tableRows}
*Last synced on: ${new Date().toUTCString()}*
${endTag}`;

        const updatedReadme = readme.substring(0, startIndex) + statsSection + readme.substring(endIndex + endTag.length);
        fs.writeFileSync(readmePath, updatedReadme, 'utf8');
      }
    }

    // Git Commit for this specific question
    const commitMsg = `"${qNumber}. ${qTitle}"`;
    console.log(`Committing: ${commitMsg}`);
    
    if (isGitHubActions) {
      runCmd('git add leetcode-solved.json README.md');
      runCmd(`git commit -m ${commitMsg}`);
    } else {
      console.log(`[Local Simulation] Would run: git commit -m ${commitMsg}`);
    }
  }

  if (newSolvesCount > 0) {
    console.log(`Successfully committed ${newSolvesCount} new solved problems.`);
    if (isGitHubActions) {
      console.log('Pushing updates to GitHub remote branch...');
      runCmd('git push origin main');
    } else {
      console.log('[Local Simulation] Would run: git push origin main');
    }
  } else {
    console.log('No new problems solved since last sync.');
  }
}

main();
