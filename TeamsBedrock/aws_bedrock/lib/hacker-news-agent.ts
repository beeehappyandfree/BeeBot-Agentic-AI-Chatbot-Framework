import { bedrock } from '@cdklabs/generative-ai-cdk-constructs';
import { CfnAgent, CfnAgentAlias } from 'aws-cdk-lib/aws-bedrock';
import { Construct } from 'constructs';

import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodeLambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cdk from 'aws-cdk-lib';
import * as path from 'path';
import * as util from './util';
import { CommonAgentProps } from './common-props';

export class HackerNewsStack extends Construct {
    public readonly agent: bedrock.Agent;
    // public readonly agentAlias: bedrock.AgentAlias;
    // public readonly agent: CfnAgent;
    public readonly agentAlias: CfnAgentAlias;

    constructor(scope: Construct, id: string, props?: CommonAgentProps) {
        super(scope, id);

        // constants
        const serviceName = 'HackerNewsService';
        const metricNamespace = 'HackerNews';

        this.agent = new bedrock.Agent(this, 'HackerNewsAgent', {
            name: 'HackerNewsAgent',
            description: 'The agent for fetching news from Hacker News.',
            foundationModel: bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_HAIKU_V1_0,
            instruction: 'Please help our customers to get news from Hacker News.',
            shouldPrepareAgent: true,
            userInputEnabled: true,
        })
        props?.addCommonTags?.(this.agent);

        const timestamp = util.timestamp;

        // this.agentAlias = new bedrock.AgentAlias(this, 'HackerNewsAgentAlias', {
        //     agent: this.agent,
        //     aliasName: `HackerNewsAgentAlias-${timestamp}`,
        // });

        this.agentAlias = new CfnAgentAlias(this, 'HackerNewsAgentAlias', {
            agentId: this.agent.agentId,
            agentAliasName: util.sanitizeName(`HackerNewsAgentAlias-${timestamp}`),
        });
        props?.addCommonTags?.(this.agentAlias);

        // create the lambda for the agent - this is the lambda that determines
        // what the prompt looks like with regards to mapping to the schema
        const actionGroupAgentLambda = new nodeLambda.NodejsFunction(
            this,
            'HackerNewsAgentLambda',
            {
                runtime: lambda.Runtime.NODEJS_20_X,
                handler: 'handler',
                entry: path.join(
                    __dirname,
                    '../lambda/hacker_news_agent/index.ts'
                ),
                timeout: cdk.Duration.seconds(60), // 60 seconds timeout
                environment: {
                    ...util.lambdaConfig(serviceName, metricNamespace),
                },
                bundling: util.bundleConfig,
            });
        actionGroupAgentLambda.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);
        props?.addCommonTags?.(actionGroupAgentLambda);

        const agentActionGroup = new bedrock.AgentActionGroup({
            name: 'HackerNewsAgentActionGroup',
            description: 'The action group for fetching news from Hacker News.',
            executor: bedrock.ActionGroupExecutor.fromlambdaFunction(actionGroupAgentLambda),
            enabled: true,
            apiSchema: bedrock.ApiSchema.fromLocalAsset(
                path.join(__dirname, '../lambda/hacker_news_agent/schema/api-schema.json')
            )
        })
        this.agent.addActionGroup(agentActionGroup);

        new cdk.CfnOutput(this, 'HackerNewsAgentArnOutput', {
            value: this.agent.agentArn,
            exportName: 'HackerNewsAgentArnOutput',
        });

        new cdk.CfnOutput(this, 'HackerNewsAgentIdOutput', {
            value: this.agent.agentId,
            exportName: 'HackerNewsAgentIdOutput',
        });

        new cdk.CfnOutput(this, 'HackerNewsAgentAliasIdOutput', {
            value: this.agentAlias.attrAgentAliasId,
            exportName: 'HackerNewsAgentAliasIdOutput',
        });
    }
}
