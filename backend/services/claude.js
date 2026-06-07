const apiKey = process.env.CLAUDE_API_KEY;

// Check if Claude API key is missing
const isKeyMissing = !apiKey || apiKey === 'your_claude_api_key_here';

/**
 * Generate quiz questions based on lecture note inputs.
 */
async function generateQuestions(textInput, numQuestions = 5) {
  if (isKeyMissing) {
    console.warn('Claude API key is not configured. Falling back to local AI simulation.');
    return getSimulatedQuestions(textInput, numQuestions);
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 4000,
        temperature: 0.2,
        system: `You are an expert university professor creating a quiz. Analyze the provided study material. Generate exactly ${numQuestions} distinct questions. Return ONLY a valid JSON array matching this typescript interface:
        interface Question {
          text: string;
          type: 'mcq' | 'short' | 'tf';
          options: string[]; // 4 items if type is mcq, empty array if tf or short
          correctAnswer: string; // the option text for mcq, "True" or "False" for tf, or short keyword for short
          difficulty: 'easy' | 'medium' | 'hard';
          topic: string; // 1-3 words topic representing the core question theme
        }
        Provide no additional introductory text, conversational comments, or explanations outside the JSON array. Output raw JSON code.`,
        messages: [
          { role: 'user', content: `Create a quiz based on this content:\n\n${textInput}` }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API request failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const rawText = data.content[0].text;
    
    // Parse the JSON array
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
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 150,
        temperature: 0.5,
        system: `You are an encouraging academic helper. Explain why the user's answer is incorrect. Be brief, clear, and direct. Limit the feedback to exactly 2 sentences in friendly plain English.`,
        messages: [
          {
            role: 'user',
            content: `Question: ${questionText}\nCorrect Answer: ${correctAnswer}\nStudent's Incorrect Answer: ${studentAnswer}`
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.content[0].text.trim();
  } catch (err) {
    console.error('Failed to get explanation from Claude, returning simulated fallback:', err);
    return `The correct answer is "${correctAnswer}". Your answer "${studentAnswer}" is incorrect. Re-read the lecture materials regarding this topic.`;
  }
}

/**
 * Fallback questions generator when Claude API is unavailable/unconfigured.
 */
function getSimulatedQuestions(textInput, count) {
  const normalized = (textInput || '').toLowerCase();
  
  // Custom mock database depending on inputs
  const mocks = [];
  
  if (normalized.includes('database') || normalized.includes('sql') || normalized.includes('mongodb')) {
    mocks.push(
      {
        text: 'Which SQL statement is used to extract data from a database?',
        type: 'mcq',
        options: ['GET', 'OPEN', 'SELECT', 'EXTRACT'],
        correctAnswer: 'SELECT',
        difficulty: 'easy',
        topic: 'Databases'
      },
      {
        text: 'MongoDB is a relational database manager.',
        type: 'tf',
        options: [],
        correctAnswer: 'False',
        difficulty: 'easy',
        topic: 'NoSQL Databases'
      },
      {
        text: 'What does ACID stand for in database systems?',
        type: 'short',
        options: [],
        correctAnswer: 'Atomicity Consistency Isolation Durability',
        difficulty: 'hard',
        topic: 'Transactions'
      },
      {
        text: 'Which index type in MongoDB is default for the _id field?',
        type: 'mcq',
        options: ['Text index', 'Hashed index', 'Single field index', 'Compound index'],
        correctAnswer: 'Single field index',
        difficulty: 'medium',
        topic: 'NoSQL Indexes'
      },
      {
        text: 'What format does MongoDB use to store data documents internally?',
        type: 'short',
        options: [],
        correctAnswer: 'BSON',
        difficulty: 'medium',
        topic: 'NoSQL Databases'
      }
    );
  } else if (normalized.includes('react') || normalized.includes('javascript') || normalized.includes('frontend')) {
    mocks.push(
      {
        text: 'Which hook is used to perform side effects in a React functional component?',
        type: 'mcq',
        options: ['useState', 'useContext', 'useEffect', 'useReducer'],
        correctAnswer: 'useEffect',
        difficulty: 'easy',
        topic: 'Hooks'
      },
      {
        text: 'React uses a virtual DOM to optimize rendering performance.',
        type: 'tf',
        options: [],
        correctAnswer: 'True',
        difficulty: 'easy',
        topic: 'React Core'
      },
      {
        text: 'What keyword is used to declare a block-scoped local variable in ES6?',
        type: 'short',
        options: [],
        correctAnswer: 'let',
        difficulty: 'medium',
        topic: 'Javascript'
      },
      {
        text: 'Which function in Reanimated 2 creates an shared value reference?',
        type: 'mcq',
        options: ['useSharedValue', 'useDerivedValue', 'useAnimatedStyle', 'withTiming'],
        correctAnswer: 'useSharedValue',
        difficulty: 'medium',
        topic: 'Reanimated'
      },
      {
        text: 'Redux state is mutable and can be changed directly.',
        type: 'tf',
        options: [],
        correctAnswer: 'False',
        difficulty: 'hard',
        topic: 'State Management'
      }
    );
  } else {
    // General topics (Algorithms, networks, general science)
    mocks.push(
      {
        text: 'What is the time complexity of binary search in a sorted array?',
        type: 'mcq',
        options: ['O(1)', 'O(n)', 'O(log n)', 'O(n log n)'],
        correctAnswer: 'O(log n)',
        difficulty: 'easy',
        topic: 'Algorithms'
      },
      {
        text: 'HTTP is a stateful network protocol.',
        type: 'tf',
        options: [],
        correctAnswer: 'False',
        difficulty: 'easy',
        topic: 'Networking'
      },
      {
        text: 'What protocol is typically used to enable full-duplex communication over a TCP connection?',
        type: 'short',
        options: [],
        correctAnswer: 'WebSocket',
        difficulty: 'medium',
        topic: 'Networking'
      },
      {
        text: 'Which sorting algorithm has the best average-case performance?',
        type: 'mcq',
        options: ['Bubble Sort', 'Selection Sort', 'Merge Sort', 'Insertion Sort'],
        correctAnswer: 'Merge Sort',
        difficulty: 'medium',
        topic: 'Algorithms'
      },
      {
        text: 'A Stack data structure operates on a First-In-First-Out (FIFO) basis.',
        type: 'tf',
        options: [],
        correctAnswer: 'False',
        difficulty: 'medium',
        topic: 'Data Structures'
      }
    );
  }
  
  // Cut or repeat to match requested length
  let results = [];
  for (let i = 0; i < count; i++) {
    results.push(mocks[i % mocks.length]);
  }
  return results;
}

module.exports = {
  generateQuestions,
  explainWrongAnswer
};
