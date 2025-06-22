import { bedrock } from '@cdklabs/generative-ai-cdk-constructs';
import { Construct } from 'constructs';
import { AgentCollaboratorType } from '@cdklabs/generative-ai-cdk-constructs/lib/cdk-lib/bedrock/agents/agent-collaborator';
import { CfnAgent, CfnAgentAlias } from 'aws-cdk-lib/aws-bedrock';
import { Role, ServicePrincipal, PolicyStatement, PolicyDocument } from 'aws-cdk-lib/aws-iam';
import agentOptions, { supervisorAgentOptions } from './agentOptions';
import { CommonAgentProps } from './common-props';

import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';
import * as util from './util';


export interface SupervisorStackProps extends CommonAgentProps {
    helloWorldAgentAlias?: CfnAgentAlias;
    timeAgentAlias?: CfnAgentAlias;
    hackerNewsAgentAlias?: CfnAgentAlias;
    knowledgeBaseAgentAlias?: CfnAgentAlias;
}

export class SupervisorStack extends Construct {
    public readonly agent: CfnAgent;
    public readonly agentAlias: CfnAgentAlias;
    private readonly role: Role


    constructor(scope: Construct, id: string, props: SupervisorStackProps) {
        super(scope, id);

        // create the role for the agent
        this.role = new Role(this, 'SupervisorAgentRole', {
            assumedBy: new ServicePrincipal('bedrock.amazonaws.com'),
            description: 'The role for the supervisor agent',
        });

        this.role.addToPolicy(new PolicyStatement({
            actions: ['bedrock:*'],
            resources: ['*'],
        }));

        props.addCommonTags?.(this.role);

        const bedrockPolicyDocument = new iam.PolicyDocument({
            statements: [
                new PolicyStatement({
                    actions: ['bedrock:*'],
                    resources: ['*'],
                    effect: iam.Effect.ALLOW,
                })
            ]
        });

        const bedrockPolicy = new iam.Policy(this, 'BedrockPolicy', {
            policyName: 'BedrockPolicy',
            document: bedrockPolicyDocument,
        });

        bedrockPolicy.attachToRole(this.role);

        // Create the supervisor agent
        // this.agent = new bedrock.Agent(this, 'SupervisorAgent', {
        //     name: util.sanitizeName(`SupervisorAgent-${props.environment || 'Dev'}`),
        //     description: `${supervisorAgentOptions.description}`,
        //     foundationModel: bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_HAIKU_V1_0,
        //     instruction: `${supervisorAgentOptions.instruction}`,
        //     shouldPrepareAgent: true,
        //     userInputEnabled: true,
        //     agentCollaboration: AgentCollaboratorType.SUPERVISOR_ROUTER,
        //     agentCollaborators: [
        //         ...(props.helloWorldAgentAlias ? [
        //             new bedrock.AgentCollaborator({
        //                 agentAlias: props.helloWorldAgentAlias,
        //                 collaborationInstruction: `${agentOptions.helloWorldAgentOptions.instruction}`,
        //                 collaboratorName: `${agentOptions.helloWorldAgentOptions.name}`,
        //                 relayConversationHistory: true,
        //             })
        //         ] : []),
        //         ...(props.timeAgentAlias ? [
        //             new bedrock.AgentCollaborator({
        //                 agentAlias: props.timeAgentAlias,
        //                 collaborationInstruction: `${agentOptions.timeAgentOptions.instruction}`,
        //                 collaboratorName: `${agentOptions.timeAgentOptions.name}`,
        //                 relayConversationHistory: true,
        //             })
        //         ] : []),
        //         ...(props.hackerNewsAgentAlias ? [
        //             new bedrock.AgentCollaborator({
        //                 agentAlias: props.hackerNewsAgentAlias,
        //                 collaborationInstruction: `${agentOptions.hackerNewsAgentOptions.instruction}`,
        //                 collaboratorName: `${agentOptions.hackerNewsAgentOptions.name}`,
        //                 relayConversationHistory: true,
        //             })
        //         ] : []),
        //         ...(props.knowledgeBaseAgentAlias ? [
        //             new bedrock.AgentCollaborator({
        //                 agentAlias: props.knowledgeBaseAgentAlias,
        //                 collaborationInstruction: `${agentOptions.knowledgeBaseAgentOptions.instruction}`,
        //                 collaboratorName: `${agentOptions.knowledgeBaseAgentOptions.name}`,
        //                 relayConversationHistory: true,
        //             })
        //         ] : [])
        //     ],
        //     forceDelete: true,
        // });

        this.agent = new CfnAgent(this, 'SupervisorAgent', {
            agentName: util.sanitizeName(`SupervisorAgent-${props.environment}}`),
            description: 'A supervisor agent that coordinates and manages other agents.',
            foundationModel: bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_HAIKU_V1_0.modelId,
            instruction: supervisorAgentOptions.instruction,
            agentResourceRoleArn: this.role.roleArn,
            agentCollaboration: AgentCollaboratorType.SUPERVISOR_ROUTER,
            agentCollaborators: [
                {
                    agentDescriptor: {
                        aliasArn: props.helloWorldAgentAlias?.attrAgentAliasArn,
                    },
                    collaborationInstruction: agentOptions.helloWorldAgentOptions.instruction,
                    collaboratorName: util.sanitizeName(agentOptions.helloWorldAgentOptions.name),
                    relayConversationHistory: "TO_COLLABORATOR"
                },
                {
                    agentDescriptor: {
                        aliasArn: props.timeAgentAlias?.attrAgentAliasArn,
                    },
                    collaborationInstruction: agentOptions.timeAgentOptions.instruction,
                    collaboratorName: util.sanitizeName(agentOptions.timeAgentOptions.name),
                    relayConversationHistory: "TO_COLLABORATOR"
                },
                {
                    agentDescriptor: {
                        aliasArn: props.hackerNewsAgentAlias?.attrAgentAliasArn,
                    },
                    collaborationInstruction: agentOptions.hackerNewsAgentOptions.instruction,
                    collaboratorName: util.sanitizeName(agentOptions.hackerNewsAgentOptions.name),
                    relayConversationHistory: "TO_COLLABORATOR"
                },
                {
                    agentDescriptor: {
                        aliasArn: props.knowledgeBaseAgentAlias?.attrAgentAliasArn,
                    },
                    collaborationInstruction: agentOptions.knowledgeBaseAgentOptions.instruction,
                    collaboratorName: util.sanitizeName(agentOptions.knowledgeBaseAgentOptions.name),
                    relayConversationHistory: "TO_COLLABORATOR"
                }
            ]
        });
        
        props.addCommonTags?.(this.agent);

        // Create an alias for the agent
        const timestamp = util.timestamp;
        // this.agentAlias = new bedrock.AgentAlias(this, 'SupervisorAgentAlias', {
        //     agent: this.agent,
        //     aliasName: `SupervisorAgentAlias-${timestamp}`,
        // });
        this.agentAlias = new CfnAgentAlias(this, 'SupervisorAgentAlias', {
            agentId: this.agent.attrAgentId,
            agentAliasName: util.sanitizeName(`SupervisorAgentAlias-${timestamp}`),
        });
        props.addCommonTags?.(this.agentAlias);

        // Output the agent ARN
        new cdk.CfnOutput(this, 'SupervisorAgentArnOutput', {
            value: this.agent.attrAgentArn,
            exportName: 'SupervisorAgentArnOutput',
        });

        // Output the agent ID
        new cdk.CfnOutput(this, 'SupervisorAgentIdOutput', {
            value: this.agent.attrAgentId,
            exportName: 'SupervisorAgentIdOutput',
        });

        // Output the agent alias ID
        new cdk.CfnOutput(this, 'SupervisorAgentAliasIdOutput', {
            value: this.agentAlias.attrAgentAliasId,
            exportName: 'SupervisorAgentAliasIdOutput',
        });
    }
}
