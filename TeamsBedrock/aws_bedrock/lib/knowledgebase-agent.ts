import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodeLambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';
import { Construct } from 'constructs';
import { bedrock } from "@cdklabs/generative-ai-cdk-constructs";
import { NagSuppressions } from "cdk-nag";
import { CfnAgentAlias } from 'aws-cdk-lib/aws-bedrock';
import agentOptions from './agentOptions';
import util from './util';
import { CommonAgentProps } from './common-props';

export class KnowledgeBaseAgent extends Construct {
  public readonly agent: bedrock.Agent;
  // public readonly agentAlias: bedrock.AgentAlias;
  public readonly agentAlias: CfnAgentAlias;
  public readonly knowledgeBase: bedrock.VectorKnowledgeBase;
  public readonly dataSource: bedrock.S3DataSource;
  public readonly docBucket: s3.Bucket;
  public readonly syncLambda: lambda.Function;

  constructor(scope: Construct, id: string, props?: CommonAgentProps) {
    super(scope, id);

    const addCommonTags = props?.addCommonTags || ((construct: Construct) => {
      cdk.Tags.of(construct).add('Project', 'Bedrock');
      cdk.Tags.of(construct).add('Environment', props?.environment || 'Dev');
    });

    // Create access log bucket
    const accesslogBucket = new s3.Bucket(this, 'AccessLogs', {
      enforceSSL: true,
      versioned: true,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    NagSuppressions.addResourceSuppressions(accesslogBucket, [
      { id: 'AwsSolutions-S1', reason: 'There is no need to enable access logging for the AccessLogs bucket.' },
    ]);

    // Create document bucket
    this.docBucket = new s3.Bucket(this, 'DocBucket', {
      enforceSSL: true,
      versioned: true,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      serverAccessLogsBucket: accesslogBucket,
      serverAccessLogsPrefix: 'inputsAssetsBucketLogs/',
    });
    addCommonTags(this.docBucket);

    // Create a Bedrock Knowledge Base
    this.knowledgeBase = new bedrock.VectorKnowledgeBase(this, 'KB', {
      name: util.sanitizeName(`knowledgebaseEmbeddings-${props?.environment}`),
      embeddingsModel: bedrock.BedrockFoundationModel.TITAN_EMBED_TEXT_V1,
      instruction: 'You are an expert in GenAI and LLMs. You are given a question and you need to answer it based on the provided context.',
    });
    addCommonTags(this.knowledgeBase);

    // Create data source
    this.dataSource = new bedrock.S3DataSource(this, 'DataSource', {
      bucket: this.docBucket,
      knowledgeBase: this.knowledgeBase,
      dataSourceName: 'Documentation',
      chunkingStrategy: bedrock.ChunkingStrategy.fixedSize({
        maxTokens: 500,
        overlapPercentage: 20
      }),
    });
    addCommonTags(this.dataSource);

    // Create Lambda function for S3 event processing
    this.syncLambda = new lambda.Function(this, 'KnowledgeBaseSyncLambda', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'lambda.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/sync_bedrock_knowledgebase')),
      timeout: cdk.Duration.minutes(5),
      environment: {
        KNOWLEDGE_BASE_ID: this.knowledgeBase.knowledgeBaseId,
        DATA_SOURCE_ID: this.dataSource.dataSourceId,
      },
      description: 'Lambda function to automatically sync documents to Bedrock Knowledge Base when uploaded to S3',
    });
    addCommonTags(this.syncLambda);

    // Grant Lambda permissions to access Bedrock Knowledge Base operations
    this.syncLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock-agent:StartIngestionJob',
        'bedrock-agent:GetIngestionJob',
        'bedrock-agent:ListIngestionJobs',
        'bedrock-agent:GetKnowledgeBase',
        'bedrock-agent:GetDataSource',
        // Fallback permissions for regular bedrock service
        'bedrock:StartIngestionJob',
        'bedrock:GetIngestionJob',
        'bedrock:ListIngestionJobs'
      ],
      resources: ['*']
    }));

    // Grant additional Bedrock permissions for model operations
    this.syncLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
        'bedrock:ListFoundationModels',
        'bedrock:GetFoundationModel'
      ],
      resources: ['*']
    }));

    // Grant permissions for bedrock-agent-runtime service
    this.syncLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock-agent-runtime:InvokeAgent',
        'bedrock-agent-runtime:InvokeAgentAlias'
      ],
      resources: ['*']
    }));

    // Grant Lambda permissions to read from S3 bucket
    this.docBucket.grantRead(this.syncLambda);

    // Add S3 event trigger to the document bucket
    this.docBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(this.syncLambda),
      {
        prefix: '', // Trigger for all objects
        suffix: '.pdf' // Only trigger for PDF files (you can add more suffixes)
      }
    );

    // Add another trigger for other document types
    this.docBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(this.syncLambda),
      {
        prefix: '', // Trigger for all objects
        suffix: '.txt' // Trigger for text files
      }
    );

    this.docBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(this.syncLambda),
      {
        prefix: '', // Trigger for all objects
        suffix: '.docx' // Trigger for Word documents
      }
    );

    this.docBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(this.syncLambda),
      {
        prefix: '', // Trigger for all objects
        suffix: '.md' // Trigger for Markdown files
      }
    );

    // Deploy documentation
    const assetsPath = path.join(__dirname, '../docs/');
    const assetDoc = s3deploy.Source.asset(assetsPath);

    new s3deploy.BucketDeployment(this, 'DeployDocumentation', {
      sources: [assetDoc],
      destinationBucket: this.docBucket,
    });

    // Create the Bedrock Agent
    this.agent = new bedrock.Agent(this, 'kbAgent', {
      foundationModel: bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_HAIKU_V1_0,
      instruction: agentOptions.knowledgeBaseAgentOptions.instruction,
      knowledgeBases: [this.knowledgeBase],
      userInputEnabled: true,
      shouldPrepareAgent: true
    });
    addCommonTags(this.agent);

    // Agent Policy
    const bedrockAgentPolicyDocument = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          actions: ['bedrock:Invoke*'],
          resources: ['*'],
          effect: iam.Effect.ALLOW
        })
      ]
    });

    const bedrockAgentPolicy = new iam.Policy(this, 'BedrockAgentPolicy', {
      policyName: 'BedrockAgentPolicy',
      document: bedrockAgentPolicyDocument
    });
    addCommonTags(bedrockAgentPolicy);

    // Attach the policy
    this.agent.role.attachInlinePolicy(bedrockAgentPolicy);
    
    // Create Agent Alias
    const timestamp = util.timestamp;
    this.agentAlias = new CfnAgentAlias(this, 'kbAgentAlias', {
      agentId: this.agent.agentId,
      agentAliasName: util.sanitizeName(`knowledgebase-agent-alias-${timestamp}`)
    });
    addCommonTags(this.agentAlias);

    // Output the Lambda function ARN for reference
    new cdk.CfnOutput(this, 'KnowledgeBaseSyncLambdaArn', {
      value: this.syncLambda.functionArn,
      description: 'ARN of the Lambda function that syncs documents to Knowledge Base',
      exportName: 'KnowledgeBaseSyncLambdaArn',
    });

  }
}
