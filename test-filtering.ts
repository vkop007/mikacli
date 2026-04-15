import { FilterExpressionParser } from './src/core/output/filter-expression-parser.js';
import { transformOutput } from './src/core/output/output-transform.js';

// Test data
const testResult = {
  items: [
    {
      name: "autocli",
      stargazers_count: 1250,
      language: "TypeScript",
      watchers_count: 120
    },
    {
      name: "python-utils",
      stargazers_count: 234,
      language: "Python",
      watchers_count: 25
    },
    {
      name: "js-lib",
      stargazers_count: 89,
      language: "JavaScript",
      watchers_count: 5
    }
  ],
  meta: {
    count: 3,
    listKey: "items"
  }
};

console.log("=== TEST 1: Original Data ===");
console.log(JSON.stringify(testResult, null, 2));

console.log("\n=== TEST 2: Select Fields (name, stargazers_count) ===");
const selected = transformOutput(testResult, {
  select: ["name", "stargazers_count"]
});
console.log(JSON.stringify(selected, null, 2));

console.log("\n=== TEST 3: Filter (stargazers_count > 100) ===");
const filtered = transformOutput(testResult, {
  filter: "stargazers_count > 100"
});
console.log(JSON.stringify(filtered, null, 2));

console.log("\n=== TEST 4: Filter + Select (stars > 100 AND language = 'TypeScript', select name,language) ===");
const filteredSelected = transformOutput(testResult, {
  filter: 'stargazers_count > 100 AND language = "TypeScript"',
  select: ["name", "language"]
});
console.log(JSON.stringify(filteredSelected, null, 2));

console.log("\n=== TEST 5: Complex Filter (stars > 100 AND language = 'Python', select all) ===");
const pythonRepos = transformOutput(testResult, {
  filter: 'language = "Python" AND stargazers_count > 100'
});
console.log(JSON.stringify(pythonRepos, null, 2));

console.log("\n=== TEST 6: Direct Filter Evaluation ===");
const parser = new FilterExpressionParser('stargazers_count > 100');
const item = testResult.items[1];
console.log(`Testing "${item.name}" (${item.stargazers_count} stars) against "stargazers_count > 100"`);
console.log(`Result: ${parser.evaluate(item as Record<string, unknown>)}`);

const parser2 = new FilterExpressionParser('language = "JavaScript"');
console.log(`\nTesting "${item.name}" against 'language = "JavaScript"'`);
console.log(`Result: ${parser2.evaluate(item as Record<string, unknown>)}`);

console.log("\n✅ All tests completed!");
