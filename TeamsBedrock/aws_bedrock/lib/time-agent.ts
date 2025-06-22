import { bedrock } from '@cdklabs/generative-ai-cdk-constructs';
import { Construct } from 'constructs';

import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodeLambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cdk from 'aws-cdk-lib';
import * as path from 'path';
import { CfnAgentAlias } from 'aws-cdk-lib/aws-bedrock';
import * as util from './util';
import { CommonAgentProps } from './common-props';

export class TimeStack extends Construct {
    public readonly agent: bedrock.Agent;
    public readonly agentAlias: CfnAgentAlias;

    constructor(scope: Construct, id: string, props?: CommonAgentProps) {
        super(scope, id);

        // constants
        const serviceName = 'TimeService';
        const metricNamespace = 'Time';

        this.agent = new bedrock.Agent(this, 'TimeAgent', {
            name: 'TimeAgent',
            description: 'The agent for getting current time information.',
            foundationModel: bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_HAIKU_V1_0,
            instruction: 'Please help our customers to get the current time.',
            shouldPrepareAgent: true,
            userInputEnabled: true,
        })
        props?.addCommonTags?.(this.agent);

        const timestamp = util.timestamp;

        this.agentAlias = new CfnAgentAlias(this, 'TimeAgentAlias', {
            agentId: this.agent.agentId,
            agentAliasName: util.sanitizeName(`TimeAgentAlias-${timestamp}`),
        });

        props?.addCommonTags?.(this.agentAlias);

        // add our lambda config
        const lambdaConfig = {
            LOG_LEVEL: 'DEBUG',
            POWERTOOLS_LOGGER_LOG_EVENT: 'true',
            POWERTOOLS_LOGGER_SAMPLE_RATE: '1',
            POWERTOOLS_TRACE_ENABLED: 'enabled',
            POWERTOOLS_TRACER_CAPTURE_HTTPS_REQUESTS: 'captureHTTPsRequests',
            POWERTOOLS_SERVICE_NAME: serviceName,
            POWERTOOLS_TRACER_CAPTURE_RESPONSE: 'captureResult',
            POWERTOOLS_METRICS_NAMESPACE: metricNamespace,
        };

        // create the lambda for the agent - this is the lambda that determines
        // what the prompt looks like with regards to mapping to the schema
        const actionGroupAgentLambda = new nodeLambda.NodejsFunction(
            this,
            'TimeAgentLambda',
            {
                runtime: lambda.Runtime.NODEJS_20_X,
                handler: 'handler',
                entry: path.join(
                    __dirname,
                    '../lambda/time/index.ts'
                ),
                timeout: cdk.Duration.seconds(60), // 60 seconds timeout
                environment: {
                    ...lambdaConfig,
                },
                bundling: util.bundleConfig,
            });
        actionGroupAgentLambda.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);
        props?.addCommonTags?.(actionGroupAgentLambda);

        const agentActionGroup = new bedrock.AgentActionGroup({
            name: 'TimeAgentActionGroup',
            description: 'The action group for getting current time.',
            executor: bedrock.ActionGroupExecutor.fromlambdaFunction(actionGroupAgentLambda),
            enabled: true,
            apiSchema: bedrock.ApiSchema.fromLocalAsset(
                path.join(__dirname, '../lambda/time/schema/api-schema.json')
            )
        })
        this.agent.addActionGroup(agentActionGroup);

        new cdk.CfnOutput(this, 'TimeAgentArnOutput', {
            value: this.agent.agentArn,
            exportName: 'TimeAgentArnOutput',
        });

        new cdk.CfnOutput(this, 'TimeAgentIdOutput', {
            value: this.agent.agentId,
            exportName: 'TimeAgentIdOutput',
        });

        new cdk.CfnOutput(this, 'TimeAgentAliasIdOutput', {
            value: this.agentAlias.attrAgentAliasId,
            exportName: 'TimeAgentAliasIdOutput',
        });
    }
}
