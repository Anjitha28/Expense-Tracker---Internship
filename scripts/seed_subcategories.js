const db = require('../db');

const subcategoriesData = [
  // 1. Income Subcategories
  // Salary (id: 1 or name: 'Salary', type: 'income')
  { category: 'Salary', type: 'income', subs: ['Basic Salary', 'Bonus', 'Incentives', 'Overtime', 'Allowances', 'Reimbursement', 'Other'] },
  // Freelancing (id: 2)
  { category: 'Freelancing', type: 'income', subs: ['Client Payment', 'Project Payment', 'Consulting', 'Contract Work', 'Other'] },
  // Business (id: 3)
  { category: 'Business', type: 'income', subs: ['Sales', 'Service Income', 'Commission', 'Business Profit', 'Other'] },
  // Investments (id: 4)
  { category: 'Investments', type: 'income', subs: ['Stocks', 'Mutual Funds', 'ETFs', 'Bonds', 'Gold', 'Fixed Deposit', 'Crypto', 'Retirement/Pension', 'Other'] },
  // Gifts (id: 5)
  { category: 'Gifts', type: 'income', subs: ['Family', 'Friends', 'Birthday', 'Wedding', 'Anniversary', 'Festival', 'Other'] },
  // Rental Income (id: 6)
  { category: 'Rental Income', type: 'income', subs: ['Residential Rent', 'Commercial Rent', 'Parking Rent', 'Property Income', 'Other'] },
  // Others (id: 7)
  { category: 'Others', type: 'income', subs: ['Cashback', 'Refund', 'Payback', 'Earnings', 'Other'] },

  // 2. Expense Subcategories
  // Food (id: 8)
  { category: 'Food', type: 'expense', subs: ['Groceries', 'Restaurants', 'Food Delivery', 'Snacks', 'Coffee/Tea', 'Fast Food', 'Other'] },
  // Rent (id: 9)
  { category: 'Rent', type: 'expense', subs: ['House Rent', 'Room Rent', 'Office Rent', 'Maintenance', 'Parking', 'Other'] },
  // Shopping (id: 10)
  { category: 'Shopping', type: 'expense', subs: ['Clothing', 'Electronics', 'Home & Furniture', 'Beauty & Cosmetics', 'Accessories', 'Gifts', 'Online Shopping', 'Other'] },
  // Transport (id: 11)
  { category: 'Transport', type: 'expense', subs: ['Fuel', 'Bus', 'Train', 'Taxi/Cab', 'Auto', 'Metro', 'Vehicle Repair', 'Vehicle Maintenance', 'Parking', 'Toll', 'Other'] },
  // Bills (id: 12)
  { category: 'Bills', type: 'expense', subs: ['Electricity', 'Water', 'Gas', 'Internet', 'Mobile/Phone', 'Insurance', 'Subscription', 'Credit Card Bill', 'Other'] },
  // Entertainment (id: 13)
  { category: 'Entertainment', type: 'expense', subs: ['Movies', 'OTT/Streaming', 'Games', 'Events', 'Music', 'Hobbies', 'Other'] },
  // Medical (id: 14)
  { category: 'Medical', type: 'expense', subs: ['Doctor', 'Medicines', 'Hospital', 'Lab Tests', 'Dental', 'Health Insurance', 'Other'] },
  // Education (id: 15)
  { category: 'Education', type: 'expense', subs: ['Tuition Fees', 'Course/Training', 'Books', 'Stationery', 'Exam Fees', 'Certification', 'College/School Fees', 'Other'] },
  // Travel (id: 16)
  { category: 'Travel', type: 'expense', subs: ['Flight', 'Train Ticket', 'Hotel', 'Travel Food', 'Local Transport', 'Sightseeing', 'Travel Activities', 'Travel Shopping', 'Other'] },
  // Others (id: 17)
  { category: 'Others', type: 'expense', subs: ['Bank Charges', 'Fines', 'Donations', 'Personal Care', 'Miscellaneous', 'Unexpected Expense', 'Other'] }
];

async function seedSubcategories() {
  console.log('Starting subcategories migration...');
  try {
    for (const group of subcategoriesData) {
      // Find category id
      const catRes = await db.query(
        'SELECT id FROM "Categories" WHERE name = $1 AND type = $2 AND user_id IS NULL',
        [group.category, group.type]
      );

      if (catRes.rowCount === 0) {
        console.warn(`Category not found: ${group.category} (${group.type})`);
        continue;
      }

      const catId = catRes.rows[0].id;

      for (const subName of group.subs) {
        await db.query(
          `INSERT INTO "Subcategories" (category_id, name)
           VALUES ($1, $2)
           ON CONFLICT ("category_id", "name") DO NOTHING`,
          [catId, subName]
        );
      }
      console.log(`Seeded subcategories for: ${group.category} (${group.type})`);
    }

    console.log('Subcategories seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error during subcategories seeding:', err);
    process.exit(1);
  }
}

seedSubcategories();
