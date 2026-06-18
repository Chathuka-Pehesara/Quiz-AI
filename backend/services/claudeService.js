const apiKey = process.env.CLAUDE_API_KEY;
const isKeyMissing = !apiKey || apiKey === 'your_claude_api_key_here';

// Helper to fetch with retries and exponential backoff
const fetchWithRetry = async (url, options, retries = 3, delay = 1000) => {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API error (${response.status}): ${text}`);
    }
    return response;
  } catch (err) {
    if (retries > 0) {
      console.warn(`Claude API call failed. Retrying in ${delay}ms... (${retries} retries left). Error: ${err.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    throw err;
  }
};

/**
 * Generate quiz questions based on lecture note inputs.
 */
async function generateQuestions(textInput, numQuestions = 5) {
  if (isKeyMissing) {
    console.warn('Claude API key is not configured. Falling back to local AI simulation.');
    return getSimulatedQuestions(textInput, numQuestions);
  }

  try {
    const response = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        temperature: 0.2,
        system: `You are an expert university professor creating a quiz. Analyze the provided study material. Generate exactly ${numQuestions} distinct questions. Return ONLY a valid JSON array matching this typescript interface:
        interface Question {
          text: string;
          type: 'mcq' | 'short' | 'tf';
          options: string[]; // 4 items if type is mcq, empty array if tf or short
          correctAnswer: string; // the option text for mcq, "True" or "False" for tf, or short keyword for short
          explanation: string; // plain-English explanation of why the correctAnswer is correct and what the concept actually is. Limit to 2 sentences.
          difficulty: number; // integer from 1 (easiest) to 5 (hardest)
          topic: string; // 1-3 words topic representing the core question theme
        }
        Provide no additional introductory text, conversational comments, or explanations outside the JSON array. Output raw JSON code.`,
        messages: [
          { role: 'user', content: `Create a quiz based on this content:\n\n${textInput}` }
        ]
      })
    });

    const data = await response.json();
    const rawText = data.content[0].text;
    
    // Parse the JSON array safely
    const cleanText = rawText.substring(rawText.indexOf('['), rawText.lastIndexOf(']') + 1);
    return JSON.parse(cleanText);
  } catch (err) {
    console.error('Claude API call failed, generating simulated fallback questions:', err);
    return getSimulatedQuestions(textInput, numQuestions);
  }
}

/**
 * Generate a short plain-English explanation of why the student's answer was incorrect.
 */
async function explainWrongAnswer(questionText, correctAnswer, studentAnswer) {
  if (isKeyMissing) {
    return `Simulated Explanation: The correct answer is "${correctAnswer}". Your answer "${studentAnswer}" is incorrect because it misses key concepts related to the question topic.`;
  }

  try {
    const response = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        temperature: 0.5,
        system: `You are an encouraging academic helper. Explain why the user's answer is incorrect and clarify the correct concept. Be brief, clear, and direct. Limit the feedback to exactly 2-3 sentences in friendly plain English.`,
        messages: [
          {
            role: 'user',
            content: `Question: ${questionText}\nCorrect Answer: ${correctAnswer}\nStudent's Incorrect Answer: ${studentAnswer}`
          }
        ]
      })
    });

    const data = await response.json();
    return data.content[0].text.trim();
  } catch (err) {
    console.error('Failed to get explanation from Claude, returning simulated fallback:', err);
    return `The correct answer is "${correctAnswer}". Your answer "${studentAnswer}" is incorrect. Re-read the lecture materials regarding this topic.`;
  }
}

/**
 * Generate a 7-day study plan based on student's weakest topics.
 */
async function generateStudyPlan(weakestTopics) {
  const topicsStr = weakestTopics.join(', ');
  if (isKeyMissing) {
    return getSimulatedStudyPlan(weakestTopics);
  }

  try {
    const response = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        temperature: 0.3,
        system: `You are an academic learning advisor. Generate a structured 7-day study plan for a student struggling with these topics: ${topicsStr}. 
        Return ONLY a valid JSON object matching this typescript interface:
        interface StudyPlan {
          days: {
            day: number; // 1 to 7
            topic: string; // The specific topic to study this day
            tasks: string[]; // 2-3 specific learning tasks (e.g. read notes, practice SQL syntax)
            recommendedQuizTopic: string; // The topic category to take a practice quiz on
            estimatedMinutes: number; // Estimated study time in minutes
          }[];
        }
        Provide no additional conversational comments, text markdown wrappers, or intro/outro outside the JSON object. Output raw JSON code.`,
        messages: [
          { role: 'user', content: `Generate a study plan for: ${topicsStr}` }
        ]
      })
    });

    const data = await response.json();
    const rawText = data.content[0].text;
    
    // Parse the JSON object safely
    const cleanText = rawText.substring(rawText.indexOf('{'), rawText.lastIndexOf('}') + 1);
    return JSON.parse(cleanText);
  } catch (err) {
    console.error('Failed to generate study plan from Claude, returning simulated fallback:', err);
    return getSimulatedStudyPlan(weakestTopics);
  }
}

/**
 * Generate a subtle hint for a question.
 */
async function generateHint(questionText) {
  if (isKeyMissing) {
    return `Simulated Hint: Try breaking down the question and focusing on the core keywords.`;
  }

  try {
    const response = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 150,
        temperature: 0.5,
        system: `You are a helpful teaching assistant. Provide a single-sentence nudge hint for the given question. Do NOT reveal the correct answer. Point the student in the right direction with a supportive tip.`,
        messages: [
          {
            role: 'user',
            content: `Provide a hint for this question: "${questionText}"`
          }
        ]
      })
    });

    const data = await response.json();
    return data.content[0].text.trim();
  } catch (err) {
    console.error('Failed to get hint from Claude, returning simulated fallback:', err);
    return `Review the basic definitions and structures associated with this question.`;
  }
}

/**
 * Fallback questions generator when Claude API is unavailable/unconfigured.
 */
function getSimulatedQuestions(textInput, count) {
  const normalized = (textInput || '').toLowerCase();
  const mocks = [];
  
  if (normalized.includes('database') || normalized.includes('sql') || normalized.includes('mongodb')) {
    mocks.push(
      {
        text: 'Which SQL statement is used to extract data from a database?',
        type: 'mcq',
        options: ['GET', 'OPEN', 'SELECT', 'EXTRACT'],
        correctAnswer: 'SELECT',
        explanation: 'The SELECT statement is the standard SQL syntax used to query and retrieve data records.',
        difficulty: 1,
        topic: 'SQL Joins'
      },
      {
        text: 'MongoDB is a relational database manager.',
        type: 'tf',
        options: [],
        correctAnswer: 'False',
        explanation: 'MongoDB is a document-oriented NoSQL database manager and does not use tables/relations.',
        difficulty: 2,
        topic: 'Normalization'
      },
      {
        text: 'What does ACID stand for in database systems?',
        type: 'short',
        options: [],
        correctAnswer: 'Atomicity Consistency Isolation Durability',
        explanation: 'ACID represents the key properties (Atomicity, Consistency, Isolation, Durability) that guarantee database transactions are processed reliably.',
        difficulty: 5,
        topic: 'Transactions'
      },
      {
        text: 'Which index type in MongoDB is default for the _id field?',
        type: 'mcq',
        options: ['Text index', 'Hashed index', 'Single field index', 'Compound index'],
        correctAnswer: 'Single field index',
        explanation: 'The default index created automatically by MongoDB on the _id field is a unique single field index.',
        difficulty: 3,
        topic: 'Indexing'
      },
      {
        text: 'What format does MongoDB use to store data documents internally?',
        type: 'short',
        options: [],
        correctAnswer: 'BSON',
        explanation: 'MongoDB stores data internally as BSON (Binary JSON), which extends JSON with binary type supports.',
        difficulty: 4,
        topic: 'Normalization'
      }
    );
  } else {
    mocks.push(
      {
        text: 'What is the time complexity of binary search in a sorted array?',
        type: 'mcq',
        options: ['O(1)', 'O(n)', 'O(log n)', 'O(n log n)'],
        correctAnswer: 'O(log n)',
        explanation: 'Binary search splits the search interval in half with each iteration, yielding logarithmic complexity.',
        difficulty: 2,
        topic: 'Algorithms'
      },
      {
        text: 'HTTP is a stateful network protocol.',
        type: 'tf',
        options: [],
        correctAnswer: 'False',
        explanation: 'HTTP is stateless by design; each request is executed independently without retaining prior session metadata.',
        difficulty: 1,
        topic: 'Networking'
      },
      {
        text: 'What protocol is typically used to enable full-duplex communication over a TCP connection?',
        type: 'short',
        options: [],
        correctAnswer: 'WebSocket',
        explanation: 'WebSockets facilitate bidirectional communication over a single persistent TCP connection.',
        difficulty: 4,
        topic: 'Networking'
      }
    );
  }
  
  let results = [];
  for (let i = 0; i < count; i++) {
    results.push(mocks[i % mocks.length]);
  }
  return results;
}

/**
 * Fallback study planner when Claude API is unavailable.
 */
function getSimulatedStudyPlan(weakestTopics) {
  const t1 = weakestTopics[0] || 'Database Normalization';
  const t2 = weakestTopics[1] || 'SQL Joins';
  const t3 = weakestTopics[2] || 'Indexing';
  
  return {
    days: [
      {
        day: 1,
        topic: t1,
        tasks: ['Review lecture notes on 1NF, 2NF, and 3NF rules', 'Decompose a mock table into normal forms'],
        recommendedQuizTopic: t1,
        estimatedMinutes: 45
      },
      {
        day: 2,
        topic: t1,
        tasks: ['Practice mapping dependencies and identify primary keys', 'Answer 5 practice questions on BCNF'],
        recommendedQuizTopic: t1,
        estimatedMinutes: 30
      },
      {
        day: 3,
        topic: t2,
        tasks: ['Study INNER JOIN, LEFT JOIN, and RIGHT JOIN differences', 'Write raw SQL queries for relational data queries'],
        recommendedQuizTopic: t2,
        estimatedMinutes: 40
      },
      {
        day: 4,
        topic: t2,
        tasks: ['Analyze execution plans for queries containing JOIN statements', 'Practice nested query operations'],
        recommendedQuizTopic: t2,
        estimatedMinutes: 30
      },
      {
        day: 5,
        topic: t3,
        tasks: ['Review index structures (B-Tree vs Hashed)', 'Implement indexes in local database schemas'],
        recommendedQuizTopic: t3,
        estimatedMinutes: 50
      },
      {
        day: 6,
        topic: t3,
        tasks: ['Measure database execution times on queries before/after indexing', 'Compare single vs compound index uses'],
        recommendedQuizTopic: t3,
        estimatedMinutes: 40
      },
      {
        day: 7,
        topic: 'Cumulative Review',
        tasks: ['Review weak concepts from Normalization and Joins', 'Take a cumulative practice test matching all weak topics'],
        recommendedQuizTopic: 'General Review',
        estimatedMinutes: 60
      }
    ]
  };
}

/**
 * Analyze timing and app focus patterns using Claude to check for suspected cheating.
 */
async function analyzeCheatPattern(timings, answerSequence, appStateChanges) {
  if (isKeyMissing) {
    return {
      cheatingSuspected: false,
      reason: "Local programmatic checks applied: Claude API key missing."
    };
  }

  try {
    const response = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        temperature: 0.2,
        system: `You are an academic integrity AI auditor. Analyze the quiz submission metrics. Return ONLY a valid JSON object matching this structure:
        {
          "cheatingSuspected": boolean,
          "reason": "Clear explanation of findings and patterns"
        }
        Do not include any other text.`,
        messages: [
          {
            role: 'user',
            content: `Analyze the student's telemetry for this quiz session:
            Timings per question (seconds): ${JSON.stringify(timings)}
            Answer sequence (given answers): ${JSON.stringify(answerSequence)}
            App state changes (number of times student exited/switched app): ${appStateChanges}`
          }
        ]
      })
    });

    const data = await response.json();
    const rawText = data.content[0].text.trim();
    const cleanText = rawText.substring(rawText.indexOf('{'), rawText.lastIndexOf('}') + 1);
    return JSON.parse(cleanText);
  } catch (err) {
    console.error('Failed to analyze cheat pattern with Claude, returning fallback:', err);
    return {
      cheatingSuspected: false,
      reason: "Could not retrieve Claude AI analysis. Network/API issue."
    };
  }
}

/**
 * Generate a 3-sentence personalized insight based on student quiz stats.
 */
async function generateStudentReportInsight(reportData) {
  if (isKeyMissing) {
    return "You have made consistent progress across your enrolled courses, demonstrating strong performance in core topics. Focus on reinforcing your weaker areas by using the adaptive quiz engine regularly. Keep maintaining your daily study habit to maximize knowledge retention.";
  }

  try {
    const response = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        temperature: 0.5,
        system: `You are an academic learning advisor. Write a 3-sentence personalized insight summary for a student based on their quiz performance metrics. Be encouraging, actionable, and reference their strongest and weakest topics. Do not write introductory words like 'Here is your summary'. Return only the 3 sentences of text.`,
        messages: [
          { role: 'user', content: `Student Metrics:\n${JSON.stringify(reportData)}` }
        ]
      })
    });

    const data = await response.json();
    return data.content[0].text.trim();
  } catch (err) {
    console.error('Failed to get student report insight from Claude, returning fallback:', err);
    return "You have made consistent progress across your enrolled courses, demonstrating strong performance in core topics. Focus on reinforcing your weaker areas by using the adaptive quiz engine regularly. Keep maintaining your daily study habit to maximize knowledge retention.";
  }
}

module.exports = {
  generateQuestions,
  explainWrongAnswer,
  generateStudyPlan,
  generateHint,
  analyzeCheatPattern,
  generateStudentReportInsight
};
