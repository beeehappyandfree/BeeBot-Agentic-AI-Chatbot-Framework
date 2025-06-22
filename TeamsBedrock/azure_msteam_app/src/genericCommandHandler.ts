import { Activity, TurnContext } from "botbuilder";
import { CommandMessage, TeamsFxBotCommandHandler, TriggerPatterns } from "@microsoft/teamsfx";
import { MultiAgentOrchestrator, AmazonBedrockAgent, SupervisorAgent, BedrockLLMAgent, AnthropicAgent } from "multi-agent-orchestrator";
import config from "./internal/config";
import { time } from "console";
/**
 * The `GenericCommandHandler` registers patterns with the `TeamsFxBotCommandHandler` and responds
 * with appropriate messages if the user types general command inputs, such as "hi", "hello", and "help".
 */

const orchestrator = new MultiAgentOrchestrator();

export class GenericCommandHandler implements TeamsFxBotCommandHandler {
  triggerPatterns: TriggerPatterns = new RegExp(/^.+$/);

  constructor() {

    const supervisorAgent = new AmazonBedrockAgent({
      name: "SupervisorAgent",
      description: "A supervisor agent that manages the team of agents",
      agentId: config.AWS_SUPERVISOR_AGENT_ID,
      agentAliasId: config.AWS_SUPERVISOR_AGENT_ALIAS_ID,
    });

    orchestrator.addAgent(supervisorAgent);
   
  }

  sendTypingLoop(context: TurnContext) {
    return setInterval(async () => {
      await context.sendActivity({ type: "typing" })
    }, 1000)
  }

  async handleCommandReceived(
    context: TurnContext,
    message: CommandMessage
  ): Promise<string | Partial<Activity> | void> {
    try {
      console.log(`App received message: ${message.text}`);

      const typingInterval = this.sendTypingLoop(context);

      console.log(orchestrator.getAllAgents());

      const response = await orchestrator.routeRequest(
        message.text,
        context.activity.from.id.toString(),
        `session${context.activity.from.id.toString()}`
      );

      clearInterval(typingInterval);

      await context.sendActivity({
        type: "message",
        text: response.output.toString(),
      });

    } catch (error) {
      console.log(`Detail error: ${error}`);
      await context.sendActivity({
        type: 'message',
        text: "I'm sorry, I had trouble understanding you. Please try again."
      });
    }
  }
}
