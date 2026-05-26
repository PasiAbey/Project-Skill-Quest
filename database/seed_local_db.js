// ==========================================
// SKILLQUEST DATABASE SEEDER (LOCAL RUN)
// ==========================================
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function runSeeder() {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306');
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || 'rootpassword';
  const database = process.env.DB_NAME || 'skillquest';

  console.log(`🚀 Connecting to MySQL at ${host}:${port}...`);
  let connection;
  try {
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database
    });
    console.log('✅ Connected successfully!');
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    process.exit(1);
  }

  try {
    // ----------------------------------------------------
    // 1. SEED BADGES
    // ----------------------------------------------------
    console.log('\n🏅 Seeding Badges...');
    const badges = [
      {
        badge_id: 'first_step',
        badge_name: 'First Steps',
        badge_description: 'Completed your first study plan step.',
        icon_url: '/uploads/badges/first-steps.png'
      },
      {
        badge_id: 'perfect_quiz',
        badge_name: 'Sharpshooter',
        badge_description: 'Aced a quiz on the first try.',
        icon_url: '/uploads/badges/sharpshooter.png'
      },
      {
        badge_id: 'diagnostic_master',
        badge_name: 'Diagnostic Completed',
        badge_description: 'Completed the initial diagnostic assessment.',
        icon_url: '/uploads/badges/diagnostic-master.png'
      },
      {
        badge_id: 'streak_3',
        badge_name: 'Consistent Learner',
        badge_description: 'Maintained a 3-day active streak.',
        icon_url: '/uploads/badges/consistent.png'
      },
      {
        badge_id: 'streak_7',
        badge_name: 'Week of Fire',
        badge_description: 'Maintained a 7-day active streak.',
        icon_url: '/uploads/badges/week-fire.png'
      },
      {
        badge_id: 'level_5',
        badge_name: 'Apprentice Scholar',
        badge_description: 'Reached Level 5 on the platform.',
        icon_url: '/uploads/badges/apprentice.png'
      }
    ];

    for (const badge of badges) {
      await connection.execute(
        `INSERT INTO badges (badge_id, badge_name, badge_description, icon_url)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE badge_name = VALUES(badge_name), badge_description = VALUES(badge_description), icon_url = VALUES(icon_url)`,
        [badge.badge_id, badge.badge_name, badge.badge_description, badge.icon_url]
      );
    }
    console.log(`✅ Seeded ${badges.length} badges successfully!`);

    // ----------------------------------------------------
    // 2. SEED STUDENTS (FROM temp_student.json)
    // ----------------------------------------------------
    console.log('\n👥 Seeding Students...');
    const studentPath = path.join(__dirname, '..', 'backend', 'temp_student.json');
    if (!fs.existsSync(studentPath)) {
      console.warn(`⚠️ Warning: temp_student.json not found at ${studentPath}. Skipping student seeding.`);
    } else {
      const studentData = JSON.parse(fs.readFileSync(studentPath, 'utf8'));
      let studentCount = 0;
      for (const s of studentData) {
        // Format dates correctly or set to NULL
        const lastLogin = s.last_login ? new Date(s.last_login).toISOString().slice(0, 19).replace('T', ' ') : null;
        const closedAt = s.closed_at ? new Date(s.closed_at).toISOString().slice(0, 19).replace('T', ' ') : null;
        const createdAt = s.created_at ? new Date(s.created_at).toISOString().slice(0, 19).replace('T', ' ') : null;

        await connection.execute(
          `INSERT INTO student (
             student_ID, name, email, profile_pic, password, status, level, feedback,
             at_score, p_score, ct_score, ct_tol_easy, ct_tol_med, ct_tol_hard,
             at_tol_easy, at_tol_med, at_tol_hard, p_tol_easy, p_tol_med, p_tol_hard,
             username, total_xp, current_level, current_streak, longest_streak,
             last_login, closed_at, created_at, bio, is_verified, weakness
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email), password = VALUES(password)`,
          [
            s.student_ID, s.name, s.email, s.profile_pic, s.password, s.status || 0, s.level || 'beginner', s.feedback,
            s.at_score || 0, s.p_score || 0, s.ct_score || 0, s.ct_tol_easy || 0, s.ct_tol_med || 0, s.ct_tol_hard || 0,
            s.at_tol_easy || 0, s.at_tol_med || 0, s.at_tol_hard || 0, s.p_tol_easy || 0, s.p_tol_med || 0, s.p_tol_hard || 0,
            s.username || s.name.toLowerCase().replace(' ', '_'), s.total_xp || 0, s.current_level || 1, s.current_streak || 0, s.longest_streak || 0,
            lastLogin, closedAt, createdAt, s.bio, s.is_verified || 0, s.weakness
          ]
        );
        studentCount++;
      }
      console.log(`✅ Seeded ${studentCount} students from temp_student.json!`);
    }

    // ----------------------------------------------------
    // 3. SEED QUIZ BANK (DIAGNOSTIC QUESTIONS)
    // ----------------------------------------------------
    console.log('\n📝 Seeding Quiz Bank Diagnostic Questions...');
    const questions = [
      // === ANALYTICAL THINKING - EASY ===
      {
        question: 'If all cats are animals and all animals breathe, can cats breathe?',
        options: ['a) Yes', 'b) No', 'c) Sometimes', 'd) Cannot determine'],
        correct_answer: 'a) Yes',
        category: 'Analytical Thinking',
        difficulty_rate: 'Easy'
      },
      {
        question: 'Choose the next number in the pattern: 2, 4, 8, 16, ...',
        options: ['a) 20', 'b) 24', 'c) 32', 'd) 64'],
        correct_answer: 'c) 32',
        category: 'Analytical Thinking',
        difficulty_rate: 'Easy'
      },
      {
        question: 'Which word does not belong with the others?',
        options: ['a) Apple', 'b) Banana', 'c) Carrot', 'd) Grape'],
        correct_answer: 'c) Carrot',
        category: 'Analytical Thinking',
        difficulty_rate: 'Easy'
      },
      {
        question: 'Complete the analogy: Hand is to Glove as Foot is to ...',
        options: ['a) Shoe', 'b) Sock', 'c) Toe', 'd) Leg'],
        correct_answer: 'b) Sock',
        category: 'Analytical Thinking',
        difficulty_rate: 'Easy'
      },
      {
        question: 'If red is yellow, blue is green, and green is orange, what is the color of the clear sky?',
        options: ['a) Green', 'b) Blue', 'c) Red', 'd) Orange'],
        correct_answer: 'a) Green',
        category: 'Analytical Thinking',
        difficulty_rate: 'Easy'
      },

      // === ANALYTICAL THINKING - MODERATE ===
      {
        question: 'A is taller than B, but shorter than C. D is taller than E, but shorter than A. Who is the tallest?',
        options: ['a) A', 'b) B', 'c) C', 'd) D'],
        correct_answer: 'c) C',
        category: 'Analytical Thinking',
        difficulty_rate: 'Moderate'
      },
      {
        question: 'A clock shows 3:15. What is the angle between the hour and minute hands?',
        options: ['a) 0 degrees', 'b) 7.5 degrees', 'c) 15 degrees', 'd) 90 degrees'],
        correct_answer: 'b) 7.5 degrees',
        category: 'Analytical Thinking',
        difficulty_rate: 'Moderate'
      },
      {
        question: 'If you have a 3-liter bucket and a 5-liter bucket, how can you measure exactly 4 liters of water?',
        options: [
          'a) Fill 5L, pour into 3L (leaves 2L). Empty 3L, pour 2L into 3L. Fill 5L, pour into 3L until full (leaves 4L).',
          'b) Fill 3L, pour into 5L twice until full.',
          'c) Fill 5L, pour half into 3L.',
          'd) Cannot be measured exactly.'
        ],
        correct_answer: 'a) Fill 5L, pour into 3L (leaves 2L). Empty 3L, pour 2L into 3L. Fill 5L, pour into 3L until full (leaves 4L).',
        category: 'Analytical Thinking',
        difficulty_rate: 'Moderate'
      },
      {
        question: 'If 5 workers can build 5 tables in 5 hours, how many hours does it take 100 workers to build 100 tables?',
        options: ['a) 1 hour', 'b) 5 hours', 'c) 50 hours', 'd) 100 hours'],
        correct_answer: 'b) 5 hours',
        category: 'Analytical Thinking',
        difficulty_rate: 'Moderate'
      },

      // === ANALYTICAL THINKING - HARD ===
      {
        question: 'If all bloops are bleeps, and some bleeps are blops, are some bloops definitely blops?',
        options: ['a) Yes, definitely', 'b) No, not necessarily', 'c) No, never', 'd) Only on Tuesdays'],
        correct_answer: 'b) No, not necessarily',
        category: 'Analytical Thinking',
        difficulty_rate: 'Hard'
      },
      {
        question: 'You have two hourglasses: a 4-minute one and a 7-minute one. How can you measure exactly 9 minutes?',
        options: [
          'a) Start both. When 4L empties (4m), flip it. When 7L empties (7m), flip 7L (leaves 1m in 4L). At 8m, flip 7L again.',
          'b) Start both. When 4L empties (4m), flip it. When 4L empties again (8m), start 7L.',
          'c) Run both concurrently 3 times.',
          'd) Flip the 7-minute hourglass, and run the 4-minute hourglass twice.'
        ],
        correct_answer: 'a) Start both. When 4L empties (4m), flip it. When 7L empties (7m), flip 7L (leaves 1m in 4L). At 8m, flip 7L again.',
        category: 'Analytical Thinking',
        difficulty_rate: 'Hard'
      },
      {
        question: 'A box contains 6 black balls and 4 white balls. What is the probability of drawing 2 black balls consecutively without replacement?',
        options: ['a) 1/3', 'b) 6/15', 'c) 1/2', 'd) 3/10'],
        correct_answer: 'a) 1/3',
        category: 'Analytical Thinking',
        difficulty_rate: 'Hard'
      },
      {
        question: 'In a group of 30 people, 15 play soccer, 18 play basketball, and 5 play neither. How many play both sports?',
        options: ['a) 3', 'b) 5', 'c) 8', 'd) 10'],
        correct_answer: 'c) 8',
        category: 'Analytical Thinking',
        difficulty_rate: 'Hard'
      },

      // === COMPUTATIONAL THINKING - EASY ===
      {
        question: 'What is the first step in solving a problem computationally?',
        options: ['a) Writing code', 'b) Finding bugs', 'c) Decomposing the problem', 'd) Buying a computer'],
        correct_answer: 'c) Decomposing the problem',
        category: 'Computational Thinking',
        difficulty_rate: 'Easy'
      },
      {
        question: 'What is decomposition in computational thinking?',
        options: [
          'a) Deleting old files',
          'b) Breaking a complex problem down into smaller, manageable parts',
          'c) Converting code into binary',
          'd) Compressing data'
        ],
        correct_answer: 'b) Breaking a complex problem down into smaller, manageable parts',
        category: 'Computational Thinking',
        difficulty_rate: 'Easy'
      },
      {
        question: 'What is abstraction in computational thinking?',
        options: [
          'a) Writing highly detailed reports',
          'b) Ignoring irrelevant details to focus on key characteristics',
          'c) Creating colorful user interfaces',
          'd) Multiplying numbers'
        ],
        correct_answer: 'b) Ignoring irrelevant details to focus on key characteristics',
        category: 'Computational Thinking',
        difficulty_rate: 'Easy'
      },
      {
        question: 'Which of the following is a step-by-step procedure for solving a problem?',
        options: ['a) Variable', 'b) Algorithm', 'c) Database', 'd) Loop'],
        correct_answer: 'b) Algorithm',
        category: 'Computational Thinking',
        difficulty_rate: 'Easy'
      },
      {
        question: 'What is pattern recognition in computational thinking?',
        options: [
          'a) Searching for similar problems and identifying shared characteristics',
          'b) Generating random passwords',
          'c) Drawing shapes in CSS',
          'd) Recording sound'
        ],
        correct_answer: 'a) Searching for similar problems and identifying shared characteristics',
        category: 'Computational Thinking',
        difficulty_rate: 'Easy'
      },

      // === COMPUTATIONAL THINKING - MODERATE ===
      {
        question: 'Which search algorithm divides the search interval in half at each step?',
        options: ['a) Linear Search', 'b) Binary Search', 'c) Bubble Search', 'd) Depth-First Search'],
        correct_answer: 'b) Binary Search',
        category: 'Computational Thinking',
        difficulty_rate: 'Moderate'
      },
      {
        question: 'What is the worst-case time complexity of binary search?',
        options: ['a) O(1)', 'b) O(n)', 'c) O(log n)', 'd) O(n^2)'],
        correct_answer: 'c) O(log n)',
        category: 'Computational Thinking',
        difficulty_rate: 'Moderate'
      },
      {
        question: 'Which of the following sorting algorithms works by repeatedly swapping adjacent elements that are out of order?',
        options: ['a) Merge Sort', 'b) Quick Sort', 'c) Bubble Sort', 'd) Insertion Sort'],
        correct_answer: 'c) Bubble Sort',
        category: 'Computational Thinking',
        difficulty_rate: 'Moderate'
      },
      {
        question: 'Which data structure follows the Last-In, First-Out (LIFO) principle?',
        options: ['a) Queue', 'b) Stack', 'c) Array', 'd) Tree'],
        correct_answer: 'b) Stack',
        category: 'Computational Thinking',
        difficulty_rate: 'Moderate'
      },

      // === COMPUTATIONAL THINKING - HARD ===
      {
        question: 'What is a heuristic algorithm?',
        options: [
          'a) An algorithm that always finds the mathematically optimal solution.',
          'b) A practical approach that finds a satisfactory solution in a reasonable time, even if not mathematically optimal.',
          'c) An algorithm written purely in Assembly.',
          'd) An infinite loop.'
        ],
        correct_answer: 'b) A practical approach that finds a satisfactory solution in a reasonable time, even if not mathematically optimal.',
        category: 'Computational Thinking',
        difficulty_rate: 'Hard'
      },
      {
        question: 'Which data structure is best suited for implementing a breadth-first search (BFS) algorithm?',
        options: ['a) Stack', 'b) Queue', 'c) Priority Queue', 'd) Binary Search Tree'],
        correct_answer: 'b) Queue',
        category: 'Computational Thinking',
        difficulty_rate: 'Hard'
      },
      {
        question: 'What is the time complexity of QuickSort in the worst-case scenario?',
        options: ['a) O(n log n)', 'b) O(n)', 'c) O(n^2)', 'd) O(2^n)'],
        correct_answer: 'c) O(n^2)',
        category: 'Computational Thinking',
        difficulty_rate: 'Hard'
      },
      {
        question: 'In graph theory, what does Dijkstra\'s algorithm calculate?',
        options: [
          'a) Maximum flow in a network',
          'b) The shortest path between nodes in a weighted graph',
          'c) The minimum spanning tree',
          'd) Whether a graph contains a cycle'
        ],
        correct_answer: 'b) The shortest path between nodes in a weighted graph',
        category: 'Computational Thinking',
        difficulty_rate: 'Hard'
      },

      // === PROGRAMMING - EASY ===
      {
        question: 'What is the output of console.log(typeof []) in JavaScript?',
        options: ['a) "array"', 'b) "object"', 'c) "list"', 'd) "undefined"'],
        correct_answer: 'b) "object"',
        category: 'Programming',
        difficulty_rate: 'Easy'
      },
      {
        question: 'What is the output of 2 + "2" in JavaScript?',
        options: ['a) 4', 'b) "22"', 'c) NaN', 'd) "4"'],
        correct_answer: 'b) "22"',
        category: 'Programming',
        difficulty_rate: 'Easy'
      },
      {
        question: 'Which keyword is used to declare a block-scoped variable that cannot be reassigned?',
        options: ['a) var', 'b) let', 'c) const', 'd) def'],
        correct_answer: 'c) const',
        category: 'Programming',
        difficulty_rate: 'Easy'
      },
      {
        question: 'Which of the following represents a Boolean value?',
        options: ['a) "true"', 'b) true', 'c) 1', 'd) "yes"'],
        correct_answer: 'b) true',
        category: 'Programming',
        difficulty_rate: 'Easy'
      },

      // === PROGRAMMING - MODERATE ===
      {
        question: 'What does the map function do on a JavaScript array?',
        options: [
          'a) Filters elements based on a condition.',
          'b) Creates a new array populated with the results of calling a provided function on every element.',
          'c) Joins all elements into a single string.',
          'd) Sorts the array in place.'
        ],
        correct_answer: 'b) Creates a new array populated with the results of calling a provided function on every element.',
        category: 'Programming',
        difficulty_rate: 'Moderate'
      },
      {
        question: 'What is the difference between "==" and "===" in JavaScript?',
        options: [
          'a) "===" compares values and types, while "==" performs type coercion.',
          'b) "==" compares values and types, while "===" performs type coercion.',
          'c) There is no difference.',
          'd) "===" is only used for objects.'
        ],
        correct_answer: 'a) "===" compares values and types, while "==" performs type coercion.',
        category: 'Programming',
        difficulty_rate: 'Moderate'
      },
      {
        question: 'What is the result of console.log(0.1 + 0.2 === 0.3) in JavaScript?',
        options: ['a) true', 'b) false', 'c) undefined', 'd) TypeError'],
        correct_answer: 'b) false',
        category: 'Programming',
        difficulty_rate: 'Moderate'
      },
      {
        question: 'Which array method adds one or more elements to the end of an array and returns its new length?',
        options: ['a) pop()', 'b) push()', 'c) shift()', 'd) unshift()'],
        correct_answer: 'b) push()',
        category: 'Programming',
        difficulty_rate: 'Moderate'
      },

      // === PROGRAMMING - HARD ===
      {
        question: 'What is a closure in JavaScript?',
        options: [
          'a) Closing a browser tab programmatically.',
          'b) The combination of a function bundled together with references to its surrounding state (lexical environment).',
          'c) Exiting a loop before it naturally finishes.',
          'd) Deleting a variable from memory.'
        ],
        correct_answer: 'b) The combination of a function bundled together with references to its surrounding state (lexical environment).',
        category: 'Programming',
        difficulty_rate: 'Hard'
      },
      {
        question: 'What is the purpose of the event loop in JavaScript?',
        options: [
          'a) To continuously compile code.',
          'b) To handle asynchronous call executions, moving tasks from the queue to the stack once the stack is clear.',
          'c) To run infinite for loops.',
          'd) To connect to external database services.'
        ],
        correct_answer: 'b) To handle asynchronous call executions, moving tasks from the queue to the stack once the stack is clear.',
        category: 'Programming',
        difficulty_rate: 'Hard'
      },
      {
        question: 'What is the main difference between microtasks (e.g. Promises) and macrotasks (e.g. setTimeout) in the event loop?',
        options: [
          'a) Macrotasks have higher priority than microtasks.',
          'b) Microtasks are executed immediately after the current script task and before any macrotasks.',
          'c) There is no execution order difference.',
          'd) Promises are executed inside web workers only.'
        ],
        correct_answer: 'b) Microtasks are executed immediately after the current script task and before any macrotasks.',
        category: 'Programming',
        difficulty_rate: 'Hard'
      },
      {
        question: 'What does "this" refer to inside an arrow function?',
        options: [
          'a) The arrow function itself.',
          'b) The global object (window/global).',
          'c) The lexical context in which the arrow function was defined.',
          'd) The object that called the function.'
        ],
        correct_answer: 'c) The lexical context in which the arrow function was defined.',
        category: 'Programming',
        difficulty_rate: 'Hard'
      }
    ];

    let questionCount = 0;
    for (const q of questions) {
      const optionsStr = JSON.stringify(q.options);
      await connection.execute(
        `INSERT INTO quiz_bank (question, option_text, correct_answer, category, difficulty_rate)
         VALUES (?, ?, ?, ?, ?)`,
        [q.question, optionsStr, q.correct_answer, q.category, q.difficulty_rate]
      );
      questionCount++;
    }
    console.log(`✅ Seeded ${questionCount} diagnostic questions into the quiz_bank!`);

    console.log('\n🎉 ALL LOCAL DATABASE DATA SEEDED SUCCESSFUL!');
  } catch (error) {
    console.error('\n❌ Seeding error occurred:', error.message);
  } finally {
    await connection.end();
    console.log('🔌 Database connection closed.');
  }
}

runSeeder();
