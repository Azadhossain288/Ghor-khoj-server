import { Property } from "../models/Property.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// The AI Assistant is "agentic" because it can call this real function
// (search the live property database) instead of only generating text.
const searchPropertiesTool = {
  type: "function",
  function: {
    name: "search_properties",
    description: "Search live property listings by location, price range, or type",
    parameters: {
      type: "object",
      properties: {
        location: { type: "string", description: "City or area name, optional" },
        maxPrice: { type: "number", description: "Maximum budget in BDT, optional" },
        minPrice: { type: "number", description: "Minimum budget in BDT, optional" },
        type: {
          type: "string",
          enum: ["apartment", "house", "land", "commercial"],
          description: "Property type, optional",
        },
      },
    },
  },
};

async function runToolCall(name: string, args: Record<string, any>) {
  if (name === "search_properties") {
    const query: Record<string, any> = {};
    if (args.location) query.location = { $regex: args.location, $options: "i" };
    if (args.type) query.type = args.type;
    if (args.minPrice || args.maxPrice) {
      query.price = {};
      if (args.minPrice) query.price.$gte = args.minPrice;
      if (args.maxPrice) query.price.$lte = args.maxPrice;
    }
    const results = await Property.find(query).limit(5).select("title price location type bedrooms");
    return JSON.stringify(results);
  }
  return JSON.stringify({ error: "Unknown tool" });
}

const SYSTEM_PROMPT = `You are the GhorKhoj AI Assistant, embedded in a real estate platform.
You help users find properties, answer questions about listings, and guide navigation.
When a user describes what they're looking for (budget, location, property type), use the
search_properties tool to fetch real, current listings instead of guessing.
Keep answers concise, friendly, and end with 1-2 short natural follow-up questions when useful.`;

export async function getChatCompletion(history: { role: string; content: string }[]) {
  const messages = [{ role: "system", content: SYSTEM_PROMPT }, ...history];

  let response = await callGroq(messages, true);
  let data = await response.json();
  let choice = data.choices[0];

  // Agentic loop: if the model asked to call a tool, run it and feed the result back
  if (choice.finish_reason === "tool_calls") {
    const toolCall = choice.message.tool_calls[0];
    const args = JSON.parse(toolCall.function.arguments || "{}");
    const toolResult = await runToolCall(toolCall.function.name, args);

    messages.push(choice.message);
    messages.push({
      role: "tool",
      tool_call_id: toolCall.id,
      content: toolResult,
    });

    response = await callGroq(messages, false);
    data = await response.json();
    choice = data.choices[0];
  }

  return choice.message.content as string;
}

async function callGroq(messages: any[], allowTools: boolean) {
  return fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL || "llama-3.3-70b-versatile",
      messages,
      tools: allowTools ? [searchPropertiesTool] : undefined,
      temperature: 0.4,
    }),
  });
}

// Used by the Recommendation Engine to explain *why* a property was picked
export async function explainRecommendation(
  userPrefs: string,
  property: { title: string; price: number; location: string; type: string }
) {
  const messages = [
    {
      role: "system",
      content:
        "In one short sentence, explain why this property is a good fit for the user's stated preferences. Focus on what does match — never say it doesn't fit.",
    },
    {
      role: "user",
      content: `User preferences: ${userPrefs}\nProperty: ${JSON.stringify(property)}`,
    },
  ];
  const response = await callGroq(messages, false);
  const data = await response.json();
  return data.choices[0].message.content as string;
}