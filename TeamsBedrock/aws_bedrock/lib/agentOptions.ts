const agentNames = {
    supervisor: 'SupervisorAgent',
    time: 'TimeAgent',
    knowledgeBaseEmbeddings: 'KnowledgeBaseEmbeddingsAgent',
    knowledgeBase: 'KnowledgeBaseAgent',
    hackerNews: 'HackerNewsAgent',
    helloWorld: 'HelloWorldAgent',
}

const knowledgeBaseEmbeddingsAgentOptions = {
    name: agentNames.knowledgeBaseEmbeddings,
    description: 'The agent that embeds the knowledge base',
    instruction: '',
}

const knowledgeBaseAgentOptions = {
    name: agentNames.knowledgeBase,
    description: 'The agent that answers questions about the knowledge base',
    instruction: `
    You are a helpful assistant that can answer questions about the knowledge base.
    You are given a question and a knowledge base.
    You need to answer the question based on the knowledge base.
    `,
}

const hackerNewsAgentOptions = {
    name: agentNames.hackerNews,
    description: 'The agent that gets the latest news from Hacker News',
    instruction: `
    You are a helpful assistant that can get the latest news from Hacker News.
    `,
}

const helloWorldAgentOptions = {
    name: agentNames.helloWorld,
    description: 'The agent that says hello world',
    instruction: `
    You are a helpful assistant that can say hello world.
    `,
}

const timeAgentOptions = {
    name: agentNames.time,
    description: 'The agent that gets the current time',
    instruction: `
    You are a helpful assistant that can get the current time.
    `,
}

const supervisorAgentOptions = {
    name: agentNames.supervisor,
    description: 'The agent that coordinates the other agents',
    instruction: `
        Role:
        You are a helpful assistant that can coordinate the other agents.

        Instructions:
        - Analyze the user's request to determine which agent(s) should handle it
        - If multiple agents are needed, coordinate their responses
        - Synthesize information from multiple agents into a coherent response
        - If no existing agent can handle the request, inform the user and suggest alternatives

        Sub-Agents:
            - ${agentNames.knowledgeBaseEmbeddings}
            - ${agentNames.knowledgeBase}
            - ${agentNames.hackerNews}
            - ${agentNames.helloWorld}
    `,
}


// import as a module
export default {
    agentNames,
    knowledgeBaseEmbeddingsAgentOptions,
    knowledgeBaseAgentOptions,
    hackerNewsAgentOptions,
    timeAgentOptions,
    helloWorldAgentOptions,
    supervisorAgentOptions,
}

// Import individual variables
export {
    agentNames,
    knowledgeBaseEmbeddingsAgentOptions,
    knowledgeBaseAgentOptions,
    hackerNewsAgentOptions,
    timeAgentOptions,
    helloWorldAgentOptions,
    supervisorAgentOptions,
}