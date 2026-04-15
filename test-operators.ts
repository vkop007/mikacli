import { FilterExpressionParser } from './src/core/output/filter-expression-parser.js';

const testCases = [
  // Comparison operators
  { expr: "stars > 100", data: { stars: 150 }, expected: true },
  { expr: "stars > 100", data: { stars: 50 }, expected: false },
  { expr: "stars >= 100", data: { stars: 100 }, expected: true },
  { expr: "stars < 100", data: { stars: 50 }, expected: true },
  { expr: "stars <= 100", data: { stars: 100 }, expected: true },
  { expr: "stars = 100", data: { stars: 100 }, expected: true },
  { expr: "stars != 100", data: { stars: 99 }, expected: true },

  // Text operators
  { expr: 'title CONTAINS "TypeScript"', data: { title: "Learn TypeScript" }, expected: true },
  { expr: 'title CONTAINS "Python"', data: { title: "Learn TypeScript" }, expected: false },
  { expr: 'name STARTS_WITH "auto"', data: { name: "autocli" }, expected: true },
  { expr: 'name ENDS_WITH "cli"', data: { name: "autocli" }, expected: true },

  // Logical operators
  { expr: 'stars > 100 AND language = "TypeScript"', data: { stars: 150, language: "TypeScript" }, expected: true },
  { expr: 'stars > 100 AND language = "Python"', data: { stars: 150, language: "TypeScript" }, expected: false },
  { expr: 'stars > 100 OR language = "Python"', data: { stars: 50, language: "Python" }, expected: true },
  { expr: 'stars > 100 OR language = "Python"', data: { stars: 50, language: "Java" }, expected: false },

  // Nested fields
  { expr: 'metrics.likes > 1000', data: { metrics: { likes: 1500 } }, expected: true },
  { expr: 'metrics.likes > 1000', data: { metrics: { likes: 500 } }, expected: false },

  // Temporal (basic test)
  { expr: 'created_at = "today"', data: { created_at: new Date().toISOString() }, expected: true },
];

console.log("=== COMPREHENSIVE FILTER TESTS ===\n");

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  try {
    const parser = new FilterExpressionParser(testCase.expr);
    const result = parser.evaluate(testCase.data as Record<string, unknown>);
    
    if (result === testCase.expected) {
      console.log(`✅ PASS: "${testCase.expr}"`);
      console.log(`   Data: ${JSON.stringify(testCase.data)}`);
      console.log(`   Result: ${result}\n`);
      passed++;
    } else {
      console.log(`❌ FAIL: "${testCase.expr}"`);
      console.log(`   Data: ${JSON.stringify(testCase.data)}`);
      console.log(`   Expected: ${testCase.expected}, Got: ${result}\n`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ ERROR: "${testCase.expr}"`);
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}\n`);
    failed++;
  }
}

console.log(`\n=== SUMMARY ===`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);

if (failed === 0) {
  console.log(`\n🎉 ALL TESTS PASSED!`);
  process.exit(0);
} else {
  process.exit(1);
}
