import { bedrock } from '@cdklabs/generative-ai-cdk-constructs';
import { Construct } from 'constructs';
import { CfnAgentAlias } from 'aws-cdk-lib/aws-bedrock';

import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodeLambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cdk from 'aws-cdk-lib';
import * as path from 'path';
import util, { lambdaConfig } from './util';
import agentOptions from './agentOptions';
import { CommonAgentProps } from './common-props';

export interface HelloWorldStackProps {
    addCommonTags: (construct: Construct) => void;
}

export class HelloWorldStack extends Construct {
    public readonly agent: bedrock.Agent;
    // public readonly agentAlias: bedrock.AgentAlias;
    public readonly agentAlias: CfnAgentAlias;

    constructor(scope: Construct, id: string, props?: CommonAgentProps) {
        super(scope, id);

        // constants
        const serviceName = 'HelloWorldService';
        const metricNamespace = 'HelloWorld';

        this.agent = new bedrock.Agent(this, 'HelloWorldAgent', {
            name: agentOptions.helloWorldAgentOptions.name,
            description: agentOptions.helloWorldAgentOptions.description,
            foundationModel: bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_HAIKU_V1_0,
            instruction: agentOptions.helloWorldAgentOptions.instruction,
            shouldPrepareAgent: true,
            userInputEnabled: true,
        })
        props?.addCommonTags?.(this.agent);

        const timestamp = util.timestamp;
        this.agentAlias = new CfnAgentAlias(this, 'HelloWorldAgentAlias', {
            agentId: this.agent.agentId,
            agentAliasName: util.sanitizeName(`HelloWorldAgentAlias-${timestamp}`),
        });
        props?.addCommonTags?.(this.agentAlias);

        // create the lambda for the agent - this is the lambda that determines
        // what the prompt looks like with regards to mapping to the schema
        const actionGroupAgentLambda = new nodeLambda.NodejsFunction(
            this,
            'HelloWorldAgentLambda',
            {
                runtime: lambda.Runtime.NODEJS_20_X,
                handler: 'handler',
                entry: path.join(
                    __dirname,
                    '../lambda/helloWorld_agent/index.ts'
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
            name: 'HelloWorldAgentActionGroup',
            description: 'The action group for Hello World.',
            executor: bedrock.ActionGroupExecutor.fromlambdaFunction(actionGroupAgentLambda),
            enabled: true,
            apiSchema: bedrock.ApiSchema.fromLocalAsset(
                path.join(__dirname, '../lambda/helloWorld_agent/schema/api-schema.json')
            )
        })
        this.agent.addActionGroup(agentActionGroup);

        new cdk.CfnOutput(this, 'HelloWorldAgentArnOutput', {
            value: this.agent.agentArn,
            exportName: 'HelloWorldAgentArnOutput',
        });

        new cdk.CfnOutput(this, 'HelloWorldAgentIdOutput', {
            value: this.agent.agentId,
            exportName: 'HelloWorldAgentIdOutput',
        });

        new cdk.CfnOutput(this, 'HelloWorldAgentAliasIdOutput', {
            value: this.agentAlias.attrAgentAliasId,
            exportName: 'HelloWorldAgentAliasIdOutput',
        });
    }
}