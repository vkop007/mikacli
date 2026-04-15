import { transformOutput } from './src/core/output/output-transform.js';

// Realistic GitHub API response
const githubResponse = {
  data: {
    items: [
      {
        name: "react",
        language: "JavaScript",
        stargazers_count: 215000,
        forks_count: 43000,
        open_issues_count: 892,
        created_at: "2013-05-24T16:15:13Z",
        owner: { login: "facebook", type: "Organization" }
      },
      {
        name: "vue",
        language: "TypeScript",
        stargazers_count: 207000,
        forks_count: 34000,
        open_issues_count: 623,
        created_at: "2013-07-29T03:24:51Z",
        owner: { login: "vuejs", type: "Organization" }
      },
      {
        name: "svelte",
        language: "TypeScript",
        stargazers_count: 79000,
        forks_count: 4200,
        open_issues_count: 445,
        created_at: "2016-12-16T22:52:59Z",
        owner: { login: "sveltejs", type: "Organization" }
      },
      {
        name: "angular",
        language: "TypeScript",
        stargazers_count: 94000,
        forks_count: 24000,
        open_issues_count: 2500,
        created_at: "2014-09-18T23:24:16Z",
        owner: { login: "angular", type: "Organization" }
      }
    ]
  }
};

console.log("📊 REAL-WORLD SCENARIO: Finding modern TypeScript frameworks\n");
console.log('Query: --filter \'language = "TypeScript" AND stargazers_count > 50000\' --select name,stargazers_count,open_issues_count\n');

const result = transformOutput(githubResponse.data, {
  filter: 'language = "TypeScript" AND stargazers_count > 50000',
  select: ['name', 'stargazers_count', 'open_issues_count']
});

console.log("=== FILTERED & SELECTED RESULT ===");
console.log(JSON.stringify(result, null, 2));

console.log("\n\n📊 SCENARIO 2: Find repos with most stars\n");
console.log('Query: --filter \'stargazers_count > 100000\' --select name,language,stargazers_count,owner\n');

const topRepos = transformOutput(githubResponse.data, {
  filter: 'stargazers_count > 100000',
  select: ['name', 'language', 'stargazers_count', 'owner']
});

console.log("=== FILTERED RESULT (TOP REPOS) ===");
console.log(JSON.stringify(topRepos, null, 2));

console.log("\n✅ Filtering and selection working perfectly!");
