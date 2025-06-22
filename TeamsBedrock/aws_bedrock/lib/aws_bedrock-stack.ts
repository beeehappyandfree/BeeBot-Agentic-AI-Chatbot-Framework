import { Construct } from 'constructs';
import { KnowledgeBaseAgent } from './knowledgebase-agent';
import { HelloWorldStack } from './helloWorld-agent';
import { HackerNewsStack } from './hacker-news-agent';
import { SupervisorStack } from './supervisor-agent';

import * as cdk from 'aws-cdk-lib';
import { TimeStack } from './time-agent';
import { CommonAgentProps } from './common-props';

interface AwsBedrockStackProps extends CommonAgentProps {
  environment?: string;
}

export class AwsBedrockStack extends cdk.Stack {
  private readonly knowledgeBaseAgent: KnowledgeBaseAgent;
  private readonly helloWorldAgent: HelloWorldStack;
  private readonly timeAgent: TimeStack;
  private readonly hackerNewsAgent: HackerNewsStack;
  private readonly supervisorAgent: SupervisorStack;

  constructor(scope: Construct, id: string, props?: AwsBedrockStackProps) {
    super(scope, id, props);

    const addCommonTags = (construct: Construct) => {
      cdk.Tags.of(construct).add('Project', 'Bedrock');
      cdk.Tags.of(construct).add('Environment', 'Dev');
    };

    this.knowledgeBaseAgent = new KnowledgeBaseAgent(this, 'KnowledgeBaseAgent');

    this.helloWorldAgent = new HelloWorldStack(this, 'HelloWorldAgent', {
      addCommonTags: addCommonTags,
    });

    this.timeAgent = new TimeStack(this, 'TimeAgent', {
      addCommonTags: addCommonTags,
    });

    this.hackerNewsAgent = new HackerNewsStack(this, 'HackerNewsAgent', {
      addCommonTags: addCommonTags,
    });

    this.supervisorAgent = new SupervisorStack(this, 'SupervisorAgent', {
      addCommonTags: addCommonTags,
      helloWorldAgentAlias: this.helloWorldAgent.agentAlias,
      timeAgentAlias: this.timeAgent.agentAlias  ,
      hackerNewsAgentAlias: this.hackerNewsAgent.agentAlias,
      knowledgeBaseAgentAlias: this.knowledgeBaseAgent.agentAlias,
      environment: props?.environment,
    });
  }
}
