const fs = require('fs');

let content = fs.readFileSync('server.js', 'utf8');

// 1. INTERVAL in seed data
content = content.replace(/CURRENT_DATE - INTERVAL '(\d+) days'/g, "date('now', '-$1 days')");
content = content.replace(/CURRENT_DATE/g, "date('now')");

// 2. Income vs Expense chart (by month, last 6 months)
// TO_CHAR(date, 'Mon YYYY') as period,
// TO_CHAR(date, 'YYYYMM') as sort_key,
content = content.replace(/TO_CHAR\(date, 'Mon YYYY'\)/g, "strftime('%m-%Y', date)");
content = content.replace(/TO_CHAR\(date, 'YYYYMM'\)/g, "strftime('%Y%m', date)");
content = content.replace(/TO_CHAR\(date, 'Mon'\)/g, "strftime('%m', date)");
content = content.replace(/TO_CHAR\(date, 'MM'\)/g, "strftime('%m', date)");

// 3. INTERVAL '6 months'
content = content.replace(/date >= date\('now'\) - INTERVAL '6 months'/g, "date >= date('now', '-6 months')");
content = content.replace(/date >= CURRENT_DATE - INTERVAL '6 months'/g, "date >= date('now', '-6 months')"); // Just in case CURRENT_DATE was missed

// 4. DATE_TRUNC
content = content.replace(/date >= DATE_TRUNC\('week', date\('now'\)\)/g, "date >= date('now', 'weekday 0', '-7 days')");
content = content.replace(/date >= DATE_TRUNC\('month', date\('now'\)\)/g, "date >= date('now', 'start of month')");
content = content.replace(/date >= DATE_TRUNC\('year', date\('now'\)\)/g, "date >= date('now', 'start of year')");

// 5. EXTRACT(YEAR FROM date)
content = content.replace(/EXTRACT\(YEAR FROM date\)/g, "strftime('%Y', date)");
content = content.replace(/EXTRACT\(YEAR FROM date\('now'\)\)/g, "strftime('%Y', 'now')");
content = content.replace(/EXTRACT\(YEAR FROM CURRENT_DATE\)/g, "strftime('%Y', 'now')");

// 6. Fix `CURRENT_TIMESTAMP` fallback to just let SQLite handle it or replace it if it was CURRENT_DATE
// Actually SQLite supports CURRENT_TIMESTAMP natively.
// Also fix any leftover CURRENT_DATE -> date('now')
content = content.replace(/COALESCE\(\$3, date\('now'\)\)/g, "COALESCE($3, date('now'))");

// 7. Write back
fs.writeFileSync('server.js', content, 'utf8');
console.log('Replacements complete.');
